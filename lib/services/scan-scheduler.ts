import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface ScanDecision {
  shouldScan: boolean
  reason: string
  platformsToScan: string[]
  scanPriority: 'high' | 'medium' | 'low'
  bufferStatus: {
    totalBuffer: number
    visualContent: number
    daysOfBuffer: number
    platformBreakdown: { [key: string]: number }
  }
}

export class ScanScheduler {
  // Main decision logic - should we scan content?
  static async shouldScan(): Promise<ScanDecision> {
    try {
      // Get current buffer status
      const bufferResult = await db.query(`
        SELECT 
          COUNT(*) as total_buffer,
          COUNT(*) FILTER (WHERE content_type IN ('image', 'video')) as visual_content,
          source_platform,
          COUNT(*) as platform_count
        FROM content_queue
        WHERE is_approved = true AND is_posted = false
        GROUP BY source_platform
      `)

      const totalBuffer = bufferResult.rows.reduce((sum, row) => sum + parseInt(row.platform_count), 0)
      const visualContent = bufferResult.rows.reduce((sum, row) => sum + parseInt(row.visual_content), 0)
      const daysOfBuffer = totalBuffer / 6.0 // 6 posts per day
      
      const platformBreakdown = bufferResult.rows.reduce((acc, row) => {
        acc[row.source_platform] = parseInt(row.platform_count)
        return acc
      }, {} as { [key: string]: number })

      // Check time since last scan
      const lastScanResult = await db.query(`
        SELECT MAX(scraped_at) as last_scan
        FROM content_queue
      `)
      
      const lastScan = lastScanResult.rows[0]?.last_scan
      const hoursSinceLastScan = lastScan 
        ? (Date.now() - new Date(lastScan).getTime()) / (1000 * 60 * 60)
        : 24 // If no scans, assume 24 hours

      // Determine platforms that need content
      const platformsNeedingContent = await this.getPlatformsNeedingContent()
      
      // Decision logic
      let shouldScan = false
      let reason = ''
      let scanPriority: 'high' | 'medium' | 'low' = 'low'

      if (totalBuffer < 6) {
        // Critical - less than 1 day of content
        shouldScan = true
        reason = 'Critical: Buffer below 1 day of content'
        scanPriority = 'high'
      } else if (totalBuffer < 12) {
        // Low - less than 2 days of content
        shouldScan = true
        reason = 'Low buffer: Less than 2 days of content remaining'
        scanPriority = 'high'
      } else if (visualContent < (totalBuffer * 0.4)) {
        // Need more visual content (target 60% visual)
        shouldScan = true
        reason = 'Visual content ratio too low - need more images/videos'
        scanPriority = 'medium'
      } else if (platformsNeedingContent.length > 0) {
        // Some platforms have low content
        shouldScan = true
        reason = `Platforms need content: ${platformsNeedingContent.join(', ')}`
        scanPriority = 'medium'
      } else if (hoursSinceLastScan > 8) {
        // Regular maintenance scan
        shouldScan = true
        reason = `Regular scan - ${Math.round(hoursSinceLastScan)} hours since last scan`
        scanPriority = 'low'
      } else if (totalBuffer > 30) {
        // Buffer is very full - no need to scan
        shouldScan = false
        reason = `Buffer is healthy (${Math.round(daysOfBuffer)} days) - skipping scan`
      } else {
        // Buffer is adequate but not excessive
        shouldScan = false
        reason = `Buffer is adequate (${Math.round(daysOfBuffer)} days) - no scan needed`
      }

      const decision: ScanDecision = {
        shouldScan,
        reason,
        platformsToScan: shouldScan ? await this.getPrioritizedPlatforms() : [],
        scanPriority,
        bufferStatus: {
          totalBuffer,
          visualContent,
          daysOfBuffer,
          platformBreakdown
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'Scan decision made',
        'ScanScheduler',
        decision
      )

      return decision

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Error in scan scheduling decision',
        'ScanScheduler',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )

      // Fallback decision - scan if error occurs
      return {
        shouldScan: true,
        reason: 'Error in scheduling - defaulting to scan',
        platformsToScan: ['reddit', 'pixabay', 'youtube'],
        scanPriority: 'medium',
        bufferStatus: {
          totalBuffer: 0,
          visualContent: 0,
          daysOfBuffer: 0,
          platformBreakdown: {}
        }
      }
    }
  }

  // Get platforms that need more content
  private static async getPlatformsNeedingContent(): Promise<string[]> {
    const result = await db.query(`
      WITH platform_stats AS (
        SELECT 
          source_platform,
          COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as buffer_size,
          MAX(scraped_at) as last_scan
        FROM content_queue
        GROUP BY source_platform
      )
      SELECT 
        source_platform
      FROM platform_stats
      WHERE buffer_size < 2  -- Need at least 2 items per platform
      OR last_scan < NOW() - INTERVAL '12 hours'
      OR last_scan IS NULL
      ORDER BY buffer_size ASC, last_scan ASC NULLS FIRST
    `)

    return result.rows.map(r => r.source_platform)
  }

  // Get platforms in priority order for scanning
  private static async getPrioritizedPlatforms(): Promise<string[]> {
    const result = await db.query(`
      WITH platform_performance AS (
        SELECT 
          source_platform,
          COUNT(*) as total_scanned,
          COUNT(*) FILTER (WHERE is_approved = true) as approved_count,
          ROUND(100.0 * COUNT(*) FILTER (WHERE is_approved = true) / NULLIF(COUNT(*), 0), 1) as approval_rate,
          COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as current_buffer,
          MAX(scraped_at) as last_scan,
          -- Priority scoring: visual platforms first, then by approval rate
          CASE 
            WHEN source_platform IN ('youtube', 'pixabay', 'imgur') THEN 3 -- Video/image priority
            WHEN source_platform IN ('tumblr') THEN 2 -- Visual but lower priority
            ELSE 1 -- Text-based platforms
          END as visual_priority
        FROM content_queue
        WHERE scraped_at > NOW() - INTERVAL '$1 days'
        GROUP BY source_platform
      )
      SELECT 
        source_platform
      FROM platform_performance
      WHERE total_scanned > 0  -- Only platforms we've scanned before
      ORDER BY 
        visual_priority DESC,           -- Visual content platforms first
        current_buffer ASC,             -- Platforms with less buffer first
        approval_rate DESC,             -- Higher performing platforms first
        last_scan ASC NULLS FIRST       -- Platforms not scanned recently
    `)

    const prioritizedPlatforms = result.rows.map(r => r.source_platform)
    
    // Always include the top visual platforms if they're available
    const essentialPlatforms = ['pixabay', 'youtube', 'imgur', 'reddit']
    const finalList = [
      ...prioritizedPlatforms.filter(p => essentialPlatforms.includes(p)),
      ...prioritizedPlatforms.filter(p => !essentialPlatforms.includes(p))
    ]

    return finalList.length > 0 ? finalList : ['reddit', 'pixabay'] // Fallback
  }

  // Get detailed buffer analysis for reporting
  static async getBufferAnalysis() {
    const result = await db.query(`
      SELECT 
        source_platform,
        content_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as ready_to_post,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - scraped_at))) / 3600, 1) as avg_age_hours,
        MIN(scraped_at) as oldest_content,
        MAX(scraped_at) as newest_content
      FROM content_queue
      WHERE scraped_at > NOW() - INTERVAL '$1 days'
      GROUP BY source_platform, content_type
      ORDER BY source_platform, content_type
    `)

    return result.rows
  }
}