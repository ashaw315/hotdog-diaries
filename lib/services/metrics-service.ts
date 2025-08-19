import { dbAdapter, executeQuery } from '@/lib/adapters/database-adapter'
import { loggingService } from './logging'

export interface ContentMetrics {
  totalContent: number
  approvedContent: number
  postedContent: number
  approvalRate: number
  avgConfidenceScore: number
}

export interface PlatformMetrics {
  platform: string
  totalScanned: number
  totalApproved: number
  totalPosted: number
  approvalRate: number
  avgConfidenceScore: number
  lastScanDate?: string
}

export interface EngagementMetrics {
  totalViews: number
  avgEngagementScore: number
  topPerformingContent: Array<{
    id: number
    platform: string
    contentText: string
    viewCount: number
    engagementScore: number
  }>
}

export interface FilteringMetrics {
  totalAnalyzed: number
  avgConfidenceScore: number
  flaggedCount: number
  flaggedPatterns: Array<{
    pattern: string
    count: number
  }>
}

export interface DashboardMetrics {
  contentMetrics: ContentMetrics
  platformMetrics: PlatformMetrics[]
  engagementMetrics: EngagementMetrics
  filteringMetrics: FilteringMetrics
  systemHealth: {
    queueSize: number
    lastScanTime?: string
    lastPostTime?: string
    errorRate: number
  }
}

export class MetricsService {
  constructor() {
    console.log(`Metrics service initialized with ${dbAdapter.isPostgreSQL ? 'PostgreSQL' : 'SQLite'} adapter`)
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const [
        contentMetrics,
        platformMetrics,
        engagementMetrics,
        filteringMetrics,
        systemHealth
      ] = await Promise.all([
        this.getContentMetrics(),
        this.getPlatformMetrics(),
        this.getEngagementMetrics(),
        this.getFilteringMetrics(),
        this.getSystemHealth()
      ])

      return {
        contentMetrics,
        platformMetrics,
        engagementMetrics,
        filteringMetrics,
        systemHealth
      }
    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get dashboard metrics', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Get content performance metrics
   */
  async getContentMetrics(): Promise<ContentMetrics> {
    try {
      // Get basic content metrics from content_queue
      const contentQuery = `
        SELECT 
          ${dbAdapter.count()} as total_content,
          ${dbAdapter.sum(dbAdapter.caseWhen('is_approved = 1', '1', '0'))} as approved_content,
          ${dbAdapter.sum(dbAdapter.caseWhen('is_posted = 1', '1', '0'))} as posted_content
        FROM content_queue
      `

      const contentResult = await executeQuery(contentQuery)
      const contentRow = contentResult.rows[0]

      // Get average confidence score from content_analysis table
      const confidenceQuery = `
        SELECT ${dbAdapter.avg('confidence_score')} as avg_confidence_score
        FROM content_analysis
      `

      const confidenceResult = await executeQuery(confidenceQuery)
      const confidenceRow = confidenceResult.rows[0]

      const totalContent = parseInt(contentRow.total_content) || 0
      const approvedContent = parseInt(contentRow.approved_content) || 0
      const postedContent = parseInt(contentRow.posted_content) || 0
      const approvalRate = totalContent > 0 ? approvedContent / totalContent : 0
      const avgConfidenceScore = parseFloat(confidenceRow.avg_confidence_score) || 0

      return {
        totalContent,
        approvedContent,
        postedContent,
        approvalRate,
        avgConfidenceScore
      }
    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get content metrics', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Get platform effectiveness metrics
   */
  async getPlatformMetrics(): Promise<PlatformMetrics[]> {
    try {
      const query = `
        SELECT 
          cq.source_platform as platform,
          ${dbAdapter.count('cq.id')} as total_scanned,
          ${dbAdapter.sum(dbAdapter.caseWhen('cq.is_approved = 1', '1', '0'))} as total_approved,
          ${dbAdapter.sum(dbAdapter.caseWhen('cq.is_posted = 1', '1', '0'))} as total_posted,
          ${dbAdapter.avg('ca.confidence_score')} as avg_confidence_score,
          ${dbAdapter.max('cq.created_at')} as last_scan_date
        FROM content_queue cq
        LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
        WHERE cq.source_platform IS NOT NULL
        GROUP BY cq.source_platform
        ORDER BY total_scanned DESC
      `

      const result = await executeQuery(query)

      return result.rows.map((row: any) => {
        const totalScanned = parseInt(row.total_scanned) || 0
        const totalApproved = parseInt(row.total_approved) || 0
        const totalPosted = parseInt(row.total_posted) || 0
        const approvalRate = totalScanned > 0 ? totalApproved / totalScanned : 0
        const avgConfidenceScore = parseFloat(row.avg_confidence_score) || 0

        return {
          platform: row.platform,
          totalScanned,
          totalApproved,
          totalPosted,
          approvalRate,
          avgConfidenceScore,
          lastScanDate: row.last_scan_date
        }
      })
    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get platform metrics', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Get user engagement metrics
   */
  async getEngagementMetrics(): Promise<EngagementMetrics> {
    try {
      // Since posted_content doesn't have view_count or engagement_score,
      // we'll use posted content count and confidence scores as engagement proxies
      const statsQuery = `
        SELECT 
          ${dbAdapter.count('pc.id')} as total_posts,
          ${dbAdapter.avg('ca.confidence_score')} as avg_confidence
        FROM posted_content pc
        LEFT JOIN content_queue cq ON pc.content_queue_id = cq.id
        LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      `

      const statsResult = await executeQuery(statsQuery)
      const stats = statsResult.rows[0] || {}

      // Get top performing content (highest confidence scores)
      const topContentQuery = `
        SELECT 
          cq.id,
          cq.source_platform as platform,
          ${dbAdapter.substring('cq.content_text', 1, 100)} as content_text,
          ca.confidence_score
        FROM content_queue cq
        LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
        WHERE cq.is_posted = 1 AND ca.confidence_score IS NOT NULL
        ORDER BY ca.confidence_score DESC
        ${dbAdapter.limitOffset(10)}
      `

      const topContentResult = await executeQuery(topContentQuery)

      return {
        totalViews: parseInt(stats.total_posts) || 0, // Using post count as proxy for views
        avgEngagementScore: parseFloat(stats.avg_confidence) || 0, // Using confidence as proxy for engagement
        topPerformingContent: topContentResult.rows.map((row: any) => ({
          id: row.id,
          platform: row.platform,
          contentText: row.content_text || 'No content text',
          viewCount: 1, // Placeholder since we don't track views yet
          engagementScore: parseFloat(row.confidence_score) || 0
        }))
      }
    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get engagement metrics', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Get filtering effectiveness metrics
   */
  async getFilteringMetrics(): Promise<FilteringMetrics> {
    try {
      // Get basic filtering stats
      const statsQuery = `
        SELECT 
          ${dbAdapter.count()} as total_analyzed,
          ${dbAdapter.avg('confidence_score')} as avg_confidence_score,
          ${dbAdapter.sum(dbAdapter.caseWhen('flagged_patterns IS NOT NULL AND flagged_patterns != \'[]\'', '1', '0'))} as flagged_count
        FROM content_analysis
      `

      const statsResult = await executeQuery(statsQuery)
      const stats = statsResult.rows[0] || {}

      // For flagged patterns, we'll use a simplified approach since JSON handling varies between DBs
      const patternsQuery = `
        SELECT flagged_patterns
        FROM content_analysis
        WHERE flagged_patterns IS NOT NULL 
        AND flagged_patterns != '[]'
        AND flagged_patterns != ''
        ${dbAdapter.limitOffset(100)}
      `

      const patternsResult = await executeQuery(patternsQuery)
      
      // Process flagged patterns (simplified - just count occurrences)
      const patternCounts: Record<string, number> = {}
      patternsResult.rows.forEach((row: any) => {
        try {
          if (row.flagged_patterns) {
            const patterns = JSON.parse(row.flagged_patterns)
            if (Array.isArray(patterns)) {
              patterns.forEach((pattern: string) => {
                patternCounts[pattern] = (patternCounts[pattern] || 0) + 1
              })
            }
          }
        } catch (error) {
          // Skip invalid JSON
        }
      })

      const flaggedPatterns = Object.entries(patternCounts)
        .map(([pattern, count]) => ({ pattern, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        totalAnalyzed: parseInt(stats.total_analyzed) || 0,
        avgConfidenceScore: parseFloat(stats.avg_confidence_score) || 0,
        flaggedCount: parseInt(stats.flagged_count) || 0,
        flaggedPatterns
      }
    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get filtering metrics', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth() {
    try {
      // Get queue size (pending content)
      const queueQuery = `
        SELECT ${dbAdapter.count()} as queue_size
        FROM content_queue
        WHERE is_approved = 0 AND is_posted = 0
      `

      const queueResult = await executeQuery(queueQuery)
      const queueSize = parseInt(queueResult.rows[0]?.queue_size) || 0

      // Get last scan time
      const lastScanQuery = `
        SELECT ${dbAdapter.max('created_at')} as last_scan_time
        FROM content_queue
      `

      const lastScanResult = await executeQuery(lastScanQuery)
      const lastScanTime = lastScanResult.rows[0]?.last_scan_time

      // Get last post time - from content_queue posted_at since posted_content might be empty
      const lastPostQuery = `
        SELECT ${dbAdapter.max('posted_at')} as last_post_time
        FROM content_queue
        WHERE is_posted = 1 AND posted_at IS NOT NULL
      `

      const lastPostResult = await executeQuery(lastPostQuery)
      const lastPostTime = lastPostResult.rows[0]?.last_post_time

      // Calculate error rate (simplified - based on low confidence scores)
      const errorRateQuery = `
        SELECT 
          ${dbAdapter.count('ca.id')} as total_processed,
          ${dbAdapter.sum(dbAdapter.caseWhen('ca.confidence_score < 0.5', '1', '0'))} as low_confidence_count
        FROM content_analysis ca
        JOIN content_queue cq ON ca.content_queue_id = cq.id
        WHERE cq.created_at > ${dbAdapter.dateAdd(dbAdapter.now(), -24, 'hours')}
      `

      const errorRateResult = await executeQuery(errorRateQuery)
      const errorRateData = errorRateResult.rows[0] || {}
      const totalProcessed = parseInt(errorRateData.total_processed) || 0
      const lowConfidenceCount = parseInt(errorRateData.low_confidence_count) || 0
      const errorRate = totalProcessed > 0 ? lowConfidenceCount / totalProcessed : 0

      return {
        queueSize,
        lastScanTime,
        lastPostTime,
        errorRate
      }
    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get system health', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Record content processing metrics for platforms
   */
  async recordContentProcessingMetric(data: {
    platform: string
    success: boolean
    processingTime: number
    contentType: string
    itemCount: number
    errorMessage?: string
  }): Promise<void> {
    try {
      // Create or update metrics record in appropriate table
      const metricsQuery = dbAdapter.isPostgreSQL ? `
        INSERT INTO platform_metrics (
          platform,
          success,
          processing_time_ms,
          content_type,
          item_count,
          error_message,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ` : `
        INSERT INTO platform_metrics (
          platform,
          success,
          processing_time_ms,
          content_type,
          item_count,
          error_message,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `

      // Execute the query - handle table not existing gracefully
      try {
        await executeQuery(metricsQuery, [
          data.platform,
          data.success ? 1 : 0,
          data.processingTime,
          data.contentType,
          data.itemCount,
          data.errorMessage || null
        ])
      } catch (error: any) {
        // If table doesn't exist, create it first
        if (error.message?.includes('no such table') || error.message?.includes('does not exist')) {
          await this.createPlatformMetricsTable()
          // Retry the insert
          await executeQuery(metricsQuery, [
            data.platform,
            data.success ? 1 : 0,
            data.processingTime,
            data.contentType,
            data.itemCount,
            data.errorMessage || null
          ])
        } else {
          throw error
        }
      }

      // Log the metric for monitoring
      await loggingService.logInfo('MetricsService', `Content processing metric recorded for ${data.platform}`, {
        platform: data.platform,
        success: data.success,
        itemCount: data.itemCount,
        processingTime: data.processingTime
      })
    } catch (error) {
      // Don't throw error to avoid breaking content processing
      await loggingService.logError('MetricsService', 'Failed to record content processing metric', {
        platform: data.platform,
        error: error.message
      }, error as Error)
    }
  }

  /**
   * Create platform metrics table if it doesn't exist
   */
  private async createPlatformMetricsTable(): Promise<void> {
    const createTableQuery = dbAdapter.isPostgreSQL ? `
      CREATE TABLE IF NOT EXISTS platform_metrics (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        success BOOLEAN NOT NULL,
        processing_time_ms INTEGER,
        content_type VARCHAR(50),
        item_count INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    ` : `
      CREATE TABLE IF NOT EXISTS platform_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        success INTEGER NOT NULL,
        processing_time_ms INTEGER,
        content_type TEXT,
        item_count INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    await executeQuery(createTableQuery)
  }

  /**
   * Get platform performance for a specific time period
   */
  async getPlatformPerformance(platform: string, days = 7): Promise<any> {
    try {
      const dateFilter = dbAdapter.dateAdd(dbAdapter.now(), -days, 'days')
      
      const query = `
        SELECT 
          ${dbAdapter.dateFormat('cq.created_at')} as date,
          ${dbAdapter.count('cq.id')} as scanned,
          ${dbAdapter.sum(dbAdapter.caseWhen('cq.is_approved = 1', '1', '0'))} as approved,
          ${dbAdapter.avg('ca.confidence_score')} as avg_confidence
        FROM content_queue cq
        LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
        WHERE cq.source_platform = ? 
        AND cq.created_at > ${dateFilter}
        GROUP BY ${dbAdapter.dateFormat('cq.created_at')}
        ORDER BY date DESC
      `

      const result = await executeQuery(query, [platform])
      
      return result.rows.map((row: any) => ({
        date: row.date,
        scanned: parseInt(row.scanned) || 0,
        approved: parseInt(row.approved) || 0,
        avgConfidence: parseFloat(row.avg_confidence) || 0,
        approvalRate: parseInt(row.scanned) > 0 ? parseInt(row.approved) / parseInt(row.scanned) : 0
      }))
    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get platform performance', {
        platform,
        days,
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Get content trends over time
   */
  async getContentTrends(days = 30): Promise<any> {
    try {
      const dateFilter = dbAdapter.dateAdd(dbAdapter.now(), -days, 'days')
      
      const query = `
        SELECT 
          ${dbAdapter.dateFormat('cq.created_at')} as date,
          ${dbAdapter.count('cq.id')} as total_content,
          ${dbAdapter.sum(dbAdapter.caseWhen('cq.is_approved = 1', '1', '0'))} as approved_content,
          ${dbAdapter.sum(dbAdapter.caseWhen('cq.is_posted = 1', '1', '0'))} as posted_content,
          ${dbAdapter.avg('ca.confidence_score')} as avg_confidence
        FROM content_queue cq
        LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
        WHERE cq.created_at > ${dateFilter}
        GROUP BY ${dbAdapter.dateFormat('cq.created_at')}
        ORDER BY date DESC
        ${dbAdapter.limitOffset(days)}
      `

      const result = await executeQuery(query)
      
      return result.rows.map((row: any) => ({
        date: row.date,
        totalContent: parseInt(row.total_content) || 0,
        approvedContent: parseInt(row.approved_content) || 0,
        postedContent: parseInt(row.posted_content) || 0,
        avgConfidence: parseFloat(row.avg_confidence) || 0,
        approvalRate: parseInt(row.total_content) > 0 ? parseInt(row.approved_content) / parseInt(row.total_content) : 0
      }))
    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get content trends', {
        days,
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Record custom metric (missing method)
   */
  async recordCustomMetric(name: string, value: number, tags?: Record<string, any>): Promise<void> {
    try {
      // Implementation for recording custom metrics
      console.log(`Recording metric: ${name} = ${value}`, tags);
    } catch (error) {
      console.error('Failed to record custom metric:', error);
    }
  }

  /**
   * Get performance stats (missing method)
   */
  async getPerformanceStats(): Promise<any> {
    try {
      return {
        queries: { total: 0, average: 0 },
        memory: { usage: 0, peak: 0 },
        errors: { count: 0, rate: 0 }
      };
    } catch (error) {
      console.error('Failed to get performance stats:', error);
      return { queries: {}, memory: {}, errors: {} };
    }
  }

  /**
   * Query metrics (missing method)
   */
  async queryMetrics(query: any): Promise<any[]> {
    try {
      return [];
    } catch (error) {
      console.error('Failed to query metrics:', error);
      return [];
    }
  }

  /**
   * Get metrics summary (missing method)
   */
  async getMetricsSummary(): Promise<any> {
    try {
      return {
        totalMetrics: 0,
        activeMetrics: 0,
        errors: 0
      };
    } catch (error) {
      console.error('Failed to get metrics summary:', error);
      return {};
    }
  }

  /**
   * Shutdown service (missing method)
   */
  async shutdown(): Promise<void> {
    try {
      console.log('Metrics service shutdown');
    } catch (error) {
      console.error('Failed to shutdown metrics service:', error);
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService()