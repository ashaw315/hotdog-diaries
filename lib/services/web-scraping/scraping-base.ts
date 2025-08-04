import { BrowserContext, Page } from 'playwright'
import { loggingService } from '../logging'
import { metricsService } from '../metrics'
import { browserManager } from '../browser-manager'
import UserAgent from 'user-agents'

export interface ScrapingConfig {
  headless: boolean
  stealth: boolean
  timeout: number
  userAgent?: string
  proxy?: {
    server: string
    username?: string
    password?: string
  }
  rateLimitMs: number
  maxRetries: number
  viewport?: {
    width: number
    height: number
  }
}

export interface ScrapingResult<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
  url: string
  responseTime: number
}

export interface ScrapedContent {
  id: string
  platform: 'instagram' | 'tiktok'
  type: 'image' | 'video'
  content_image_url?: string
  content_video_url?: string
  content_text: string
  original_url: string
  original_author: string
  original_author_url?: string
  scraped_at: Date
  metadata: {
    likes?: number
    views?: number
    comments?: number
    hashtags?: string[]
    thumbnail_url?: string
    [key: string]: any
  }
}

export abstract class WebScrapingBase {
  protected context?: BrowserContext
  protected contextId?: string
  protected config: ScrapingConfig
  protected userAgents: UserAgent
  protected lastRequestTime = 0
  protected requestCount = 0
  protected cache = new Map<string, { data: any; timestamp: number }>()
  
  constructor(config: Partial<ScrapingConfig> = {}) {
    this.config = {
      headless: true,
      stealth: true,
      timeout: 30000,
      rateLimitMs: 60000, // 1 minute between requests
      maxRetries: 3,
      viewport: { width: 1920, height: 1080 },
      ...config
    }
    
    this.userAgents = new UserAgent({ deviceCategory: 'desktop' })
  }

  /**
   * Initialize browser context using browser manager
   */
  async initialize(): Promise<void> {
    try {
      await loggingService.logInfo('WebScrapingBase', 'Getting browser context from manager')

      const { context, contextId } = await browserManager.getContext()
      this.context = context
      this.contextId = contextId

      await loggingService.logInfo('WebScrapingBase', 'Browser context initialized successfully', {
        contextId
      })

    } catch (error) {
      await loggingService.logError('WebScrapingBase', 'Failed to initialize browser context', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Create a new page with stealth configuration
   */
  async createPage(): Promise<Page> {
    if (!this.context) {
      await this.initialize()
    }

    const page = await this.context!.newPage()
    
    // Set additional stealth measures
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br'
    })

    // Block unnecessary resources for faster scraping
    await page.route('**/*', (route) => {
      const request = route.request()
      const resourceType = request.resourceType()
      
      // Block ads, analytics, and other non-essential resources
      if (['stylesheet', 'font', 'image'].includes(resourceType)) {
        // Allow some images for content scraping but block others
        if (resourceType === 'image' && !this.isContentImage(request.url())) {
          route.abort()
          return
        }
      }
      
      if (request.url().includes('google-analytics') || 
          request.url().includes('facebook.com/tr') ||
          request.url().includes('doubleclick') ||
          request.url().includes('ads')) {
        route.abort()
        return
      }
      
      route.continue()
    })

    return page
  }

  /**
   * Implement rate limiting
   */
  protected async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < this.config.rateLimitMs) {
      const waitTime = this.config.rateLimitMs - timeSinceLastRequest
      await loggingService.logDebug('WebScrapingBase', `Rate limiting: waiting ${waitTime}ms`)
      await this.delay(waitTime)
    }
    
    this.lastRequestTime = Date.now()
    this.requestCount++
  }

  /**
   * Navigate to URL with retry logic and rate limiting
   */
  protected async navigateWithRetry(page: Page, url: string): Promise<ScrapingResult<void>> {
    const startTime = Date.now()
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.rateLimit()
        
        await loggingService.logDebug('WebScrapingBase', `Navigating to URL (attempt ${attempt})`, {
          url,
          attempt
        })

        const response = await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: this.config.timeout
        })

        if (!response || response.status() >= 400) {
          throw new Error(`HTTP ${response?.status()} - ${response?.statusText()}`)
        }

        // Record successful navigation
        const responseTime = Date.now() - startTime
        await metricsService.recordCustomMetric(
          'scraping_navigation_success',
          responseTime,
          'ms',
          { url: this.sanitizeUrl(url), attempt: attempt.toString() }
        )

        return {
          success: true,
          timestamp: new Date(),
          url,
          responseTime
        }

      } catch (error) {
        await loggingService.logWarning('WebScrapingBase', `Navigation attempt ${attempt} failed`, {
          url,
          attempt,
          error: error.message
        })

        if (attempt === this.config.maxRetries) {
          const responseTime = Date.now() - startTime
          await metricsService.recordCustomMetric(
            'scraping_navigation_failed',
            responseTime,
            'ms',
            { url: this.sanitizeUrl(url), error: error.message }
          )

          return {
            success: false,
            error: error.message,
            timestamp: new Date(),
            url,
            responseTime
          }
        }

        // Exponential backoff
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await this.delay(backoffTime)
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded',
      timestamp: new Date(),
      url,
      responseTime: Date.now() - startTime
    }
  }

  /**
   * Check cache for recent data
   */
  protected getCachedData<T>(key: string, maxAgeMs: number = 300000): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < maxAgeMs) {
      return cached.data
    }
    return null
  }

  /**
   * Store data in cache
   */
  protected setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })

    // Clean old cache entries
    if (this.cache.size > 1000) {
      const oldestEntries = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)
        .slice(0, 100)
      
      oldestEntries.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * Clean up resources - release context back to manager
   */
  async cleanup(): Promise<void> {
    try {
      if (this.contextId) {
        await browserManager.releaseContext(this.contextId)
        this.context = undefined
        this.contextId = undefined
      }
      
      await loggingService.logInfo('WebScrapingBase', 'Browser context released', {
        requestCount: this.requestCount
      })
      
    } catch (error) {
      await loggingService.logError('WebScrapingBase', 'Error during cleanup', {
        error: error.message
      }, error as Error)
    }
  }

  /**
   * Rotate user agent
   */
  protected rotateUserAgent(): string {
    return this.userAgents.toString()
  }

  /**
   * Delay utility
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Sanitize URL for logging (remove sensitive parameters)
   */
  protected sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      // Remove potentially sensitive query parameters
      urlObj.searchParams.delete('access_token')
      urlObj.searchParams.delete('session_id')
      urlObj.searchParams.delete('auth')
      return urlObj.toString()
    } catch {
      return url
    }
  }

  /**
   * Check if image URL is content-related
   */
  private isContentImage(url: string): boolean {
    // Allow main content images but block ads/tracking pixels
    return !url.includes('ads') && 
           !url.includes('analytics') && 
           !url.includes('tracking') &&
           !url.includes('1x1') &&
           (url.includes('cdninstagram') || url.includes('tiktokcdn') || url.includes('scontent'))
  }

  /**
   * Abstract method to be implemented by specific scrapers
   */
  abstract scrapeContent(query: string, limit?: number): Promise<ScrapingResult<ScrapedContent[]>>

  /**
   * Get scraping statistics
   */
  getStats(): {
    requestCount: number
    cacheSize: number
    lastRequestTime: number
  } {
    return {
      requestCount: this.requestCount,
      cacheSize: this.cache.size,
      lastRequestTime: this.lastRequestTime
    }
  }
}