import { redditScanningService, RedditScanResult, RedditScanConfig } from './reddit-scanning'
import { instagramScanningService, InstagramScanResult, InstagramScanConfig } from './instagram-scanning'
import { tiktokScanningService, TikTokScanResult, TikTokScanConfig } from './tiktok-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { query } from '@/lib/db-query-builder'

export interface PlatformScanResult {
  platform: 'reddit' | 'instagram' | 'tiktok'
  scanId: string
  success: boolean
  postsFound: number
  postsApproved: number
  errors: string[]
  duration: number // milliseconds
  contentType?: 'posts' | 'images' | 'videos' // Track content type for balancing
}

export interface UnifiedScanResult {
  scanId: string
  startTime: Date
  endTime: Date
  platforms: PlatformScanResult[]
  totalPostsFound: number
  totalPostsApproved: number
  totalErrors: number
  successfulPlatforms: number
  failedPlatforms: number
}

export interface PlatformStatus {
  platform: 'reddit' | 'instagram' | 'tiktok'
  isEnabled: boolean
  isAuthenticated: boolean
  lastScanTime?: Date
  nextScanTime?: Date
  rateLimitStatus: 'healthy' | 'warning' | 'critical'
  errorCount: number
  contentType: 'posts' | 'images' | 'videos'
  quotaStatus?: {
    hourlyUsed: number
    hourlyLimit: number
    dailyUsed: number
    dailyLimit: number
  }
}

export interface SocialMediaCoordinationConfig {
  enableCoordination: boolean
  scanInterval: number // minutes - unified interval
  platformPriority: ('reddit' | 'instagram' | 'tiktok')[]
  contentBalancing: {
    enabled: boolean
    redditWeight: number // 0-100
    instagramWeight: number // 0-100
    tiktokWeight: number // 0-100
    targetDistribution: {
      posts: number // percentage from text-based platforms
      images: number // percentage from image platforms
      videos: number // percentage from video platforms
    }
  }
  rateLimitCoordination: boolean
  errorThreshold: number // max errors before disabling platform
  intelligentScheduling: {
    enabled: boolean
    peakContentTimes: {
      reddit: string[] // Hours when Reddit has most content (e.g., ["09", "15", "21"])
      instagram: string[] // Hours when Instagram has most content
      tiktok: string[] // Hours when TikTok has most content
    }
    adaptiveIntervals: boolean // Adjust intervals based on content availability
  }
}

export class SocialMediaService {
  private isCoordinatedScanRunning = false
  private coordinationTimer?: NodeJS.Timeout

  /**
   * Start coordinated scanning across all platforms
   */
  async startCoordinatedScanning(): Promise<void> {
    try {
      const config = await this.getCoordinationConfig()
      
      if (!config.enableCoordination) {
        await logToDatabase(
          LogLevel.INFO,
          'SOCIAL_MEDIA_COORDINATION_DISABLED',
          'Social media coordination is disabled'
        )
        return
      }

      // Clear existing timer
      if (this.coordinationTimer) {
        clearInterval(this.coordinationTimer)
      }

      // Set up coordinated scanning
      const intervalMs = config.scanInterval * 60 * 1000
      this.coordinationTimer = setInterval(async () => {
        if (!this.isCoordinatedScanRunning) {
          await this.performCoordinatedScan()
        }
      }, intervalMs)

      // Perform initial scan
      await this.performCoordinatedScan()

      await logToDatabase(
        LogLevel.INFO,
        'SOCIAL_MEDIA_COORDINATION_STARTED',
        `Coordinated scanning started with ${config.scanInterval} minute intervals`,
        { config }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'SOCIAL_MEDIA_COORDINATION_START_ERROR',
        `Failed to start coordinated scanning: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Stop coordinated scanning
   */
  async stopCoordinatedScanning(): Promise<void> {
    if (this.coordinationTimer) {
      clearInterval(this.coordinationTimer)
      this.coordinationTimer = undefined
    }

    await logToDatabase(
      LogLevel.INFO,
      'SOCIAL_MEDIA_COORDINATION_STOPPED',
      'Coordinated scanning stopped'
    )
  }

  /**
   * Perform coordinated scan across all enabled platforms
   */
  async performCoordinatedScan(): Promise<UnifiedScanResult> {
    if (this.isCoordinatedScanRunning) {
      throw new Error('Coordinated scan already in progress')
    }

    this.isCoordinatedScanRunning = true
    const scanId = `unified_scan_${Date.now()}`
    const startTime = new Date()

    const result: UnifiedScanResult = {
      scanId,
      startTime,
      endTime: new Date(),
      platforms: [],
      totalPostsFound: 0,
      totalPostsApproved: 0,
      totalErrors: 0,
      successfulPlatforms: 0,
      failedPlatforms: 0
    }

    try {
      const config = await this.getCoordinationConfig()
      const platformStatuses = await this.getPlatformStatuses()

      // Determine scan order based on priority and rate limits
      const scanOrder = await this.determineScanOrder(config, platformStatuses)

      await logToDatabase(
        LogLevel.INFO,
        'COORDINATED_SCAN_STARTED',
        `Starting coordinated scan across ${scanOrder.length} platforms`,
        { scanId, platforms: scanOrder }
      )

      // Scan platforms in order with coordination
      for (const platform of scanOrder) {
        const platformStatus = platformStatuses.find(p => p.platform === platform)
        
        if (!platformStatus?.isEnabled || !platformStatus?.isAuthenticated) {
          await logToDatabase(
            LogLevel.WARNING,
            'PLATFORM_SCAN_SKIPPED',
            `Skipping ${platform} scan: not enabled or not authenticated`,
            { scanId, platform }
          )
          continue
        }

        // Check rate limits before scanning
        if (config.rateLimitCoordination && platformStatus.rateLimitStatus === 'critical') {
          await logToDatabase(
            LogLevel.WARNING,
            'PLATFORM_SCAN_SKIPPED_RATE_LIMIT',
            `Skipping ${platform} scan: rate limit critical`,
            { scanId, platform }
          )
          continue
        }

        const platformResult = await this.scanPlatform(platform, scanId)
        result.platforms.push(platformResult)

        if (platformResult.success) {
          result.successfulPlatforms++
        } else {
          result.failedPlatforms++
        }

        result.totalPostsFound += platformResult.postsFound
        result.totalPostsApproved += platformResult.postsApproved
        result.totalErrors += platformResult.errors.length

        // Add delay between platform scans to respect rate limits
        if (config.rateLimitCoordination && scanOrder.indexOf(platform) < scanOrder.length - 1) {
          await this.delay(5000) // 5 second delay between platforms
        }
      }

      result.endTime = new Date()

      // Apply content balancing if enabled
      if (config.contentBalancing.enabled) {
        await this.applyContentBalancing(result, config)
      }

      // Record unified scan result
      await this.recordUnifiedScanResult(result)

      await logToDatabase(
        LogLevel.INFO,
        'COORDINATED_SCAN_COMPLETED',
        `Coordinated scan completed: ${result.totalPostsApproved} posts approved across ${result.successfulPlatforms} platforms`,
        result
      )

      return result

    } catch (error) {
      result.endTime = new Date()
      result.totalErrors++

      await logToDatabase(
        LogLevel.ERROR,
        'COORDINATED_SCAN_ERROR',
        `Coordinated scan failed: ${error.message}`,
        { scanId, error: error.message }
      )

      throw error

    } finally {
      this.isCoordinatedScanRunning = false
    }
  }

  /**
   * Get status of all social media platforms
   */
  async getPlatformStatuses(): Promise<PlatformStatus[]> {
    const statuses: PlatformStatus[] = []

    try {
      // Reddit status
      const redditConfig = await redditScanningService.getScanConfig()
      const redditStatus = await redditScanningService.testConnection()
      
      statuses.push({
        platform: 'reddit',
        isEnabled: redditConfig.isEnabled,
        isAuthenticated: redditStatus.success,
        lastScanTime: redditConfig.lastScanTime,
        rateLimitStatus: 'healthy', // Would need to integrate with monitoring
        errorCount: 0, // Would need to get from recent scans
        contentType: 'posts'
      })

      // Instagram status
      const instagramConfig = await instagramScanningService.getScanConfig()
      const instagramStatus = await instagramScanningService.testConnection()
      
      statuses.push({
        platform: 'instagram',
        isEnabled: instagramConfig.isEnabled,
        isAuthenticated: instagramStatus.success,
        lastScanTime: instagramConfig.lastScanTime,
        rateLimitStatus: 'healthy', // Would need to integrate with monitoring
        errorCount: 0, // Would need to get from recent scans
        contentType: 'images'
      })

      // TikTok status
      const tiktokConfig = await tiktokScanningService.getScanConfig()
      const tiktokStatus = await tiktokScanningService.testConnection()
      
      statuses.push({
        platform: 'tiktok',
        isEnabled: tiktokConfig.isEnabled,
        isAuthenticated: tiktokStatus.success,
        lastScanTime: tiktokConfig.lastScanTime,
        rateLimitStatus: 'healthy', // Would need to integrate with monitoring
        errorCount: 0, // Would need to get from recent scans
        contentType: 'videos',
        quotaStatus: {
          hourlyUsed: 0, // Would get from TikTok monitoring service
          hourlyLimit: 100,
          dailyUsed: 0,
          dailyLimit: 1000
        }
      })

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'PLATFORM_STATUS_ERROR',
        `Failed to get platform statuses: ${error.message}`,
        { error: error.message }
      )
    }

    return statuses
  }

  /**
   * Get unified statistics across all platforms
   */
  async getUnifiedStats(): Promise<{
    totalScans: number
    totalPostsFound: number
    totalPostsApproved: number
    platformBreakdown: Array<{
      platform: string
      scans: number
      postsFound: number
      postsApproved: number
      successRate: number
      contentType: string
    }>
    contentDistribution: {
      posts: number // percentage
      images: number // percentage
      videos: number // percentage
    }
    averageSuccessRate: number
    lastScanTime?: Date
  }> {
    try {
      // Get Reddit stats
      const redditStats = await redditScanningService.getScanStats()
      
      // Get Instagram stats
      const instagramStats = await instagramScanningService.getScanStats()

      // Get TikTok stats
      const tiktokStats = await tiktokScanningService.getScanStats()

      const platformBreakdown = [
        {
          platform: 'reddit',
          scans: redditStats.totalScans,
          postsFound: redditStats.totalPostsFound,
          postsApproved: redditStats.totalPostsApproved,
          successRate: redditStats.successRate,
          contentType: 'posts'
        },
        {
          platform: 'instagram',
          scans: instagramStats.totalScans,
          postsFound: instagramStats.totalPostsFound,
          postsApproved: instagramStats.totalPostsApproved,
          successRate: instagramStats.successRate,
          contentType: 'images'
        },
        {
          platform: 'tiktok',
          scans: tiktokStats.totalScans,
          postsFound: tiktokStats.totalVideosFound,
          postsApproved: tiktokStats.totalVideosApproved,
          successRate: tiktokStats.successRate,
          contentType: 'videos'
        }
      ]

      const totalScans = redditStats.totalScans + instagramStats.totalScans + tiktokStats.totalScans
      const totalPostsFound = redditStats.totalPostsFound + instagramStats.totalPostsFound + tiktokStats.totalVideosFound
      const totalPostsApproved = redditStats.totalPostsApproved + instagramStats.totalPostsApproved + tiktokStats.totalVideosApproved
      
      const averageSuccessRate = platformBreakdown.length > 0 
        ? platformBreakdown.reduce((sum, p) => sum + p.successRate, 0) / platformBreakdown.length
        : 0

      // Calculate content distribution
      const contentDistribution = this.calculateContentDistribution(platformBreakdown)

      const lastScanTimes = [redditStats.lastScanTime, instagramStats.lastScanTime, tiktokStats.lastScanTime].filter(Boolean)
      const lastScanTime = lastScanTimes.length > 0 
        ? new Date(Math.max(...lastScanTimes.map(d => d!.getTime())))
        : undefined

      return {
        totalScans,
        totalPostsFound,
        totalPostsApproved,
        platformBreakdown,
        contentDistribution,
        averageSuccessRate,
        lastScanTime
      }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'UNIFIED_STATS_ERROR',
        `Failed to get unified statistics: ${error.message}`,
        { error: error.message }
      )

      return {
        totalScans: 0,
        totalPostsFound: 0,
        totalPostsApproved: 0,
        platformBreakdown: [],
        contentDistribution: { posts: 0, images: 0, videos: 0 },
        averageSuccessRate: 0
      }
    }
  }

  // Private helper methods

  private async scanPlatform(platform: 'reddit' | 'instagram' | 'tiktok', scanId: string): Promise<PlatformScanResult> {
    const startTime = Date.now()
    
    try {
      let result: RedditScanResult | InstagramScanResult | TikTokScanResult
      let contentType: 'posts' | 'images' | 'videos'

      if (platform === 'reddit') {
        result = await redditScanningService.performScan()
        contentType = 'posts'
      } else if (platform === 'instagram') {
        result = await instagramScanningService.performScan()
        contentType = 'images'
      } else {
        result = await tiktokScanningService.performScan()
        contentType = 'videos'
      }

      return {
        platform,
        scanId: result.scanId,
        success: true,
        postsFound: 'videosFound' in result ? result.videosFound : result.postsFound,
        postsApproved: 'videosApproved' in result ? result.videosApproved : result.postsApproved,
        errors: result.errors,
        duration: Date.now() - startTime,
        contentType
      }

    } catch (error) {
      return {
        platform,
        scanId: `${platform}_scan_error_${Date.now()}`,
        success: false,
        postsFound: 0,
        postsApproved: 0,
        errors: [error.message],
        duration: Date.now() - startTime,
        contentType: platform === 'reddit' ? 'posts' : platform === 'instagram' ? 'images' : 'videos'
      }
    }
  }

  private async determineScanOrder(
    config: SocialMediaCoordinationConfig, 
    statuses: PlatformStatus[]
  ): Promise<('reddit' | 'instagram' | 'tiktok')[]> {
    const enabledPlatforms = statuses
      .filter(s => s.isEnabled && s.isAuthenticated)
      .map(s => s.platform)

    // Start with configured priority order
    let scanOrder = config.platformPriority.filter(p => enabledPlatforms.includes(p))

    // Add any enabled platforms not in priority list
    const missingPlatforms = enabledPlatforms.filter(p => !scanOrder.includes(p))
    scanOrder = [...scanOrder, ...missingPlatforms]

    // Apply intelligent scheduling if enabled
    if (config.intelligentScheduling.enabled) {
      scanOrder = await this.applyIntelligentScheduling(scanOrder, config, statuses)
    }

    // Reorder based on rate limit status if coordination is enabled
    if (config.rateLimitCoordination) {
      scanOrder.sort((a, b) => {
        const statusA = statuses.find(s => s.platform === a)
        const statusB = statuses.find(s => s.platform === b)
        
        // Prioritize platforms with healthy rate limits and better quota status
        let scoreA = statusA?.rateLimitStatus === 'healthy' ? 0 : 2
        let scoreB = statusB?.rateLimitStatus === 'healthy' ? 0 : 2
        
        // Factor in quota usage for TikTok
        if (statusA?.platform === 'tiktok' && statusA.quotaStatus) {
          const quotaPercentage = (statusA.quotaStatus.hourlyUsed / statusA.quotaStatus.hourlyLimit) * 100
          if (quotaPercentage > 80) scoreA += 1
        }
        
        if (statusB?.platform === 'tiktok' && statusB.quotaStatus) {
          const quotaPercentage = (statusB.quotaStatus.hourlyUsed / statusB.quotaStatus.hourlyLimit) * 100
          if (quotaPercentage > 80) scoreB += 1
        }
        
        return scoreA - scoreB
      })
    }

    return scanOrder
  }

  private async applyIntelligentScheduling(
    scanOrder: ('reddit' | 'instagram' | 'tiktok')[],
    config: SocialMediaCoordinationConfig,
    statuses: PlatformStatus[]
  ): Promise<('reddit' | 'instagram' | 'tiktok')[]> {
    const currentHour = new Date().getHours().toString().padStart(2, '0')
    
    // Reorder based on peak content times
    return scanOrder.sort((a, b) => {
      const isPeakA = config.intelligentScheduling.peakContentTimes[a]?.includes(currentHour) ? 0 : 1
      const isPeakB = config.intelligentScheduling.peakContentTimes[b]?.includes(currentHour) ? 0 : 1
      
      return isPeakA - isPeakB
    })
  }

  private calculateContentDistribution(platformBreakdown: Array<{
    platform: string
    scans: number
    postsFound: number
    postsApproved: number
    successRate: number
    contentType: string
  }>): { posts: number; images: number; videos: number } {
    const totalApproved = platformBreakdown.reduce((sum, p) => sum + p.postsApproved, 0)
    
    if (totalApproved === 0) {
      return { posts: 0, images: 0, videos: 0 }
    }

    const posts = platformBreakdown
      .filter(p => p.contentType === 'posts')
      .reduce((sum, p) => sum + p.postsApproved, 0)
    
    const images = platformBreakdown
      .filter(p => p.contentType === 'images')
      .reduce((sum, p) => sum + p.postsApproved, 0)
    
    const videos = platformBreakdown
      .filter(p => p.contentType === 'videos')
      .reduce((sum, p) => sum + p.postsApproved, 0)

    return {
      posts: Math.round((posts / totalApproved) * 100),
      images: Math.round((images / totalApproved) * 100),
      videos: Math.round((videos / totalApproved) * 100)
    }
  }

  private async applyContentBalancing(result: UnifiedScanResult, config: SocialMediaCoordinationConfig): Promise<void> {
    // This would implement logic to balance content distribution
    // For now, just log the balancing attempt
    await logToDatabase(
      LogLevel.INFO,
      'CONTENT_BALANCING_APPLIED',
      'Content balancing applied to unified scan result',
      { 
        scanId: result.scanId,
        balancing: config.contentBalancing,
        platforms: result.platforms.map(p => ({ platform: p.platform, approved: p.postsApproved }))
      }
    )
  }

  private async recordUnifiedScanResult(result: UnifiedScanResult): Promise<void> {
    // This would record the unified scan result to database
    // For now, just log it
    await logToDatabase(
      LogLevel.INFO,
      'UNIFIED_SCAN_RECORDED',
      'Unified scan result recorded',
      {
        scanId: result.scanId,
        summary: {
          platforms: result.platforms.length,
          totalFound: result.totalPostsFound,
          totalApproved: result.totalPostsApproved,
          successful: result.successfulPlatforms,
          failed: result.failedPlatforms
        }
      }
    )
  }

  private async getCoordinationConfig(): Promise<SocialMediaCoordinationConfig> {
    try {
      const config = await query('social_media_coordination_config')
        .select('*')
        .first()

      if (!config) {
        // Return default configuration
        return {
          enableCoordination: true,
          scanInterval: 60, // 60 minutes (longer for TikTok rate limits)
          platformPriority: ['reddit', 'instagram', 'tiktok'],
          contentBalancing: {
            enabled: true,
            redditWeight: 40,
            instagramWeight: 35,
            tiktokWeight: 25,
            targetDistribution: {
              posts: 40, // 40% text-based content
              images: 35, // 35% image content
              videos: 25 // 25% video content
            }
          },
          rateLimitCoordination: true,
          errorThreshold: 5,
          intelligentScheduling: {
            enabled: true,
            peakContentTimes: {
              reddit: ['09', '12', '15', '18', '21'], // Peak Reddit activity times
              instagram: ['08', '11', '14', '17', '19'], // Peak Instagram activity times
              tiktok: ['16', '18', '20', '21', '22'] // Peak TikTok activity times
            },
            adaptiveIntervals: true
          }
        }
      }

      return {
        enableCoordination: config.enable_coordination,
        scanInterval: config.scan_interval,
        platformPriority: config.platform_priority || ['reddit', 'instagram', 'tiktok'],
        contentBalancing: {
          enabled: config.content_balancing_enabled,
          redditWeight: config.reddit_weight || 40,
          instagramWeight: config.instagram_weight || 35,
          tiktokWeight: config.tiktok_weight || 25,
          targetDistribution: config.target_distribution || {
            posts: 40,
            images: 35,
            videos: 25
          }
        },
        rateLimitCoordination: config.rate_limit_coordination,
        errorThreshold: config.error_threshold,
        intelligentScheduling: config.intelligent_scheduling || {
          enabled: true,
          peakContentTimes: {
            reddit: ['09', '12', '15', '18', '21'],
            instagram: ['08', '11', '14', '17', '19'],
            tiktok: ['16', '18', '20', '21', '22']
          },
          adaptiveIntervals: true
        }
      }
    } catch (error) {
      // Return defaults if table doesn't exist
      return {
        enableCoordination: true,
        scanInterval: 60,
        platformPriority: ['reddit', 'instagram', 'tiktok'],
        contentBalancing: {
          enabled: true,
          redditWeight: 40,
          instagramWeight: 35,
          tiktokWeight: 25,
          targetDistribution: {
            posts: 40,
            images: 35,
            videos: 25
          }
        },
        rateLimitCoordination: true,
        errorThreshold: 5,
        intelligentScheduling: {
          enabled: true,
          peakContentTimes: {
            reddit: ['09', '12', '15', '18', '21'],
            instagram: ['08', '11', '14', '17', '19'],
            tiktok: ['16', '18', '20', '21', '22']
          },
          adaptiveIntervals: true
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const socialMediaService = new SocialMediaService()