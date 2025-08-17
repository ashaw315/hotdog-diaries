import { queueManager, QueueStats, ScanRecommendation } from './queue-manager'
import { loggingService } from './logging'
import { metricsService } from './metrics-service'

// Import scanning services
import { YouTubeScanningService } from './youtube-scanning'
import { RedditService } from './reddit'
import { TumblrScanningService } from './tumblr-scanning'
import { LemmyScanningService } from './lemmy-scanning'
import { ImgurScanningService } from './imgur-scanning'
import { GiphyScanningService } from './giphy-scanning'
import { BlueskyScanningService } from './bluesky-scanning'
import { PixabayScanningService } from './pixabay-scanning'

export interface ScanResult {
  platform: string
  success: boolean
  itemsFound: number
  itemsProcessed: number
  itemsApproved: number
  errors: string[]
  duration: number
  skipped: boolean
  reason: string
}

export interface DailyScanSummary {
  timestamp: string
  totalScans: number
  successfulScans: number
  totalItemsFound: number
  totalItemsApproved: number
  queueStatsBefore: QueueStats
  queueStatsAfter: QueueStats
  scanResults: ScanResult[]
  recommendations: ScanRecommendation[]
  skippedScans: number
  apiCallsSaved: number
}

export class ScanningScheduler {
  private readonly MAX_CONCURRENT_SCANS = 2 // Prevent rate limit issues
  private readonly SCAN_DELAY_MS = 5000 // 5 second delay between scans
  private readonly DEFAULT_SCAN_SIZES = {
    high: 15,    // High priority: scan more items
    medium: 10,  // Medium priority: normal scan
    low: 5       // Low priority: minimal scan
  }

  /**
   * Execute smart daily scans based on queue needs
   */
  async executeDailyScans(): Promise<DailyScanSummary> {
    const startTime = Date.now()
    
    try {
      await loggingService.logInfo('ScanningScheduler', 'Starting daily smart scanning routine')

      // Get initial queue statistics
      const queueStatsBefore = await queueManager.getQueueStats()
      const recommendations = await queueManager.getScanRecommendations()

      await loggingService.logInfo('ScanningScheduler', `Queue Status: ${queueStatsBefore.totalApproved} items (${queueStatsBefore.daysOfContent.toFixed(1)} days)`, {
        totalApproved: queueStatsBefore.totalApproved,
        daysOfContent: queueStatsBefore.daysOfContent,
        needsScanning: queueStatsBefore.needsScanning
      })

      // Check if we should skip all scanning
      if (queueStatsBefore.daysOfContent > 14) {
        await loggingService.logInfo('ScanningScheduler', 'Sufficient content queued. Skipping all platform scans today.', {
          daysOfContent: queueStatsBefore.daysOfContent,
          threshold: 14
        })

        return this.createSkippedSummary(queueStatsBefore, recommendations, 'Sufficient content - over 14 days queued')
      }

      // Filter recommendations to actionable items
      const scansToExecute = recommendations.filter(rec => rec.priority !== 'skip')
      const skippedScans = recommendations.filter(rec => rec.priority === 'skip')

      await loggingService.logInfo('ScanningScheduler', `Planning to execute ${scansToExecute.length} scans, skipping ${skippedScans.length}`, {
        high: scansToExecute.filter(s => s.priority === 'high').length,
        medium: scansToExecute.filter(s => s.priority === 'medium').length,
        low: scansToExecute.filter(s => s.priority === 'low').length
      })

      // Execute scans in priority order
      const scanResults: ScanResult[] = []
      
      for (const recommendation of scansToExecute) {
        try {
          await loggingService.logInfo('ScanningScheduler', `Scanning ${recommendation.platform}`, {
            priority: recommendation.priority,
            reason: recommendation.reason,
            contentType: recommendation.contentType
          })

          const result = await this.scanPlatform(recommendation)
          scanResults.push(result)

          // Record metrics
          await metricsService.recordContentProcessingMetric({
            platform: recommendation.platform,
            success: result.success,
            processingTime: result.duration,
            contentType: recommendation.contentType,
            itemCount: result.itemsApproved,
            errorMessage: result.errors.length > 0 ? result.errors.join('; ') : undefined
          })

          // Add delay between scans to avoid rate limits
          if (scansToExecute.indexOf(recommendation) < scansToExecute.length - 1) {
            await new Promise(resolve => setTimeout(resolve, this.SCAN_DELAY_MS))
          }

        } catch (error) {
          await loggingService.logError('ScanningScheduler', `Failed to scan ${recommendation.platform}`, {
            platform: recommendation.platform,
            priority: recommendation.priority
          }, error as Error)

          scanResults.push({
            platform: recommendation.platform,
            success: false,
            itemsFound: 0,
            itemsProcessed: 0,
            itemsApproved: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            duration: 0,
            skipped: false,
            reason: recommendation.reason
          })
        }
      }

      // Add skipped scans to results
      for (const skipped of skippedScans) {
        scanResults.push({
          platform: skipped.platform,
          success: true,
          itemsFound: 0,
          itemsProcessed: 0,
          itemsApproved: 0,
          errors: [],
          duration: 0,
          skipped: true,
          reason: skipped.reason
        })
      }

      // Get final queue statistics
      const queueStatsAfter = await queueManager.getQueueStats()

      // Calculate summary
      const successful = scanResults.filter(r => r.success && !r.skipped)
      const totalItemsFound = scanResults.reduce((sum, r) => sum + r.itemsFound, 0)
      const totalItemsApproved = scanResults.reduce((sum, r) => sum + r.itemsApproved, 0)
      const apiCallsSaved = skippedScans.length * 10 // Estimate 10 API calls per scan

      const summary: DailyScanSummary = {
        timestamp: new Date().toISOString(),
        totalScans: scansToExecute.length,
        successfulScans: successful.length,
        totalItemsFound,
        totalItemsApproved,
        queueStatsBefore,
        queueStatsAfter,
        scanResults,
        recommendations,
        skippedScans: skippedScans.length,
        apiCallsSaved
      }

      await loggingService.logInfo('ScanningScheduler', 'Daily scanning completed', {
        duration: Date.now() - startTime,
        totalScans: summary.totalScans,
        successfulScans: summary.successfulScans,
        itemsFound: totalItemsFound,
        itemsApproved: totalItemsApproved,
        queueGrowth: queueStatsAfter.totalApproved - queueStatsBefore.totalApproved,
        apiCallsSaved
      })

      return summary

    } catch (error) {
      await loggingService.logError('ScanningScheduler', 'Daily scanning failed', {
        duration: Date.now() - startTime
      }, error as Error)
      throw error
    }
  }

  /**
   * Scan a specific platform based on recommendation
   */
  private async scanPlatform(recommendation: ScanRecommendation): Promise<ScanResult> {
    const startTime = Date.now()
    const platform = recommendation.platform
    const scanSize = this.DEFAULT_SCAN_SIZES[recommendation.priority] || 5

    try {
      let scanResult: any = null

      switch (platform) {
        case 'reddit':
          const redditService = new RedditService()
          const redditPosts = await redditService.searchSubreddits({
            subreddits: ['hotdogs', 'food', 'FoodPorn'],
            maxPosts: scanSize,
            sortBy: 'hot',
            timeRange: 'week'
          })
          scanResult = {
            totalFound: redditPosts.length,
            processed: 0,
            approved: 0,
            rejected: 0,
            duplicates: 0,
            errors: []
          }
          break

        case 'youtube':
          const youtubeService = new YouTubeScanningService()
          scanResult = await youtubeService.performScan({ maxPosts: scanSize })
          break

        case 'bluesky':
          const blueskyService = new BlueskyScanningService()
          scanResult = await blueskyService.performScan({ maxPosts: scanSize })
          break

        case 'pixabay':
          const pixabayService = new PixabayScanningService()
          scanResult = await pixabayService.performScan({ maxImages: scanSize })
          break

        case 'giphy':
          const giphyService = new GiphyScanningService()
          scanResult = await giphyService.performScan({ maxGifs: scanSize })
          break

        case 'tumblr':
          const tumblrService = new TumblrScanningService()
          scanResult = await tumblrService.performScan({ maxPosts: scanSize })
          break

        case 'imgur':
          const imgurService = new ImgurScanningService()
          scanResult = await imgurService.performScan({ maxImages: scanSize })
          break

        case 'lemmy':
          const lemmyService = new LemmyScanningService()
          scanResult = await lemmyService.performScan({ maxPosts: scanSize })
          break

        default:
          throw new Error(`Unknown platform: ${platform}`)
      }

      return {
        platform,
        success: true,
        itemsFound: scanResult.totalFound || 0,
        itemsProcessed: scanResult.processed || 0,
        itemsApproved: scanResult.approved || 0,
        errors: scanResult.errors || [],
        duration: Date.now() - startTime,
        skipped: false,
        reason: recommendation.reason
      }

    } catch (error) {
      return {
        platform,
        success: false,
        itemsFound: 0,
        itemsProcessed: 0,
        itemsApproved: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration: Date.now() - startTime,
        skipped: false,
        reason: recommendation.reason
      }
    }
  }

  /**
   * Create summary for when all scans are skipped
   */
  private createSkippedSummary(
    queueStats: QueueStats, 
    recommendations: ScanRecommendation[], 
    reason: string
  ): DailyScanSummary {
    const scanResults: ScanResult[] = recommendations.map(rec => ({
      platform: rec.platform,
      success: true,
      itemsFound: 0,
      itemsProcessed: 0,
      itemsApproved: 0,
      errors: [],
      duration: 0,
      skipped: true,
      reason
    }))

    return {
      timestamp: new Date().toISOString(),
      totalScans: 0,
      successfulScans: 0,
      totalItemsFound: 0,
      totalItemsApproved: 0,
      queueStatsBefore: queueStats,
      queueStatsAfter: queueStats,
      scanResults,
      recommendations,
      skippedScans: recommendations.length,
      apiCallsSaved: recommendations.length * 10 // Estimate
    }
  }

  /**
   * Get scan schedule for the next 7 days based on current queue
   */
  async getWeeklySchedule(): Promise<{
    day: string
    date: string
    shouldScan: boolean
    estimatedItems: number
    priority: string[]
    reason: string
  }[]> {
    try {
      const stats = await queueManager.getQueueStats()
      const schedule = []
      
      let currentQueueSize = stats.totalApproved
      const dailyConsumption = 6 // 6 posts per day

      for (let i = 0; i < 7; i++) {
        const date = new Date()
        date.setDate(date.getDate() + i)
        
        // Estimate queue depletion
        currentQueueSize -= dailyConsumption
        
        let shouldScan = currentQueueSize < 42 // Less than 7 days
        let estimatedItems = 0
        let priority: string[] = []
        let reason = ''

        if (shouldScan) {
          const recommendations = await queueManager.getScanRecommendations()
          priority = recommendations
            .filter(r => r.priority === 'high' || r.priority === 'medium')
            .map(r => r.platform)
          estimatedItems = priority.length * 8 // Estimate 8 items per platform
          reason = `Queue will be at ${currentQueueSize} items`
        } else {
          reason = `Queue sufficient (${currentQueueSize} items)`
        }

        schedule.push({
          day: date.toLocaleDateString('en-US', { weekday: 'long' }),
          date: date.toISOString().split('T')[0],
          shouldScan,
          estimatedItems,
          priority,
          reason
        })
      }

      return schedule

    } catch (error) {
      await loggingService.logError('ScanningScheduler', 'Failed to generate weekly schedule', {}, error as Error)
      throw error
    }
  }

  /**
   * Force scan specific platforms (for manual override)
   */
  async forceScanPlatforms(platforms: string[], reason: string = 'Manual override'): Promise<ScanResult[]> {
    try {
      await loggingService.logInfo('ScanningScheduler', `Force scanning platforms: ${platforms.join(', ')}`, {
        platforms,
        reason
      })

      const results: ScanResult[] = []

      for (const platform of platforms) {
        const fakeRecommendation: ScanRecommendation = {
          platform,
          priority: 'high',
          reason,
          contentType: queueManager.getPlatformPrimaryContentType(platform)
        }

        const result = await this.scanPlatform(fakeRecommendation)
        results.push(result)

        // Add delay between forced scans
        if (platforms.indexOf(platform) < platforms.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.SCAN_DELAY_MS))
        }
      }

      return results

    } catch (error) {
      await loggingService.logError('ScanningScheduler', 'Force scan failed', {
        platforms,
        reason
      }, error as Error)
      throw error
    }
  }
}

export const scanningScheduler = new ScanningScheduler()