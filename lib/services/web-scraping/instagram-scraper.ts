import { Page } from 'playwright'
import { WebScrapingBase, ScrapingConfig, ScrapingResult, ScrapedContent } from './scraping-base'
import { loggingService } from '../logging'
import { metricsService } from '../metrics'

export interface InstagramPost {
  id: string
  shortcode: string
  media_url: string
  thumbnail_url?: string
  caption: string
  author: {
    username: string
    profile_url: string
  }
  post_url: string
  likes_count?: number
  comments_count?: number
  timestamp: Date
  hashtags: string[]
  is_video: boolean
}

export class InstagramScraper extends WebScrapingBase {
  private readonly baseUrl = 'https://www.instagram.com'
  private readonly hashtags = ['hotdog', 'hotdogs', 'hotdoglovers', 'foodporn']

  constructor(config?: Partial<ScrapingConfig>) {
    super({
      rateLimitMs: 90000, // 1.5 minutes between requests for Instagram
      ...config
    })
  }

  /**
   * Scrape Instagram hashtag pages for hotdog content
   */
  async scrapeContent(query?: string, limit: number = 20): Promise<ScrapingResult<ScrapedContent[]>> {
    const startTime = Date.now()
    const hashtag = query || this.getRandomHashtag()
    const cacheKey = `instagram_${hashtag}_${limit}`

    try {
      // Check cache first
      const cached = this.getCachedData<ScrapedContent[]>(cacheKey, 600000) // 10 minutes
      if (cached) {
        await loggingService.logDebug('InstagramScraper', 'Returning cached data', {
          hashtag,
          count: cached.length
        })
        
        return {
          success: true,
          data: cached,
          timestamp: new Date(),
          url: `${this.baseUrl}/explore/tags/${hashtag}/`,
          responseTime: Date.now() - startTime
        }
      }

      await loggingService.logInfo('InstagramScraper', 'Starting Instagram scraping', {
        hashtag,
        limit
      })

      const page = await this.createPage()
      const url = `${this.baseUrl}/explore/tags/${hashtag}/`
      
      // Navigate to hashtag page
      const navResult = await this.navigateWithRetry(page, url)
      if (!navResult.success) {
        await page.close()
        return {
          success: false,
          error: navResult.error,
          timestamp: new Date(),
          url,
          responseTime: Date.now() - startTime
        }
      }

      // Wait for content to load
      await page.waitForTimeout(3000)

      // Extract posts from the page
      const posts = await this.extractPosts(page, limit)
      
      // Convert to standard format
      const scrapedContent = posts.map(post => this.convertToScrapedContent(post))

      // Cache the results
      this.setCachedData(cacheKey, scrapedContent)

      await page.close()

      // Record metrics
      await metricsService.recordCustomMetric(
        'instagram_scraping_success',
        Date.now() - startTime,
        'ms',
        {
          hashtag,
          postsFound: scrapedContent.length.toString(),
          requestedLimit: limit.toString()
        }
      )

      await loggingService.logInfo('InstagramScraper', 'Instagram scraping completed', {
        hashtag,
        postsFound: scrapedContent.length,
        responseTime: Date.now() - startTime
      })

      return {
        success: true,
        data: scrapedContent,
        timestamp: new Date(),
        url,
        responseTime: Date.now() - startTime
      }

    } catch (error) {
      await loggingService.logError('InstagramScraper', 'Instagram scraping failed', {
        hashtag,
        error: error.message
      }, error as Error)

      await metricsService.recordCustomMetric(
        'instagram_scraping_failed',
        Date.now() - startTime,
        'ms',
        {
          hashtag,
          error: error.message
        }
      )

      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
        url: `${this.baseUrl}/explore/tags/${hashtag}/`,
        responseTime: Date.now() - startTime
      }
    }
  }

  /**
   * Extract posts from Instagram hashtag page
   */
  private async extractPosts(page: Page, limit: number): Promise<InstagramPost[]> {
    const posts: InstagramPost[] = []

    try {
      // Wait for the main content to load
      await page.waitForSelector('article', { timeout: 10000 })

      // Scroll to load more content
      await this.scrollToLoadContent(page, limit)

      // Extract post data using JavaScript execution
      const extractedPosts = await page.evaluate((maxPosts) => {
        const posts = []
        const articles = document.querySelectorAll('article a[href*="/p/"]')

        for (let i = 0; i < Math.min(articles.length, maxPosts); i++) {
          const link = articles[i]
          const img = link.querySelector('img')
          const postUrl = link.getAttribute('href')
          
          if (!img || !postUrl) continue

          const shortcode = postUrl.match(/\/p\/([^\/]+)/)?.[1]
          if (!shortcode) continue

          // Try to extract caption from alt text or nearby elements
          const altText = img.getAttribute('alt') || ''
          const caption = altText.length > 10 ? altText : 'Instagram hotdog post'

          // Try to extract author from nearby elements or URL structure
          const authorElement = link.closest('article')?.querySelector('a[href*="/"]')
          const authorMatch = authorElement?.getAttribute('href')?.match(/\/([^\/]+)\//)
          const username = authorMatch?.[1] || 'unknown'

          posts.push({
            id: shortcode,
            shortcode,
            media_url: img.src,
            thumbnail_url: img.src,
            caption: caption,
            author: {
              username: username,
              profile_url: `https://www.instagram.com/${username}/`
            },
            post_url: `https://www.instagram.com${postUrl}`,
            hashtags: this.extractHashtagsFromText(caption),
            is_video: false, // Will be detected later if needed
            timestamp: new Date()
          })
        }

        return posts
      }, limit)

      posts.push(...extractedPosts)

    } catch (error) {
      await loggingService.logWarning('InstagramScraper', 'Error extracting posts', {
        error: error.message
      })
    }

    return posts
  }

  /**
   * Scroll page to load more content
   */
  private async scrollToLoadContent(page: Page, targetCount: number): Promise<void> {
    let previousHeight = 0
    let scrollAttempts = 0
    const maxScrollAttempts = 5

    while (scrollAttempts < maxScrollAttempts) {
      // Check current number of posts
      const currentPostCount = await page.evaluate(() => {
        return document.querySelectorAll('article a[href*="/p/"]').length
      })

      if (currentPostCount >= targetCount) {
        break
      }

      // Scroll down
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })

      // Wait for content to load
      await page.waitForTimeout(2000)

      // Check if page height changed
      const currentHeight = await page.evaluate(() => document.body.scrollHeight)
      if (currentHeight === previousHeight) {
        scrollAttempts++
      } else {
        scrollAttempts = 0 // Reset if we're still loading content
      }
      previousHeight = currentHeight
    }
  }

  /**
   * Convert Instagram post to standard scraped content format
   */
  private convertToScrapedContent(post: InstagramPost): ScrapedContent {
    return {
      id: post.id,
      platform: 'instagram',
      type: post.is_video ? 'video' : 'image',
      content_image_url: post.is_video ? undefined : post.media_url,
      content_video_url: post.is_video ? post.media_url : undefined,
      content_text: post.caption,
      original_url: post.post_url,
      original_author: post.author.username,
      original_author_url: post.author.profile_url,
      scraped_at: new Date(),
      metadata: {
        likes: post.likes_count,
        comments: post.comments_count,
        hashtags: post.hashtags,
        thumbnail_url: post.thumbnail_url,
        shortcode: post.shortcode,
        is_video: post.is_video,
        timestamp: post.timestamp
      }
    }
  }

  /**
   * Extract hashtags from text
   */
  private extractHashtagsFromText(text: string): string[] {
    const hashtagRegex = /#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi
    const matches = text.match(hashtagRegex) || []
    return matches.map(tag => tag.substring(1).toLowerCase()) // Remove # and lowercase
  }

  /**
   * Get a random hashtag for scraping
   */
  private getRandomHashtag(): string {
    return this.hashtags[Math.floor(Math.random() * this.hashtags.length)]
  }

  /**
   * Check if Instagram is accessible
   */
  async testAccess(): Promise<{ accessible: boolean; error?: string }> {
    try {
      const page = await this.createPage()
      const result = await this.navigateWithRetry(page, `${this.baseUrl}/explore/tags/hotdog/`)
      await page.close()

      return {
        accessible: result.success,
        error: result.error
      }
    } catch (error) {
      return {
        accessible: false,
        error: error.message
      }
    }
  }

  /**
   * Get available hashtags for scraping
   */
  getAvailableHashtags(): string[] {
    return [...this.hashtags]
  }

  /**
   * Get scraping statistics specific to Instagram
   */
  getInstagramStats(): {
    requestCount: number
    cacheSize: number
    lastRequestTime: number
    availableHashtags: string[]
    rateLimitMs: number
  } {
    const baseStats = this.getStats()
    return {
      ...baseStats,
      availableHashtags: this.hashtags,
      rateLimitMs: this.config.rateLimitMs
    }
  }
}