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
  private readonly userAgent = 'HotdogDiaries/1.0.0 (contact: admin@hotdogdiaries.com)'
  private readonly baseUrl = 'https://www.reddit.com'

  async searchSubreddit(subreddit: string, query: string, limit: number = 10): Promise<RedditPost[]> {
    try {
      // Use the public JSON API endpoint
      const searchUrl = `${this.baseUrl}/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=hot`
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
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
        return []
      }

      const posts = data.data.children
        .map(child => child.data)
        .filter(post => {
          // Filter out removed/deleted posts
          return post.title && post.title !== '[removed]' && post.title !== '[deleted]'
        })

      await logToDatabase(
        LogLevel.INFO,
        'REDDIT_HTTP_SUCCESS',
        `Found ${posts.length} posts in r/${subreddit} for query "${query}"`,
        { subreddit, query, postsFound: posts.length }
      )

      return posts

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
      const hotUrl = `${this.baseUrl}/r/${subreddit}/hot.json?limit=${limit}`
      
      const response = await fetch(hotUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site'
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