import Snoowrap from 'snoowrap'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { redditMonitoringService } from './reddit-monitoring'

export interface RedditSearchOptions {
  query: string
  subreddits: string[]
  sort?: 'relevance' | 'hot' | 'top' | 'new'
  time?: 'all' | 'year' | 'month' | 'week' | 'day' | 'hour'
  limit?: number
  minScore?: number
}

export interface ProcessedRedditPost {
  id: string
  title: string
  selftext: string
  subreddit: string
  author: string
  createdAt: Date
  score: number
  upvoteRatio: number
  numComments: number
  permalink: string
  url: string
  imageUrls: string[]
  videoUrls: string[]
  mediaUrls: string[]
  isNSFW: boolean
  isSpoiler: boolean
  isStickied: boolean
  flair?: string
  isGallery: boolean
  isCrosspost: boolean
  crosspostOrigin?: {
    subreddit: string
    author: string
    title: string
  }
}

export interface RedditRateLimit {
  used: number
  remaining: number
  resetTime: Date
}

export interface RedditApiStatus {
  isConnected: boolean
  rateLimits: RedditRateLimit
  lastError?: string
  lastRequest?: Date
  userAgent: string
}

export class RedditService {
  private client: Snoowrap
  private rateLimitTracker: RedditRateLimit = {
    used: 0,
    remaining: 100,
    resetTime: new Date(Date.now() + 60 * 1000) // Reset every minute
  }
  private requestQueue: Array<() => Promise<any>> = []
  private isProcessingQueue = false

  constructor() {
    const clientId = process.env.REDDIT_CLIENT_ID
    const clientSecret = process.env.REDDIT_CLIENT_SECRET
    const userAgent = process.env.REDDIT_USER_AGENT || 'HotdogDiaries/1.0.0 by /u/hotdog_scanner'

    if (!clientId || !clientSecret) {
      throw new Error('Reddit API credentials are required (REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET)')
    }

    this.client = new Snoowrap({
      userAgent,
      clientId,
      clientSecret,
      // User-less OAuth2 for read-only access
      grantType: 'client_credentials'
    })

    // Configure client settings
    this.client.config({
      requestDelay: 1000, // 1 second between requests to respect rate limits
      requestTimeout: 30000, // 30 second timeout
      continueAfterRatelimitError: true,
      retryErrorCodes: [502, 503, 504, 522],
      maxRetryAttempts: 3
    })
  }

  /**
   * Search multiple subreddits for hotdog content
   */
  async searchSubreddits(options: RedditSearchOptions): Promise<ProcessedRedditPost[]> {
    const startTime = Date.now()
    try {
      await this.checkRateLimit()

      const allPosts: ProcessedRedditPost[] = []
      const postsPerSubreddit = Math.floor((options.limit || 25) / options.subreddits.length)

      for (const subreddit of options.subreddits) {
        try {
          const subredditObj = this.client.getSubreddit(subreddit)
          let posts: any[]

          // Search within the subreddit
          if (options.query) {
            posts = await subredditObj.search({
              query: options.query,
              sort: options.sort || 'relevance',
              time: options.time || 'month',
              limit: postsPerSubreddit
            })
          } else {
            // Get hot posts if no specific query
            switch (options.sort) {
              case 'hot':
                posts = await subredditObj.getHot({ limit: postsPerSubreddit })
                break
              case 'top':
                posts = await subredditObj.getTop({ time: options.time || 'week', limit: postsPerSubreddit })
                break
              case 'new':
                posts = await subredditObj.getNew({ limit: postsPerSubreddit })
                break
              default:
                posts = await subredditObj.getHot({ limit: postsPerSubreddit })
            }
          }

          this.updateRateLimit()

          // Process and filter posts
          for (const post of posts) {
            const processedPost = this.processRedditPost(post)
            
            // Apply minimum score filter
            if (options.minScore && processedPost.score < options.minScore) {
              continue
            }

            allPosts.push(processedPost)
          }

          await logToDatabase(
            LogLevel.INFO,
            'REDDIT_SUBREDDIT_SEARCH_SUCCESS',
            `Found ${posts.length} posts in r/${subreddit}`,
            { 
              subreddit, 
              query: options.query,
              postsFound: posts.length 
            }
          )

        } catch (error) {
          await logToDatabase(
            LogLevel.ERROR,
            'REDDIT_SUBREDDIT_SEARCH_ERROR',
            `Failed to search r/${subreddit}: ${error.message}`,
            { 
              subreddit,
              query: options.query,
              error: error.message 
            }
          )
          continue
        }
      }

      // Sort by score descending to prioritize high-quality content
      allPosts.sort((a, b) => b.score - a.score)

      await logToDatabase(
        LogLevel.INFO,
        'REDDIT_SEARCH_COMPLETED',
        `Reddit search completed: ${allPosts.length} posts found across ${options.subreddits.length} subreddits`,
        { 
          subreddits: options.subreddits,
          query: options.query,
          totalPosts: allPosts.length 
        }
      )

      // Record successful API request for monitoring
      const requestTime = Date.now() - startTime
      await redditMonitoringService.recordApiRequest(true, requestTime)

      return allPosts

    } catch (error) {
      // Record failed API request for monitoring
      const requestTime = Date.now() - startTime
      const errorType = error.message.includes('rate limit') ? 'rate_limit' : 'api_error'
      await redditMonitoringService.recordApiRequest(false, requestTime, errorType)

      if (error.message.includes('rate limit')) {
        await this.handleRateLimit(error)
        await redditMonitoringService.recordRateLimitHit(this.rateLimitTracker.resetTime)
        throw new Error('Reddit API rate limit exceeded. Please try again later.')
      }

      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_SEARCH_ERROR',
        `Reddit search failed: ${error.message}`,
        { 
          subreddits: options.subreddits,
          query: options.query,
          error: error.message 
        }
      )
      
      throw new Error(`Reddit search failed: ${error.message}`)
    }
  }

  /**
   * Process raw Reddit post data into structured format
   */
  processRedditPost(post: any): ProcessedRedditPost {
    // Extract media URLs
    const imageUrls: string[] = []
    const videoUrls: string[] = []

    // Handle different types of Reddit media
    if (post.url) {
      const url = post.url.toString()
      
      // Direct image links
      if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        imageUrls.push(url)
      }
      // Reddit hosted images
      else if (url.includes('i.redd.it')) {
        imageUrls.push(url)
      }
      // Reddit hosted videos
      else if (url.includes('v.redd.it')) {
        videoUrls.push(url)
      }
      // Gallery posts
      else if (post.is_gallery && post.media_metadata) {
        Object.values(post.media_metadata).forEach((item: any) => {
          if (item.s && item.s.u) {
            // Decode HTML entities in URL
            const imageUrl = item.s.u.replace(/&amp;/g, '&')
            imageUrls.push(imageUrl)
          }
        })
      }
    }

    // Handle crosspost
    let crosspostOrigin
    if (post.crosspost_parent_list && post.crosspost_parent_list.length > 0) {
      const original = post.crosspost_parent_list[0]
      crosspostOrigin = {
        subreddit: original.subreddit,
        author: original.author,
        title: original.title
      }
    }

    return {
      id: post.id,
      title: post.title || '',
      selftext: post.selftext || '',
      subreddit: post.subreddit.display_name || post.subreddit_name_prefixed?.replace('r/', '') || '',
      author: post.author?.name || '[deleted]',
      createdAt: new Date(post.created_utc * 1000),
      score: post.score || 0,
      upvoteRatio: post.upvote_ratio || 0,
      numComments: post.num_comments || 0,
      permalink: `https://reddit.com${post.permalink}`,
      url: post.url?.toString() || '',
      imageUrls,
      videoUrls,
      mediaUrls: [...imageUrls, ...videoUrls],
      isNSFW: post.over_18 || false,
      isSpoiler: post.spoiler || false,
      isStickied: post.stickied || false,
      flair: post.link_flair_text || undefined,
      isGallery: post.is_gallery || false,
      isCrosspost: post.crosspost_parent_list?.length > 0 || false,
      crosspostOrigin
    }
  }

  /**
   * Validate if Reddit post content is suitable for hotdog content
   */
  async validateRedditContent(post: ProcessedRedditPost): Promise<boolean> {
    try {
      // Skip NSFW content
      if (post.isNSFW) {
        return false
      }

      // Skip very low-scoring posts
      if (post.score < 1) {
        return false
      }

      // Must contain hotdog-related terms in title or text
      const hotdogTerms = [
        'hotdog', 'hot dog', 'hotdogs', 'hot dogs',
        'weiner', 'wiener', 'frankfurter', 'sausage',
        'bratwurst', 'kielbasa', 'chorizo'
      ]
      
      const searchText = `${post.title} ${post.selftext}`.toLowerCase()
      const hasHotdogTerm = hotdogTerms.some(term => searchText.includes(term))
      
      if (!hasHotdogTerm) {
        return false
      }

      // Check for spam indicators in title/text
      const spamIndicators = [
        'click here', 'buy now', 'limited time', 'discount',
        'promo code', 'get yours', 'order now', 'sale',
        'affiliate', 'referral', 'commission'
      ]
      
      const hasSpamIndicators = spamIndicators.some(indicator => 
        searchText.includes(indicator.toLowerCase())
      )
      
      if (hasSpamIndicators) {
        return false
      }

      // Prefer posts with media or substantial text content
      const hasMedia = post.mediaUrls.length > 0
      const hasSubstantialText = post.selftext.length > 50
      const hasGoodEngagement = post.score > 10 || post.numComments > 5
      
      return hasMedia || hasSubstantialText || hasGoodEngagement

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_VALIDATION_ERROR',
        `Reddit post validation failed: ${error.message}`,
        { postId: post.id, error: error.message }
      )
      return false
    }
  }

  /**
   * Get hotdog-focused subreddits for scanning
   */
  getHotdogSubreddits(): string[] {
    return [
      'hotdogs', // Dedicated hotdog community
      'food', // General food content
      'FoodPorn', // High-quality food images
      'grilling', // Hotdog grilling content
      'baseball', // Ballpark hotdogs
      'sausages', // Related sausage content
      'BBQ', // Barbecue and grilling
      'Cooking', // Cooking community
      'MealPrepSunday', // Meal prep including hotdogs
      'budgetfood', // Budget-friendly hotdog meals
      'americanfood', // American cuisine including hotdogs
      'ballparks' // Stadium food
    ]
  }

  /**
   * Get search terms optimized for hotdog content
   */
  getHotdogSearchTerms(): string[] {
    return [
      'hotdog',
      'hot dog', 
      'frankfurter',
      'bratwurst',
      'wiener',
      'ballpark frank',
      'chili dog',
      'corn dog',
      'sausage grill'
    ]
  }

  /**
   * Check rate limit before making API call
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date()
    
    // Reset rate limit counter if minute has passed
    if (now >= this.rateLimitTracker.resetTime) {
      this.rateLimitTracker.used = 0
      this.rateLimitTracker.remaining = 100
      this.rateLimitTracker.resetTime = new Date(now.getTime() + 60 * 1000)
    }
    
    if (this.rateLimitTracker.remaining <= 0) {
      const waitTime = this.rateLimitTracker.resetTime.getTime() - now.getTime()
      throw new Error(`Rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)} seconds`)
    }
  }

  /**
   * Handle rate limit errors
   */
  private async handleRateLimit(error: any): Promise<void> {
    const resetTime = new Date(Date.now() + 60 * 1000) // Reset in 1 minute
    
    this.rateLimitTracker = {
      used: 100,
      remaining: 0,
      resetTime
    }

    await logToDatabase(
      LogLevel.WARNING,
      'REDDIT_RATE_LIMIT',
      `Reddit API rate limit exceeded. Reset at ${resetTime.toISOString()}`,
      { 
        resetTime: resetTime.toISOString(),
        error: error.message 
      }
    )
  }

  /**
   * Update rate limit tracking
   */
  private updateRateLimit(): void {
    this.rateLimitTracker.used++
    this.rateLimitTracker.remaining = Math.max(0, 100 - this.rateLimitTracker.used)
  }

  /**
   * Get current API status and rate limits
   */
  async getApiStatus(): Promise<RedditApiStatus> {
    try {
      // Test connection with a simple request
      const testSubreddit = this.client.getSubreddit('hotdogs')
      await testSubreddit.getHot({ limit: 1 })
      
      this.updateRateLimit()

      return {
        isConnected: true,
        rateLimits: this.rateLimitTracker,
        lastRequest: new Date(),
        userAgent: this.client.userAgent
      }

    } catch (error) {
      return {
        isConnected: false,
        rateLimits: {
          used: 0,
          remaining: 0,
          resetTime: new Date()
        },
        lastError: error.message,
        lastRequest: new Date(),
        userAgent: this.client.userAgent
      }
    }
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
          await this.checkRateLimit()
          await request()
          // Wait between requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error('Queued Reddit request failed:', error)
        }
      }
    }

    this.isProcessingQueue = false
  }
}