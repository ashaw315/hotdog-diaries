import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { tiktokMonitoringService } from './tiktok-monitoring'
import { TikTokScraper } from './web-scraping/tiktok-scraper'
import { loggingService } from './logging'
import { metricsService } from './metrics'

export interface TikTokSearchOptions {
  keywords: string[]
  limit?: number
  minViews?: number
  maxResults?: number
  sortBy?: 'relevance' | 'create_time' | 'view_count'
  publishedAfter?: Date
}

export interface ProcessedTikTokVideo {
  id: string
  title: string
  description: string
  videoUrl: string
  thumbnailUrl: string
  webUrl: string
  username: string
  userDisplayName: string
  userId: string
  createdAt: Date
  duration: number
  viewCount: number
  likeCount: number
  shareCount: number
  commentCount: number
  hashtags: string[]
  effects: string[]
  sounds?: {
    id: string
    title: string
    author: string
  }
  isCommercial: boolean
  region?: string
}

export interface TikTokAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string[]
  openId: string
}

export interface TikTokApiStatus {
  isAuthenticated: boolean
  rateLimits: {
    used: number
    remaining: number
    resetTime: Date
  }
  lastError?: string
  lastRequest?: Date
  tokenExpiresAt?: Date
  quota: {
    daily: { used: number; limit: number }
    hourly: { used: number; limit: number }
  }
}

export interface TikTokUserInfo {
  openId: string
  unionId: string
  avatarUrl: string
  displayName: string
  username: string
  followerCount: number
  followingCount: number
  likesCount: number
  videoCount: number
}

export class TikTokService {
  private static readonly API_BASE_URL = 'https://open.tiktokapis.com'
  private static readonly AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize'
  private static readonly TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token'
  
  // TikTok API rate limits
  private static readonly RATE_LIMIT_PER_DAY = 1000
  private static readonly RATE_LIMIT_PER_HOUR = 100
  
  private rateLimitTracker = {
    daily: { used: 0, remaining: 1000, resetTime: new Date() },
    hourly: { used: 0, remaining: 100, resetTime: new Date() }
  }

  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiresAt: Date | null = null
  private scraper: TikTokScraper
  private useWebScraping: boolean

  constructor() {
    // Load existing tokens from environment or database
    this.accessToken = process.env.TIKTOK_ACCESS_TOKEN || null
    this.refreshToken = process.env.TIKTOK_REFRESH_TOKEN || null
    if (process.env.TIKTOK_TOKEN_EXPIRES_AT) {
      this.tokenExpiresAt = new Date(process.env.TIKTOK_TOKEN_EXPIRES_AT)
    }

    // Initialize web scraper
    this.scraper = new TikTokScraper({
      headless: process.env.NODE_ENV === 'production',
      rateLimitMs: 120000 // 2 minutes between requests
    })

    // Use web scraping by default, fall back to API if available
    this.useWebScraping = process.env.TIKTOK_USE_API !== 'true'
  }

  /**
   * Search TikTok videos by keywords
   */
  async searchVideos(options: TikTokSearchOptions): Promise<ProcessedTikTokVideo[]> {
    const startTime = Date.now()
    try {
      const searchQuery = options.keywords.join(' ')
      const limit = Math.min(options.limit || 20, 100)

      let videos: ProcessedTikTokVideo[] = []

      if (this.useWebScraping) {
        // Use web scraping approach
        await loggingService.logInfo('TikTokService', 'Using web scraping for video search', {
          keywords: options.keywords,
          limit
        })

        const scrapingResult = await this.scraper.scrapeContent(searchQuery, limit)
        
        if (!scrapingResult.success) {
          throw new Error(`Web scraping failed: ${scrapingResult.error}`)
        }

        // Convert scraped content to ProcessedTikTokVideo format
        for (const scrapedContent of scrapingResult.data || []) {
          const processedVideo = await this.convertScrapedToProcessed(scrapedContent)
          
          // Apply minimum views filter
          if (options.minViews && processedVideo.viewCount < options.minViews) {
            continue
          }

          // Additional validation for hotdog relevance
          if (await this.validateTikTokContent(processedVideo)) {
            videos.push(processedVideo)
          }
        }

        await loggingService.logInfo('TikTokService', 'Web scraping search completed', {
          keywords: options.keywords,
          scraped: scrapingResult.data?.length || 0,
          processed: videos.length,
          responseTime: scrapingResult.responseTime
        })

      } else {
        // Fallback to API approach (existing implementation)
        if (!this.accessToken) {
          throw new Error('TikTok access token not available. Please authenticate first.')
        }

        await this.checkRateLimit()
        await this.checkTokenExpiration()

        const sortBy = options.sortBy || 'relevance'

        // TikTok Research API endpoint for video search
        const queryParams = new URLSearchParams({
          query: searchQuery,
          max_count: limit.toString(),
          sort_by: sortBy,
          start_date: options.publishedAfter ? 
            options.publishedAfter.toISOString().split('T')[0] : 
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Default 7 days back
        })

        const response = await fetch(
          `${TikTokService.API_BASE_URL}/v2/research/video/query/?${queryParams}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query: {
                and: options.keywords.map(keyword => ({
                  operation: 'IN',
                  field_name: 'hashtag_name',
                  field_values: [keyword]
                }))
              },
              max_count: limit
            })
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`TikTok API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
        }

        const data = await response.json()
        this.updateRateLimit()
        
        if (data.data && data.data.videos) {
          for (const video of data.data.videos) {
            try {
              const processedVideo = await this.processTikTokVideo(video)
              
              // Apply minimum views filter
              if (options.minViews && processedVideo.viewCount < options.minViews) {
                continue
              }

              videos.push(processedVideo)
            } catch (error) {
              await logToDatabase(
                LogLevel.WARNING,
                'TIKTOK_VIDEO_PROCESS_ERROR',
                `Failed to process TikTok video ${video.id}: ${error.message}`,
                { videoId: video.id, error: error.message }
              )
            }
          }
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'TIKTOK_SEARCH_SUCCESS',
        `Found ${videos.length} TikTok videos for keywords: ${options.keywords.join(', ')}`,
        { 
          keywords: options.keywords,
          videosFound: videos.length,
          limit,
          method: this.useWebScraping ? 'scraping' : 'api'
        }
      )

      // Record successful request for monitoring
      const requestTime = Date.now() - startTime
      await tiktokMonitoringService.recordApiRequest(true, requestTime)
      await metricsService.recordAPIMetric('tiktok', 'search_videos', requestTime, 200)

      return videos

    } catch (error) {
      // Record failed request for monitoring
      const requestTime = Date.now() - startTime
      const errorType = error.message.includes('rate limit') ? 'rate_limit' : 
                       error.message.includes('token') ? 'auth_error' : 
                       error.message.includes('scraping') ? 'scraping_error' : 'api_error'
      await tiktokMonitoringService.recordApiRequest(false, requestTime, errorType)
      await metricsService.recordAPIMetric('tiktok', 'search_videos', requestTime, 500)

      if (error.message.includes('rate limit')) {
        await tiktokMonitoringService.recordRateLimitHit(this.rateLimitTracker.hourly.resetTime)
      }

      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_SEARCH_ERROR',
        `TikTok video search failed: ${error.message}`,
        { 
          keywords: options.keywords,
          error: error.message,
          method: this.useWebScraping ? 'scraping' : 'api'
        }
      )
      
      throw new Error(`TikTok video search failed: ${error.message}`)
    }
  }

  /**
   * Get detailed information about a specific TikTok video
   */
  async getVideoDetails(videoId: string): Promise<ProcessedTikTokVideo> {
    try {
      if (!this.accessToken) {
        throw new Error('TikTok access token not available')
      }

      await this.checkRateLimit()
      await this.checkTokenExpiration()

      const response = await fetch(
        `${TikTokService.API_BASE_URL}/v2/video/info/?video_id=${videoId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`TikTok API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()
      this.updateRateLimit()

      return this.processTikTokVideo(data.data)

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_VIDEO_DETAILS_ERROR',
        `Failed to get TikTok video details: ${error.message}`,
        { videoId, error: error.message }
      )
      throw error
    }
  }

  /**
   * Convert scraped content to ProcessedTikTokVideo format
   */
  private async convertScrapedToProcessed(scrapedContent: any): Promise<ProcessedTikTokVideo> {
    try {
      const hashtags = scrapedContent.metadata?.hashtags || []
      const videoId = scrapedContent.id

      const processedVideo: ProcessedTikTokVideo = {
        id: videoId,
        title: scrapedContent.content_text?.substring(0, 100) || 'TikTok hotdog video',
        description: scrapedContent.content_text || '',
        videoUrl: scrapedContent.content_video_url || scrapedContent.original_url,
        thumbnailUrl: scrapedContent.metadata?.thumbnail_url || '',
        webUrl: scrapedContent.original_url,
        username: scrapedContent.original_author,
        userDisplayName: scrapedContent.metadata?.display_name || scrapedContent.original_author,
        userId: scrapedContent.original_author, // Use username as ID for scraped content
        createdAt: scrapedContent.metadata?.created_at || scrapedContent.scraped_at,
        duration: 0, // Not available from scraping
        viewCount: scrapedContent.metadata?.views || 0,
        likeCount: scrapedContent.metadata?.likes || 0,
        shareCount: scrapedContent.metadata?.shares || 0,
        commentCount: scrapedContent.metadata?.comments || 0,
        hashtags,
        effects: [], // Not available from scraping
        sounds: scrapedContent.metadata?.music ? {
          id: 'scraped',
          title: scrapedContent.metadata.music.title || 'Unknown',
          author: scrapedContent.metadata.music.author || 'Unknown'
        } : undefined,
        isCommercial: false, // Not detectable from scraping
        region: undefined // Not available from scraping
      }

      return processedVideo

    } catch (error) {
      await loggingService.logError('TikTokService', 'Failed to convert scraped content', {
        scrapedId: scrapedContent.id,
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Process raw TikTok video data into structured format
   */
  async processTikTokVideo(video: any): Promise<ProcessedTikTokVideo> {
    try {
      const hashtags = this.extractHashtags(video.hashtag_names || [])
      const effects = video.effect_ids || []

      const processedVideo: ProcessedTikTokVideo = {
        id: video.id,
        title: video.title || video.video_description || '',
        description: video.video_description || '',
        videoUrl: video.video_url || `https://www.tiktok.com/@${video.username}/video/${video.id}`,
        thumbnailUrl: video.cover_image_url || '',
        webUrl: `https://www.tiktok.com/@${video.username}/video/${video.id}`,
        username: video.username || 'unknown',
        userDisplayName: video.user_display_name || video.username || 'unknown',
        userId: video.user_id || 'unknown',
        createdAt: new Date(video.create_time * 1000), // TikTok uses Unix timestamp
        duration: video.duration || 0,
        viewCount: video.view_count || 0,
        likeCount: video.like_count || 0,
        shareCount: video.share_count || 0,
        commentCount: video.comment_count || 0,
        hashtags,
        effects,
        sounds: video.music ? {
          id: video.music.id,
          title: video.music.title,
          author: video.music.author
        } : undefined,
        isCommercial: video.is_stem_verified || false,
        region: video.region_code
      }

      return processedVideo

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_VIDEO_PROCESS_ERROR',
        `Failed to process TikTok video: ${error.message}`,
        { videoId: video.id, error: error.message }
      )
      throw error
    }
  }

  /**
   * Handle TikTok OAuth authentication flow
   */
  async handleTikTokAuth(authCode: string, redirectUri?: string): Promise<TikTokAuthTokens> {
    try {
      const clientKey = process.env.TIKTOK_CLIENT_KEY
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET

      if (!clientKey || !clientSecret) {
        throw new Error('TikTok client credentials not configured')
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch(TikTokService.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri || `${process.env.NEXT_PUBLIC_BASE_URL}/admin/tiktok/callback`
        })
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}))
        throw new Error(`Token exchange failed: ${errorData.error_description || tokenResponse.statusText}`)
      }

      const tokenData = await tokenResponse.json()

      const tokens: TikTokAuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        scope: tokenData.scope?.split(',') || ['user.info.basic', 'video.list'],
        openId: tokenData.open_id
      }

      // Store the tokens
      this.accessToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken
      this.tokenExpiresAt = tokens.expiresAt

      await logToDatabase(
        LogLevel.INFO,
        'TIKTOK_AUTH_SUCCESS',
        'TikTok authentication completed successfully',
        { openId: tokens.openId, expiresAt: tokens.expiresAt }
      )

      return tokens

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_AUTH_ERROR',
        `TikTok authentication failed: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Refresh TikTok access token
   */
  async refreshAccessToken(): Promise<void> {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available')
      }

      const clientKey = process.env.TIKTOK_CLIENT_KEY
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET

      if (!clientKey || !clientSecret) {
        throw new Error('TikTok client credentials not configured')
      }

      const response = await fetch(TikTokService.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Token refresh failed: ${errorData.error_description || response.statusText}`)
      }

      const data = await response.json()

      this.accessToken = data.access_token
      this.refreshToken = data.refresh_token
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000)

      await logToDatabase(
        LogLevel.INFO,
        'TIKTOK_TOKEN_REFRESHED',
        'TikTok access token refreshed successfully',
        { expiresAt: this.tokenExpiresAt }
      )

      // Record successful token refresh for monitoring
      await tiktokMonitoringService.recordTokenRefresh(true, this.tokenExpiresAt)

    } catch (error) {
      // Record failed token refresh for monitoring
      await tiktokMonitoringService.recordTokenRefresh(false)

      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_TOKEN_REFRESH_ERROR',
        `Failed to refresh TikTok access token: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Get TikTok API status
   */
  async getApiStatus(): Promise<TikTokApiStatus> {
    try {
      let isAuthenticated = false

      if (this.useWebScraping) {
        // Test web scraping access
        const accessTest = await this.scraper.testAccess()
        isAuthenticated = accessTest.accessible

        return {
          isAuthenticated,
          rateLimits: {
            used: 0, // Web scraping doesn't use API rate limits
            remaining: 999,
            resetTime: new Date(Date.now() + 60 * 60 * 1000)
          },
          lastRequest: new Date(),
          lastError: accessTest.error,
          quota: {
            daily: { used: 0, limit: 999 },
            hourly: { used: 0, limit: 999 }
          }
        }

      } else {
        // API mode
        if (this.accessToken && this.tokenExpiresAt) {
          // Test the token by making a simple API call
          try {
            const response = await fetch(
              `${TikTokService.API_BASE_URL}/v2/user/info/`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${this.accessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            )
            isAuthenticated = response.ok
            this.updateRateLimit()
          } catch (error) {
            isAuthenticated = false
          }
        }

        return {
          isAuthenticated,
          rateLimits: this.rateLimitTracker.hourly,
          tokenExpiresAt: this.tokenExpiresAt || undefined,
          lastRequest: new Date(),
          quota: {
            daily: this.rateLimitTracker.daily,
            hourly: this.rateLimitTracker.hourly
          }
        }
      }

    } catch (error) {
      return {
        isAuthenticated: false,
        rateLimits: {
          used: 0,
          remaining: 0,
          resetTime: new Date()
        },
        lastError: error.message,
        lastRequest: new Date(),
        quota: {
          daily: { used: 0, limit: TikTokService.RATE_LIMIT_PER_DAY },
          hourly: { used: 0, limit: TikTokService.RATE_LIMIT_PER_HOUR }
        }
      }
    }
  }

  /**
   * Get hotdog-focused keywords for TikTok searches
   */
  getHotdogKeywords(): string[] {
    return [
      'hotdog', 'hot dog', 'hotdogs', 'frankfurter', 'wiener',
      'bratwurst', 'sausage', 'corndog', 'chilidog',
      'hotdogchallenge', 'foodtok', 'grilling', 'bbq',
      'ballparkfood', 'streetfood', 'fastfood',
      'hotdogrecipe', 'grilledhotdog', 'americanfood'
    ]
  }

  /**
   * Get food-related hashtags for TikTok searches
   */
  getFoodHashtags(): string[] {
    return [
      'foodtok', 'hotdogchallenge', 'grilling', 'bbqtok',
      'streetfood', 'fastfood', 'americanfood', 'foodie',
      'cookingshow', 'recipetok', 'foodprep', 'grilltok'
    ]
  }

  /**
   * Validate TikTok content for hotdog relevance
   */
  async validateTikTokContent(video: ProcessedTikTokVideo): Promise<boolean> {
    try {
      // Check for hotdog-related terms in title and description
      const hotdogTerms = [
        'hotdog', 'hot dog', 'hotdogs', 'hot dogs',
        'frankfurter', 'wiener', 'bratwurst', 'sausage',
        'chili dog', 'corn dog', 'ballpark frank'
      ]

      const textContent = `${video.title} ${video.description}`.toLowerCase()
      const hasHotdogTerm = hotdogTerms.some(term => textContent.includes(term))

      // Check hashtags
      const hasHotdogHashtag = video.hashtags.some(tag => 
        this.getHotdogKeywords().includes(tag.toLowerCase())
      )

      // Must have hotdog relevance
      if (!hasHotdogTerm && !hasHotdogHashtag) {
        return false
      }

      // Check for spam indicators
      const spamIndicators = [
        'buy now', 'click link', 'dm me', 'link in bio',
        'promo code', 'discount', 'sale', 'affiliate',
        'subscribe', 'follow for more'
      ]

      const hasSpamIndicators = spamIndicators.some(indicator =>
        textContent.includes(indicator)
      )

      if (hasSpamIndicators) {
        return false
      }

      // Prefer content with good engagement
      const hasGoodEngagement = video.viewCount > 1000 || video.likeCount > 50
      const hasValidVideo = video.videoUrl && video.videoUrl.length > 0

      return hasValidVideo && hasGoodEngagement

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_VALIDATION_ERROR',
        `TikTok content validation failed: ${error.message}`,
        { videoId: video.id, error: error.message }
      )
      return false
    }
  }

  // Private helper methods

  private extractHashtags(hashtagNames: string[]): string[] {
    return hashtagNames.map(tag => tag.replace('#', '').toLowerCase())
  }

  private async checkRateLimit(): Promise<void> {
    const now = new Date()
    
    // Reset hourly rate limit counter if hour has passed
    if (now >= this.rateLimitTracker.hourly.resetTime) {
      this.rateLimitTracker.hourly.used = 0
      this.rateLimitTracker.hourly.remaining = TikTokService.RATE_LIMIT_PER_HOUR
      this.rateLimitTracker.hourly.resetTime = new Date(now.getTime() + 60 * 60 * 1000)
    }

    // Reset daily rate limit counter if day has passed
    if (now >= this.rateLimitTracker.daily.resetTime) {
      this.rateLimitTracker.daily.used = 0
      this.rateLimitTracker.daily.remaining = TikTokService.RATE_LIMIT_PER_DAY
      this.rateLimitTracker.daily.resetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    }
    
    if (this.rateLimitTracker.hourly.remaining <= 0) {
      const waitTime = this.rateLimitTracker.hourly.resetTime.getTime() - now.getTime()
      throw new Error(`TikTok API hourly rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)} seconds`)
    }

    if (this.rateLimitTracker.daily.remaining <= 0) {
      const waitTime = this.rateLimitTracker.daily.resetTime.getTime() - now.getTime()
      throw new Error(`TikTok API daily rate limit exceeded. Reset in ${Math.ceil(waitTime / (1000 * 60 * 60))} hours`)
    }
  }

  private async checkTokenExpiration(): Promise<void> {
    if (!this.tokenExpiresAt) {
      return
    }

    const now = new Date()
    const expiresIn = this.tokenExpiresAt.getTime() - now.getTime()
    
    // Refresh token if it expires within 24 hours
    if (expiresIn < 24 * 60 * 60 * 1000) {
      await this.refreshAccessToken()
    }
  }

  private updateRateLimit(): void {
    this.rateLimitTracker.hourly.used++
    this.rateLimitTracker.hourly.remaining = Math.max(0, TikTokService.RATE_LIMIT_PER_HOUR - this.rateLimitTracker.hourly.used)
    
    this.rateLimitTracker.daily.used++
    this.rateLimitTracker.daily.remaining = Math.max(0, TikTokService.RATE_LIMIT_PER_DAY - this.rateLimitTracker.daily.used)
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.useWebScraping && this.scraper) {
      await this.scraper.cleanup()
    }
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    if (this.useWebScraping) {
      return {
        mode: 'web_scraping',
        scraper_stats: this.scraper.getTikTokStats(),
        rate_limits: this.rateLimitTracker
      }
    } else {
      return {
        mode: 'api',
        rate_limits: this.rateLimitTracker,
        token_expires_at: this.tokenExpiresAt
      }
    }
  }
}

export const tiktokService = new TikTokService()