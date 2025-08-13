import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { redditScanningService } from './reddit-scanning'
import { blueskyService } from './bluesky-scanning'
import { youtubeScanningService } from './youtube-scanning'
import { pixabayScanningService } from './pixabay-scanning'
import { lemmyScanningService } from './lemmy-scanning'
import { imgurScanningService } from './imgur-scanning'
import { tumblrScanningService } from './tumblr-scanning'
import { giphyScanningService } from './giphy-scanning'

export interface ScanConfig {
  id: number
  enabled_platforms: string[]
  scan_frequency_hours: number
  max_posts_per_scan: number
  is_enabled: boolean
  last_scan_at?: Date
  created_at: Date
  updated_at: Date
}

export interface ScanResult {
  platform: string
  found: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
  duration: number
}

export interface ScheduledScanResult {
  success: boolean
  scannedPlatforms: string[]
  totalFound: number
  totalProcessed: number
  totalApproved: number
  totalRejected: number
  totalDuplicates: number
  errors: string[]
  duration: number
  results: ScanResult[]
}

export interface ScanningStatus {
  isEnabled: boolean
  enabledPlatforms: string[]
  lastScanAt: Date | null
  nextScanAt: Date | null
  scanFrequencyHours: number
  queueStatus: {
    total: number
    pending: number
    approved: number
    posted: number
  }
}

export class ContentScanningService {
  private static readonly DEFAULT_PLATFORMS = ['reddit', 'youtube', 'pixabay', 'bluesky', 'lemmy', 'imgur', 'tumblr', 'giphy']
  private static readonly DEFAULT_FREQUENCY_HOURS = 4
  private static readonly DEFAULT_MAX_POSTS = 50

  private readonly platformServices = {
    reddit: redditScanningService,
    youtube: youtubeScanningService,
    pixabay: pixabayScanningService,
    bluesky: blueskyService,
    lemmy: lemmyScanningService,
    imgur: imgurScanningService,
    tumblr: tumblrScanningService,
    giphy: giphyScanningService
  }

  async getScanConfig(): Promise<ScanConfig> {
    try {
      const result = await db.query<ScanConfig>(
        'SELECT * FROM scan_config ORDER BY created_at DESC LIMIT 1'
      )

      if (result.rows.length === 0) {
        return await this.createDefaultScanConfig()
      }

      return result.rows[0]
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get scan config',
        'ContentScanningService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async updateScanConfig(config: Partial<ScanConfig>): Promise<ScanConfig> {
    try {
      const currentConfig = await this.getScanConfig()
      
      const result = await db.query<ScanConfig>(
        `UPDATE scan_config 
         SET enabled_platforms = $1, scan_frequency_hours = $2, 
             max_posts_per_scan = $3, is_enabled = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [
          config.enabled_platforms || currentConfig.enabled_platforms,
          config.scan_frequency_hours || currentConfig.scan_frequency_hours,
          config.max_posts_per_scan || currentConfig.max_posts_per_scan,
          config.is_enabled !== undefined ? config.is_enabled : currentConfig.is_enabled,
          currentConfig.id
        ]
      )

      await logToDatabase(
        LogLevel.INFO,
        'Scan config updated',
        'ContentScanningService',
        { updatedConfig: result.rows[0] }
      )

      return result.rows[0]
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to update scan config',
        'ContentScanningService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async runScheduledScan(platforms?: string[]): Promise<ScheduledScanResult> {
    const startTime = Date.now()
    
    try {
      const config = await this.getScanConfig()
      
      if (!config.is_enabled) {
        await logToDatabase(
          LogLevel.INFO,
          'Content scanning disabled, skipping scheduled scan',
          'ContentScanningService'
        )
        
        return {
          success: false,
          scannedPlatforms: [],
          totalFound: 0,
          totalProcessed: 0,
          totalApproved: 0,
          totalRejected: 0,
          totalDuplicates: 0,
          errors: ['Scanning disabled'],
          duration: Date.now() - startTime,
          results: []
        }
      }

      const platformsToScan = platforms || config.enabled_platforms || ContentScanningService.DEFAULT_PLATFORMS
      const results: ScanResult[] = []
      const errors: string[] = []

      await logToDatabase(
        LogLevel.INFO,
        'Starting scheduled content scan',
        'ContentScanningService',
        { platforms: platformsToScan, maxPostsPerScan: config.max_posts_per_scan }
      )

      // Scan each platform in parallel
      const scanPromises = platformsToScan.map(platform => 
        this.scanPlatform(platform, config.max_posts_per_scan)
      )

      const scanResults = await Promise.allSettled(scanPromises)
      
      for (let i = 0; i < scanResults.length; i++) {
        const result = scanResults[i]
        const platform = platformsToScan[i]
        
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          const error = `${platform} scan failed: ${result.reason}`
          errors.push(error)
          
          // Add a failed result entry
          results.push({
            platform,
            found: 0,
            processed: 0,
            approved: 0,
            rejected: 0,
            duplicates: 0,
            errors: [error],
            duration: 0
          })
        }
      }

      // Update last scan time
      await this.updateLastScanTime()

      const totalResult: ScheduledScanResult = {
        success: errors.length === 0,
        scannedPlatforms: platformsToScan,
        totalFound: results.reduce((sum, r) => sum + r.found, 0),
        totalProcessed: results.reduce((sum, r) => sum + r.processed, 0),
        totalApproved: results.reduce((sum, r) => sum + r.approved, 0),
        totalRejected: results.reduce((sum, r) => sum + r.rejected, 0),
        totalDuplicates: results.reduce((sum, r) => sum + r.duplicates, 0),
        errors,
        duration: Date.now() - startTime,
        results
      }

      await logToDatabase(
        LogLevel.INFO,
        'Scheduled content scan completed',
        'ContentScanningService',
        totalResult
      )

      return totalResult
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      await logToDatabase(
        LogLevel.ERROR,
        'Scheduled content scan failed',
        'ContentScanningService',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        }
      )

      return {
        success: false,
        scannedPlatforms: [],
        totalFound: 0,
        totalProcessed: 0,
        totalApproved: 0,
        totalRejected: 0,
        totalDuplicates: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration,
        results: []
      }
    }
  }

  async scanPlatform(platform: string, maxPosts: number = 50): Promise<ScanResult> {
    const startTime = Date.now()
    
    try {
      const service = this.platformServices[platform as keyof typeof this.platformServices]
      
      if (!service) {
        throw new Error(`Unknown platform: ${platform}`)
      }

      await logToDatabase(
        LogLevel.INFO,
        `Starting ${platform} scan`,
        'ContentScanningService',
        { platform, maxPosts }
      )

      const scanResult = await service.performScan({ maxPosts })

      const result: ScanResult = {
        platform,
        found: scanResult.totalFound,
        processed: scanResult.processed,
        approved: scanResult.approved,
        rejected: scanResult.rejected,
        duplicates: scanResult.duplicates,
        errors: scanResult.errors,
        duration: Date.now() - startTime
      }

      await logToDatabase(
        LogLevel.INFO,
        `${platform} scan completed`,
        'ContentScanningService',
        result
      )

      return result
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      await logToDatabase(
        LogLevel.ERROR,
        `${platform} scan failed`,
        'ContentScanningService',
        { platform, error: errorMessage }
      )

      return {
        platform,
        found: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: [errorMessage],
        duration: Date.now() - startTime
      }
    }
  }

  async getScanningStatus(): Promise<ScanningStatus> {
    try {
      const config = await this.getScanConfig()
      
      const queueResult = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_approved IS NULL THEN 1 END) as pending,
          COUNT(CASE WHEN is_approved = true THEN 1 END) as approved,
          COUNT(CASE WHEN is_posted = true THEN 1 END) as posted
        FROM content_queue
      `)

      const queueStatus = queueResult.rows[0]

      let nextScanAt: Date | null = null
      if (config.is_enabled && config.last_scan_at) {
        nextScanAt = new Date(config.last_scan_at.getTime() + (config.scan_frequency_hours * 60 * 60 * 1000))
      }

      return {
        isEnabled: config.is_enabled,
        enabledPlatforms: config.enabled_platforms,
        lastScanAt: config.last_scan_at || null,
        nextScanAt,
        scanFrequencyHours: config.scan_frequency_hours,
        queueStatus: {
          total: parseInt(queueStatus.total),
          pending: parseInt(queueStatus.pending),
          approved: parseInt(queueStatus.approved),
          posted: parseInt(queueStatus.posted)
        }
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get scanning status',
        'ContentScanningService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async isTimeToScan(): Promise<boolean> {
    try {
      const config = await this.getScanConfig()
      
      if (!config.is_enabled) {
        return false
      }

      if (!config.last_scan_at) {
        return true // First scan
      }

      const timeSinceLastScan = Date.now() - config.last_scan_at.getTime()
      const scanIntervalMs = config.scan_frequency_hours * 60 * 60 * 1000
      
      return timeSinceLastScan >= scanIntervalMs
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to check if time to scan',
        'ContentScanningService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return false
    }
  }

  private async createDefaultScanConfig(): Promise<ScanConfig> {
    const result = await db.query<ScanConfig>(
      `INSERT INTO scan_config (enabled_platforms, scan_frequency_hours, max_posts_per_scan, is_enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [
        ContentScanningService.DEFAULT_PLATFORMS,
        ContentScanningService.DEFAULT_FREQUENCY_HOURS,
        ContentScanningService.DEFAULT_MAX_POSTS,
        true
      ]
    )

    await logToDatabase(
      LogLevel.INFO,
      'Default scan config created',
      'ContentScanningService',
      { config: result.rows[0] }
    )

    return result.rows[0]
  }

  private async updateLastScanTime(): Promise<void> {
    await db.query(
      'UPDATE scan_config SET last_scan_at = NOW(), updated_at = NOW()'
    )
  }
}

export const contentScanningService = new ContentScanningService()