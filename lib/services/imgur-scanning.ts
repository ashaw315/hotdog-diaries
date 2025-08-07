import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface ImgurImage {
  id: string
  title: string | null
  description: string | null
  datetime: number // Unix timestamp
  type: string // image/jpeg, image/png, etc.
  animated: boolean
  width: number
  height: number
  size: number
  views: number
  bandwidth: number
  vote: null | string
  favorite: boolean
  nsfw: boolean | null
  section: string | null
  account_url: string | null
  account_id: number | null
  is_ad: boolean
  in_gallery: boolean
  link: string // Direct image URL
  comment_count: number | null
  favorite_count: number | null
  ups: number | null
  downs: number | null
  points: number | null
  score: number | null
}

export interface ImgurGalleryItem {
  id: string
  title: string | null
  description: string | null
  datetime: number
  cover?: string // Cover image ID for albums
  account_url: string | null
  account_id: number | null
  privacy?: string
  layout?: string
  views: number
  link: string
  ups: number
  downs: number
  points: number
  score: number
  is_album: boolean
  vote: null | string
  favorite: boolean
  nsfw: boolean
  section: string
  comment_count: number
  favorite_count: number
  topic: string | null
  topic_id: number | null
  images_count?: number
  in_gallery: boolean
  is_ad: boolean
  tags: any[]
  ad_type: number
  ad_url: string
  in_most_viral: boolean
  images?: ImgurImage[] // For albums
}

export interface ImgurSearchResponse {
  data: ImgurGalleryItem[]
  success: boolean
  status: number
}

export interface ProcessedImgurPost {
  id: string
  title: string
  description: string
  imageUrl: string
  author: string
  link: string
  views: number
  upvotes: number
  score: number
  published: Date
  isVideo?: boolean
}

export interface ImgurScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxPostsPerScan: number
  searchTerms: string[]
  minScore: number
  lastScanTime?: Date
}

export interface ImgurPerformScanOptions {
  maxPosts: number
}

export interface ImgurPerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

export class ImgurScanningService {
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
  async performScan(options: ImgurPerformScanOptions): Promise<ImgurPerformScanResult> {
    try {
      // Get scan configuration
      const config = await this.getScanConfig()

      // Check if Imgur API is available
      const clientId = process.env.IMGUR_CLIENT_ID

      if (!clientId) {
        console.warn('⚠️  IMGUR: Client ID not configured, using mock data')
        return this.performMockScan(options)
      }

      const maxPosts = Math.min(options.maxPosts, config?.maxPostsPerScan || 30)
      const result: ImgurPerformScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: []
      }

      // Search for hotdog content using different search terms
      const allPosts: ProcessedImgurPost[] = []
      
      for (const searchTerm of config.searchTerms.slice(0, 3)) { // Limit search terms
        try {
          const posts = await this.searchGallery(searchTerm, Math.ceil(maxPosts / config.searchTerms.length))
          allPosts.push(...posts)
          
          await logToDatabase(
            LogLevel.INFO,
            'IMGUR_SEARCH_SUCCESS',
            `Found ${posts.length} posts for search term: ${searchTerm}`,
            { searchTerm, postsFound: posts.length }
          )
        } catch (searchError) {
          const errorMessage = searchError instanceof Error ? searchError.message : 'Unknown search error'
          result.errors.push(`Search error for "${searchTerm}": ${errorMessage}`)
          await logToDatabase(
            LogLevel.ERROR,
            'IMGUR_SEARCH_ERROR',
            `Error searching for "${searchTerm}": ${errorMessage}`,
            { searchTerm, error: errorMessage }
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
            text: `${post.title} ${post.description}`.trim(),
            url: post.imageUrl,
            metadata: {
              author: post.author,
              views: post.views,
              score: post.score
            }
          })

          if (!contentAnalysis.is_valid_hotdog) {
            result.rejected++
            continue
          }

          // Prepare content data with proper video/image detection
          const isVideo = post.isVideo || false
          const contentForHash = {
            content_text: `${post.title} ${post.description}`.trim(),
            content_image_url: isVideo ? null : post.imageUrl,
            content_video_url: isVideo ? post.imageUrl : null,
            original_url: post.link
          }

          const contentData = {
            content_text: `${post.title} ${post.description}`.trim(),
            content_image_url: isVideo ? null : post.imageUrl,
            content_video_url: isVideo ? post.imageUrl : null,
            content_type: isVideo ? 'video' as const : 'image' as const,
            source_platform: 'imgur' as const,
            original_url: post.link,
            original_author: post.author ? `@${post.author} on Imgur` : 'Anonymous on Imgur',
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
          
          const insertResult = await db.query(insertQuery, [
            contentData.content_text,
            contentData.content_image_url,
            contentData.content_video_url,
            contentData.content_type,
            contentData.source_platform,
            contentData.original_url,
            contentData.original_author,
            contentData.scraped_at,
            contentData.content_hash
          ])
          
          const contentId = insertResult.rows[0].id

          // Process the content
          const processingResult = await this.contentProcessor.processContent(contentId, {
            autoApprovalThreshold: 0.65,
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
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'IMGUR_SCAN_COMPLETED',
        `Imgur scan completed: ${result.processed} processed, ${result.approved} approved`,
        { scanId: `imgur_scan_${Date.now()}`, ...result }
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
   * Search Imgur gallery
   */
  private async searchGallery(searchTerm: string, limit: number): Promise<ProcessedImgurPost[]> {
    const clientId = process.env.IMGUR_CLIENT_ID
    if (!clientId) {
      throw new Error('Imgur Client ID not configured')
    }

    const url = `https://api.imgur.com/3/gallery/search/score/all?q=${encodeURIComponent(searchTerm)}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${clientId}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Imgur API error: ${response.status} ${response.statusText}`)
    }

    const data: ImgurSearchResponse = await response.json()

    if (!data.success || !data.data) {
      throw new Error('Invalid Imgur API response')
    }

    return data.data
      .slice(0, limit)
      .map(item => {
        // Get the media URL - either direct link or first media in album
        let mediaUrl = item.link
        let isVideo = false
        
        if (item.is_album && item.images && item.images.length > 0) {
          // For albums, use the first image/video
          const firstImage = item.images[0]
          mediaUrl = firstImage.link
          // Check if it's a video based on MIME type or URL extension
          isVideo = firstImage.type?.startsWith('video/') || 
                   firstImage.animated ||
                   mediaUrl.endsWith('.mp4') ||
                   mediaUrl.endsWith('.gifv')
        } else if (item.cover) {
          // Some albums provide a cover ID instead of images array
          mediaUrl = `https://i.imgur.com/${item.cover}.jpg`
        } else {
          // Check direct link for video indicators
          isVideo = mediaUrl.endsWith('.mp4') || 
                   mediaUrl.endsWith('.gifv')
        }
        
        // Convert .gifv to .mp4 for proper video playback
        if (mediaUrl.endsWith('.gifv')) {
          mediaUrl = mediaUrl.replace('.gifv', '.mp4')
          isVideo = true
        }

        return {
          id: item.id,
          title: item.title || 'Untitled',
          description: item.description || '',
          imageUrl: mediaUrl,
          author: item.account_url || 'anonymous',
          link: `https://imgur.com/gallery/${item.id}`,
          views: item.views || 0,
          upvotes: item.ups || 0,
          score: item.score || 0,
          published: new Date(item.datetime * 1000), // Convert from Unix timestamp
          isVideo // Add video detection flag
        }
      })
  }

  /**
   * Perform a mock scan for testing without API key
   */
  private async performMockScan(options: ImgurPerformScanOptions): Promise<ImgurPerformScanResult> {
    const mockPosts: ProcessedImgurPost[] = [
      {
        id: 'mock1',
        title: 'Epic Hotdog Meme',
        description: 'When you realize hotdogs are just meat twinkies',
        imageUrl: 'https://i.imgur.com/example1.jpg',
        author: 'hotdoglover42',
        link: 'https://imgur.com/gallery/mock1',
        views: 42069,
        upvotes: 1337,
        score: 1337,
        published: new Date()
      },
      {
        id: 'mock2',
        title: 'Chicago Style Hotdog',
        description: 'The perfect Chicago dog with all the fixings',
        imageUrl: 'https://i.imgur.com/example2.jpg',
        author: 'chicagofoodie',
        link: 'https://imgur.com/gallery/mock2',
        views: 10000,
        upvotes: 500,
        score: 500,
        published: new Date()
      },
      {
        id: 'mock3',
        title: 'Hotdog Costume Fail',
        description: 'My dog dressed as a hotdog for Halloween',
        imageUrl: 'https://i.imgur.com/example3.jpg',
        author: 'dogparent',
        link: 'https://imgur.com/gallery/mock3',
        views: 25000,
        upvotes: 2000,
        score: 2000,
        published: new Date()
      }
    ]

    const result: ImgurPerformScanResult = {
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
          content_image_url: post.imageUrl,
          content_video_url: null,
          content_type: 'image' as const,
          source_platform: 'imgur' as const,
          original_url: post.link,
          original_author: `@${post.author} on Imgur`,
          scraped_at: new Date(),
          content_hash: this.contentProcessor.generateContentHash({
            content_text: `${post.title} ${post.description}`.trim(),
            content_image_url: post.imageUrl,
            content_video_url: null,
            original_url: post.link
          })
        }

        const insertResult = await db.query(
          `INSERT INTO content_queue (
            content_text, content_image_url, content_video_url, content_type,
            source_platform, original_url, original_author, scraped_at, content_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
          ON CONFLICT (content_hash) DO UPDATE SET updated_at = NOW()
          RETURNING id`,
          [
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
        )

        const contentId = insertResult.rows[0].id

        const processingResult = await this.contentProcessor.processContent(contentId, {
          autoApprovalThreshold: 0.65,
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
   * Test connection to Imgur API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const clientId = process.env.IMGUR_CLIENT_ID
      
      if (!clientId) {
        return {
          success: true,
          message: 'No Imgur Client ID configured, will use mock data',
          details: { mockMode: true }
        }
      }

      // Try a simple search to test the connection
      const testPosts = await this.searchGallery('hotdog', 1)

      return {
        success: true,
        message: `Imgur connection successful. Found ${testPosts.length} test results.`,
        details: {
          testResultsCount: testPosts.length,
          hasClientId: true
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
  async getScanConfig(): Promise<ImgurScanConfig> {
    return {
      isEnabled: true,
      scanInterval: 240, // 4 hours
      maxPostsPerScan: 30,
      searchTerms: ['hotdog', 'hot dog', 'hotdog meme', 'glizzy'],
      minScore: 10
    }
  }
}

export const imgurScanningService = new ImgurScanningService()