import { Page } from 'playwright'
import { WebScrapingBase, ScrapingConfig, ScrapingResult, ScrapedContent } from './scraping-base'
import { loggingService } from '../logging'
import { metricsService } from '../metrics'

export interface TikTokVideo {
  id: string
  video_url: string
  thumbnail_url: string
  description: string
  author: {
    username: string
    profile_url: string
    display_name?: string
  }
  post_url: string
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
  created_at: Date
  hashtags: string[]
  music?: {
    title: string
    author: string
  }
}

export class TikTokScraper extends WebScrapingBase {
  private readonly baseUrl = 'https://www.tiktok.com'
  private readonly searchTerms = ['hotdog', 'hotdogs', 'hot dog recipe', 'hotdog challenge', 'food hotdog']

  constructor(config?: Partial<ScrapingConfig>) {
    super({
      rateLimitMs: 120000, // 2 minutes between requests for TikTok
      timeout: 45000, // Longer timeout for TikTok
      ...config
    })
  }

  /**
   * Scrape TikTok for hotdog content
   */
  async scrapeContent(query?: string, limit: number = 15): Promise<ScrapingResult<ScrapedContent[]>> {
    const startTime = Date.now()
    const searchTerm = query || this.getRandomSearchTerm()
    const cacheKey = `tiktok_${searchTerm}_${limit}`

    try {
      // Check cache first
      const cached = this.getCachedData<ScrapedContent[]>(cacheKey, 900000) // 15 minutes
      if (cached) {
        await loggingService.logDebug('TikTokScraper', 'Returning cached data', {
          searchTerm,
          count: cached.length
        })
        
        return {
          success: true,
          data: cached,
          timestamp: new Date(),
          url: `${this.baseUrl}/search?q=${encodeURIComponent(searchTerm)}`,
          responseTime: Date.now() - startTime
        }
      }

      await loggingService.logInfo('TikTokScraper', 'Starting TikTok scraping', {
        searchTerm,
        limit
      })

      const page = await this.createPage()
      
      // Set additional TikTok-specific headers
      await page.setExtraHTTPHeaders({
        'Referer': 'https://www.tiktok.com/',
        'Origin': 'https://www.tiktok.com'
      })

      const url = `${this.baseUrl}/search?q=${encodeURIComponent(searchTerm)}`
      
      // Navigate to search page
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

      // Wait for content to load and handle potential cookie/login banners
      await this.handleInitialLoad(page)

      // Extract videos from the page
      const videos = await this.extractVideos(page, limit)
      
      // Convert to standard format
      const scrapedContent = videos.map(video => this.convertToScrapedContent(video))

      // Cache the results
      this.setCachedData(cacheKey, scrapedContent)

      await page.close()

      // Record metrics
      await metricsService.recordCustomMetric(
        'tiktok_scraping_success',
        Date.now() - startTime,
        'ms',
        {
          searchTerm,
          videosFound: scrapedContent.length.toString(),
          requestedLimit: limit.toString()
        }
      )

      await loggingService.logInfo('TikTokScraper', 'TikTok scraping completed', {
        searchTerm,
        videosFound: scrapedContent.length,
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
      await loggingService.logError('TikTokScraper', 'TikTok scraping failed', {
        searchTerm,
        error: error.message
      }, error as Error)

      await metricsService.recordCustomMetric(
        'tiktok_scraping_failed',
        Date.now() - startTime,
        'ms',
        {
          searchTerm,
          error: error.message
        }
      )

      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
        url: `${this.baseUrl}/search?q=${encodeURIComponent(searchTerm)}`,
        responseTime: Date.now() - startTime
      }
    }
  }

  /**
   * Handle initial page load and dismiss any overlays
   */
  private async handleInitialLoad(page: Page): Promise<void> {
    try {
      // Wait for page content
      await page.waitForTimeout(3000)

      // Try to dismiss cookie banner or login popup
      const cookieButton = page.locator('button:has-text("Accept"), button:has-text("Allow"), button:has-text("OK")')
      if (await cookieButton.first().isVisible({ timeout: 2000 })) {
        await cookieButton.first().click()
        await page.waitForTimeout(1000)
      }

      // Try to dismiss login popup
      const closeButton = page.locator('[data-e2e="close-button"], button[aria-label="Close"], .close-button')
      if (await closeButton.first().isVisible({ timeout: 2000 })) {
        await closeButton.first().click()
        await page.waitForTimeout(1000)
      }

      // Wait for search results to load
      await page.waitForSelector('[data-e2e="search_top-item"], .video-feed-item, [data-e2e="recommend-list-item"]', { 
        timeout: 15000 
      }).catch(() => {
        // If specific selectors don't work, wait for any video container
        return page.waitForSelector('div[data-e2e*="video"], a[href*="/video/"]', { timeout: 10000 })
      })

    } catch (error) {
      await loggingService.logWarning('TikTokScraper', 'Could not handle initial load elements', {
        error: error.message
      })
    }
  }

  /**
   * Extract videos from TikTok search results
   */
  private async extractVideos(page: Page, limit: number): Promise<TikTokVideo[]> {
    const videos: TikTokVideo[] = []

    try {
      // Scroll to load more content
      await this.scrollToLoadContent(page, limit)

      // Extract video data using JavaScript execution
      const extractedVideos = await page.evaluate((maxVideos) => {
        const videos = []
        
        // Try multiple selectors for TikTok video containers
        const videoSelectors = [
          '[data-e2e="search_top-item"]',
          '.video-feed-item',
          '[data-e2e="recommend-list-item"]',
          'div[data-e2e*="video"]',
          'a[href*="/video/"]'
        ]

        let videoElements = []
        for (const selector of videoSelectors) {
          videoElements = Array.from(document.querySelectorAll(selector))
          if (videoElements.length > 0) break
        }

        for (let i = 0; i < Math.min(videoElements.length, maxVideos); i++) {
          const element = videoElements[i]
          
          try {
            // Extract video URL
            const linkElement = element.querySelector('a[href*="/video/"]') || element.closest('a[href*="/video/"]') || element
            const videoUrl = linkElement?.getAttribute('href')
            if (!videoUrl) continue

            // Extract video ID from URL
            const videoIdMatch = videoUrl.match(/\/video\/(\d+)/)
            const videoId = videoIdMatch?.[1]
            if (!videoId) continue

            // Extract thumbnail
            const imgElement = element.querySelector('img')
            const thumbnailUrl = imgElement?.src || imgElement?.getAttribute('data-src') || ''

            // Extract description/caption
            const descriptionElement = element.querySelector('div[data-e2e="search-card-desc"], .video-meta-caption, [title]')
            const description = descriptionElement?.textContent?.trim() || 
                             descriptionElement?.getAttribute('title') || 
                             imgElement?.getAttribute('alt') || 
                             'TikTok hotdog video'

            // Extract author information
            const authorElement = element.querySelector('a[data-e2e="search-card-user-link"], .author-link, [href*="/@"]')
            const authorUrl = authorElement?.getAttribute('href') || ''
            const usernameMatch = authorUrl.match(/@([^/?]+)/)
            const username = usernameMatch?.[1] || 'unknown'

            // Extract stats if available
            const viewElement = element.querySelector('[data-e2e="video-views"], .view-count')
            const likeElement = element.querySelector('[data-e2e="like-count"], .like-count')
            
            const viewText = viewElement?.textContent?.trim() || '0'
            const likeText = likeElement?.textContent?.trim() || '0'

            // Parse numbers from text (handle K, M suffixes)
            const parseCount = (text) => {
              const match = text.match(/([\d.]+)([KMB]?)/)
              if (!match) return 0
              const num = parseFloat(match[1])
              const suffix = match[2]
              switch (suffix) {
                case 'K': return Math.floor(num * 1000)
                case 'M': return Math.floor(num * 1000000)
                case 'B': return Math.floor(num * 1000000000)
                default: return Math.floor(num)
              }
            }

            videos.push({
              id: videoId,
              video_url: `https://www.tiktok.com${videoUrl}`,
              thumbnail_url: thumbnailUrl,
              description: description,
              author: {
                username: username,
                profile_url: `https://www.tiktok.com/@${username}`
              },
              post_url: `https://www.tiktok.com${videoUrl}`,
              view_count: parseCount(viewText),
              like_count: parseCount(likeText),
              hashtags: this.extractHashtagsFromText(description),
              created_at: new Date()
            })

          } catch (error) {
            console.warn('Error extracting video data:', error)
          }
        }

        return videos
      }, limit)

      videos.push(...extractedVideos)

    } catch (error) {
      await loggingService.logWarning('TikTokScraper', 'Error extracting videos', {
        error: error.message
      })
    }

    return videos
  }

  /**
   * Scroll page to load more content
   */
  private async scrollToLoadContent(page: Page, targetCount: number): Promise<void> {
    let previousHeight = 0
    let scrollAttempts = 0
    const maxScrollAttempts = 6

    while (scrollAttempts < maxScrollAttempts) {
      // Check current number of videos
      const currentVideoCount = await page.evaluate(() => {
        const selectors = ['[data-e2e="search_top-item"]', '.video-feed-item', 'a[href*="/video/"]']
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector)
          if (elements.length > 0) return elements.length
        }
        return 0
      })

      if (currentVideoCount >= targetCount) {
        break
      }

      // Scroll down gradually
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight)
      })

      // Wait for content to load
      await page.waitForTimeout(3000)

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
   * Convert TikTok video to standard scraped content format
   */
  private convertToScrapedContent(video: TikTokVideo): ScrapedContent {
    return {
      id: video.id,
      platform: 'tiktok',
      type: 'video',
      content_video_url: video.video_url,
      content_text: video.description,
      original_url: video.post_url,
      original_author: video.author.username,
      original_author_url: video.author.profile_url,
      scraped_at: new Date(),
      metadata: {
        views: video.view_count,
        likes: video.like_count,
        comments: video.comment_count,
        shares: video.share_count,
        hashtags: video.hashtags,
        thumbnail_url: video.thumbnail_url,
        music: video.music,
        created_at: video.created_at,
        display_name: video.author.display_name
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
   * Get a random search term for scraping
   */
  private getRandomSearchTerm(): string {
    return this.searchTerms[Math.floor(Math.random() * this.searchTerms.length)]
  }

  /**
   * Check if TikTok is accessible
   */
  async testAccess(): Promise<{ accessible: boolean; error?: string }> {
    try {
      const page = await this.createPage()
      const result = await this.navigateWithRetry(page, `${this.baseUrl}/search?q=hotdog`)
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
   * Get available search terms for scraping
   */
  getAvailableSearchTerms(): string[] {
    return [...this.searchTerms]
  }

  /**
   * Get scraping statistics specific to TikTok
   */
  getTikTokStats(): {
    requestCount: number
    cacheSize: number
    lastRequestTime: number
    availableSearchTerms: string[]
    rateLimitMs: number
  } {
    const baseStats = this.getStats()
    return {
      ...baseStats,
      availableSearchTerms: this.searchTerms,
      rateLimitMs: this.config.rateLimitMs
    }
  }
}