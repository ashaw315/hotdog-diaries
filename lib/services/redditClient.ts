import got from 'got'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

const REDDIT_BASE = 'https://oauth.reddit.com'
const REDDIT_AUTH_BASE = 'https://www.reddit.com/api/v1'

export interface RedditPost {
  id: string
  title: string
  selftext: string
  subreddit: string
  author: string
  created_utc: number
  score: number
  upvote_ratio: number
  num_comments: number
  permalink: string
  url: string
  is_gallery: boolean
  is_video: boolean
  over_18: boolean
  spoiler: boolean
  stickied: boolean
  link_flair_text?: string
  media_metadata?: any
  crosspost_parent_list?: any[]
}

export interface RedditSearchParams {
  q: string
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments'
  t?: 'all' | 'year' | 'month' | 'week' | 'day' | 'hour'
  limit?: number
  subreddit?: string
}

export interface RedditSubredditParams {
  limit?: number
  t?: 'all' | 'year' | 'month' | 'week' | 'day' | 'hour'
}

export interface RedditAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

export class RedditClient {
  private accessToken: string | null = null
  private tokenExpiry: number = 0
  private userAgent: string
  private clientId: string
  private clientSecret: string
  private requestCount = 0
  private lastRequestTime = 0
  private readonly RATE_LIMIT_DELAY = 1000 // 1 second between requests

  constructor(
    clientId: string, 
    clientSecret: string, 
    userAgent: string = 'HotdogDiariesBot/1.0 by /u/hotdog_scanner'
  ) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.userAgent = userAgent
  }

  /**
   * Authenticate with Reddit using client credentials flow (app-only access)
   */
  private async authenticate(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return // Token still valid
    }

    try {
      const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      
      const response = await got.post(`${REDDIT_AUTH_BASE}/access_token`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
          grant_type: 'client_credentials'
        }
      }).json<RedditAuthResponse>()

      this.accessToken = response.access_token
      this.tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000 // Expire 1 minute early

      await logToDatabase(
        LogLevel.INFO,
        'REDDIT_AUTH_SUCCESS',
        'Successfully authenticated with Reddit API',
        { 
          tokenType: response.token_type,
          expiresIn: response.expires_in,
          scope: response.scope
        }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_AUTH_ERROR',
        `Reddit authentication failed: ${error.message}`,
        { error: error.message }
      )
      throw new Error(`Reddit authentication failed: ${error.message}`)
    }
  }

  /**
   * Rate limiting helper
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    this.lastRequestTime = Date.now()
    this.requestCount++
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(endpoint: string, searchParams?: Record<string, any>): Promise<T> {
    await this.authenticate()
    await this.rateLimitDelay()

    try {
      const response = await got.get(`${REDDIT_BASE}${endpoint}`, {
        headers: {
          'Authorization': `bearer ${this.accessToken}`,
          'User-Agent': this.userAgent
        },
        searchParams,
        timeout: {
          request: 30000 // 30 second timeout
        }
      }).json<T>()

      return response

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_API_ERROR',
        `Reddit API request failed: ${error.message}`,
        { 
          endpoint,
          searchParams,
          error: error.message
        }
      )
      throw new Error(`Reddit API request failed: ${error.message}`)
    }
  }

  /**
   * Search for posts across Reddit
   */
  async search(params: RedditSearchParams): Promise<RedditPost[]> {
    const searchParams: Record<string, any> = {
      q: params.q,
      limit: params.limit || 25,
      sort: params.sort || 'relevance'
    }

    if (params.t) searchParams.t = params.t
    if (params.subreddit) searchParams.restrict_sr = 'true'

    const endpoint = params.subreddit ? `/r/${params.subreddit}/search` : '/search'
    
    try {
      const response = await this.makeRequest<any>(endpoint, searchParams)
      
      const posts = response?.data?.children || []
      return posts.map((child: any) => this.normalizePost(child.data))

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_SEARCH_ERROR',
        `Reddit search failed: ${error.message}`,
        { params, error: error.message }
      )
      throw error
    }
  }

  /**
   * Get hot posts from a subreddit
   */
  async fetchHot(subreddit: string, params: RedditSubredditParams = {}): Promise<RedditPost[]> {
    const searchParams: Record<string, any> = {
      limit: params.limit || 25
    }

    if (params.t) searchParams.t = params.t

    try {
      const response = await this.makeRequest<any>(`/r/${subreddit}/hot`, searchParams)
      
      const posts = response?.data?.children || []
      return posts.map((child: any) => this.normalizePost(child.data))

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_HOT_ERROR',
        `Reddit hot posts fetch failed: ${error.message}`,
        { subreddit, params, error: error.message }
      )
      throw error
    }
  }

  /**
   * Get new posts from a subreddit
   */
  async fetchNew(subreddit: string, params: RedditSubredditParams = {}): Promise<RedditPost[]> {
    const searchParams: Record<string, any> = {
      limit: params.limit || 25
    }

    if (params.t) searchParams.t = params.t

    try {
      const response = await this.makeRequest<any>(`/r/${subreddit}/new`, searchParams)
      
      const posts = response?.data?.children || []
      return posts.map((child: any) => this.normalizePost(child.data))

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_NEW_ERROR',
        `Reddit new posts fetch failed: ${error.message}`,
        { subreddit, params, error: error.message }
      )
      throw error
    }
  }

  /**
   * Get top posts from a subreddit
   */
  async fetchTop(subreddit: string, params: RedditSubredditParams = {}): Promise<RedditPost[]> {
    const searchParams: Record<string, any> = {
      limit: params.limit || 25,
      t: params.t || 'week'
    }

    try {
      const response = await this.makeRequest<any>(`/r/${subreddit}/top`, searchParams)
      
      const posts = response?.data?.children || []
      return posts.map((child: any) => this.normalizePost(child.data))

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_TOP_ERROR',
        `Reddit top posts fetch failed: ${error.message}`,
        { subreddit, params, error: error.message }
      )
      throw error
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ isConnected: boolean; error?: string }> {
    try {
      await this.authenticate()
      
      // Test with a simple request to a well-known subreddit
      const response = await this.makeRequest<any>('/r/test/hot', { limit: 1 })
      
      return {
        isConnected: !!(response?.data?.children)
      }

    } catch (error) {
      return {
        isConnected: false,
        error: error.message
      }
    }
  }

  /**
   * Get API status and rate limit info
   */
  getApiStatus(): {
    requestCount: number
    lastRequestTime: number
    hasValidToken: boolean
    tokenExpiry: number
  } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      hasValidToken: !!(this.accessToken && Date.now() < this.tokenExpiry),
      tokenExpiry: this.tokenExpiry
    }
  }

  /**
   * Normalize Reddit post data to match our interface
   */
  private normalizePost(post: any): RedditPost {
    return {
      id: post.id || '',
      title: post.title || '',
      selftext: post.selftext || '',
      subreddit: post.subreddit || '',
      author: post.author || '[deleted]',
      created_utc: post.created_utc || 0,
      score: post.score || 0,
      upvote_ratio: post.upvote_ratio || 0,
      num_comments: post.num_comments || 0,
      permalink: post.permalink ? `https://reddit.com${post.permalink}` : '',
      url: post.url || '',
      is_gallery: post.is_gallery || false,
      is_video: post.is_video || false,
      over_18: post.over_18 || false,
      spoiler: post.spoiler || false,
      stickied: post.stickied || false,
      link_flair_text: post.link_flair_text || undefined,
      media_metadata: post.media_metadata || undefined,
      crosspost_parent_list: post.crosspost_parent_list || undefined
    }
  }
}

/**
 * Mock client for development/testing when credentials are not available
 */
export class MockRedditClient {
  private userAgent: string

  constructor(userAgent: string = 'HotdogDiariesBot/1.0 (Mock)') {
    this.userAgent = userAgent
  }

  async search(params: RedditSearchParams): Promise<RedditPost[]> {
    return this.getMockPosts(params.limit || 25)
  }

  async fetchHot(subreddit: string, params: RedditSubredditParams = {}): Promise<RedditPost[]> {
    return this.getMockPosts(params.limit || 25)
  }

  async fetchNew(subreddit: string, params: RedditSubredditParams = {}): Promise<RedditPost[]> {
    return this.getMockPosts(params.limit || 25)
  }

  async fetchTop(subreddit: string, params: RedditSubredditParams = {}): Promise<RedditPost[]> {
    return this.getMockPosts(params.limit || 25)
  }

  async testConnection(): Promise<{ isConnected: boolean; error?: string }> {
    return { isConnected: true }
  }

  getApiStatus() {
    return {
      requestCount: 0,
      lastRequestTime: 0,
      hasValidToken: true,
      tokenExpiry: Date.now() + 3600000
    }
  }

  private getMockPosts(limit: number): RedditPost[] {
    const mockPosts: RedditPost[] = [
      {
        id: 'mock1',
        title: 'Best Chicago Deep Dish Style Hotdog Recipe',
        selftext: 'After years of perfecting this recipe, I can finally share my ultimate Chicago-style hotdog...',
        subreddit: 'food',
        author: 'ChicagoFoodie',
        created_utc: Math.floor(Date.now() / 1000) - 3600,
        score: 156,
        upvote_ratio: 0.94,
        num_comments: 23,
        permalink: 'https://reddit.com/r/food/comments/mock1/best_chicago_deep_dish_style_hotdog_recipe/',
        url: 'https://reddit.com/r/food/comments/mock1/best_chicago_deep_dish_style_hotdog_recipe/',
        is_gallery: false,
        is_video: false,
        over_18: false,
        spoiler: false,
        stickied: false,
        link_flair_text: 'Recipe'
      },
      {
        id: 'mock2',
        title: 'Grilled hotdogs at the ballpark - nothing beats this view!',
        selftext: '',
        subreddit: 'food',
        author: 'BaseballFan2023',
        created_utc: Math.floor(Date.now() / 1000) - 7200,
        score: 89,
        upvote_ratio: 0.88,
        num_comments: 15,
        permalink: 'https://reddit.com/r/food/comments/mock2/grilled_hotdogs_at_the_ballpark/',
        url: 'https://i.redd.it/hotdog_ballpark_example.jpg',
        is_gallery: false,
        is_video: false,
        over_18: false,
        spoiler: false,
        stickied: false,
        link_flair_text: 'Photo'
      },
      {
        id: 'mock3',
        title: 'Homemade bratwurst vs store-bought frankfurters - taste test results',
        selftext: 'I did a blind taste test comparing 5 different sausages...',
        subreddit: 'food',
        author: 'SausageTester',
        created_utc: Math.floor(Date.now() / 1000) - 14400,
        score: 234,
        upvote_ratio: 0.91,
        num_comments: 67,
        permalink: 'https://reddit.com/r/food/comments/mock3/homemade_bratwurst_vs_store_bought/',
        url: 'https://reddit.com/r/food/comments/mock3/homemade_bratwurst_vs_store_bought/',
        is_gallery: false,
        is_video: false,
        over_18: false,
        spoiler: false,
        stickied: false,
        link_flair_text: 'Review'
      }
    ]

    return mockPosts.slice(0, limit)
  }
}

/**
 * Factory function to create the appropriate Reddit client
 */
export function createRedditClient(): RedditClient | MockRedditClient {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  const userAgent = process.env.REDDIT_USER_AGENT || 'HotdogDiaries/1.0.0 by /u/hotdog_scanner'

  if (!clientId || !clientSecret) {
    console.warn('Reddit API credentials not found, using mock client for development')
    return new MockRedditClient(userAgent)
  }

  // Check if credentials look valid (not demo/test values)
  if (clientId.includes('demo') || clientSecret.includes('demo') || 
      clientId.length < 10 || clientSecret.length < 15) {
    console.warn('Demo/test Reddit credentials detected, using mock client')
    return new MockRedditClient(userAgent)
  }

  return new RedditClient(clientId, clientSecret, userAgent)
}