import { YouTubeService, ProcessedYouTubeVideo, YouTubeSearchOptions } from './youtube'
import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { youtubeMonitoringService } from './youtube-monitoring'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface YouTubeScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxVideosPerScan: number
  searchTerms: string[]
  videoDuration: 'any' | 'short' | 'medium' | 'long'
  publishedWithin: number // days
  minViewCount: number
  includeChannelIds?: string[]
  excludeChannelIds?: string[]
  lastScanId?: string
  lastScanTime?: Date
}

export interface YouTubeScanResult {
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
  quotaUsed: number
  searchTermsUsed: string[]
  highestViewedVideo?: {
    id: string
    title: string
    viewCount: number
    channelTitle: string
  }
  nextScanTime?: Date
}

export interface YouTubeScanStats {
  totalScans: number
  totalVideosFound: number
  totalVideosProcessed: number
  totalVideosApproved: number
  averageViews: number
  topChannels: Array<{ channelTitle: string; count: number; avgViews: number }>
  topSearchTerms: Array<{ term: string; count: number; avgViews: number }>
  scanFrequency: number
  lastScanTime?: Date
  nextScanTime?: Date
  successRate: number
  quotaUsageRate: number
}

export class YouTubeScanningService {
  private youtubeService: YouTubeService
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false
  private scanTimer?: NodeJS.Timeout

  constructor() {
    this.youtubeService = new YouTubeService()
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Start automated YouTube scanning
   */
  async startAutomatedScanning(): Promise<void> {
    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        await logToDatabase(
          LogLevel.INFO,
          'YOUTUBE_SCAN_DISABLED',
          'YouTube scanning is disabled in configuration'
        )
        return
      }

      // Check if YouTube API is available
      const apiStatus = await this.youtubeService.getApiStatus()
      if (!apiStatus.isAuthenticated) {
        await logToDatabase(
          LogLevel.WARNING,
          'YOUTUBE_NOT_AUTHENTICATED',
          'YouTube scanning cannot start: API not authenticated'
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
        'YOUTUBE_SCAN_STARTED',
        `YouTube scanning started with ${config.scanInterval} minute intervals`,
        { config }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_SCAN_START_ERROR',
        `Failed to start YouTube scanning: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Stop automated YouTube scanning
   */
  async stopAutomatedScanning(): Promise<void> {
    if (this.scanTimer) {
      clearInterval(this.scanTimer)
      this.scanTimer = undefined
    }

    await logToDatabase(
      LogLevel.INFO,
      'YOUTUBE_SCAN_STOPPED',
      'YouTube scanning stopped'
    )
  }

  /**
   * Perform a single YouTube scan
   */
  async performScan(): Promise<YouTubeScanResult> {
    if (this.isScanning) {
      throw new Error('YouTube scan already in progress')
    }

    this.isScanning = true
    const scanId = `youtube_scan_${Date.now()}`
    const startTime = new Date()
    const result: YouTubeScanResult = {
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
      quotaUsed: 0,
      searchTermsUsed: []
    }

    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        throw new Error('YouTube scanning is disabled')
      }

      // Check API status and quota
      const apiStatus = await this.youtubeService.getApiStatus()
      if (!apiStatus.isAuthenticated) {
        throw new Error('YouTube API not authenticated')
      }

      if (apiStatus.quotaRemaining < 500) {
        throw new Error(`YouTube API quota too low: ${apiStatus.quotaRemaining} remaining`)
      }

      let allVideos: ProcessedYouTubeVideo[] = []
      result.searchTermsUsed = config.searchTerms

      // Search each configured search term
      for (const searchTerm of config.searchTerms) {
        try {
          const searchOptions: YouTubeSearchOptions = {
            query: searchTerm,
            maxResults: Math.floor(config.maxVideosPerScan / config.searchTerms.length),
            order: 'relevance',
            videoDuration: config.videoDuration,
            publishedAfter: new Date(Date.now() - config.publishedWithin * 24 * 60 * 60 * 1000)
          }

          const videos = await this.youtubeService.searchVideos(searchOptions)
          allVideos = allVideos.concat(videos)

          await logToDatabase(
            LogLevel.INFO,
            'YOUTUBE_SEARCH_TERM_SUCCESS',
            `Found ${videos.length} YouTube videos for search term: ${searchTerm}`,
            { scanId, searchTerm, videosFound: videos.length }
          )

        } catch (error) {
          result.errors.push(`Search term "${searchTerm}" failed: ${error.message}`)
          
          await logToDatabase(
            LogLevel.ERROR,
            'YOUTUBE_SEARCH_TERM_ERROR',
            `Search term failed: ${searchTerm} - ${error.message}`,
            { scanId, searchTerm, error: error.message }
          )
        }
      }

      result.videosFound = allVideos.length

      // Remove duplicates and filter by view count
      const uniqueVideos = this.removeDuplicateVideos(allVideos)
      result.duplicatesFound = allVideos.length - uniqueVideos.length

      // Filter by minimum view count
      const filteredVideos = uniqueVideos.filter(video => video.viewCount >= config.minViewCount)

      // Track highest viewed video
      if (filteredVideos.length > 0) {
        const highestViewed = filteredVideos.reduce((max, video) =>
          video.viewCount > max.viewCount ? video : max
        )
        result.highestViewedVideo = {
          id: highestViewed.id,
          title: highestViewed.title,
          viewCount: highestViewed.viewCount,
          channelTitle: highestViewed.channelTitle
        }
      }

      // Process each video through the content pipeline
      for (const video of filteredVideos) {
        try {
          const processed = await this.processYouTubeVideo(video, scanId)
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
            'YOUTUBE_VIDEO_PROCESS_ERROR',
            `Failed to process YouTube video ${video.id}: ${error.message}`,
            { scanId, videoId: video.id, error: error.message }
          )
        }
      }

      // Get quota usage
      const finalApiStatus = await this.youtubeService.getApiStatus()
      result.quotaUsed = finalApiStatus.quotaUsed

      // Update scan configuration with latest scan info
      await this.updateLastScanTime()

      result.endTime = new Date()
      result.nextScanTime = new Date(Date.now() + config.scanInterval * 60 * 1000)

      // Record scan results
      await this.recordScanResult(result)

      await logToDatabase(
        LogLevel.INFO,
        'YOUTUBE_SCAN_COMPLETED',
        `YouTube scan completed: ${result.videosProcessed} processed, ${result.videosApproved} approved`,
        result
      )

      // Record scan completion for monitoring
      await youtubeMonitoringService.recordScanCompletion(
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
        'YOUTUBE_SCAN_ERROR',
        `YouTube scan failed: ${error.message}`,
        { scanId, error: error.message }
      )

      // Record scan failure for monitoring
      await youtubeMonitoringService.recordScanCompletion(
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
   * Process a single YouTube video through the content pipeline
   */
  private async processYouTubeVideo(video: ProcessedYouTubeVideo, scanId: string): Promise<{ status: 'approved' | 'rejected' | 'flagged' }> {
    try {
      // Validate YouTube video content
      const isValid = await this.youtubeService.validateYouTubeContent(video)
      if (!isValid) {
        return { status: 'rejected' }
      }

      // Check for duplicates in existing content
      const contentText = `${video.title}\n${video.description}`.trim()
      const contentHash = await this.duplicateDetection.generateContentHash(contentText)
      const isDuplicate = await this.duplicateDetection.checkForDuplicates({
        content_text: contentText,
        content_video_url: video.videoUrl,
        content_hash: contentHash
      })

      if (isDuplicate) {
        return { status: 'rejected' }
      }

      // Determine content type - videos are always mixed (video + text)
      const contentType = 'mixed'

      // Add to content queue
      const contentData = {
        content_text: contentText,
        content_image_url: video.thumbnailUrl,
        content_video_url: video.embedUrl, // Use embed URL for display
        content_type: contentType,
        source_platform: 'youtube' as const,
        original_url: video.videoUrl,
        original_author: video.channelTitle,
        scraped_at: new Date(),
        content_hash: contentHash,
        youtube_data: JSON.stringify({
          video_id: video.id,
          channel_id: video.channelId,
          channel_title: video.channelTitle,
          published_at: video.publishedAt,
          duration: video.duration,
          view_count: video.viewCount,
          like_count: video.likeCount,
          comment_count: video.commentCount,
          tags: video.tags,
          category_id: video.categoryId,
          default_language: video.defaultLanguage,
          is_live_broadcast: video.isLiveBroadcast,
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

      // Process through content processor
      const processingResult = await this.contentProcessor.processContent(insertedContent.id, {
        autoApprovalThreshold: 0.7, // Higher threshold for video content
        autoRejectionThreshold: 0.3
      })

      return { status: processingResult.action as 'approved' | 'rejected' | 'flagged' }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_VIDEO_PROCESS_ERROR',
        `Failed to process YouTube video ${video.id}: ${error.message}`,
        { 
          videoId: video.id, 
          scanId, 
          error: error.message,
          video: {
            title: video.title.substring(0, 100),
            channelTitle: video.channelTitle,
            viewCount: video.viewCount
          }
        }
      )
      throw error
    }
  }

  /**
   * Remove duplicate videos from array
   */
  private removeDuplicateVideos(videos: ProcessedYouTubeVideo[]): ProcessedYouTubeVideo[] {
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
  async getScanConfig(): Promise<YouTubeScanConfig> {
    try {
      const config = await query('youtube_scan_config')
        .select('*')
        .first()

      if (!config) {
        // Return default configuration
        return {
          isEnabled: false,
          scanInterval: 120, // 2 hours
          maxVideosPerScan: 20,
          searchTerms: this.youtubeService.getHotdogSearchTerms(),
          videoDuration: 'any',
          publishedWithin: 7, // Last week
          minViewCount: 500,
          includeChannelIds: [],
          excludeChannelIds: []
        }
      }

      return {
        isEnabled: config.is_enabled,
        scanInterval: config.scan_interval,
        maxVideosPerScan: config.max_videos_per_scan,
        searchTerms: config.search_terms || this.youtubeService.getHotdogSearchTerms(),
        videoDuration: config.video_duration || 'any',
        publishedWithin: config.published_within || 7,
        minViewCount: config.min_view_count || 500,
        includeChannelIds: config.include_channel_ids || [],
        excludeChannelIds: config.exclude_channel_ids || [],
        lastScanId: config.last_scan_id,
        lastScanTime: config.last_scan_time ? new Date(config.last_scan_time) : undefined
      }
    } catch (error) {
      // If table doesn't exist, return defaults
      return {
        isEnabled: false,
        scanInterval: 120,
        maxVideosPerScan: 20,
        searchTerms: this.youtubeService.getHotdogSearchTerms(),
        videoDuration: 'any',
        publishedWithin: 7,
        minViewCount: 500,
        includeChannelIds: [],
        excludeChannelIds: []
      }
    }
  }

  /**
   * Update scan configuration
   */
  async updateScanConfig(config: Partial<YouTubeScanConfig>): Promise<void> {
    try {
      const existing = await this.getScanConfig()
      const updated = { ...existing, ...config }

      await query('youtube_scan_config')
        .upsert({
          is_enabled: updated.isEnabled,
          scan_interval: updated.scanInterval,
          max_videos_per_scan: updated.maxVideosPerScan,
          search_terms: updated.searchTerms,
          video_duration: updated.videoDuration,
          published_within: updated.publishedWithin,
          min_view_count: updated.minViewCount,
          include_channel_ids: updated.includeChannelIds,
          exclude_channel_ids: updated.excludeChannelIds,
          last_scan_id: updated.lastScanId,
          last_scan_time: updated.lastScanTime,
          updated_at: new Date()
        })

      await logToDatabase(
        LogLevel.INFO,
        'YOUTUBE_CONFIG_UPDATED',
        'YouTube scan configuration updated',
        { config: updated }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_CONFIG_UPDATE_ERROR',
        `Failed to update YouTube configuration: ${error.message}`,
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
  private async recordScanResult(result: YouTubeScanResult): Promise<void> {
    try {
      await insert('youtube_scan_results')
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
          search_terms_used: result.searchTermsUsed,
          highest_views: result.highestViewedVideo?.viewCount || 0,
          quota_used: result.quotaUsed,
          errors: result.errors,
          created_at: new Date()
        })

    } catch (error) {
      // Don't throw error here, just log it
      await logToDatabase(
        LogLevel.WARNING,
        'YOUTUBE_SCAN_RESULT_RECORD_ERROR',
        `Failed to record YouTube scan result: ${error.message}`,
        { scanId: result.scanId, error: error.message }
      )
    }
  }

  /**
   * Test YouTube API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const status = await this.youtubeService.getApiStatus()
      
      if (status.isAuthenticated) {
        return {
          success: true,
          message: 'YouTube API connection successful',
          details: status
        }
      } else {
        return {
          success: false,
          message: status.lastError || 'YouTube API not authenticated',
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

export const youtubeScanningService = new YouTubeScanningService()