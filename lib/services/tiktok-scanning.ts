import { TikTokService, ProcessedTikTokVideo, TikTokSearchOptions } from './tiktok'
import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { tiktokMonitoringService } from './tiktok-monitoring'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface TikTokScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxVideosPerScan: number
  targetKeywords: string[]
  targetHashtags: string[]
  minViews: number
  maxDuration: number // seconds
  sortBy: 'relevance' | 'create_time' | 'view_count'
  lastScanId?: string
  lastScanTime?: Date
}

export interface TikTokScanResult {
  scanId: string
  startTime: Date
  endTime: Date
  videosFound: number
  videosProcessed: number
  videosApproved: number
  videosRejected: number
  videosFlagged: number
  duplicatesFound: number
  errors: string[]
  rateLimitHit: boolean
  keywordsScanned: string[]
  hashtagsScanned: string[]
  highestEngagedVideo?: {
    id: string
    title: string
    viewCount: number
    username: string
  }
  nextScanTime?: Date
}

export interface TikTokScanStats {
  totalScans: number
  totalVideosFound: number
  totalVideosProcessed: number
  totalVideosApproved: number
  averageViews: number
  averageDuration: number
  topKeywords: Array<{ keyword: string; count: number; avgViews: number }>
  topHashtags: Array<{ hashtag: string; count: number; avgViews: number }>
  topCreators: Array<{ username: string; count: number; avgViews: number }>
  scanFrequency: number
  lastScanTime?: Date
  nextScanTime?: Date
  successRate: number
}

export class TikTokScanningService {
  private tiktokService: TikTokService
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false
  private scanTimer?: NodeJS.Timeout

  constructor() {
    this.tiktokService = new TikTokService()
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Start automated TikTok scanning
   */
  async startAutomatedScanning(): Promise<void> {
    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        await logToDatabase(
          LogLevel.INFO,
          'TIKTOK_SCAN_DISABLED',
          'TikTok scanning is disabled in configuration'
        )
        return
      }

      // Check if TikTok is authenticated
      const apiStatus = await this.tiktokService.getApiStatus()
      if (!apiStatus.isAuthenticated) {
        await logToDatabase(
          LogLevel.WARNING,
          'TIKTOK_NOT_AUTHENTICATED',
          'TikTok scanning cannot start: not authenticated'
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
        'TIKTOK_SCAN_STARTED',
        `TikTok scanning started with ${config.scanInterval} minute intervals`,
        { config }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_SCAN_START_ERROR',
        `Failed to start TikTok scanning: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Stop automated TikTok scanning
   */
  async stopAutomatedScanning(): Promise<void> {
    if (this.scanTimer) {
      clearInterval(this.scanTimer)
      this.scanTimer = undefined
    }

    await logToDatabase(
      LogLevel.INFO,
      'TIKTOK_SCAN_STOPPED',
      'TikTok scanning stopped'
    )
  }

  /**
   * Perform a single TikTok scan
   */
  async performScan(): Promise<TikTokScanResult> {
    if (this.isScanning) {
      throw new Error('TikTok scan already in progress')
    }

    this.isScanning = true
    const scanId = `tiktok_scan_${Date.now()}`
    const startTime = new Date()
    const result: TikTokScanResult = {
      scanId,
      startTime,
      endTime: new Date(),
      videosFound: 0,
      videosProcessed: 0,
      videosApproved: 0,
      videosRejected: 0,
      videosFlagged: 0,
      duplicatesFound: 0,
      errors: [],
      rateLimitHit: false,
      keywordsScanned: [],
      hashtagsScanned: []
    }

    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        throw new Error('TikTok scanning is disabled')
      }

      // Check authentication
      const apiStatus = await this.tiktokService.getApiStatus()
      if (!apiStatus.isAuthenticated) {
        throw new Error('TikTok not authenticated')
      }

      let allVideos: ProcessedTikTokVideo[] = []
      
      // Combine keywords and hashtags for search
      const searchTerms = [...config.targetKeywords, ...config.targetHashtags]
      result.keywordsScanned = config.targetKeywords
      result.hashtagsScanned = config.targetHashtags

      // Search with combined terms
      try {
        const searchOptions: TikTokSearchOptions = {
          keywords: searchTerms,
          limit: config.maxVideosPerScan,
          minViews: config.minViews,
          sortBy: config.sortBy,
          publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }

        const videos = await this.tiktokService.searchVideos(searchOptions)
        allVideos = allVideos.concat(videos)

        await logToDatabase(
          LogLevel.INFO,
          'TIKTOK_SEARCH_SUCCESS',
          `Found ${videos.length} TikTok videos for search terms: ${searchTerms.join(', ')}`,
          { scanId, searchTerms, videosFound: videos.length }
        )

      } catch (error) {
        result.errors.push(`Search failed: ${error.message}`)
        
        if (error.message.includes('rate limit') || error.message.includes('quota')) {
          result.rateLimitHit = true
        }

        await logToDatabase(
          LogLevel.ERROR,
          'TIKTOK_SEARCH_ERROR',
          `TikTok search failed: ${error.message}`,
          { scanId, searchTerms, error: error.message }
        )
      }

      result.videosFound = allVideos.length

      // Remove duplicates and sort by engagement
      const uniqueVideos = this.removeDuplicateVideos(allVideos)
      result.duplicatesFound = allVideos.length - uniqueVideos.length

      // Filter by duration if specified
      const durationFilteredVideos = uniqueVideos.filter(video => 
        !config.maxDuration || video.duration <= config.maxDuration
      )

      // Track highest engaged video
      if (durationFilteredVideos.length > 0) {
        const highestEngaged = durationFilteredVideos.reduce((max, video) => 
          (video.viewCount + video.likeCount) > (max.viewCount + max.likeCount) ? video : max
        )
        result.highestEngagedVideo = {
          id: highestEngaged.id,
          title: highestEngaged.title.substring(0, 100) + '...',
          viewCount: highestEngaged.viewCount,
          username: highestEngaged.username
        }
      }

      // Process each unique video
      for (const video of durationFilteredVideos) {
        try {
          const processed = await this.processTikTokVideo(video, scanId)
          result.videosProcessed++

          switch (processed.status) {
            case 'approved':
              result.videosApproved++
              break
            case 'rejected':
              result.videosRejected++
              break
            case 'flagged':
              result.videosFlagged++
              break
          }

        } catch (error) {
          result.errors.push(`Video ${video.id} processing failed: ${error.message}`)
          
          await logToDatabase(
            LogLevel.ERROR,
            'TIKTOK_VIDEO_PROCESS_ERROR',
            `Failed to process TikTok video ${video.id}: ${error.message}`,
            { scanId, videoId: video.id, error: error.message }
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
        'TIKTOK_SCAN_COMPLETED',
        `TikTok scan completed: ${result.videosProcessed} processed, ${result.videosApproved} approved`,
        result
      )

      // Record scan completion for monitoring
      await tiktokMonitoringService.recordScanCompletion(
        result.videosProcessed,
        true,
        result.errors
      )

      return result

    } catch (error) {
      result.errors.push(error.message)
      result.endTime = new Date()

      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_SCAN_ERROR',
        `TikTok scan failed: ${error.message}`,
        { scanId, error: error.message }
      )

      // Record scan failure for monitoring
      await tiktokMonitoringService.recordScanCompletion(
        result.videosProcessed,
        false,
        result.errors
      )

      throw error

    } finally {
      this.isScanning = false
    }
  }

  /**
   * Process a single TikTok video through the content pipeline
   */
  private async processTikTokVideo(video: ProcessedTikTokVideo, scanId: string): Promise<{ status: 'approved' | 'rejected' | 'flagged' }> {
    try {
      // Validate TikTok video content
      const isValid = await this.tiktokService.validateTikTokContent(video)
      if (!isValid) {
        return { status: 'rejected' }
      }

      // Check for duplicates in existing content
      const contentText = `${video.title} ${video.description}`.trim()
      const contentHash = await this.duplicateDetection.generateContentHash(contentText)
      const isDuplicate = await this.duplicateDetection.checkForDuplicates({
        content_text: contentText,
        content_video_url: video.videoUrl,
        content_image_url: video.thumbnailUrl,
        content_hash: contentHash
      })

      if (isDuplicate) {
        return { status: 'rejected' }
      }

      // Determine content type
      const contentType = this.determineContentType(video)

      // Add to content queue
      const contentData = {
        content_text: contentText,
        content_video_url: video.videoUrl,
        content_image_url: video.thumbnailUrl,
        content_type: contentType,
        source_platform: 'tiktok' as const,
        original_url: video.webUrl,
        original_author: `@${video.username}`,
        scraped_at: new Date(),
        content_hash: contentHash,
        tiktok_data: JSON.stringify({
          video_id: video.id,
          username: video.username,
          user_display_name: video.userDisplayName,
          user_id: video.userId,
          created_at: video.createdAt,
          duration: video.duration,
          view_count: video.viewCount,
          like_count: video.likeCount,
          share_count: video.shareCount,
          comment_count: video.commentCount,
          hashtags: video.hashtags,
          effects: video.effects,
          sounds: video.sounds,
          is_commercial: video.isCommercial,
          region: video.region,
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
        'TIKTOK_VIDEO_PROCESS_ERROR',
        `Failed to process TikTok video ${video.id}: ${error.message}`,
        { 
          videoId: video.id, 
          scanId, 
          error: error.message,
          video: {
            title: video.title.substring(0, 100),
            username: video.username,
            viewCount: video.viewCount
          }
        }
      )
      throw error
    }
  }

  /**
   * Determine content type based on TikTok video
   */
  private determineContentType(video: ProcessedTikTokVideo): 'text' | 'image' | 'video' | 'mixed' {
    const hasText = video.title.trim().length > 0 || video.description.trim().length > 0
    
    if (video.videoUrl) {
      return hasText ? 'mixed' : 'video'
    } else if (video.thumbnailUrl) {
      return hasText ? 'mixed' : 'image'
    } else {
      return 'text'
    }
  }

  /**
   * Remove duplicate videos from array
   */
  private removeDuplicateVideos(videos: ProcessedTikTokVideo[]): ProcessedTikTokVideo[] {
    const seen = new Set<string>()
    return videos.filter(video => {
      if (seen.has(video.id)) {
        return false
      }
      seen.add(video.id)
      return true
    })
  }

  /**
   * Get current scan configuration
   */
  async getScanConfig(): Promise<TikTokScanConfig> {
    try {
      const config = await query('tiktok_scan_config')
        .select('*')
        .first()

      if (!config) {
        // Return default configuration
        return {
          isEnabled: false,
          scanInterval: 120, // 2 hours (TikTok has lower rate limits)
          maxVideosPerScan: 20,
          targetKeywords: this.tiktokService.getHotdogKeywords().slice(0, 5), // First 5 keywords
          targetHashtags: this.tiktokService.getFoodHashtags().slice(0, 5), // First 5 hashtags
          minViews: 100,
          maxDuration: 180, // 3 minutes max
          sortBy: 'relevance'
        }
      }

      return {
        isEnabled: config.is_enabled,
        scanInterval: config.scan_interval,
        maxVideosPerScan: config.max_videos_per_scan,
        targetKeywords: config.target_keywords || this.tiktokService.getHotdogKeywords().slice(0, 5),
        targetHashtags: config.target_hashtags || this.tiktokService.getFoodHashtags().slice(0, 5),
        minViews: config.min_views,
        maxDuration: config.max_duration,
        sortBy: config.sort_by || 'relevance',
        lastScanId: config.last_scan_id,
        lastScanTime: config.last_scan_time ? new Date(config.last_scan_time) : undefined
      }
    } catch (error) {
      // If table doesn't exist, return defaults
      return {
        isEnabled: false,
        scanInterval: 120,
        maxVideosPerScan: 20,
        targetKeywords: this.tiktokService.getHotdogKeywords().slice(0, 5),
        targetHashtags: this.tiktokService.getFoodHashtags().slice(0, 5),
        minViews: 100,
        maxDuration: 180,
        sortBy: 'relevance'
      }
    }
  }

  /**
   * Update scan configuration
   */
  async updateScanConfig(config: Partial<TikTokScanConfig>): Promise<void> {
    try {
      const existing = await this.getScanConfig()
      const updated = { ...existing, ...config }

      await query('tiktok_scan_config')
        .upsert({
          is_enabled: updated.isEnabled,
          scan_interval: updated.scanInterval,
          max_videos_per_scan: updated.maxVideosPerScan,
          target_keywords: updated.targetKeywords,
          target_hashtags: updated.targetHashtags,
          min_views: updated.minViews,
          max_duration: updated.maxDuration,
          sort_by: updated.sortBy,
          last_scan_id: updated.lastScanId,
          last_scan_time: updated.lastScanTime,
          updated_at: new Date()
        })

      await logToDatabase(
        LogLevel.INFO,
        'TIKTOK_CONFIG_UPDATED',
        'TikTok scan configuration updated',
        { config: updated }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_CONFIG_UPDATE_ERROR',
        `Failed to update TikTok configuration: ${error.message}`,
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
  private async recordScanResult(result: TikTokScanResult): Promise<void> {
    try {
      await insert('tiktok_scan_results')
        .values({
          scan_id: result.scanId,
          start_time: result.startTime,
          end_time: result.endTime,
          videos_found: result.videosFound,
          videos_processed: result.videosProcessed,
          videos_approved: result.videosApproved,
          videos_rejected: result.videosRejected,
          videos_flagged: result.videosFlagged,
          duplicates_found: result.duplicatesFound,
          keywords_scanned: result.keywordsScanned,
          hashtags_scanned: result.hashtagsScanned,
          highest_views: result.highestEngagedVideo?.viewCount || 0,
          errors: result.errors,
          rate_limit_hit: result.rateLimitHit,
          created_at: new Date()
        })

    } catch (error) {
      // Don't throw error here, just log it
      await logToDatabase(
        LogLevel.WARNING,
        'TIKTOK_SCAN_RESULT_RECORD_ERROR',
        `Failed to record TikTok scan result: ${error.message}`,
        { scanId: result.scanId, error: error.message }
      )
    }
  }

  /**
   * Get TikTok scanning statistics
   */
  async getScanStats(): Promise<TikTokScanStats> {
    try {
      // Get basic stats from scan results
      const scanResults = await query('tiktok_scan_results')
        .select([
          'COUNT(*) as total_scans',
          'SUM(videos_found) as total_videos_found',
          'SUM(videos_processed) as total_videos_processed',
          'SUM(videos_approved) as total_videos_approved',
          'AVG(highest_views) as average_views',
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
      const totalProcessed = parseInt(scanResults?.total_videos_processed || '0')
      const totalApproved = parseInt(scanResults?.total_videos_approved || '0')
      const successRate = totalProcessed > 0 ? (totalApproved / totalProcessed) * 100 : 0

      return {
        totalScans,
        totalVideosFound: parseInt(scanResults?.total_videos_found || '0'),
        totalVideosProcessed: totalProcessed,
        totalVideosApproved: totalApproved,
        averageViews: parseFloat(scanResults?.average_views || '0'),
        averageDuration: 60, // Placeholder - would need more complex query
        topKeywords: [], // Placeholder - would need keyword analysis
        topHashtags: [], // Placeholder - would need hashtag analysis
        topCreators: [], // Placeholder - would need creator analysis
        scanFrequency: config.scanInterval,
        lastScanTime: scanResults?.last_scan_time ? new Date(scanResults.last_scan_time) : undefined,
        nextScanTime,
        successRate
      }

    } catch (error) {
      // Return default stats if tables don't exist
      return {
        totalScans: 0,
        totalVideosFound: 0,
        totalVideosProcessed: 0,
        totalVideosApproved: 0,
        averageViews: 0,
        averageDuration: 0,
        topKeywords: [],
        topHashtags: [],
        topCreators: [],
        scanFrequency: 120,
        lastScanTime: undefined,
        nextScanTime: undefined,
        successRate: 0
      }
    }
  }

  /**
   * Test TikTok API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const status = await this.tiktokService.getApiStatus()
      
      if (status.isAuthenticated) {
        return {
          success: true,
          message: 'TikTok API connection successful',
          details: status
        }
      } else {
        return {
          success: false,
          message: status.lastError || 'TikTok not authenticated',
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

export const tiktokScanningService = new TikTokScanningService()