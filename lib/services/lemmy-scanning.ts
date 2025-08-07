import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface LemmyPostData {
  id: number
  name: string // title
  body?: string // description
  url?: string // might be image URL
  thumbnail_url?: string // preview image
  ap_id: string // unique ActivityPub ID/URL
  published: string // ISO date
  creator_id: number
  community_id: number
}

export interface LemmyPost {
  post: LemmyPostData
  creator: {
    id: number
    name: string
    display_name?: string
  }
  community: {
    id: number
    name: string
    title: string
  }
  counts: {
    post_id: number
    score: number
    upvotes: number
    downvotes: number
    comments: number
  }
}

export interface LemmySearchResponse {
  type_: string
  comments: any[]
  posts: LemmyPost[]
  communities: any[]
  users: any[]
}

export interface ProcessedLemmyPost {
  id: string
  title: string
  description: string
  imageUrl?: string
  thumbnailUrl?: string
  author: string
  community: string
  postUrl: string
  score: number
  published: Date
}

export interface LemmyScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxPostsPerScan: number
  searchTerms: string[]
  minScore: number
  instances: string[] // Different Lemmy instances to search
  lastScanTime?: Date
}

export interface LemmyPerformScanOptions {
  maxPosts: number
}

export interface LemmyPerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

export class LemmyScanningService {
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private isScanning = false

  constructor() {
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
  }

  /**
   * Perform a single scan with options
   */
  async performScan(options: LemmyPerformScanOptions): Promise<LemmyPerformScanResult> {
    try {
      // Get scan configuration
      const config = await this.getScanConfig()

      const maxPosts = Math.min(options.maxPosts, config?.maxPostsPerScan || 30)
      const result: LemmyPerformScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: []
      }

      // Search for hotdog content across multiple instances
      const allPosts: ProcessedLemmyPost[] = []
      
      for (const instance of config.instances) {
        for (const searchTerm of config.searchTerms.slice(0, 2)) { // Limit search terms per instance
          try {
            const posts = await this.searchPosts(instance, searchTerm, Math.ceil(maxPosts / config.instances.length))
            allPosts.push(...posts)
            
            await logToDatabase(
              LogLevel.INFO,
              'LEMMY_SEARCH_SUCCESS',
              `Found ${posts.length} posts from ${instance} for term: ${searchTerm}`,
              { instance, searchTerm, postsFound: posts.length }
            )
          } catch (searchError) {
            const errorMessage = searchError instanceof Error ? searchError.message : 'Unknown search error'
            result.errors.push(`${instance} search error: ${errorMessage}`)
            await logToDatabase(
              LogLevel.ERROR,
              'LEMMY_INSTANCE_SEARCH_ERROR',
              `Error searching ${instance}: ${errorMessage}`,
              { instance, searchTerm, error: errorMessage }
            )
          }
        }
      }

      // Deduplicate posts by ap_id and limit to maxPosts
      const uniquePosts = Array.from(
        new Map(allPosts.map(post => [post.postUrl, post])).values()
      ).slice(0, maxPosts)

      result.totalFound = uniquePosts.length

      // Process each post
      for (const post of uniquePosts) {
        try {
          // Apply content filtering
          const contentText = `${post.title} ${post.description}`.trim()
          const contentAnalysis = await this.filteringService.isValidHotdogContent({
            text: contentText,
            url: post.imageUrl || post.postUrl,
            metadata: {
              author: post.author,
              community: post.community,
              score: post.score
            }
          })

          if (!contentAnalysis.is_valid_hotdog) {
            result.rejected++
            await logToDatabase(
              LogLevel.DEBUG,
              'LEMMY_POST_VALIDATION_FAILED',
              `Post validation failed: ${post.title}`,
              { title: post.title, postId: post.id }
            )
            continue
          }

          // Determine content type
          const hasImage = !!(post.imageUrl || post.thumbnailUrl)
          const contentType = hasImage ? 'image' : 'text'

          // Prepare content data
          const contentForHash = {
            content_text: contentText,
            content_image_url: post.imageUrl || post.thumbnailUrl || null,
            content_video_url: null,
            original_url: post.postUrl
          }

          const contentData = {
            content_text: contentText,
            content_image_url: post.imageUrl || post.thumbnailUrl || null,
            content_video_url: null,
            content_type: contentType,
            source_platform: 'lemmy',
            original_url: post.postUrl,
            original_author: `${post.author} on ${post.community}`,
            scraped_at: new Date(),
            content_hash: this.contentProcessor.generateContentHash(contentForHash)
          }

          // Insert into database
          const insertQuery = `
            INSERT INTO content_queue (
              content_text, content_image_url, content_video_url, content_type,
              source_platform, original_url, original_author, 
              scraped_at, content_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            ON CONFLICT (content_hash) DO UPDATE SET updated_at = NOW()
            RETURNING id, content_text, source_platform
          `
          
          const insertValues = [
            contentData.content_text,
            contentData.content_image_url,
            contentData.content_video_url,
            contentData.content_type,
            contentData.source_platform,
            contentData.original_url,
            contentData.original_author,
            contentData.scraped_at,
            contentData.content_hash
          ]
          
          const insertResult = await db.query(insertQuery, insertValues)
          
          if (!insertResult.rows || insertResult.rows.length === 0) {
            throw new Error('Insert returned no rows')
          }
          
          const contentId = insertResult.rows[0].id

          await logToDatabase(
            LogLevel.DEBUG,
            'LEMMY_CONTENT_INSERT_SUCCESS',
            `Successfully inserted content: ${post.title}`,
            { postId: post.id, contentId }
          )

          // Process the content
          const processingResult = await this.contentProcessor.processContent(contentId, {
            autoApprovalThreshold: 0.65, // Slightly higher threshold for user-generated content
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

        } catch (postError) {
          const errorMessage = postError instanceof Error ? postError.message : 'Unknown post error'
          result.errors.push(`Post processing error: ${errorMessage}`)
          await logToDatabase(
            LogLevel.ERROR,
            'LEMMY_POST_PROCESSING_ERROR',
            `Error processing post ${post.id}: ${errorMessage}`,
            { postId: post.id, error: errorMessage }
          )
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'LEMMY_SCAN_COMPLETED',
        `Lemmy scan completed: ${result.processed} processed, ${result.approved} approved`,
        { 
          scanId: `lemmy_scan_${Date.now()}`,
          ...result
        }
      )

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await logToDatabase(
        LogLevel.ERROR,
        'LEMMY_SCAN_ERROR',
        `Lemmy scan failed: ${errorMessage}`,
        { error: errorMessage }
      )
      
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
   * Search posts on a specific Lemmy instance
   */
  private async searchPosts(instance: string, searchTerm: string, limit: number): Promise<ProcessedLemmyPost[]> {
    const url = `${instance}/api/v3/search?q=${encodeURIComponent(searchTerm)}&type_=Posts&limit=${limit}&sort=Hot`
    
    console.log(`🔍 Lemmy: Searching ${instance} for "${searchTerm}"...`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HotdogDiaries/1.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Lemmy API error: ${response.status} ${response.statusText}`)
    }

    const responseText = await response.text()
    let data: LemmySearchResponse
    
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error(`Failed to parse Lemmy response from ${instance}:`, responseText.substring(0, 200))
      throw new Error(`Invalid JSON response from ${instance}`)
    }

    if (!data.posts || !Array.isArray(data.posts)) {
      console.log('Lemmy response has no posts array:', data)
      return []
    }

    return data.posts
      .filter(item => item && item.post && item.counts && item.counts.score >= 0) // Filter out heavily downvoted posts
      .map(item => ({
        id: item.post.id ? item.post.id.toString() : `lemmy_${Date.now()}_${Math.random()}`,
        title: item.post.name || 'Untitled',
        description: item.post.body || '',
        imageUrl: this.extractImageUrl(item.post.url),
        thumbnailUrl: item.post.thumbnail_url,
        author: item.creator?.name || 'Unknown',
        community: item.community?.name || 'Unknown',
        postUrl: item.post.ap_id || item.post.url || '',
        score: item.counts?.score || 0,
        published: new Date(item.post.published || Date.now())
      }))
  }

  /**
   * Extract image URL if the post URL is an image
   */
  private extractImageUrl(url?: string): string | undefined {
    if (!url) return undefined
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const lowerUrl = url.toLowerCase()
    
    if (imageExtensions.some(ext => lowerUrl.endsWith(ext))) {
      return url
    }
    
    // Check if it's an imgur link without extension
    if (lowerUrl.includes('imgur.com') && !lowerUrl.includes('/a/')) {
      return url + '.jpg' // Try adding .jpg
    }
    
    return undefined
  }

  /**
   * Test connection to Lemmy instances
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const config = await this.getScanConfig()
      const results: any[] = []
      
      for (const instance of config.instances.slice(0, 2)) { // Test first 2 instances
        try {
          const testPosts = await this.searchPosts(instance, 'hotdog', 1)
          results.push({
            instance,
            success: true,
            postsFound: testPosts.length
          })
        } catch (error) {
          results.push({
            instance,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      
      return {
        success: successCount > 0,
        message: `Connected to ${successCount}/${results.length} Lemmy instances`,
        details: { instanceResults: results }
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
  async getScanConfig(): Promise<LemmyScanConfig> {
    return {
      isEnabled: true,
      scanInterval: 240, // 4 hours
      maxPostsPerScan: 30,
      searchTerms: ['hotdog', 'hot dog', 'chicago dog', 'chili dog'],
      minScore: 1,
      instances: [
        'https://lemmy.world',
        'https://lemmy.ml',
        'https://sh.itjust.works',
        'https://lemm.ee',
        'https://programming.dev'
      ]
    }
  }
}

export const lemmyScanningService = new LemmyScanningService()