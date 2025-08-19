import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { youtubeMonitoringService } from './youtube-monitoring'
import { loadEnv } from '@/lib/env'

// Ensure environment variables are loaded
loadEnv()

export interface YouTubeSearchOptions {
  query: string
  maxResults?: number
  order?: 'relevance' | 'date' | 'rating' | 'viewCount'
  publishedAfter?: Date
  videoDuration?: 'any' | 'short' | 'medium' | 'long'
  videoDefinition?: 'any' | 'high' | 'standard'
}

export interface ProcessedYouTubeVideo {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  videoUrl: string
  embedUrl: string
  channelTitle: string
  channelId: string
  publishedAt: Date
  duration: string
  viewCount: number
  likeCount?: number
  commentCount?: number
  tags: string[]
  categoryId: string
  defaultLanguage?: string
  isLiveBroadcast: boolean
}

export interface YouTubeApiStatus {
  isAuthenticated: boolean
  quotaUsed: number
  quotaRemaining: number
  quotaResetTime: Date
  lastError?: string
  lastRequest?: Date
}

export class YouTubeService {
  private static readonly API_BASE_URL = 'https://www.googleapis.com/youtube/v3'
  private static readonly DAILY_QUOTA_LIMIT = 10000 // YouTube Data API v3 free quota
  
  private apiKey: string | null = null
  private quotaTracker = {
    used: 0,
    remaining: 10000,
    resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // Reset daily
  }

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || null
    
    if (!this.apiKey) {
      console.warn('YouTube API key not found in environment variables')
    }
  }

  /**
   * Search YouTube for hotdog-related videos
   */
  async searchVideos(options: YouTubeSearchOptions): Promise<ProcessedYouTubeVideo[]> {
    const startTime = Date.now()
    try {
      if (!this.apiKey) {
        throw new Error('YouTube API key not configured')
      }

      await this.checkQuotaLimit()

      const searchParams = new URLSearchParams({
        part: 'snippet',
        q: options.query,
        type: 'video',
        maxResults: Math.min(options.maxResults || 25, 50).toString(),
        order: options.order || 'relevance',
        key: this.apiKey,
        safeSearch: 'moderate'
      })
      
      // Note: videoDefinition and videoDuration are not valid for search endpoint

      if (options.publishedAfter) {
        searchParams.append('publishedAfter', options.publishedAfter.toISOString())
      }

      const searchUrl = `${YouTubeService.API_BASE_URL}/search?${searchParams}`
      console.log('🔍 YOUTUBE API: Calling search URL:', searchUrl)
      
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
      
      console.log('🔍 YOUTUBE API: Response status:', searchResponse.status)
      
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text()
        console.log('🔍 YOUTUBE API: Error response:', errorText)
        throw new Error(`YouTube API error: ${searchResponse.status} - ${errorText}`)
      }

      const searchData = await searchResponse.json()
      console.log('🔍 YOUTUBE API: Response data:', JSON.stringify(searchData, null, 2))
      this.updateQuotaUsage(100) // Search costs 100 quota units

      // Get video details for additional metadata
      const videoIds = searchData.items?.map((item: any) => item.id.videoId).filter(Boolean) || []
      const videoDetails = videoIds.length > 0 ? await this.getVideoDetails(videoIds) : []

      // Process and combine data
      const processedVideos: ProcessedYouTubeVideo[] = []
      
      for (const item of searchData.items || []) {
        if (item.id?.videoId) {
          const videoDetail = videoDetails.find(v => v.id === item.id.videoId)
          const processedVideo = await this.processYouTubeVideo(item, videoDetail)
          
          // Validate content for hotdog relevance
          // TEMPORARILY DISABLED FOR TESTING
          const isValid = await this.validateYouTubeContent(processedVideo)
          console.log(`🔍 Video "${processedVideo.title}" validation: ${isValid}`)
          
          if (true) { // Always add for testing
            processedVideos.push(processedVideo)
          }
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'YOUTUBE_SEARCH_SUCCESS',
        `Found ${processedVideos.length} YouTube videos for query: ${options.query}`,
        { 
          query: options.query,
          videosFound: processedVideos.length,
          quotaUsed: this.quotaTracker.used
        }
      )

      // Record successful request for monitoring
      const requestTime = Date.now() - startTime
      await youtubeMonitoringService.recordApiRequest(true, requestTime)

      return processedVideos

    } catch (error) {
      // Record failed request for monitoring
      const requestTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorType = errorMessage.includes('quota') ? 'quota_limit' : 
                       errorMessage.includes('key') ? 'auth_error' : 'api_error'
      await youtubeMonitoringService.recordApiRequest(false, requestTime, errorType)

      if (errorMessage.includes('quota')) {
        await youtubeMonitoringService.recordQuotaLimitHit(this.quotaTracker.resetTime)
      }

      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_SEARCH_ERROR',
        `YouTube search failed: ${errorMessage}`,
        { 
          query: options.query,
          error: errorMessage
        }
      )
      
      throw new Error(`YouTube search failed: ${errorMessage}`)
    }
  }

  /**
   * Get detailed video information
   */
  private async getVideoDetails(videoIds: string[]): Promise<any[]> {
    if (!this.apiKey || videoIds.length === 0) {
      return []
    }

    try {
      const detailsParams = new URLSearchParams({
        part: 'snippet,statistics,contentDetails,status',
        id: videoIds.join(','),
        key: this.apiKey
      })

      const response = await fetch(
        `${YouTubeService.API_BASE_URL}/videos?${detailsParams}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        console.warn('Failed to get video details:', response.statusText)
        return []
      }

      const data = await response.json()
      this.updateQuotaUsage(1) // Videos endpoint costs 1 quota unit

      return data.items || []

    } catch (error) {
      console.warn('Error fetching video details:', error.message)
      return []
    }
  }

  /**
   * Process YouTube video data into structured format
   */
  private async processYouTubeVideo(searchItem: any, videoDetail?: any): Promise<ProcessedYouTubeVideo> {
    const snippet = searchItem.snippet
    const statistics = videoDetail?.statistics || {}
    const contentDetails = videoDetail?.contentDetails || {}

    return {
      id: searchItem.id.videoId,
      title: snippet.title || '',
      description: snippet.description || '',
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
      videoUrl: `https://www.youtube.com/watch?v=${searchItem.id.videoId}`,
      embedUrl: `https://www.youtube.com/embed/${searchItem.id.videoId}`,
      channelTitle: snippet.channelTitle || '',
      channelId: snippet.channelId || '',
      publishedAt: new Date(snippet.publishedAt),
      duration: contentDetails.duration || 'PT0S',
      viewCount: parseInt(statistics.viewCount || '0'),
      likeCount: parseInt(statistics.likeCount || '0'),
      commentCount: parseInt(statistics.commentCount || '0'),
      tags: videoDetail?.snippet?.tags || [],
      categoryId: videoDetail?.snippet?.categoryId || '0',
      defaultLanguage: videoDetail?.snippet?.defaultLanguage,
      isLiveBroadcast: snippet.liveBroadcastContent === 'live'
    }
  }

  /**
   * Validate YouTube content for hotdog relevance
   */
  async validateYouTubeContent(video: ProcessedYouTubeVideo): Promise<boolean> {
    try {
      // Check for hotdog-related terms in title and description
      const hotdogTerms = [
        'hotdog', 'hot dog', 'hotdogs', 'hot dogs',
        'frankfurter', 'wiener', 'bratwurst', 'sausage',
        'ballpark frank', 'chili dog', 'corn dog',
        'grilling hotdog', 'hotdog recipe', 'hotdog review'
      ]

      const searchText = `${video.title} ${video.description}`.toLowerCase()
      const hasHotdogTerm = hotdogTerms.some(term => searchText.includes(term))

      if (!hasHotdogTerm) {
        return false
      }

      // Check for spam indicators
      const spamIndicators = [
        'clickbait', 'fake', 'scam', 'virus', 'hack',
        'free money', 'get rich quick', 'miracle cure'
      ]

      const hasSpamIndicators = spamIndicators.some(indicator =>
        searchText.includes(indicator)
      )

      if (hasSpamIndicators) {
        return false
      }

      // Prefer videos with good engagement and reasonable duration
      const hasGoodEngagement = video.viewCount > 1000 || (video.likeCount && video.likeCount > 10)
      const hasReasonableDuration = !video.duration.includes('PT0S') // Not zero duration
      const isNotLive = !video.isLiveBroadcast // Skip live streams

      return hasGoodEngagement && hasReasonableDuration && isNotLive

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_VALIDATION_ERROR',
        `YouTube content validation failed: ${errorMessage}`,
        { videoId: video.id, error: errorMessage }
      )
      return false
    }
  }

  /**
   * Get hotdog-focused search terms for YouTube
   */
  getHotdogSearchTerms(): string[] {
    return [
      'hotdog recipe',
      'best hotdogs',
      'hotdog challenge',
      'ballpark food',
      'grilling hotdogs',
      'hotdog review',
      'homemade hotdogs',
      'hotdog competition',
      'street food hotdogs',
      'gourmet hotdogs'
    ]
  }

  /**
   * Get YouTube API status and quota usage
   */
  async getApiStatus(): Promise<YouTubeApiStatus> {
    try {
      if (!this.apiKey) {
        return {
          isAuthenticated: false,
          quotaUsed: 0,
          quotaRemaining: 0,
          quotaResetTime: new Date(),
          lastError: 'API key not configured'
        }
      }

      // Test connection with a simple search
      const testParams = new URLSearchParams({
        part: 'snippet',
        q: 'hotdog',
        type: 'video',
        maxResults: '1',
        key: this.apiKey
      })

      const response = await fetch(
        `${YouTubeService.API_BASE_URL}/search?${testParams}`,
        { method: 'GET' }
      )

      const isAuthenticated = response.ok
      if (response.ok) {
        this.updateQuotaUsage(100) // Test search costs quota
      }

      return {
        isAuthenticated,
        quotaUsed: this.quotaTracker.used,
        quotaRemaining: this.quotaTracker.remaining,
        quotaResetTime: this.quotaTracker.resetTime,
        lastRequest: new Date(),
        lastError: isAuthenticated ? undefined : `HTTP ${response.status}`
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        isAuthenticated: false,
        quotaUsed: this.quotaTracker.used,
        quotaRemaining: this.quotaTracker.remaining,
        quotaResetTime: this.quotaTracker.resetTime,
        lastError: errorMessage,
        lastRequest: new Date()
      }
    }
  }

  /**
   * Check quota limit before making API calls
   */
  private async checkQuotaLimit(): Promise<void> {
    const now = new Date()
    
    // Reset quota counter if day has passed
    if (now >= this.quotaTracker.resetTime) {
      this.quotaTracker.used = 0
      this.quotaTracker.remaining = YouTubeService.DAILY_QUOTA_LIMIT
      this.quotaTracker.resetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    }
    
    if (this.quotaTracker.remaining <= 100) { // Reserve 100 units minimum
      const waitTime = this.quotaTracker.resetTime.getTime() - now.getTime()
      throw new Error(`YouTube API quota exceeded. Reset in ${Math.ceil(waitTime / 1000 / 60 / 60)} hours`)
    }
  }

  /**
   * Update quota usage tracking
   */
  private updateQuotaUsage(units: number): void {
    this.quotaTracker.used += units
    this.quotaTracker.remaining = Math.max(0, YouTubeService.DAILY_QUOTA_LIMIT - this.quotaTracker.used)
  }

  /**
   * Parse YouTube duration format (PT1M30S) to seconds
   */
  static parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0
    
    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')
    
    return hours * 3600 + minutes * 60 + seconds
  }

  /**
   * Format duration seconds to human readable format
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }
  }
}

export const youtubeService = new YouTubeService()