import { chromium, Browser, BrowserContext } from 'playwright'
import { loggingService } from './logging'
import { metricsService } from './metrics'
import UserAgent from 'user-agents'

export interface BrowserPoolConfig {
  maxBrowsers: number
  maxContextsPerBrowser: number
  idleTimeoutMs: number
  browserLaunchOptions: any
}

interface ManagedBrowser {
  browser: Browser
  contexts: Set<BrowserContext>
  lastUsed: number
  isClosing: boolean
}

interface ManagedContext {
  context: BrowserContext
  browser: Browser
  lastUsed: number
  inUse: boolean
}

export class BrowserManager {
  private browsers = new Map<string, ManagedBrowser>()
  private contexts = new Map<string, ManagedContext>()
  private userAgents: UserAgent
  private config: BrowserPoolConfig
  private cleanupInterval?: NodeJS.Timeout
  private nextBrowserId = 1
  private nextContextId = 1

  constructor(config: Partial<BrowserPoolConfig> = {}) {
    this.config = {
      maxBrowsers: 2, // Limit concurrent browsers
      maxContextsPerBrowser: 5, // Max contexts per browser
      idleTimeoutMs: 5 * 60 * 1000, // 5 minutes idle timeout
      browserLaunchOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--memory-pressure-off', // Reduce memory pressure
          '--max_old_space_size=512', // Limit V8 heap
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding'
        ]
      },
      ...config
    }

    this.userAgents = new UserAgent({ deviceCategory: 'desktop' })
    this.startCleanupTimer()
  }

  /**
   * Get or create a browser context for scraping
   */
  async getContext(): Promise<{ context: BrowserContext; contextId: string }> {
    const startTime = Date.now()
    
    try {
      // Try to reuse an existing idle context
      const existingContext = this.findIdleContext()
      if (existingContext) {
        existingContext.inUse = true
        existingContext.lastUsed = Date.now()
        
        await metricsService.recordCustomMetric(
          'browser_context_reused',
          Date.now() - startTime,
          'ms'
        )
        
        return {
          context: existingContext.context,
          contextId: this.getContextId(existingContext.context)
        }
      }

      // Create new context if we have capacity
      const browser = await this.getOrCreateBrowser()
      const contextId = `ctx_${this.nextContextId++}`
      
      const context = await browser.newContext({
        userAgent: this.userAgents.toString(),
        viewport: { width: 1920, height: 1080 },
        // Stealth settings
        permissions: [],
        geolocation: { latitude: 37.7749, longitude: -122.4194 },
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        }
      })

      // Add stealth scripts
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol
      })

      this.contexts.set(contextId, {
        context,
        browser,
        lastUsed: Date.now(),
        inUse: true
      })

      // Add context to browser's context set
      const browserId = this.getBrowserId(browser)
      const managedBrowser = this.browsers.get(browserId)
      if (managedBrowser) {
        managedBrowser.contexts.add(context)
      }

      await metricsService.recordCustomMetric(
        'browser_context_created',
        Date.now() - startTime,
        'ms'
      )

      await loggingService.logDebug('BrowserManager', `Created new context: ${contextId}`)

      return { context, contextId }

    } catch (error) {
      await loggingService.logError('BrowserManager', 'Failed to get browser context', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Release a browser context back to the pool
   */
  async releaseContext(contextId: string): Promise<void> {
    const managedContext = this.contexts.get(contextId)
    if (!managedContext) {
      return
    }

    managedContext.inUse = false
    managedContext.lastUsed = Date.now()

    await loggingService.logDebug('BrowserManager', `Released context: ${contextId}`)
  }

  /**
   * Get or create a browser instance
   */
  private async getOrCreateBrowser(): Promise<Browser> {
    // Try to find an existing browser with capacity
    for (const [browserId, managedBrowser] of this.browsers) {
      if (!managedBrowser.isClosing && 
          managedBrowser.contexts.size < this.config.maxContextsPerBrowser) {
        managedBrowser.lastUsed = Date.now()
        return managedBrowser.browser
      }
    }

    // Create new browser if we have capacity
    if (this.browsers.size < this.config.maxBrowsers) {
      return await this.createBrowser()
    }

    // Find the least recently used browser and close it, then create a new one
    const oldestBrowser = Array.from(this.browsers.entries())
      .sort(([,a], [,b]) => a.lastUsed - b.lastUsed)[0]

    if (oldestBrowser) {
      await this.closeBrowser(oldestBrowser[0])
    }

    return await this.createBrowser()
  }

  /**
   * Create a new browser instance
   */
  private async createBrowser(): Promise<Browser> {
    const startTime = Date.now()
    const browserId = `browser_${this.nextBrowserId++}`

    try {
      await loggingService.logInfo('BrowserManager', `Creating new browser: ${browserId}`)

      const browser = await chromium.launch(this.config.browserLaunchOptions)

      this.browsers.set(browserId, {
        browser,
        contexts: new Set(),
        lastUsed: Date.now(),
        isClosing: false
      })

      await metricsService.recordCustomMetric(
        'browser_created',
        Date.now() - startTime,
        'ms'
      )

      await loggingService.logInfo('BrowserManager', `Browser created successfully: ${browserId}`)

      return browser

    } catch (error) {
      await loggingService.logError('BrowserManager', `Failed to create browser: ${browserId}`, {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Find an idle context that can be reused
   */
  private findIdleContext(): ManagedContext | null {
    for (const managedContext of this.contexts.values()) {
      if (!managedContext.inUse && 
          Date.now() - managedContext.lastUsed < this.config.idleTimeoutMs) {
        return managedContext
      }
    }
    return null
  }

  /**
   * Close a specific browser and all its contexts
   */
  private async closeBrowser(browserId: string): Promise<void> {
    const managedBrowser = this.browsers.get(browserId)
    if (!managedBrowser || managedBrowser.isClosing) {
      return
    }

    managedBrowser.isClosing = true

    try {
      // Close all contexts first
      const contextsToClose = Array.from(this.contexts.entries())
        .filter(([, ctx]) => ctx.browser === managedBrowser.browser)

      for (const [contextId, managedContext] of contextsToClose) {
        try {
          await managedContext.context.close()
          this.contexts.delete(contextId)
        } catch (error) {
          await loggingService.logWarning('BrowserManager', `Failed to close context ${contextId}`, {
            error: error.message
          })
        }
      }

      // Close the browser
      await managedBrowser.browser.close()
      this.browsers.delete(browserId)

      await loggingService.logInfo('BrowserManager', `Browser closed: ${browserId}`)

    } catch (error) {
      await loggingService.logError('BrowserManager', `Error closing browser ${browserId}`, {
        error: error.message
      }, error as Error)
    }
  }

  /**
   * Clean up idle contexts and browsers
   */
  private async cleanupIdleResources(): Promise<void> {
    const now = Date.now()
    const idleContexts: string[] = []
    const idleBrowsers: string[] = []

    // Find idle contexts
    for (const [contextId, managedContext] of this.contexts) {
      if (!managedContext.inUse && 
          now - managedContext.lastUsed > this.config.idleTimeoutMs) {
        idleContexts.push(contextId)
      }
    }

    // Close idle contexts
    for (const contextId of idleContexts) {
      const managedContext = this.contexts.get(contextId)
      if (managedContext) {
        try {
          await managedContext.context.close()
          this.contexts.delete(contextId)

          // Remove from browser's context set
          const browserId = this.getBrowserId(managedContext.browser)
          const managedBrowser = this.browsers.get(browserId)
          if (managedBrowser) {
            managedBrowser.contexts.delete(managedContext.context)
          }

          await loggingService.logDebug('BrowserManager', `Cleaned up idle context: ${contextId}`)
        } catch (error) {
          await loggingService.logWarning('BrowserManager', `Failed to cleanup context ${contextId}`, {
            error: error.message
          })
        }
      }
    }

    // Find browsers with no contexts that are idle
    for (const [browserId, managedBrowser] of this.browsers) {
      if (managedBrowser.contexts.size === 0 && 
          now - managedBrowser.lastUsed > this.config.idleTimeoutMs) {
        idleBrowsers.push(browserId)
      }
    }

    // Close idle browsers
    for (const browserId of idleBrowsers) {
      await this.closeBrowser(browserId)
    }

    if (idleContexts.length > 0 || idleBrowsers.length > 0) {
      await loggingService.logInfo('BrowserManager', 'Cleanup completed', {
        closedContexts: idleContexts.length,
        closedBrowsers: idleBrowsers.length
      })
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupIdleResources()
    }, 60000) // Run cleanup every minute
  }

  /**
   * Get browser ID for a browser instance
   */
  private getBrowserId(browser: Browser): string {
    for (const [id, managedBrowser] of this.browsers) {
      if (managedBrowser.browser === browser) {
        return id
      }
    }
    return 'unknown'
  }

  /**
   * Get context ID for a context instance
   */
  private getContextId(context: BrowserContext): string {
    for (const [id, managedContext] of this.contexts) {
      if (managedContext.context === context) {
        return id
      }
    }
    return 'unknown'
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    activeBrowsers: number
    activeContexts: number
    idleContexts: number
    totalMemoryMB?: number
  } {
    const activeContexts = Array.from(this.contexts.values()).filter(ctx => ctx.inUse).length
    const idleContexts = this.contexts.size - activeContexts

    return {
      activeBrowsers: this.browsers.size,
      activeContexts,
      idleContexts,
      totalMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }
  }

  /**
   * Force cleanup all resources
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    await loggingService.logInfo('BrowserManager', 'Shutting down browser manager')

    // Close all contexts
    const contextPromises = Array.from(this.contexts.keys()).map(async (contextId) => {
      const managedContext = this.contexts.get(contextId)
      if (managedContext) {
        try {
          await managedContext.context.close()
        } catch (error) {
          await loggingService.logWarning('BrowserManager', `Error closing context ${contextId}`, {
            error: error.message
          })
        }
      }
    })

    await Promise.all(contextPromises)
    this.contexts.clear()

    // Close all browsers
    const browserPromises = Array.from(this.browsers.keys()).map(async (browserId) => {
      await this.closeBrowser(browserId)
    })

    await Promise.all(browserPromises)

    await loggingService.logInfo('BrowserManager', 'Browser manager shutdown complete')
  }
}

// Export singleton instance
export const browserManager = new BrowserManager()

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await browserManager.shutdown()
  })

  process.on('SIGINT', async () => {
    await browserManager.shutdown()
  })
}