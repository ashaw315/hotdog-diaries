import { mastodonService, MastodonPost } from './mastodon'
import { SourcePlatform } from '@/types'
import { db } from '@/lib/db'

export interface MastodonScanResult {
  scanId: string
  timestamp: Date
  postsFound: number
  postsProcessed: number
  postsAdded: number
  instancesScanned: string[]
  errors: Array<{
    instance: string
    error: string
    timestamp: Date
  }>
  scanDurationMs: number
}

export class MastodonScanningService {
  private isScanning = false
  private scanInterval?: NodeJS.Timer
  private lastScanTime?: Date

  async startAutomaticScanning(): Promise<void> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
    }

    const config = await mastodonService.getConfig()
    const intervalMs = config.scanIntervalMinutes * 60 * 1000

    console.log(`Starting Mastodon automatic scanning every ${config.scanIntervalMinutes} minutes`)

    // Run initial scan
    this.performScan()

    // Schedule recurring scans
    this.scanInterval = setInterval(() => {
      this.performScan()
    }, intervalMs)
  }

  async stopAutomaticScanning(): Promise<void> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = undefined
      console.log('Stopped Mastodon automatic scanning')
    }
  }

  async performScan(): Promise<MastodonScanResult> {
    if (this.isScanning) {
      throw new Error('Scan already in progress')
    }

    const scanId = `mastodon_${Date.now()}`
    const startTime = Date.now()
    const scanResult: MastodonScanResult = {
      scanId,
      timestamp: new Date(),
      postsFound: 0,
      postsProcessed: 0,
      postsAdded: 0,
      instancesScanned: [],
      errors: [],
      scanDurationMs: 0
    }

    try {
      this.isScanning = true
      console.log(`Starting Mastodon scan: ${scanId}`)

      // Get posts from Mastodon
      const posts = await mastodonService.scanForHotdogContent()
      scanResult.postsFound = posts.length

      if (posts.length === 0) {
        console.log('No hotdog content found on Mastodon')
        return scanResult
      }

      // Process each post
      for (const post of posts) {
        try {
          await this.processPost(post)
          scanResult.postsProcessed++
        } catch (error) {
          console.error(`Failed to process Mastodon post ${post.id}:`, error)
          scanResult.errors.push({
            instance: post.instance,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          })
        }
      }

      // Get unique instances that were scanned
      scanResult.instancesScanned = [...new Set(posts.map(post => post.instance))]
      
      this.lastScanTime = new Date()
      console.log(`Mastodon scan completed: ${scanResult.postsProcessed}/${scanResult.postsFound} posts processed`)

    } catch (error) {
      console.error('Mastodon scan failed:', error)
      scanResult.errors.push({
        instance: 'system',
        error: error instanceof Error ? error.message : 'Unknown system error',
        timestamp: new Date()
      })
    } finally {
      this.isScanning = false
      scanResult.scanDurationMs = Date.now() - startTime
      
      // Store scan results
      await this.storeScanResult(scanResult)
    }

    return scanResult
  }

  private async processPost(post: MastodonPost): Promise<void> {
    try {
      // Check if we already have this post
      const existingPostResult = await db.query(
        'SELECT id FROM content_queue WHERE original_url = $1',
        [post.url]
      )

      if (existingPostResult.rows.length > 0) {
        console.log(`Mastodon post already exists: ${post.url}`)
        return
      }

      // Transform to our format
      const hotdogPost = mastodonService.transformToHotdogPost(post)

      // Generate content hash for deduplication
      const crypto = require('crypto')
      const contentHash = crypto
        .createHash('sha256')
        .update(`${hotdogPost.original_url}_${hotdogPost.content_text}`)
        .digest('hex')
        .substring(0, 16)

      // Insert into content queue
      const insertResult = await db.query(`
        INSERT INTO content_queue (
          content_text,
          content_type,
          source_platform,
          original_url,
          original_author,
          content_image_url,
          content_video_url,
          scraped_at,
          content_hash,
          mastodon_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        hotdogPost.content_text,
        hotdogPost.content_type,
        hotdogPost.source_platform,
        hotdogPost.original_url,
        hotdogPost.original_author,
        hotdogPost.content_image_url,
        hotdogPost.content_video_url,
        hotdogPost.scraped_at,
        contentHash,
        JSON.stringify(hotdogPost.mastodon_data)
      ])

      const contentId = insertResult.rows[0].id
      console.log(`Added Mastodon post to queue: ${contentId} from ${post.instance}`)

    } catch (error) {
      console.error('Failed to process Mastodon post:', error)
      throw error
    }
  }

  private async storeScanResult(result: MastodonScanResult): Promise<void> {
    try {
      await db.query(`
        INSERT INTO mastodon_scan_results (
          scan_id,
          timestamp,
          posts_found,
          posts_processed,
          posts_added,
          instances_scanned,
          errors,
          scan_duration_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        result.scanId,
        result.timestamp,
        result.postsFound,
        result.postsProcessed,
        result.postsAdded,
        JSON.stringify(result.instancesScanned),
        JSON.stringify(result.errors),
        result.scanDurationMs
      ])
    } catch (error) {
      console.error('Failed to store Mastodon scan result:', error)
    }
  }

  async getRecentScanResults(limit: number = 10): Promise<MastodonScanResult[]> {
    try {
      const result = await db.query(`
        SELECT 
          scan_id,
          timestamp,
          posts_found,
          posts_processed,
          posts_added,
          instances_scanned,
          errors,
          scan_duration_ms
        FROM mastodon_scan_results 
        ORDER BY timestamp DESC 
        LIMIT $1
      `, [limit])

      return result.rows.map(row => ({
        scanId: row.scan_id,
        timestamp: row.timestamp,
        postsFound: row.posts_found,
        postsProcessed: row.posts_processed,
        postsAdded: row.posts_added,
        instancesScanned: JSON.parse(row.instances_scanned),
        errors: JSON.parse(row.errors),
        scanDurationMs: row.scan_duration_ms
      }))
    } catch (error) {
      console.error('Failed to get Mastodon scan results:', error)
      return []
    }
  }

  async getScanningStats(): Promise<{
    totalScans: number
    totalPostsFound: number
    totalPostsProcessed: number
    totalPostsAdded: number
    averageScanDuration: number
    lastScanTime?: Date
    isScanning: boolean
    successRate: number
  }> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_scans,
          SUM(posts_found) as total_posts_found,
          SUM(posts_processed) as total_posts_processed,
          SUM(posts_added) as total_posts_added,
          AVG(scan_duration_ms) as avg_scan_duration
        FROM mastodon_scan_results
      `)

      const stats = result.rows[0]
      const successfulScans = await db.query(`
        SELECT COUNT(*) as successful_scans
        FROM mastodon_scan_results
        WHERE posts_processed > 0
      `)

      return {
        totalScans: parseInt(stats.total_scans) || 0,
        totalPostsFound: parseInt(stats.total_posts_found) || 0,
        totalPostsProcessed: parseInt(stats.total_posts_processed) || 0,
        totalPostsAdded: parseInt(stats.total_posts_added) || 0,
        averageScanDuration: parseFloat(stats.avg_scan_duration) || 0,
        lastScanTime: this.lastScanTime,
        isScanning: this.isScanning,
        successRate: stats.total_scans > 0 
          ? parseInt(successfulScans.rows[0].successful_scans) / parseInt(stats.total_scans)
          : 0
      }
    } catch (error) {
      console.error('Failed to get Mastodon scanning stats:', error)
      return {
        totalScans: 0,
        totalPostsFound: 0,
        totalPostsProcessed: 0,
        totalPostsAdded: 0,
        averageScanDuration: 0,
        lastScanTime: this.lastScanTime,
        isScanning: this.isScanning,
        successRate: 0
      }
    }
  }

  async getContentAddedToday(): Promise<number> {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM content_queue
        WHERE source_platform = $1
        AND scraped_at >= CURRENT_DATE
      `, [SourcePlatform.MASTODON])

      return parseInt(result.rows[0].count) || 0
    } catch (error) {
      console.error('Failed to get Mastodon content added today:', error)
      return 0
    }
  }

  async getTotalContentCount(): Promise<number> {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM content_queue
        WHERE source_platform = $1
      `, [SourcePlatform.MASTODON])

      return parseInt(result.rows[0].count) || 0
    } catch (error) {
      console.error('Failed to get total Mastodon content count:', error)
      return 0
    }
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning
  }

  getLastScanTime(): Date | undefined {
    return this.lastScanTime
  }

  async testScan(): Promise<MastodonScanResult> {
    console.log('Running Mastodon test scan...')
    
    // Temporarily set a small limit for testing
    const config = await mastodonService.getConfig()
    const originalMax = config.maxPostsPerScan
    
    await mastodonService.updateConfig({ maxPostsPerScan: 5 })
    
    try {
      const result = await this.performScan()
      console.log('Test scan completed:', result)
      return result
    } finally {
      // Restore original config
      await mastodonService.updateConfig({ maxPostsPerScan: originalMax })
    }
  }
}

export const mastodonScanningService = new MastodonScanningService()