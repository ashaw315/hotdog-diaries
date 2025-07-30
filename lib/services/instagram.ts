import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { instagramMonitoringService } from './instagram-monitoring'

export interface InstagramSearchOptions {
  hashtag: string
  limit?: number
  minLikes?: number
  includeStories?: boolean
}

export interface ProcessedInstagramMedia {
  id: string
  caption: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  mediaUrl: string
  thumbnailUrl?: string
  permalink: string
  username: string
  userId: string
  timestamp: Date
  likesCount: number
  commentsCount: number
  hashtags: string[]
  mentions: string[]
  location?: {
    id: string
    name: string
  }
  isStory: boolean
  carouselMedia?: Array<{
    id: string
    mediaType: 'IMAGE' | 'VIDEO'
    mediaUrl: string
  }>
}

export interface InstagramAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  scope: string[]
  userId: string
}

export interface InstagramApiStatus {
  isAuthenticated: boolean
  rateLimits: {
    used: number
    remaining: number
    resetTime: Date
  }
  lastError?: string
  lastRequest?: Date
  tokenExpiresAt?: Date
}

export interface InstagramUserInfo {
  id: string
  username: string
  accountType: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL'
  mediaCount: number
}

export class InstagramService {
  private static readonly API_BASE_URL = 'https://graph.instagram.com'
  private static readonly BASIC_DISPLAY_URL = 'https://api.instagram.com'
  private static readonly RATE_LIMIT_PER_HOUR = 200 // Instagram API limit
  
  private rateLimitTracker = {
    used: 0,
    remaining: 200,
    resetTime: new Date(Date.now() + 60 * 60 * 1000) // Reset every hour
  }

  private accessToken: string | null = null
  private tokenExpiresAt: Date | null = null

  constructor() {
    // Load existing token from environment or database
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || null
    if (process.env.INSTAGRAM_TOKEN_EXPIRES_AT) {
      this.tokenExpiresAt = new Date(process.env.INSTAGRAM_TOKEN_EXPIRES_AT)
    }
  }

  /**
   * Search Instagram hashtags for hotdog content
   */
  async searchHashtags(options: InstagramSearchOptions): Promise<ProcessedInstagramMedia[]> {
    const startTime = Date.now()
    try {
      if (!this.accessToken) {
        throw new Error('Instagram access token not available. Please authenticate first.')
      }

      await this.checkRateLimit()
      await this.checkTokenExpiration()

      const hashtag = options.hashtag.replace('#', '') // Remove # if present
      const limit = Math.min(options.limit || 25, 50) // Instagram API limits

      // Instagram Basic Display API doesn't support hashtag search directly
      // We'll need to use Instagram Graph API (requires business account)
      // For now, we'll implement a fallback using user media search

      const mediaList: ProcessedInstagramMedia[] = []

      // Search user's own media first (Basic Display API limitation)
      const userMedia = await this.getUserMedia(limit)
      
      // Filter media that contains the hashtag in caption
      for (const media of userMedia) {
        if (this.containsHashtag(media.caption, hashtag) || 
            this.isHotdogRelated(media.caption)) {
          
          const processedMedia = await this.processInstagramMedia(media)
          
          // Apply minimum likes filter
          if (options.minLikes && processedMedia.likesCount < options.minLikes) {
            continue
          }

          mediaList.push(processedMedia)
        }
      }

      this.updateRateLimit()

      await logToDatabase(
        LogLevel.INFO,
        'INSTAGRAM_HASHTAG_SEARCH_SUCCESS',
        `Found ${mediaList.length} Instagram posts for hashtag #${hashtag}`,
        { 
          hashtag, 
          mediaFound: mediaList.length,
          limit 
        }
      )

      // Record successful API request for monitoring
      const requestTime = Date.now() - startTime
      await instagramMonitoringService.recordApiRequest(true, requestTime)

      return mediaList

    } catch (error) {
      // Record failed API request for monitoring
      const requestTime = Date.now() - startTime
      const errorType = error.message.includes('rate limit') ? 'rate_limit' : 
                       error.message.includes('token') ? 'auth_error' : 'api_error'
      await instagramMonitoringService.recordApiRequest(false, requestTime, errorType)

      if (error.message.includes('rate limit')) {
        await instagramMonitoringService.recordRateLimitHit(this.rateLimitTracker.resetTime)
      }

      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_HASHTAG_SEARCH_ERROR',
        `Instagram hashtag search failed: ${error.message}`,
        { 
          hashtag: options.hashtag,
          error: error.message 
        }
      )
      
      throw new Error(`Instagram hashtag search failed: ${error.message}`)
    }
  }

  /**
   * Get detailed media information from Instagram
   */
  async getMediaInfo(mediaId: string): Promise<ProcessedInstagramMedia> {
    try {
      if (!this.accessToken) {
        throw new Error('Instagram access token not available')
      }

      await this.checkRateLimit()
      await this.checkTokenExpiration()

      const fields = [
        'id', 'caption', 'media_type', 'media_url', 'thumbnail_url',
        'permalink', 'timestamp', 'username', 'like_count', 'comments_count'
      ].join(',')

      const response = await fetch(
        `${InstagramService.API_BASE_URL}/${mediaId}?fields=${fields}&access_token=${this.accessToken}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Instagram API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
      }

      const mediaData = await response.json()
      this.updateRateLimit()

      return this.processInstagramMedia(mediaData)

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_MEDIA_INFO_ERROR',
        `Failed to get Instagram media info: ${error.message}`,
        { mediaId, error: error.message }
      )
      throw error
    }
  }

  /**
   * Process raw Instagram media data into structured format
   */
  async processInstagramMedia(media: any): Promise<ProcessedInstagramMedia> {
    try {
      const hashtags = this.extractHashtags(media.caption || '')
      const mentions = this.extractMentions(media.caption || '')

      let carouselMedia: any[] = []
      if (media.media_type === 'CAROUSEL_ALBUM' && media.children) {
        // Get carousel children
        carouselMedia = await this.getCarouselChildren(media.id)
      }

      const processedMedia: ProcessedInstagramMedia = {
        id: media.id,
        caption: media.caption || '',
        mediaType: media.media_type,
        mediaUrl: media.media_url,
        thumbnailUrl: media.thumbnail_url,
        permalink: media.permalink,
        username: media.username || 'unknown',
        userId: media.user?.id || media.owner?.id || 'unknown',
        timestamp: new Date(media.timestamp),
        likesCount: media.like_count || 0,
        commentsCount: media.comments_count || 0,
        hashtags,
        mentions,
        location: media.location ? {
          id: media.location.id,
          name: media.location.name
        } : undefined,
        isStory: media.media_product_type === 'STORY',
        carouselMedia: carouselMedia.length > 0 ? carouselMedia : undefined
      }

      return processedMedia

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_MEDIA_PROCESS_ERROR',
        `Failed to process Instagram media: ${error.message}`,
        { mediaId: media.id, error: error.message }
      )
      throw error
    }
  }

  /**
   * Handle Instagram OAuth authentication flow
   */
  async handleInstagramAuth(authCode: string, redirectUri: string): Promise<InstagramAuthTokens> {
    try {
      const clientId = process.env.INSTAGRAM_CLIENT_ID
      const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        throw new Error('Instagram client credentials not configured')
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch(`${InstagramService.BASIC_DISPLAY_URL}/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code: authCode
        })
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}))
        throw new Error(`Token exchange failed: ${errorData.error_message || tokenResponse.statusText}`)
      }

      const tokenData = await tokenResponse.json()

      // Exchange short-lived token for long-lived token
      const longLivedResponse = await fetch(
        `${InstagramService.API_BASE_URL}/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${tokenData.access_token}`,
        { method: 'GET' }
      )

      if (!longLivedResponse.ok) {
        const errorData = await longLivedResponse.json().catch(() => ({}))
        throw new Error(`Long-lived token exchange failed: ${errorData.error?.message || longLivedResponse.statusText}`)
      }

      const longLivedData = await longLivedResponse.json()

      const tokens: InstagramAuthTokens = {
        accessToken: longLivedData.access_token,
        expiresAt: new Date(Date.now() + longLivedData.expires_in * 1000),
        scope: tokenData.scope?.split(',') || ['user_profile', 'user_media'],
        userId: tokenData.user_id
      }

      // Store the token
      this.accessToken = tokens.accessToken
      this.tokenExpiresAt = tokens.expiresAt

      await logToDatabase(
        LogLevel.INFO,
        'INSTAGRAM_AUTH_SUCCESS',
        'Instagram authentication completed successfully',
        { userId: tokens.userId, expiresAt: tokens.expiresAt }
      )

      return tokens

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_AUTH_ERROR',
        `Instagram authentication failed: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Refresh Instagram access token
   */
  async refreshAccessToken(): Promise<void> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token to refresh')
      }

      const response = await fetch(
        `${InstagramService.API_BASE_URL}/refresh_access_token?grant_type=ig_refresh_token&access_token=${this.accessToken}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Token refresh failed: ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()

      this.accessToken = data.access_token
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000)

      await logToDatabase(
        LogLevel.INFO,
        'INSTAGRAM_TOKEN_REFRESHED',
        'Instagram access token refreshed successfully',
        { expiresAt: this.tokenExpiresAt }
      )

      // Record successful token refresh for monitoring
      await instagramMonitoringService.recordTokenRefresh(true, this.tokenExpiresAt)

    } catch (error) {
      // Record failed token refresh for monitoring
      await instagramMonitoringService.recordTokenRefresh(false)

      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_TOKEN_REFRESH_ERROR',
        `Failed to refresh Instagram access token: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Get Instagram API status
   */
  async getApiStatus(): Promise<InstagramApiStatus> {
    try {
      let isAuthenticated = false

      if (this.accessToken && this.tokenExpiresAt) {
        // Test the token by making a simple API call
        const response = await fetch(
          `${InstagramService.API_BASE_URL}/me?fields=id,username&access_token=${this.accessToken}`,
          { method: 'GET' }
        )
        isAuthenticated = response.ok
        this.updateRateLimit()
      }

      return {
        isAuthenticated,
        rateLimits: this.rateLimitTracker,
        tokenExpiresAt: this.tokenExpiresAt || undefined,
        lastRequest: new Date()
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
        lastRequest: new Date()
      }
    }
  }

  /**
   * Get hotdog-focused hashtags for scanning
   */
  getHotdogHashtags(): string[] {
    return [
      'hotdog', 'hotdogs', 'hotdoglovers', 'hotdoglunch',
      'hotdogday', 'hotdoglife', 'hotdogtime', 'hotdogstand',
      'frankfurter', 'wiener', 'sausage', 'bratwurst',
      'ballparkfrank', 'chilidog', 'corndog', 'foodporn',
      'grilling', 'bbq', 'barbecue', 'grilledhotdog',
      'ballparkfood', 'streetfood', 'fastfood', 'americanfood'
    ]
  }

  /**
   * Validate Instagram content for hotdog relevance
   */
  async validateInstagramContent(media: ProcessedInstagramMedia): Promise<boolean> {
    try {
      // Check for hotdog-related terms in caption
      const hotdogTerms = [
        'hotdog', 'hot dog', 'hotdogs', 'hot dogs',
        'frankfurter', 'wiener', 'bratwurst', 'sausage',
        'chili dog', 'corn dog', 'ballpark frank'
      ]

      const captionLower = media.caption.toLowerCase()
      const hasHotdogTerm = hotdogTerms.some(term => captionLower.includes(term))

      // Check hashtags
      const hasHotdogHashtag = media.hashtags.some(tag => 
        this.getHotdogHashtags().includes(tag.toLowerCase())
      )

      // Must have hotdog relevance
      if (!hasHotdogTerm && !hasHotdogHashtag) {
        return false
      }

      // Check for spam indicators
      const spamIndicators = [
        'buy now', 'click link', 'dm me', 'link in bio',
        'promo code', 'discount', 'sale', 'affiliate'
      ]

      const hasSpamIndicators = spamIndicators.some(indicator =>
        captionLower.includes(indicator)
      )

      if (hasSpamIndicators) {
        return false
      }

      // Prefer content with good engagement
      const hasGoodEngagement = media.likesCount > 10 || media.commentsCount > 2
      const hasMedia = media.mediaUrl && media.mediaUrl.length > 0

      return hasMedia || hasGoodEngagement

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_VALIDATION_ERROR',
        `Instagram content validation failed: ${error.message}`,
        { mediaId: media.id, error: error.message }
      )
      return false
    }
  }

  // Private helper methods

  private async getUserMedia(limit: number = 25): Promise<any[]> {
    if (!this.accessToken) {
      throw new Error('No access token available')
    }

    const fields = [
      'id', 'caption', 'media_type', 'media_url', 'thumbnail_url',
      'permalink', 'timestamp', 'username', 'like_count', 'comments_count'
    ].join(',')

    const response = await fetch(
      `${InstagramService.API_BASE_URL}/me/media?fields=${fields}&limit=${limit}&access_token=${this.accessToken}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Failed to get user media: ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.data || []
  }

  private async getCarouselChildren(mediaId: string): Promise<any[]> {
    if (!this.accessToken) {
      return []
    }

    try {
      const response = await fetch(
        `${InstagramService.API_BASE_URL}/${mediaId}/children?fields=id,media_type,media_url&access_token=${this.accessToken}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.data || []

    } catch (error) {
      return []
    }
  }

  private extractHashtags(caption: string): string[] {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g
    const matches = caption.match(hashtagRegex) || []
    return matches.map(tag => tag.substring(1)) // Remove # symbol
  }

  private extractMentions(caption: string): string[] {
    const mentionRegex = /@[a-zA-Z0-9_.]+/g
    const matches = caption.match(mentionRegex) || []
    return matches.map(mention => mention.substring(1)) // Remove @ symbol
  }

  private containsHashtag(caption: string, hashtag: string): boolean {
    const captionLower = caption.toLowerCase()
    return captionLower.includes(`#${hashtag.toLowerCase()}`)
  }

  private isHotdogRelated(caption: string): boolean {
    const hotdogTerms = [
      'hotdog', 'hot dog', 'frankfurter', 'wiener', 'bratwurst',
      'sausage', 'chili dog', 'corn dog', 'ballpark frank'
    ]
    
    const captionLower = caption.toLowerCase()
    return hotdogTerms.some(term => captionLower.includes(term))
  }

  private async checkRateLimit(): Promise<void> {
    const now = new Date()
    
    // Reset rate limit counter if hour has passed
    if (now >= this.rateLimitTracker.resetTime) {
      this.rateLimitTracker.used = 0
      this.rateLimitTracker.remaining = InstagramService.RATE_LIMIT_PER_HOUR
      this.rateLimitTracker.resetTime = new Date(now.getTime() + 60 * 60 * 1000)
    }
    
    if (this.rateLimitTracker.remaining <= 0) {
      const waitTime = this.rateLimitTracker.resetTime.getTime() - now.getTime()
      throw new Error(`Instagram API rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)} seconds`)
    }
  }

  private async checkTokenExpiration(): Promise<void> {
    if (!this.tokenExpiresAt) {
      return
    }

    const now = new Date()
    const expiresIn = this.tokenExpiresAt.getTime() - now.getTime()
    
    // Refresh token if it expires within 7 days
    if (expiresIn < 7 * 24 * 60 * 60 * 1000) {
      await this.refreshAccessToken()
    }
  }

  private updateRateLimit(): void {
    this.rateLimitTracker.used++
    this.rateLimitTracker.remaining = Math.max(0, InstagramService.RATE_LIMIT_PER_HOUR - this.rateLimitTracker.used)
  }
}

export const instagramService = new InstagramService()