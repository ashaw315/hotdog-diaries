import { TwitterApi, TweetV2, UserV2, MediaObjectV2 } from 'twitter-api-v2'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface TwitterSearchOptions {
  query: string
  maxResults?: number
  sinceId?: string
  untilId?: string
  startTime?: string
  endTime?: string
}

export interface ProcessedTweet {
  id: string
  text: string
  authorId: string
  authorUsername: string
  authorName: string
  createdAt: Date
  mediaUrls: string[]
  imageUrls: string[]
  videoUrls: string[]
  hashtags: string[]
  mentions: string[]
  urls: string[]
  retweetCount: number
  likeCount: number
  replyCount: number
  quoteCount: number
  isRetweet: boolean
  isReply: boolean
  isQuote: boolean
  originalTweetId?: string
  quotedTweetId?: string
  referencedTweets?: any[]
  publicMetrics: {
    retweet_count: number
    like_count: number
    reply_count: number
    quote_count: number
  }
}

export interface TwitterRateLimit {
  limit: number
  remaining: number
  resetTime: Date
}

export interface TwitterApiStatus {
  isConnected: boolean
  rateLimits: {
    search: TwitterRateLimit
    users: TwitterRateLimit
  }
  lastError?: string
  lastRequest?: Date
}

export class TwitterService {
  private client: TwitterApi
  private bearerClient: TwitterApi
  private rateLimitTracker: Map<string, TwitterRateLimit> = new Map()
  private requestQueue: Array<() => Promise<any>> = []
  private isProcessingQueue = false

  constructor() {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET

    if (!bearerToken) {
      throw new Error('Twitter Bearer Token is required')
    }

    // Bearer token client for app-only authentication (higher rate limits for search)
    this.bearerClient = new TwitterApi(bearerToken)

    // Full client for user context (if credentials provided)
    if (apiKey && apiSecret && accessToken && accessTokenSecret) {
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken,
        accessSecret: accessTokenSecret,
      })
    } else {
      // Fall back to bearer token
      this.client = this.bearerClient
    }
  }

  /**
   * Search for tweets using Twitter API v2
   */
  async searchTweets(options: TwitterSearchOptions): Promise<ProcessedTweet[]> {
    try {
      await this.checkRateLimit('search')

      const searchParams = {
        query: options.query,
        max_results: Math.min(options.maxResults || 10, 100), // API limit is 100
        'tweet.fields': [
          'id',
          'text',
          'author_id',
          'created_at',
          'public_metrics',
          'referenced_tweets',
          'attachments',
          'entities'
        ].join(','),
        'user.fields': [
          'id',
          'username',
          'name',
          'verified',
          'public_metrics'
        ].join(','),
        'media.fields': [
          'type',
          'url',
          'preview_image_url',
          'public_metrics'
        ].join(','),
        expansions: [
          'author_id',
          'attachments.media_keys',
          'referenced_tweets.id',
          'referenced_tweets.id.author_id'
        ].join(','),
        since_id: options.sinceId,
        until_id: options.untilId,
        start_time: options.startTime,
        end_time: options.endTime
      }

      // Remove undefined parameters
      Object.keys(searchParams).forEach(key => 
        searchParams[key] === undefined && delete searchParams[key]
      )

      const response = await this.bearerClient.v2.search(searchParams.query, searchParams)
      
      // Update rate limit info
      this.updateRateLimit('search', response.rateLimit)

      if (!response.data?.data) {
        await logToDatabase(
          LogLevel.INFO,
          'TWITTER_SEARCH_NO_RESULTS',
          `No tweets found for query: ${options.query}`,
          { query: options.query, searchParams }
        )
        return []
      }

      const processedTweets = response.data.data.map(tweet => 
        this.processTweetData(tweet, response.data.includes)
      )

      await logToDatabase(
        LogLevel.INFO,
        'TWITTER_SEARCH_SUCCESS',
        `Found ${processedTweets.length} tweets for query: ${options.query}`,
        { 
          query: options.query, 
          resultsCount: processedTweets.length,
          rateLimit: response.rateLimit 
        }
      )

      return processedTweets

    } catch (error) {
      if (error.code === 429) {
        await this.handleRateLimit('search', error)
        throw new Error('Rate limit exceeded. Please try again later.')
      }

      await logToDatabase(
        LogLevel.ERROR,
        'TWITTER_SEARCH_ERROR',
        `Twitter search failed: ${error.message}`,
        { 
          query: options.query, 
          error: error.message,
          code: error.code 
        }
      )
      
      throw new Error(`Twitter search failed: ${error.message}`)
    }
  }

  /**
   * Process raw tweet data into structured format
   */
  processTweetData(tweet: TweetV2, includes?: any): ProcessedTweet {
    const author = includes?.users?.find((user: UserV2) => user.id === tweet.author_id)
    const media = includes?.media || []
    
    // Extract media URLs
    const mediaKeys = tweet.attachments?.media_keys || []
    const tweetMedia = media.filter((m: MediaObjectV2) => mediaKeys.includes(m.media_key))
    
    const imageUrls = tweetMedia
      .filter((m: MediaObjectV2) => m.type === 'photo')
      .map((m: MediaObjectV2) => m.url)
      .filter(Boolean)
    
    const videoUrls = tweetMedia
      .filter((m: MediaObjectV2) => ['video', 'animated_gif'].includes(m.type))
      .map((m: MediaObjectV2) => m.preview_image_url || m.url)
      .filter(Boolean)

    // Extract entities
    const hashtags = tweet.entities?.hashtags?.map(tag => tag.tag) || []
    const mentions = tweet.entities?.mentions?.map(mention => mention.username) || []
    const urls = tweet.entities?.urls?.map(url => url.expanded_url || url.url) || []

    // Check tweet type
    const referencedTweets = tweet.referenced_tweets || []
    const isRetweet = referencedTweets.some(ref => ref.type === 'retweeted')
    const isReply = referencedTweets.some(ref => ref.type === 'replied_to')
    const isQuote = referencedTweets.some(ref => ref.type === 'quoted')

    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id || '',
      authorUsername: author?.username || 'unknown',
      authorName: author?.name || 'Unknown User',
      createdAt: new Date(tweet.created_at || Date.now()),
      mediaUrls: [...imageUrls, ...videoUrls],
      imageUrls,
      videoUrls,
      hashtags,
      mentions,
      urls,
      retweetCount: tweet.public_metrics?.retweet_count || 0,
      likeCount: tweet.public_metrics?.like_count || 0,
      replyCount: tweet.public_metrics?.reply_count || 0,
      quoteCount: tweet.public_metrics?.quote_count || 0,
      isRetweet,
      isReply,
      isQuote,
      originalTweetId: isRetweet ? referencedTweets.find(ref => ref.type === 'retweeted')?.id : undefined,
      quotedTweetId: isQuote ? referencedTweets.find(ref => ref.type === 'quoted')?.id : undefined,
      referencedTweets,
      publicMetrics: {
        retweet_count: tweet.public_metrics?.retweet_count || 0,
        like_count: tweet.public_metrics?.like_count || 0,
        reply_count: tweet.public_metrics?.reply_count || 0,
        quote_count: tweet.public_metrics?.quote_count || 0
      }
    }
  }

  /**
   * Validate if tweet content is suitable for hotdog content
   */
  async validateTweetContent(tweet: ProcessedTweet): Promise<boolean> {
    try {
      // Skip retweets and replies
      if (tweet.isRetweet || tweet.isReply) {
        return false
      }

      // Must contain hotdog-related terms
      const hotdogTerms = [
        'hotdog', 'hot dog', 'hotdogs', 'hot dogs',
        'weiner', 'wiener', 'frankfurter', 'sausage',
        'bratwurst', 'bratwurst'
      ]
      
      const text = tweet.text.toLowerCase()
      const hasHotdogTerm = hotdogTerms.some(term => text.includes(term))
      
      if (!hasHotdogTerm) {
        return false
      }

      // Check for spam indicators
      const spamIndicators = [
        'click here', 'buy now', 'limited time', 'discount',
        'promo code', 'get yours', 'order now', 'sale'
      ]
      
      const hasSpamIndicators = spamIndicators.some(indicator => 
        text.includes(indicator.toLowerCase())
      )
      
      if (hasSpamIndicators) {
        return false
      }

      // Must have some engagement or media
      const hasEngagement = (tweet.likeCount + tweet.retweetCount + tweet.replyCount) > 0
      const hasMedia = tweet.mediaUrls.length > 0
      
      if (!hasEngagement && !hasMedia) {
        return false
      }

      return true

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TWITTER_VALIDATION_ERROR',
        `Tweet validation failed: ${error.message}`,
        { tweetId: tweet.id, error: error.message }
      )
      return false
    }
  }

  /**
   * Check rate limit before making API call
   */
  private async checkRateLimit(endpoint: string): Promise<void> {
    const limit = this.rateLimitTracker.get(endpoint)
    
    if (limit && limit.remaining <= 0 && new Date() < limit.resetTime) {
      const waitTime = limit.resetTime.getTime() - Date.now()
      throw new Error(`Rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)} seconds`)
    }
  }

  /**
   * Handle rate limit errors with exponential backoff
   */
  private async handleRateLimit(endpoint: string, error: any): Promise<void> {
    const resetTime = error.rateLimit?.reset ? new Date(error.rateLimit.reset * 1000) : new Date(Date.now() + 15 * 60 * 1000)
    
    this.rateLimitTracker.set(endpoint, {
      limit: error.rateLimit?.limit || 0,
      remaining: 0,
      resetTime
    })

    await logToDatabase(
      LogLevel.WARNING,
      'TWITTER_RATE_LIMIT',
      `Rate limit exceeded for ${endpoint}. Reset at ${resetTime.toISOString()}`,
      { 
        endpoint, 
        resetTime: resetTime.toISOString(),
        rateLimit: error.rateLimit 
      }
    )
  }

  /**
   * Update rate limit tracking
   */
  private updateRateLimit(endpoint: string, rateLimit?: any): void {
    if (rateLimit) {
      this.rateLimitTracker.set(endpoint, {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetTime: new Date(rateLimit.reset * 1000)
      })
    }
  }

  /**
   * Get current API status and rate limits
   */
  async getApiStatus(): Promise<TwitterApiStatus> {
    try {
      // Test connection with a minimal request
      const response = await this.bearerClient.v2.me()
      
      const searchLimit = this.rateLimitTracker.get('search') || {
        limit: 300,
        remaining: 300,
        resetTime: new Date(Date.now() + 15 * 60 * 1000)
      }

      const usersLimit = this.rateLimitTracker.get('users') || {
        limit: 300,
        remaining: 300,
        resetTime: new Date(Date.now() + 15 * 60 * 1000)
      }

      return {
        isConnected: true,
        rateLimits: {
          search: searchLimit,
          users: usersLimit
        },
        lastRequest: new Date()
      }

    } catch (error) {
      return {
        isConnected: false,
        rateLimits: {
          search: { limit: 0, remaining: 0, resetTime: new Date() },
          users: { limit: 0, remaining: 0, resetTime: new Date() }
        },
        lastError: error.message,
        lastRequest: new Date()
      }
    }
  }

  /**
   * Get optimized search queries for hotdog content
   */
  getHotdogSearchQueries(): string[] {
    return [
      // Main hotdog terms
      '(hotdog OR "hot dog" OR hotdogs OR "hot dogs") -is:retweet -is:reply lang:en',
      
      // With hashtags
      '#hotdog OR #hotdogs OR #nationalhotdogday -is:retweet -is:reply lang:en',
      
      // Food context
      '("hotdog" OR "hot dog") (delicious OR tasty OR amazing OR perfect) -is:retweet -is:reply has:media lang:en',
      
      // Location-based (popular hotdog places)
      '("hotdog" OR "hot dog") (chicago OR "coney island" OR "new york") -is:retweet -is:reply lang:en',
      
      // Event-based
      '("hotdog" OR "hot dog") (bbq OR barbecue OR grill OR grilling) -is:retweet -is:reply has:media lang:en'
    ]
  }

  /**
   * Queue a request to handle rate limiting
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        try {
          await request()
          // Wait a bit between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error('Queued request failed:', error)
        }
      }
    }

    this.isProcessingQueue = false
  }
}