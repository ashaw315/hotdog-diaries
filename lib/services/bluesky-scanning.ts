import { ContentProcessor, contentProcessor } from './content-processor'
import { logToDatabase, db } from '@/lib/db'
import { LogLevel } from '@/types'

export interface BlueskyPost {
  uri: string
  cid: string
  author: {
    did: string
    handle: string
    displayName?: string
  }
  record: {
    text: string
    createdAt: string
    embed?: {
      $type: string
      images?: Array<{
        alt: string
        image: {
          $type: string
          ref: {
            $link: string
          }
          mimeType: string
          size: number
        }
      }>
      video?: {
        alt: string
        video: {
          $type: string
          ref: {
            $link: string
          }
          mimeType: string
          size: number
        }
        playlist?: string
        thumbnail?: string
      }
      external?: {
        uri: string
        title: string
        description: string
        thumb?: string
      }
    }
  }
  replyCount: number
  repostCount: number
  likeCount: number
  indexedAt: string
}

export interface BlueskyFeed {
  feed: BlueskyPost[]
  cursor?: string
}

export interface BlueskyStats {
  totalPostsFound: number
  postsProcessed: number
  postsApproved: number
  postsRejected: number
  lastScanTime?: Date
  nextScanTime?: Date
  successRate: number
}

interface BlueskyAuthSession {
  accessJwt: string
  refreshJwt: string
  handle: string
  did: string
}

export class BlueskyService {
  private readonly baseUrl = 'https://bsky.social/xrpc'
  private session: BlueskyAuthSession | null = null
  private readonly searchTerms = [
    'hotdog', 'hot dog', 'hot-dog', 
    'sausage', 'frankfurter', 'wiener', 'bratwurst',
    'corn dog', 'chili dog'
  ]

  /**
   * Authenticate with Bluesky using identifier and app password
   */
  private async authenticate(): Promise<BlueskyAuthSession> {
    const identifier = process.env.BLUESKY_IDENTIFIER
    const password = process.env.BLUESKY_APP_PASSWORD

    if (!identifier || !password) {
      throw new Error('Missing BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD in environment variables')
    }

    console.log(`[BLUESKY] Authenticating as ${identifier}...`)

    const response = await fetch(`${this.baseUrl}/com.atproto.server.createSession`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HotdogDiaries/1.0'
      },
      body: JSON.stringify({
        identifier,
        password
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Authentication failed: ${response.status} ${error}`)
    }

    const session = await response.json()
    console.log(`[BLUESKY] Authenticated successfully as @${session.handle}`)
    
    this.session = session
    return session
  }

  /**
   * Ensure we have a valid session
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.session) {
      await this.authenticate()
    }
  }

  async performScan(options?: { maxPosts?: number }): Promise<{
    totalFound: number
    processed: number
    approved: number
    rejected: number
    duplicates: number
    errors: number
  }> {
    const maxPosts = options?.maxPosts || 20
    const startTime = Date.now()
    
    try {
      await logToDatabase(
        LogLevel.INFO,
        'BLUESKY_SCAN_STARTED',
        'Starting Bluesky content scan',
        { maxPosts, searchTerms: this.searchTerms }
      )

      let totalFound = 0
      let processed = 0
      let approved = 0
      let rejected = 0
      let duplicates = 0
      let errors = 0

      // Search for hotdog content using multiple terms
      for (const term of this.searchTerms) {
        try {
          const posts = await this.searchPosts(term, Math.ceil(maxPosts / this.searchTerms.length))
          console.log(`🔍 Found ${posts.length} posts for term "${term}"`)
          
          totalFound += posts.length

          for (const post of posts) {
            try {
              // Check if we already have this content
              const existingContent = await this.checkForExistingContent(post.uri)
              if (existingContent) {
                duplicates++
                continue
              }

              // Process the post
              const contentId = await this.savePostToQueue(post)
              if (contentId) {
                // Process with content processor
                const result = await contentProcessor.processContent(contentId, {
                  autoApprovalThreshold: 0.6, // Lower threshold for Bluesky
                  autoRejectionThreshold: 0.2
                })

                processed++
                if (result.action === 'approved') {
                  approved++
                } else if (result.action === 'rejected') {
                  rejected++
                }

                console.log(`✅ Processed Bluesky post: ${result.action} (confidence: ${result.analysis.confidence_score})`)
              }
            } catch (error) {
              console.error('Error processing individual post:', error)
              errors++
            }
          }

          // Small delay between search terms to be respectful
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`Error searching for term "${term}":`, error)
          errors++
        }
      }

      const duration = Date.now() - startTime
      await logToDatabase(
        LogLevel.INFO,
        'BLUESKY_SCAN_COMPLETED',
        'Bluesky content scan completed',
        { 
          totalFound, 
          processed, 
          approved, 
          rejected, 
          duplicates, 
          errors, 
          duration,
          successRate: processed > 0 ? (approved / processed) : 0
        }
      )

      return { totalFound, processed, approved, rejected, duplicates, errors }

    } catch (error) {
      const duration = Date.now() - startTime
      await logToDatabase(
        LogLevel.ERROR,
        'BLUESKY_SCAN_ERROR',
        `Bluesky scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : 'Unknown error', duration }
      )
      throw error
    }
  }

  private async searchPosts(query: string, limit: number = 20): Promise<BlueskyPost[]> {
    try {
      await this.ensureAuthenticated()
      
      const url = `${this.baseUrl}/app.bsky.feed.searchPosts`
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        sort: 'latest'
      })

      console.log(`🔍 Searching Bluesky for: "${query}" (limit: ${limit})`)
      
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.session!.accessJwt}`,
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Bluesky API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Filter posts to only include those with hotdog-related content
      const relevantPosts = (data.posts || []).filter((post: BlueskyPost) => {
        const text = post.record.text.toLowerCase()
        return this.searchTerms.some(term => text.includes(term.toLowerCase()))
      })

      console.log(`📝 Found ${relevantPosts.length} relevant posts out of ${data.posts?.length || 0} total`)
      return relevantPosts

    } catch (error) {
      console.error(`Error searching Bluesky posts for "${query}":`, error)
      return []
    }
  }

  private async savePostToQueue(post: BlueskyPost): Promise<number | null> {
    try {
      // Convert AT Protocol URI to web URL
      const webUrl = this.convertAtUriToWebUrl(post.uri)
      
      // Determine content type and extract media URLs
      let contentType = 'text'
      let imageUrl: string | undefined
      let videoUrl: string | undefined
      let videoThumbnail: string | undefined
      
      if (post.record.embed) {
        if (post.record.embed.images && post.record.embed.images.length > 0) {
          contentType = 'image'
          // Convert blob reference to actual URL
          imageUrl = this.convertBlobToUrl(post.record.embed.images[0].image.ref.$link, post.author.did)
        }
        
        if (post.record.embed.video) {
          contentType = 'video'
          videoUrl = post.record.embed.video.playlist || this.convertBlobToUrl(post.record.embed.video.video.ref.$link, post.author.did)
          videoThumbnail = post.record.embed.video.thumbnail
        }
        
        if (post.record.embed.images && post.record.embed.video) {
          contentType = 'mixed'
        }
      }

      // Add video indicator for video content
      let contentText = post.record.text
      if (contentType === 'video' || contentType === 'mixed') {
        contentText = `🎥 ${contentText}`
      }

      // Generate content hash for duplicate detection
      const hashInput = `${post.uri}|${contentText}|${imageUrl || ''}|${videoUrl || ''}`
      const contentHash = require('crypto').createHash('sha256').update(hashInput).digest('hex')

      const result = await db.query(
        `INSERT INTO content_queue (
          content_text, content_image_url, content_video_url, content_type, 
          source_platform, original_url, original_author, content_hash, 
          scraped_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW()) 
        RETURNING id`,
        [
          contentText,
          imageUrl,
          videoUrl,
          contentType,
          'bluesky',
          webUrl,
          `${post.author.displayName || post.author.handle} (@${post.author.handle})`,
          contentHash
        ]
      )

      const contentId = result.rows[0]?.id
      if (contentId) {
        console.log(`💾 Saved Bluesky post to queue: ID ${contentId} (${contentType})`)
        
        // Log additional metadata
        await logToDatabase(
          LogLevel.INFO,
          'BLUESKY_CONTENT_SAVED',
          'Saved Bluesky post to content queue',
          {
            contentId,
            authorHandle: post.author.handle,
            contentType,
            hasImage: !!imageUrl,
            hasVideo: !!videoUrl,
            postUri: post.uri,
            likes: post.likeCount,
            reposts: post.repostCount
          }
        )
      }

      return contentId

    } catch (error) {
      console.error('Error saving Bluesky post to queue:', error)
      await logToDatabase(
        LogLevel.ERROR,
        'BLUESKY_SAVE_ERROR',
        `Failed to save Bluesky post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          postUri: post.uri, 
          authorHandle: post.author.handle,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      )
      return null
    }
  }

  private async checkForExistingContent(uri: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT id FROM content_queue WHERE original_url = $1 LIMIT 1',
        [this.convertAtUriToWebUrl(uri)]
      )
      return result.rows.length > 0
    } catch (error) {
      console.error('Error checking for existing content:', error)
      return false
    }
  }

  private convertAtUriToWebUrl(atUri: string): string {
    try {
      // AT Protocol URI format: at://did:plc:xxx/app.bsky.feed.post/xxx
      const match = atUri.match(/at:\/\/(did:plc:[^\/]+)\/app\.bsky\.feed\.post\/(.+)/)
      if (match) {
        const [, did, postId] = match
        // We need to get the handle for the URL, but for now use a placeholder
        return `https://bsky.app/profile/${did}/post/${postId}`
      }
      return atUri // fallback to original URI
    } catch (error) {
      console.error('Error converting AT URI to web URL:', error)
      return atUri
    }
  }

  private convertBlobToUrl(blobRef: string, authorDid: string): string {
    // Convert blob reference to actual URL
    return `${this.baseUrl}/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${blobRef}`
  }

  async getScanningStats(): Promise<BlueskyStats> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_posts,
          COUNT(*) FILTER (WHERE content_status = 'approved') as approved_posts,
          COUNT(*) FILTER (WHERE content_status = 'rejected') as rejected_posts,
          MAX(scraped_at) as last_scan_time
        FROM content_queue 
        WHERE source_platform = 'bluesky'
        AND scraped_at >= NOW() - INTERVAL '24 hours'
      `)

      const stats = result.rows[0]
      const totalPosts = parseInt(stats.total_posts) || 0
      const approvedPosts = parseInt(stats.approved_posts) || 0
      const rejectedPosts = parseInt(stats.rejected_posts) || 0
      
      return {
        totalPostsFound: totalPosts,
        postsProcessed: totalPosts,
        postsApproved: approvedPosts,
        postsRejected: rejectedPosts,
        lastScanTime: stats.last_scan_time || undefined,
        nextScanTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        successRate: totalPosts > 0 ? approvedPosts / totalPosts : 0
      }
    } catch (error) {
      console.error('Error getting Bluesky scanning stats:', error)
      return {
        totalPostsFound: 0,
        postsProcessed: 0,
        postsApproved: 0,
        postsRejected: 0,
        successRate: 0
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🔗 Testing Bluesky API connection with authentication...')
      
      // Test authentication first
      await this.ensureAuthenticated()
      
      // Test with a simple authenticated search
      const testPosts = await this.searchPosts('test', 1)
      
      return {
        success: true,
        message: `Successfully connected to Bluesky as @${this.session!.handle}`,
        details: {
          handle: this.session!.handle,
          did: this.session!.did,
          testPostsFound: testPosts.length
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Bluesky connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  async getScanConfig(): Promise<{
    isEnabled: boolean
    scanInterval: number
    lastScanTime?: Date
    nextScanTime?: Date
    searchTerms: string[]
  }> {
    try {
      const stats = await this.getScanningStats()
      
      const hasCredentials = !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD)
      
      return {
        isEnabled: hasCredentials, // Bluesky requires authentication now
        scanInterval: 4 * 60 * 60 * 1000, // 4 hours
        lastScanTime: stats.lastScanTime,
        nextScanTime: stats.nextScanTime,
        searchTerms: this.searchTerms
      }
    } catch (error) {
      console.error('Error getting Bluesky scan config:', error)
      return {
        isEnabled: false,
        scanInterval: 4 * 60 * 60 * 1000,
        searchTerms: this.searchTerms
      }
    }
  }

  async startAutomatedScanning(): Promise<void> {
    try {
      await logToDatabase(
        LogLevel.INFO,
        'BLUESKY_AUTO_SCAN_STARTED',
        'Starting automated Bluesky scanning'
      )

      // Perform a scan
      await this.performScan({ maxPosts: 30 })
      
      console.log('✅ Bluesky automated scanning started successfully')
    } catch (error) {
      console.error('Error starting Bluesky automated scanning:', error)
      await logToDatabase(
        LogLevel.ERROR,
        'BLUESKY_AUTO_SCAN_ERROR',
        `Failed to start automated Bluesky scanning: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }
}

export const blueskyService = new BlueskyService()

// Export as BlueskyScanningService for compatibility with scanning-scheduler
export { BlueskyService as BlueskyScanningService }