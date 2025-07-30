import { InstagramService, ProcessedInstagramMedia, InstagramSearchOptions } from './instagram'
import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { instagramMonitoringService } from './instagram-monitoring'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface InstagramScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxPostsPerScan: number
  targetHashtags: string[]
  minLikes: number
  includeStories: boolean
  lastScanId?: string
  lastScanTime?: Date
}

export interface InstagramScanResult {
  scanId: string
  startTime: Date
  endTime: Date
  postsFound: number
  postsProcessed: number
  postsApproved: number
  postsRejected: number
  postsFlagged: number
  duplicatesFound: number
  errors: string[]
  rateLimitHit: boolean
  hashtagsScanned: string[]
  highestEngagedPost?: {
    id: string
    caption: string
    likesCount: number
    username: string
  }
  nextScanTime?: Date
}

export interface InstagramScanStats {
  totalScans: number
  totalPostsFound: number
  totalPostsProcessed: number
  totalPostsApproved: number
  averageLikes: number
  topHashtags: Array<{ hashtag: string; count: number; avgLikes: number }>
  topAccounts: Array<{ username: string; count: number; avgLikes: number }>
  scanFrequency: number
  lastScanTime?: Date
  nextScanTime?: Date
  successRate: number
}

export class InstagramScanningService {
  private instagramService: InstagramService
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false
  private scanTimer?: NodeJS.Timeout

  constructor() {
    this.instagramService = new InstagramService()
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Start automated Instagram scanning
   */
  async startAutomatedScanning(): Promise<void> {
    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        await logToDatabase(
          LogLevel.INFO,
          'INSTAGRAM_SCAN_DISABLED',
          'Instagram scanning is disabled in configuration'
        )
        return
      }

      // Check if Instagram is authenticated
      const apiStatus = await this.instagramService.getApiStatus()
      if (!apiStatus.isAuthenticated) {
        await logToDatabase(
          LogLevel.WARNING,
          'INSTAGRAM_NOT_AUTHENTICATED',
          'Instagram scanning cannot start: not authenticated'
        )
        return
      }

      // Clear existing timer
      if (this.scanTimer) {
        clearInterval(this.scanTimer)
      }

      // Set up periodic scanning
      const intervalMs = config.scanInterval * 60 * 1000 // Convert minutes to milliseconds
      this.scanTimer = setInterval(async () => {
        if (!this.isScanning) {
          await this.performScan()
        }
      }, intervalMs)

      // Perform initial scan
      await this.performScan()

      await logToDatabase(
        LogLevel.INFO,
        'INSTAGRAM_SCAN_STARTED',
        `Instagram scanning started with ${config.scanInterval} minute intervals`,
        { config }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_SCAN_START_ERROR',
        `Failed to start Instagram scanning: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Stop automated Instagram scanning
   */
  async stopAutomatedScanning(): Promise<void> {
    if (this.scanTimer) {
      clearInterval(this.scanTimer)
      this.scanTimer = undefined
    }

    await logToDatabase(
      LogLevel.INFO,
      'INSTAGRAM_SCAN_STOPPED',
      'Instagram scanning stopped'
    )
  }

  /**
   * Perform a single Instagram scan
   */
  async performScan(): Promise<InstagramScanResult> {
    if (this.isScanning) {
      throw new Error('Instagram scan already in progress')
    }

    this.isScanning = true
    const scanId = `instagram_scan_${Date.now()}`
    const startTime = new Date()
    const result: InstagramScanResult = {
      scanId,
      startTime,
      endTime: new Date(),
      postsFound: 0,
      postsProcessed: 0,
      postsApproved: 0,
      postsRejected: 0,
      postsFlagged: 0,
      duplicatesFound: 0,
      errors: [],
      rateLimitHit: false,
      hashtagsScanned: []
    }

    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        throw new Error('Instagram scanning is disabled')
      }

      // Check authentication
      const apiStatus = await this.instagramService.getApiStatus()
      if (!apiStatus.isAuthenticated) {
        throw new Error('Instagram not authenticated')
      }

      let allPosts: ProcessedInstagramMedia[] = []
      result.hashtagsScanned = config.targetHashtags

      // Search each target hashtag
      for (const hashtag of config.targetHashtags) {
        try {
          const searchOptions: InstagramSearchOptions = {
            hashtag: hashtag,
            limit: Math.floor(config.maxPostsPerScan / config.targetHashtags.length),
            minLikes: config.minLikes,
            includeStories: config.includeStories
          }

          const posts = await this.instagramService.searchHashtags(searchOptions)
          allPosts = allPosts.concat(posts)

          await logToDatabase(
            LogLevel.INFO,
            'INSTAGRAM_HASHTAG_SEARCH_SUCCESS',
            `Found ${posts.length} Instagram posts for hashtag #${hashtag}`,
            { scanId, hashtag, postsFound: posts.length }
          )

        } catch (error) {
          result.errors.push(`Hashtag "#${hashtag}" search failed: ${error.message}`)
          
          if (error.message.includes('rate limit')) {
            result.rateLimitHit = true
          }

          await logToDatabase(
            LogLevel.ERROR,
            'INSTAGRAM_HASHTAG_SEARCH_ERROR',
            `Hashtag search failed: #${hashtag} - ${error.message}`,
            { scanId, hashtag, error: error.message }
          )
        }
      }

      result.postsFound = allPosts.length

      // Remove duplicates and sort by engagement
      const uniquePosts = this.removeDuplicatePosts(allPosts)
      result.duplicatesFound = allPosts.length - uniquePosts.length

      // Track highest engaged post
      if (uniquePosts.length > 0) {
        const highestEngaged = uniquePosts.reduce((max, post) => 
          (post.likesCount + post.commentsCount) > (max.likesCount + max.commentsCount) ? post : max
        )
        result.highestEngagedPost = {
          id: highestEngaged.id,
          caption: highestEngaged.caption.substring(0, 100) + '...',
          likesCount: highestEngaged.likesCount,
          username: highestEngaged.username
        }
      }

      // Process each unique post
      for (const post of uniquePosts) {
        try {
          const processed = await this.processInstagramPost(post, scanId)
          result.postsProcessed++

          switch (processed.status) {
            case 'approved':
              result.postsApproved++
              break
            case 'rejected':
              result.postsRejected++
              break
            case 'flagged':
              result.postsFlagged++
              break
          }

        } catch (error) {
          result.errors.push(`Post ${post.id} processing failed: ${error.message}`)
          
          await logToDatabase(
            LogLevel.ERROR,
            'INSTAGRAM_POST_PROCESS_ERROR',
            `Failed to process Instagram post ${post.id}: ${error.message}`,
            { scanId, postId: post.id, error: error.message }
          )
        }
      }

      // Update scan configuration with latest scan info
      await this.updateLastScanTime()

      result.endTime = new Date()
      result.nextScanTime = new Date(Date.now() + config.scanInterval * 60 * 1000)

      // Record scan results
      await this.recordScanResult(result)

      await logToDatabase(
        LogLevel.INFO,
        'INSTAGRAM_SCAN_COMPLETED',
        `Instagram scan completed: ${result.postsProcessed} processed, ${result.postsApproved} approved`,
        result
      )

      // Record scan completion for monitoring
      await instagramMonitoringService.recordScanCompletion(
        result.postsProcessed,
        true,
        result.errors
      )

      return result

    } catch (error) {
      result.errors.push(error.message)
      result.endTime = new Date()

      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_SCAN_ERROR',
        `Instagram scan failed: ${error.message}`,
        { scanId, error: error.message }
      )

      // Record scan failure for monitoring
      await instagramMonitoringService.recordScanCompletion(
        result.postsProcessed,
        false,
        result.errors
      )

      throw error

    } finally {
      this.isScanning = false
    }
  }

  /**
   * Process a single Instagram post through the content pipeline
   */
  private async processInstagramPost(post: ProcessedInstagramMedia, scanId: string): Promise<{ status: 'approved' | 'rejected' | 'flagged' }> {
    try {
      // Validate Instagram post content
      const isValid = await this.instagramService.validateInstagramContent(post)
      if (!isValid) {
        return { status: 'rejected' }
      }

      // Check for duplicates in existing content
      const contentText = `${post.caption}`.trim()
      const contentHash = await this.duplicateDetection.generateContentHash(contentText)
      const isDuplicate = await this.duplicateDetection.checkForDuplicates({
        content_text: contentText,
        content_image_url: post.mediaUrl,
        content_video_url: post.mediaType === 'VIDEO' ? post.mediaUrl : undefined,
        content_hash: contentHash
      })

      if (isDuplicate) {
        return { status: 'rejected' }
      }

      // Determine content type
      const contentType = this.determineContentType(post)

      // Add to content queue
      const contentData = {
        content_text: contentText,
        content_image_url: post.mediaType === 'IMAGE' ? post.mediaUrl : post.thumbnailUrl,
        content_video_url: post.mediaType === 'VIDEO' ? post.mediaUrl : null,
        content_type: contentType,
        source_platform: 'instagram' as const,
        original_url: post.permalink,
        original_author: `@${post.username}`,
        scraped_at: new Date(),
        content_hash: contentHash,
        instagram_data: JSON.stringify({
          post_id: post.id,
          username: post.username,
          user_id: post.userId,
          media_type: post.mediaType,
          likes_count: post.likesCount,
          comments_count: post.commentsCount,
          hashtags: post.hashtags,
          mentions: post.mentions,
          location: post.location,
          is_story: post.isStory,
          carousel_media: post.carouselMedia,
          timestamp: post.timestamp,
          scan_id: scanId
        })
      }

      const insertedContent = await insert('content_queue')
        .values(contentData)
        .returning(['id'])
        .first()

      if (!insertedContent) {
        throw new Error('Failed to insert content into queue')
      }

      // Process through filtering service
      const processingResult = await this.contentProcessor.processContent(insertedContent.id)

      return { status: processingResult.action as 'approved' | 'rejected' | 'flagged' }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_POST_PROCESS_ERROR',
        `Failed to process Instagram post ${post.id}: ${error.message}`,
        { 
          postId: post.id, 
          scanId, 
          error: error.message,
          post: {
            caption: post.caption.substring(0, 100),
            username: post.username,
            likesCount: post.likesCount
          }
        }
      )
      throw error
    }
  }

  /**
   * Determine content type based on Instagram media
   */
  private determineContentType(post: ProcessedInstagramMedia): 'text' | 'image' | 'video' | 'mixed' {
    const hasText = post.caption.trim().length > 0

    switch (post.mediaType) {
      case 'VIDEO':
        return hasText ? 'mixed' : 'video'
      case 'IMAGE':
        return hasText ? 'mixed' : 'image'
      case 'CAROUSEL_ALBUM':
        return 'mixed'
      default:
        return hasText ? 'text' : 'image'
    }
  }

  /**
   * Remove duplicate posts from array
   */
  private removeDuplicatePosts(posts: ProcessedInstagramMedia[]): ProcessedInstagramMedia[] {
    const seen = new Set<string>()
    return posts.filter(post => {
      if (seen.has(post.id)) {
        return false
      }
      seen.add(post.id)
      return true
    })
  }

  /**
   * Get current scan configuration
   */
  async getScanConfig(): Promise<InstagramScanConfig> {
    try {
      const config = await query('instagram_scan_config')
        .select('*')
        .first()

      if (!config) {
        // Return default configuration
        return {
          isEnabled: false,
          scanInterval: 60, // 60 minutes
          maxPostsPerScan: 20,
          targetHashtags: this.instagramService.getHotdogHashtags().slice(0, 8), // First 8 hashtags
          minLikes: 5,
          includeStories: false
        }
      }

      return {
        isEnabled: config.is_enabled,
        scanInterval: config.scan_interval,
        maxPostsPerScan: config.max_posts_per_scan,
        targetHashtags: config.target_hashtags || this.instagramService.getHotdogHashtags().slice(0, 8),
        minLikes: config.min_likes,
        includeStories: config.include_stories,
        lastScanId: config.last_scan_id,
        lastScanTime: config.last_scan_time ? new Date(config.last_scan_time) : undefined
      }
    } catch (error) {
      // If table doesn't exist, return defaults
      return {
        isEnabled: false,
        scanInterval: 60,
        maxPostsPerScan: 20,
        targetHashtags: this.instagramService.getHotdogHashtags().slice(0, 8),
        minLikes: 5,
        includeStories: false
      }
    }
  }

  /**
   * Update scan configuration
   */
  async updateScanConfig(config: Partial<InstagramScanConfig>): Promise<void> {
    try {
      const existing = await this.getScanConfig()
      const updated = { ...existing, ...config }

      await query('instagram_scan_config')
        .upsert({
          is_enabled: updated.isEnabled,
          scan_interval: updated.scanInterval,
          max_posts_per_scan: updated.maxPostsPerScan,
          target_hashtags: updated.targetHashtags,
          min_likes: updated.minLikes,
          include_stories: updated.includeStories,
          last_scan_id: updated.lastScanId,
          last_scan_time: updated.lastScanTime,
          updated_at: new Date()
        })

      await logToDatabase(
        LogLevel.INFO,
        'INSTAGRAM_CONFIG_UPDATED',
        'Instagram scan configuration updated',
        { config: updated }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_CONFIG_UPDATE_ERROR',
        `Failed to update Instagram configuration: ${error.message}`,
        { config, error: error.message }
      )
      throw error
    }
  }

  /**
   * Update last scan time
   */
  private async updateLastScanTime(): Promise<void> {
    await this.updateScanConfig({ 
      lastScanTime: new Date() 
    })
  }

  /**
   * Record scan result for analytics
   */
  private async recordScanResult(result: InstagramScanResult): Promise<void> {
    try {
      await insert('instagram_scan_results')
        .values({
          scan_id: result.scanId,
          start_time: result.startTime,
          end_time: result.endTime,
          posts_found: result.postsFound,
          posts_processed: result.postsProcessed,
          posts_approved: result.postsApproved,
          posts_rejected: result.postsRejected,
          posts_flagged: result.postsFlagged,
          duplicates_found: result.duplicatesFound,
          hashtags_scanned: result.hashtagsScanned,
          highest_likes: result.highestEngagedPost?.likesCount || 0,
          errors: result.errors,
          rate_limit_hit: result.rateLimitHit,
          created_at: new Date()
        })

    } catch (error) {
      // Don't throw error here, just log it
      await logToDatabase(
        LogLevel.WARNING,
        'INSTAGRAM_SCAN_RESULT_RECORD_ERROR',
        `Failed to record Instagram scan result: ${error.message}`,
        { scanId: result.scanId, error: error.message }
      )
    }
  }

  /**
   * Get Instagram scanning statistics
   */
  async getScanStats(): Promise<InstagramScanStats> {
    try {
      // Get basic stats from scan results
      const scanResults = await query('instagram_scan_results')
        .select([
          'COUNT(*) as total_scans',
          'SUM(posts_found) as total_posts_found',
          'SUM(posts_processed) as total_posts_processed',
          'SUM(posts_approved) as total_posts_approved',
          'AVG(highest_likes) as average_likes',
          'MAX(end_time) as last_scan_time'
        ])
        .first()

      // Get scan configuration for frequency and next scan time
      const config = await this.getScanConfig()
      const nextScanTime = config.lastScanTime 
        ? new Date(config.lastScanTime.getTime() + config.scanInterval * 60 * 1000)
        : undefined

      // Calculate success rate
      const totalScans = parseInt(scanResults?.total_scans || '0')
      const totalProcessed = parseInt(scanResults?.total_posts_processed || '0')
      const totalApproved = parseInt(scanResults?.total_posts_approved || '0')
      const successRate = totalProcessed > 0 ? (totalApproved / totalProcessed) * 100 : 0

      return {
        totalScans,
        totalPostsFound: parseInt(scanResults?.total_posts_found || '0'),
        totalPostsProcessed: totalProcessed,
        totalPostsApproved: totalApproved,
        averageLikes: parseFloat(scanResults?.average_likes || '0'),
        topHashtags: [], // Placeholder - would need more complex query
        topAccounts: [], // Placeholder - would need account analysis
        scanFrequency: config.scanInterval,
        lastScanTime: scanResults?.last_scan_time ? new Date(scanResults.last_scan_time) : undefined,
        nextScanTime,
        successRate
      }

    } catch (error) {
      // Return default stats if tables don't exist
      return {
        totalScans: 0,
        totalPostsFound: 0,
        totalPostsProcessed: 0,
        totalPostsApproved: 0,
        averageLikes: 0,
        topHashtags: [],
        topAccounts: [],
        scanFrequency: 60,
        lastScanTime: undefined,
        nextScanTime: undefined,
        successRate: 0
      }
    }
  }

  /**
   * Test Instagram API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const status = await this.instagramService.getApiStatus()
      
      if (status.isAuthenticated) {
        return {
          success: true,
          message: 'Instagram API connection successful',
          details: status
        }
      } else {
        return {
          success: false,
          message: status.lastError || 'Instagram not authenticated',
          details: status
        }
      }

    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        details: { error: error.message }
      }
    }
  }
}

export const instagramScanningService = new InstagramScanningService()