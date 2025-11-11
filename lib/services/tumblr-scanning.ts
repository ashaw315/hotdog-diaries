import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { createSimpleClient } from '@/utils/supabase/server'

export interface TumblrPhoto {
  caption: string
  original_size: {
    url: string
    width: number
    height: number
  }
  alt_sizes: Array<{
    url: string
    width: number
    height: number
  }>
}

export interface TumblrPost {
  type: 'text' | 'photo' | 'quote' | 'link' | 'chat' | 'video' | 'audio'
  blog_name: string
  id: number
  post_url: string
  slug: string
  date: string
  timestamp: number
  state: string
  format: string
  reblog_key: string
  tags: string[]
  short_url: string
  summary: string
  recommended_source?: string
  recommended_color?: string
  note_count: number
  title?: string
  body?: string
  photos?: TumblrPhoto[]
  caption?: string
  trail?: any[]
}

export interface TumblrTaggedResponse {
  meta: {
    status: number
    msg: string
  }
  response: TumblrPost[]
}

export interface ProcessedTumblrPost {
  id: string
  title: string
  description: string
  imageUrl?: string
  videoUrl?: string
  contentType?: 'text' | 'image' | 'video'
  author: string
  postUrl: string
  tags: string[]
  noteCount: number
  published: Date
}

export interface TumblrScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxPostsPerScan: number
  searchTags: string[]
  minNotes: number
  lastScanTime?: Date
}

export interface TumblrPerformScanOptions {
  maxPosts: number
}

export interface TumblrPerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

export class TumblrScanningService {
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private isScanning = false

  constructor() {
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
  }

  /**
   * Extract image URL from Tumblr's HTML content
   */
  private extractImageFromHTML(html: string): string | null {
    if (!html) return null
    
    // Look for img src in the HTML
    const imgMatch = html.match(/<img[^>]+src="([^"]+)"/i)
    if (imgMatch) {
      // Get the URL and remove any srcset parameters
      const url = imgMatch[1]
      // Return the base URL without size parameters
      return url.split(' ')[0]
    }
    
    // Also check for data-orig-src which Tumblr sometimes uses
    const dataOrigMatch = html.match(/data-orig-src="([^"]+)"/i)
    if (dataOrigMatch) {
      return dataOrigMatch[1]
    }
    
    return null
  }

  /**
   * Clean HTML from text content
   */
  private stripHTML(html: string): string {
    if (!html) return ''
    
    // Remove all HTML tags
    let text = html.replace(/<[^>]*>/g, ' ')
    
    // Decode HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
    
    // Clean up extra whitespace
    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * Perform a single scan with options
   */
  async performScan(options: TumblrPerformScanOptions): Promise<TumblrPerformScanResult> {
    try {
      // Get scan configuration
      const config = await this.getScanConfig()

      // Check if Tumblr API is available
      const apiKey = process.env.TUMBLR_API_KEY

      if (!apiKey) {
        console.warn('⚠️  TUMBLR: API key not configured, using mock data')
        return this.performMockScan(options)
      }

      const maxPosts = Math.min(options.maxPosts, config?.maxPostsPerScan || 30)
      const result: TumblrPerformScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: []
      }

      // Search for hotdog content using different tags
      const allPosts: ProcessedTumblrPost[] = []
      
      for (const tag of config.searchTags.slice(0, 3)) { // Limit tags
        try {
          const posts = await this.searchTagged(tag, Math.ceil(maxPosts / config.searchTags.length))
          allPosts.push(...posts)
          
          await logToDatabase(
            LogLevel.INFO,
            'TUMBLR_SEARCH_SUCCESS',
            `Found ${posts.length} posts for tag: ${tag}`,
            { tag, postsFound: posts.length }
          )
        } catch (searchError) {
          const errorMessage = searchError instanceof Error ? searchError.message : 'Unknown search error'
          result.errors.push(`Search error for tag "${tag}": ${errorMessage}`)
          await logToDatabase(
            LogLevel.ERROR,
            'TUMBLR_SEARCH_ERROR',
            `Error searching for tag "${tag}": ${errorMessage}`,
            { tag, error: errorMessage }
          )
        }
      }

      // Deduplicate and limit
      const uniquePosts = Array.from(
        new Map(allPosts.map(post => [post.id, post])).values()
      ).slice(0, maxPosts)

      result.totalFound = uniquePosts.length

      // Process each post
      for (const post of uniquePosts) {
        try {
          // Apply content filtering
          const contentAnalysis = await this.filteringService.isValidHotdogContent({
            text: `${post.title} ${post.description} ${post.tags.join(' ')}`.trim(),
            url: post.imageUrl || post.postUrl,
            metadata: {
              author: post.author,
              noteCount: post.noteCount,
              tags: post.tags
            }
          })

          if (!contentAnalysis.is_valid_hotdog) {
            console.log(`Tumblr post ${post.id} rejected by filter: ${contentAnalysis.reason} (confidence: ${contentAnalysis.confidence})`)
            result.rejected++
            continue
          }

          // Prepare content data with proper media handling
          const contentForHash = {
            content_text: `${post.title} ${post.description}`.trim(),
            content_image_url: post.imageUrl || null,
            content_video_url: post.videoUrl || null,
            original_url: post.postUrl
          }

          // Determine content type based on available media
          let contentType: 'text' | 'image' | 'video' = 'text'
          if (post.videoUrl) {
            contentType = 'video'
          } else if (post.imageUrl) {
            contentType = 'image'
          } else if (post.contentType) {
            contentType = post.contentType
          }

          const contentData = {
            content_text: `${post.title} ${post.description}`.trim(),
            content_image_url: post.imageUrl || null,
            content_video_url: post.videoUrl || null,
            content_type: contentType,
            source_platform: 'tumblr' as const,
            original_url: post.postUrl,
            original_author: `@${post.author} on Tumblr`,
            scraped_at: new Date().toISOString(),
            content_hash: this.contentProcessor.generateContentHash(contentForHash),
            content_status: 'discovered',
            is_approved: false,
            is_rejected: false,
            is_posted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          // Use Supabase client (same pattern as Bluesky and other working scanners)
          const supabase = createSimpleClient()

          const { data, error } = await supabase
            .from('content_queue')
            .insert(contentData)
            .select('id')
            .single()

          if (error) {
            throw error
          }

          if (!data?.id) {
            throw new Error('Insert returned no ID')
          }

          const contentId = data.id

          // Process the content
          const processingResult = await this.contentProcessor.processContent(contentId, {
            autoApprovalThreshold: 0.6, // Lowered to match other platforms
            autoRejectionThreshold: 0.2,
            enableDuplicateDetection: true
          })

          console.log(`Tumblr post ${post.id}: ${processingResult.action} (score: ${processingResult.confidenceScore})`)

          if (processingResult.success && processingResult.action === 'approved') {
            result.approved++
          } else if (processingResult.action === 'duplicate') {
            result.duplicates++
          } else {
            result.rejected++
          }
          result.processed++

        } catch (postError) {
          const errorMessage = postError instanceof Error
            ? postError.message
            : typeof postError === 'string'
              ? postError
              : JSON.stringify(postError)
          result.errors.push(`Post processing error: ${errorMessage}`)
          console.error('Tumblr post processing error:', postError)
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'TUMBLR_SCAN_COMPLETED',
        `Tumblr scan completed: ${result.processed} processed, ${result.approved} approved`,
        { scanId: `tumblr_scan_${Date.now()}`, ...result }
      )

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Search Tumblr tagged posts
   */
  private async searchTagged(tag: string, limit: number): Promise<ProcessedTumblrPost[]> {
    const apiKey = process.env.TUMBLR_API_KEY
    if (!apiKey) {
      throw new Error('Tumblr API key not configured')
    }

    const url = `https://api.tumblr.com/v2/tagged?tag=${encodeURIComponent(tag)}&api_key=${apiKey}&limit=${Math.min(limit, 20)}`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HotdogDiaries/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Tumblr API error: ${response.status} ${response.statusText}`)
    }

    const data: TumblrTaggedResponse = await response.json()

    if (data.meta.status !== 200) {
      throw new Error(`Tumblr API error: ${data.meta.msg}`)
    }

    return data.response
      .filter(post => post.note_count >= 0) // Basic filter
      .map(post => {
        let imageUrl: string | undefined
        let videoUrl: string | undefined
        let title = post.title || ''
        let description = post.summary || post.body || post.caption || ''
        let contentType: 'text' | 'image' | 'video' = 'text'

        // Extract image URL for photo posts
        if (post.type === 'photo' && post.photos && post.photos.length > 0) {
          imageUrl = post.photos[0].original_size.url
          contentType = 'image'
          if (!description && post.photos[0].caption) {
            description = post.photos[0].caption
          }
        }
        // Extract image from text posts with embedded images
        else if (post.type === 'text' && post.body) {
          const extractedImage = this.extractImageFromHTML(post.body)
          if (extractedImage) {
            imageUrl = extractedImage
            contentType = 'image'
          }
          // Clean the HTML from description
          description = this.stripHTML(post.body).substring(0, 500)
        }
        // Handle video posts
        else if (post.type === 'video') {
          contentType = 'video'
          // @ts-ignore - video_url might exist on video posts
          if (post.video_url) {
            // @ts-ignore
            videoUrl = post.video_url
          }
          // @ts-ignore - player might exist
          else if (post.player && Array.isArray(post.player) && post.player[0]) {
            // Extract video URL from player embed
            // @ts-ignore
            const playerHtml = post.player[0].embed_code
            const videoMatch = playerHtml.match(/src="([^"]+)"/i)
            if (videoMatch) {
              videoUrl = videoMatch[1]
            }
          }
        }

        // Clean up the description if it contains HTML
        if (description && description.includes('<')) {
          description = this.stripHTML(description)
        }

        // For text posts, use the cleaned body as title if no title
        if (post.type === 'text' && !title && description) {
          title = description.substring(0, 100)
          if (title.length === 100) title += '...'
        }

        return {
          id: post.id.toString(),
          title: title || 'Untitled',
          description: description || '',
          imageUrl,
          videoUrl,
          contentType,
          author: post.blog_name,
          postUrl: post.post_url,
          tags: post.tags || [],
          noteCount: post.note_count || 0,
          published: new Date(post.timestamp * 1000)
        }
      })
  }

  /**
   * Perform a mock scan for testing without API key
   */
  private async performMockScan(options: TumblrPerformScanOptions): Promise<TumblrPerformScanResult> {
    const mockPosts: ProcessedTumblrPost[] = [
      {
        id: 'mock_tumblr_1',
        title: 'Aesthetic Hotdog Photography',
        description: 'Just a beautiful Chicago-style hotdog shot with vintage film camera. The colors are so dreamy! #hotdog #foodphotography #aesthetic',
        imageUrl: 'https://example.com/tumblr-hotdog1.jpg',
        author: 'foodie-aesthetic',
        postUrl: 'https://foodie-aesthetic.tumblr.com/post/123456789',
        tags: ['hotdog', 'foodphotography', 'aesthetic', 'chicago'],
        noteCount: 247,
        published: new Date()
      },
      {
        id: 'mock_tumblr_2',
        title: '',
        description: 'me: I should eat healthy\nalso me: *orders 3 hotdogs at 2am*\n\nwhy am I like this',
        imageUrl: undefined,
        author: 'chaotic-millennial',
        postUrl: 'https://chaotic-millennial.tumblr.com/post/987654321',
        tags: ['hotdog', 'relatable', 'foodblog', 'midnight snacks'],
        noteCount: 1520,
        published: new Date()
      },
      {
        id: 'mock_tumblr_3',
        title: 'DIY Galaxy Hotdog',
        description: 'I made a galaxy-themed hotdog for my art project! Used food coloring and edible glitter. It tastes better than it looks (which is saying something because it looks amazing)',
        imageUrl: 'https://example.com/tumblr-galaxy-hotdog.jpg',
        author: 'creative-foodart',
        postUrl: 'https://creative-foodart.tumblr.com/post/456789123',
        tags: ['hotdog', 'food art', 'galaxy', 'diy', 'creative'],
        noteCount: 892,
        published: new Date()
      }
    ]

    const result: TumblrPerformScanResult = {
      totalFound: mockPosts.length,
      processed: 0,
      approved: 0,
      rejected: 0,
      duplicates: 0,
      errors: []
    }

    // Process mock posts
    for (const post of mockPosts.slice(0, options.maxPosts)) {
      try {
        const contentData = {
          content_text: `${post.title} ${post.description}`.trim(),
          content_image_url: post.imageUrl || null,
          content_video_url: null,
          content_type: post.imageUrl ? 'image' as const : 'text' as const,
          source_platform: 'tumblr' as const,
          original_url: post.postUrl,
          original_author: `@${post.author} on Tumblr`,
          scraped_at: new Date().toISOString(),
          content_hash: this.contentProcessor.generateContentHash({
            content_text: `${post.title} ${post.description}`.trim(),
            content_image_url: post.imageUrl || null,
            content_video_url: null,
            original_url: post.postUrl
          }),
          content_status: 'discovered',
          is_approved: false,
          is_rejected: false,
          is_posted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const supabase = createSimpleClient()

        const { data, error } = await supabase
          .from('content_queue')
          .insert(contentData)
          .select('id')
          .single()

        if (error) {
          throw error
        }

        if (!data?.id) {
          throw new Error('Insert returned no ID')
        }

        const contentId = data.id

        const processingResult = await this.contentProcessor.processContent(contentId, {
          autoApprovalThreshold: 0.7,
          autoRejectionThreshold: 0.2,
          enableDuplicateDetection: true
        })

        if (processingResult.success && processingResult.action === 'approved') {
          result.approved++
        } else if (processingResult.action === 'duplicate') {
          result.duplicates++
        } else {
          result.rejected++
        }
        result.processed++

      } catch (error) {
        result.errors.push(`Mock post error: ${error.message}`)
      }
    }

    return result
  }

  /**
   * Test connection to Tumblr API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const apiKey = process.env.TUMBLR_API_KEY
      
      if (!apiKey) {
        return {
          success: true,
          message: 'No Tumblr API key configured, will use mock data',
          details: { mockMode: true }
        }
      }

      // Try a simple tag search to test the connection
      const testPosts = await this.searchTagged('hotdog', 1)

      return {
        success: true,
        message: `Tumblr connection successful. Found ${testPosts.length} test results.`,
        details: {
          testResultsCount: testPosts.length,
          hasApiKey: true
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Connection test failed: ${errorMessage}`,
        details: { error: errorMessage }
      }
    }
  }

  /**
   * Get or create scan configuration
   */
  async getScanConfig(): Promise<TumblrScanConfig> {
    return {
      isEnabled: true,
      scanInterval: 360, // 6 hours (Tumblr has stricter rate limits)
      maxPostsPerScan: 20,
      searchTags: ['hotdog', 'hot dog', 'food photography', 'food blog'],
      minNotes: 5
    }
  }
}

export const tumblrScanningService = new TumblrScanningService()