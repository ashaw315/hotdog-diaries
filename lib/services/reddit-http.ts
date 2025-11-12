import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

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
  over_18: boolean
  stickied: boolean
  is_self: boolean
}

export interface RedditSearchResponse {
  data: {
    children: Array<{
      data: RedditPost
    }>
  }
}

export class RedditHttpService {
  private readonly userAgent = 'HotdogDiaries/1.0.0'
  private readonly baseUrl = 'https://oauth.reddit.com'
  private readonly authUrl = 'https://www.reddit.com/api/v1/access_token'
  private accessToken: string | null = null
  private tokenExpiresAt: Date | null = null

  /**
   * Authenticate with Reddit OAuth2 API
   */
  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken
    }

    const clientId = process.env.REDDIT_CLIENT_ID
    const clientSecret = process.env.REDDIT_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Reddit API credentials not configured')
    }

    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      
      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent
        },
        body: 'grant_type=client_credentials'
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Reddit OAuth failed: ${response.status} - ${errorText}`)
      }

      const tokenData = await response.json()
      
      if (!tokenData.access_token) {
        throw new Error('No access token received from Reddit')
      }

      this.accessToken = tokenData.access_token
      // Reddit tokens typically expire in 1 hour, set expiry to 50 minutes to be safe
      this.tokenExpiresAt = new Date(Date.now() + 50 * 60 * 1000)

      await logToDatabase(
        LogLevel.INFO,
        'REDDIT_AUTH_SUCCESS',
        'Successfully authenticated with Reddit OAuth2 API',
        { expiresAt: this.tokenExpiresAt }
      )

      return this.accessToken

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_AUTH_ERROR',
        `Reddit authentication failed: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  async searchSubreddit(
    subreddit: string,
    query: string,
    limit: number = 10,
    sort: 'hot' | 'new' | 'top' | 'rising' = 'hot',
    timeRange: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'week',
    after?: string
  ): Promise<{ posts: RedditPost[]; after?: string }> {
    try {
      // Get OAuth access token
      const accessToken = await this.authenticate()

      // Build search URL with sort and time parameters
      let searchUrl = `${this.baseUrl}/r/${subreddit}/search?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=${sort}&raw_json=1`

      // Add time range for 'top' sort
      if (sort === 'top') {
        searchUrl += `&t=${timeRange}`
      }

      // Add pagination cursor
      if (after) {
        searchUrl += `&after=${after}`
      }
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        method: 'GET'
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Reddit API returned ${response.status}: ${errorText.substring(0, 200)}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        const responseText = await response.text()
        await logToDatabase(
          LogLevel.ERROR,
          'REDDIT_NON_JSON_RESPONSE',
          `Reddit returned non-JSON response. Content-Type: ${contentType}`,
          { 
            url: searchUrl,
            contentType,
            responsePreview: responseText.substring(0, 500)
          }
        )
        throw new Error(`Reddit returned non-JSON response: ${contentType}`)
      }

      const data: RedditSearchResponse = await response.json()
      
      if (!data.data?.children) {
        await logToDatabase(
          LogLevel.WARNING,
          'REDDIT_UNEXPECTED_RESPONSE',
          'Reddit response missing expected data structure',
          { url: searchUrl, response: data }
        )
        return { posts: [], after: undefined }
      }

      const posts = data.data.children
        .map(child => child.data)
        .filter(post => {
          // Filter out removed/deleted posts
          return post.title && post.title !== '[removed]' && post.title !== '[deleted]'
        })

      // Extract pagination token
      const afterToken = data.data.after || undefined

      await logToDatabase(
        LogLevel.INFO,
        'REDDIT_HTTP_SUCCESS',
        `Found ${posts.length} posts in r/${subreddit} for query "${query}"`,
        { subreddit, query, postsFound: posts.length, after: afterToken }
      )

      return { posts, after: afterToken }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_HTTP_ERROR',
        `Reddit HTTP request failed for r/${subreddit}: ${error.message}`,
        { 
          subreddit, 
          query, 
          error: error.message,
          userAgent: this.userAgent 
        }
      )
      throw error
    }
  }

  async getHotPosts(subreddit: string, limit: number = 10): Promise<RedditPost[]> {
    try {
      // Get OAuth access token
      const accessToken = await this.authenticate()
      
      const hotUrl = `${this.baseUrl}/r/${subreddit}/hot?limit=${limit}&raw_json=1`
      
      const response = await fetch(hotUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`Reddit API returned ${response.status}`)
      }

      const data: RedditSearchResponse = await response.json()
      const posts = data.data.children
        .map(child => child.data)
        .filter(post => post.title && post.title !== '[removed]' && post.title !== '[deleted]')

      await logToDatabase(
        LogLevel.INFO,
        'REDDIT_HOT_SUCCESS',
        `Found ${posts.length} hot posts in r/${subreddit}`,
        { subreddit, postsFound: posts.length }
      )

      return posts

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_HOT_ERROR',
        `Reddit hot posts request failed for r/${subreddit}: ${error.message}`,
        { subreddit, error: error.message }
      )
      throw error
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const posts = await this.getHotPosts('test', 1)
      return {
        success: true,
        message: 'Reddit HTTP connection successful',
        details: {
          userAgent: this.userAgent,
          postsReturned: posts.length
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Reddit HTTP connection failed: ${error.message}`,
        details: {
          userAgent: this.userAgent,
          error: error.message
        }
      }
    }
  }
}

export const redditHttpService = new RedditHttpService()