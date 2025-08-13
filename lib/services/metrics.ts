import { query, insert } from '@/lib/db-query-builder'
import { loggingService } from './logging'
import { db } from '@/lib/db'

export interface MetricEntry {
  id?: string
  name: string
  value: number
  unit: string
  timestamp: Date
  tags?: Record<string, string>
  metadata?: Record<string, any>
}

export interface PerformanceMetric extends MetricEntry {
  component: string
  operation: string
  duration: number
  success: boolean
}

export interface APIMetric extends MetricEntry {
  platform: 'reddit' | 'flickr' | 'youtube' | 'unsplash' | 'pixabay' | 'bluesky' | 'lemmy' | 'imgur' | 'tumblr' | 'giphy'
  endpoint: string
  responseTime: number
  statusCode: number
  rateLimitRemaining?: number
  quotaUsed?: number
}

export interface SystemMetric extends MetricEntry {
  metric: 'memory' | 'cpu' | 'disk' | 'network'
  usage: number
  limit?: number
  percentage?: number
}

export interface BusinessMetric extends MetricEntry {
  metric: 'content_processed' | 'posts_created' | 'queue_size' | 'error_rate'
  count: number
  period: 'minute' | 'hour' | 'day'
}

export interface MetricFilter {
  name?: string[]
  tags?: Record<string, string>
  dateRange?: {
    start: Date
    end: Date
  }
  limit?: number
  offset?: number
  aggregation?: 'avg' | 'sum' | 'count' | 'min' | 'max'
  groupBy?: string[]
}

export interface MetricQueryResult {
  metrics: MetricEntry[]
  total: number
  hasMore: boolean
  aggregatedValue?: number
}

export interface MetricSummary {
  totalMetrics: number
  recentAPIResponseTimes: {
    reddit: number
    flickr: number
    youtube: number
    unsplash: number
    pixabay: number
    bluesky: number
    lemmy: number
    imgur: number
    tumblr: number
    giphy: number
  }
  systemResources: {
    memoryUsagePercent: number
    cpuUsagePercent: number
    diskUsagePercent: number
  }
  businessKPIs: {
    contentProcessedLast24h: number
    postsCreatedLast24h: number
    errorRateLast1h: number
    queueSize: number
  }
  topSlowOperations: Array<{
    operation: string
    avgResponseTime: number
    count: number
  }>
}

export class MetricsService {
  private readonly maxBatchSize = 50
  private readonly flushInterval = 10000 // 10 seconds
  private metricBuffer: MetricEntry[] = []
  private flushTimer?: NodeJS.Timeout
  private readonly environment: string

  constructor() {
    this.environment = process.env.NODE_ENV || 'development'
    this.startPeriodicFlush()
    this.ensureMetricsTable()
  }

  /**
   * Record API response time and status
   */
  async recordAPIMetric(
    platform: 'reddit' | 'flickr' | 'youtube' | 'unsplash' | 'pixabay' | 'bluesky' | 'lemmy' | 'imgur' | 'tumblr' | 'giphy',
    endpoint: string,
    responseTime: number,
    statusCode: number,
    rateLimitRemaining?: number,
    quotaUsed?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: APIMetric = {
      name: 'api_response_time',
      value: responseTime,
      unit: 'ms',
      timestamp: new Date(),
      platform,
      endpoint,
      responseTime,
      statusCode,
      rateLimitRemaining,
      quotaUsed,
      tags: {
        platform,
        endpoint: endpoint.replace(/\/\d+/g, '/:id'), // Normalize paths
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'error'
      },
      metadata: {
        statusCode,
        rateLimitRemaining,
        quotaUsed,
        ...metadata
      }
    }

    await this.addToBuffer(metric)
  }

  /**
   * Record database query performance
   */
  async recordDatabaseQueryMetric(
    query: string,
    duration: number,
    success: boolean,
    rowCount?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: PerformanceMetric = {
      name: 'database_query_time',
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      component: 'database',
      operation: this.normalizeQuery(query),
      duration,
      success,
      tags: {
        operation: this.normalizeQuery(query),
        status: success ? 'success' : 'error'
      },
      metadata: {
        query: query.substring(0, 500), // Truncate long queries
        rowCount,
        ...metadata
      }
    }

    await this.addToBuffer(metric)
  }

  /**
   * Record content processing performance
   */
  async recordContentProcessingMetric(
    operation: string,
    duration: number,
    success: boolean,
    itemsProcessed: number = 1,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: PerformanceMetric = {
      name: 'content_processing_time',
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      component: 'content_processor',
      operation,
      duration,
      success,
      tags: {
        operation,
        status: success ? 'success' : 'error'
      },
      metadata: {
        itemsProcessed,
        ...metadata
      }
    }

    await this.addToBuffer(metric)

    // Also record throughput
    const throughputMetric: BusinessMetric = {
      name: 'content_processing_throughput',
      value: itemsProcessed / (duration / 1000), // items per second
      unit: 'items/sec',
      timestamp: new Date(),
      metric: 'content_processed',
      count: itemsProcessed,
      period: 'minute',
      tags: {
        operation,
        status: success ? 'success' : 'error'
      }
    }

    await this.addToBuffer(throughputMetric)
  }

  /**
   * Record system resource usage
   */
  async recordSystemMetrics(): Promise<void> {
    try {
      // Memory metrics
      const memoryUsage = process.memoryUsage()
      const memoryMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      }

      const memoryPercentage = (memoryMB.heapUsed / memoryMB.heapTotal) * 100

      await this.addToBuffer({
        name: 'system_memory_usage',
        value: memoryMB.heapUsed,
        unit: 'MB',
        timestamp: new Date(),
        tags: {
          metric: 'memory',
          type: 'heap_used'
        },
        metadata: memoryMB
      } as SystemMetric)

      // CPU metrics
      const cpuUsage = process.cpuUsage()
      const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) * 100 // Convert to percentage

      await this.addToBuffer({
        name: 'system_cpu_usage',
        value: cpuPercent,
        unit: 'percent',
        timestamp: new Date(),
        tags: {
          metric: 'cpu'
        },
        metadata: {
          user: Math.round(cpuUsage.user / 1000), // Convert to ms
          system: Math.round(cpuUsage.system / 1000)
        }
      } as SystemMetric)

      // Process uptime
      await this.addToBuffer({
        name: 'process_uptime',
        value: process.uptime(),
        unit: 'seconds',
        timestamp: new Date(),
        tags: {
          metric: 'uptime'
        }
      })

    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to record system metrics', {
        error: error.message
      }, error as Error)
    }
  }

  /**
   * Record business KPI metrics
   */
  async recordBusinessMetric(
    metric: 'content_processed' | 'posts_created' | 'queue_size' | 'error_rate',
    value: number,
    period: 'minute' | 'hour' | 'day' = 'hour',
    metadata?: Record<string, any>
  ): Promise<void> {
    const businessMetric: BusinessMetric = {
      name: `business_${metric}`,
      value,
      unit: metric === 'error_rate' ? 'percent' : 'count',
      timestamp: new Date(),
      metric,
      count: metric === 'error_rate' ? 0 : value,
      period,
      tags: {
        metric,
        period
      },
      metadata
    }

    await this.addToBuffer(businessMetric)
  }

  /**
   * Record custom metric
   */
  async recordCustomMetric(
    name: string,
    value: number,
    unit: string,
    tags?: Record<string, string>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: MetricEntry = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
      metadata
    }

    await this.addToBuffer(metric)
  }

  /**
   * Query metrics with filtering and aggregation
   */
  async queryMetrics(filters: MetricFilter = {}): Promise<MetricQueryResult> {
    try {
      const {
        name,
        tags,
        dateRange,
        limit = 100,
        offset = 0,
        aggregation,
        groupBy
      } = filters

      let queryBuilder = query('system_metrics')
        .select([
          'id',
          'name',
          'value',
          'unit',
          'timestamp',
          'tags',
          'metadata'
        ])
        .orderBy('timestamp', 'DESC')

      // Apply filters
      if (name && name.length > 0) {
        queryBuilder = queryBuilder.whereIn('name', name)
      }

      if (dateRange) {
        queryBuilder = queryBuilder
          .where('timestamp', '>=', dateRange.start)
          .where('timestamp', '<=', dateRange.end)
      }

      if (tags) {
        for (const [key, value] of Object.entries(tags)) {
          queryBuilder = queryBuilder.whereRaw(`tags->? = ?`, [key, value])
        }
      }

      // Handle aggregation
      if (aggregation && !groupBy) {
        const aggregatedQuery = queryBuilder.clone()
        
        let selectField: string
        switch (aggregation) {
          case 'avg':
            selectField = 'AVG(value) as aggregated_value'
            break
          case 'sum':
            selectField = 'SUM(value) as aggregated_value'
            break
          case 'count':
            selectField = 'COUNT(*) as aggregated_value'
            break
          case 'min':
            selectField = 'MIN(value) as aggregated_value'
            break
          case 'max':
            selectField = 'MAX(value) as aggregated_value'
            break
          default:
            selectField = 'AVG(value) as aggregated_value'
        }
        
        const aggregatedResult = await aggregatedQuery
          .select([selectField])
          .first()

        return {
          metrics: [],
          total: 0,
          hasMore: false,
          aggregatedValue: parseFloat(aggregatedResult?.aggregated_value || '0')
        }
      }

      // Get total count
      const totalResult = await queryBuilder.clone().count('*').first()
      const total = parseInt(totalResult?.count || '0')

      // Get paginated results
      const results = await queryBuilder
        .limit(limit)
        .offset(offset)
        .execute()

      const metrics: MetricEntry[] = results.map((row: any) => ({
        id: row.id,
        name: row.name,
        value: parseFloat(row.value),
        unit: row.unit,
        timestamp: new Date(row.timestamp),
        tags: row.tags || {},
        metadata: row.metadata || {}
      }))

      return {
        metrics,
        total,
        hasMore: offset + metrics.length < total
      }

    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to query metrics', {
        filters,
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Get comprehensive metrics summary
   */
  async getMetricsSummary(): Promise<MetricSummary> {
    try {
      const now = new Date()
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const last1h = new Date(now.getTime() - 60 * 60 * 1000)

      // Get total metrics count
      const totalResult = await query('system_metrics').count('*').first()
      const totalMetrics = parseInt(totalResult?.count || '0')

      // Get recent API response times
      const apiMetrics = await this.queryMetrics({
        name: ['api_response_time'],
        dateRange: { start: last1h, end: now },
        limit: 1000
      })

      const apiResponseTimes = {
        reddit: 0,
        flickr: 0,
        youtube: 0,
        unsplash: 0,
        pixabay: 0,
        bluesky: 0,
        lemmy: 0,
        imgur: 0,
        tumblr: 0,
        giphy: 0
      }

      const apiCounts = { reddit: 0, flickr: 0, youtube: 0, unsplash: 0, pixabay: 0, bluesky: 0, lemmy: 0, imgur: 0, tumblr: 0, giphy: 0 }
      
      apiMetrics.metrics.forEach(metric => {
        const platform = metric.tags?.platform as keyof typeof apiResponseTimes
        if (platform && apiResponseTimes.hasOwnProperty(platform)) {
          apiResponseTimes[platform] += metric.value
          apiCounts[platform]++
        }
      })

      // Calculate averages
      Object.keys(apiResponseTimes).forEach(platform => {
        const key = platform as keyof typeof apiResponseTimes
        if (apiCounts[key] > 0) {
          apiResponseTimes[key] = Math.round(apiResponseTimes[key] / apiCounts[key])
        }
      })

      // Get recent system metrics
      const systemMetrics = await this.queryMetrics({
        name: ['system_memory_usage', 'system_cpu_usage'],
        dateRange: { start: last1h, end: now },
        limit: 10
      })

      let memoryUsagePercent = 0
      let cpuUsagePercent = 0
      
      systemMetrics.metrics.forEach(metric => {
        if (metric.name === 'system_memory_usage' && metric.metadata?.heapTotal) {
          memoryUsagePercent = Math.round((metric.value / metric.metadata.heapTotal) * 100)
        } else if (metric.name === 'system_cpu_usage') {
          cpuUsagePercent = Math.round(metric.value)
        }
      })

      // Get business metrics
      const contentProcessed = await this.queryMetrics({
        name: ['business_content_processed'],
        dateRange: { start: last24h, end: now },
        aggregation: 'sum'
      })

      const postsCreated = await this.queryMetrics({
        name: ['business_posts_created'],
        dateRange: { start: last24h, end: now },
        aggregation: 'sum'
      })

      const errorRate = await this.queryMetrics({
        name: ['business_error_rate'],
        dateRange: { start: last1h, end: now },
        aggregation: 'avg'
      })

      // Get current queue size from database
      const queueResult = await query('content_queue')
        .where('status', 'pending')
        .count('*')
        .first()
      const queueSize = parseInt(queueResult?.count || '0')

      // Get top slow operations
      const slowOperations = await query('system_metrics')
        .select(['tags', 'AVG(value) as avg_time', 'COUNT(*) as count'])
        .where('name', 'content_processing_time')
        .where('timestamp', '>', last24h)
        .groupBy('tags')
        .orderBy('avg_time', 'DESC')
        .limit(5)
        .execute()

      const topSlowOperations = slowOperations.map((row: any) => ({
        operation: row.tags?.operation || 'unknown',
        avgResponseTime: Math.round(parseFloat(row.avg_time || '0')),
        count: parseInt(row.count || '0')
      }))

      return {
        totalMetrics,
        recentAPIResponseTimes: apiResponseTimes,
        systemResources: {
          memoryUsagePercent,
          cpuUsagePercent,
          diskUsagePercent: 0 // TODO: Implement disk usage tracking
        },
        businessKPIs: {
          contentProcessedLast24h: Math.round(contentProcessed.aggregatedValue || 0),
          postsCreatedLast24h: Math.round(postsCreated.aggregatedValue || 0),
          errorRateLast1h: Math.round((errorRate.aggregatedValue || 0) * 100) / 100,
          queueSize
        },
        topSlowOperations
      }

    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get metrics summary', {
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Clean up old metrics
   */
  async cleanupOldMetrics(retentionDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await query('system_metrics')
        .where('timestamp', '<', cutoffDate)
        .delete()

      await loggingService.logInfo('MetricsService', `Cleaned up ${result} old metric entries`, {
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      })

      return result

    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to cleanup old metrics', {
        retentionDays,
        error: error.message
      }, error as Error)
      throw error
    }
  }

  /**
   * Export metrics to JSON
   */
  async exportMetrics(filters: MetricFilter = {}): Promise<string> {
    try {
      const result = await this.queryMetrics({
        ...filters,
        limit: 10000 // Large limit for export
      })

      return JSON.stringify(result.metrics, null, 2)

    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to export metrics', { filters }, error as Error)
      throw error
    }
  }

  /**
   * Get real-time performance statistics
   */
  async getPerformanceStats(): Promise<{
    avgAPIResponseTime: number
    avgDatabaseQueryTime: number
    avgContentProcessingTime: number
    successRate: number
    requestsPerMinute: number
  }> {
    try {
      const now = new Date()
      const last5min = new Date(now.getTime() - 5 * 60 * 1000)

      // API response times
      const apiStats = await this.queryMetrics({
        name: ['api_response_time'],
        dateRange: { start: last5min, end: now },
        aggregation: 'avg'
      })

      // Database query times
      const dbStats = await this.queryMetrics({
        name: ['database_query_time'],
        dateRange: { start: last5min, end: now },
        aggregation: 'avg'
      })

      // Content processing times
      const processingStats = await this.queryMetrics({
        name: ['content_processing_time'],
        dateRange: { start: last5min, end: now },
        aggregation: 'avg'
      })

      // Success rate calculation
      const successMetrics = await this.queryMetrics({
        tags: { status: 'success' },
        dateRange: { start: last5min, end: now }
      })

      const totalMetrics = await this.queryMetrics({
        dateRange: { start: last5min, end: now }
      })

      const successRate = totalMetrics.total > 0 
        ? (successMetrics.total / totalMetrics.total) * 100 
        : 100

      // Requests per minute
      const requestsPerMinute = Math.round(totalMetrics.total / 5) // 5 minute window

      return {
        avgAPIResponseTime: Math.round(apiStats.aggregatedValue || 0),
        avgDatabaseQueryTime: Math.round(dbStats.aggregatedValue || 0),
        avgContentProcessingTime: Math.round(processingStats.aggregatedValue || 0),
        successRate: Math.round(successRate * 100) / 100,
        requestsPerMinute
      }

    } catch (error) {
      await loggingService.logError('MetricsService', 'Failed to get performance stats', {
        error: error.message
      }, error as Error)
      
      return {
        avgAPIResponseTime: 0,
        avgDatabaseQueryTime: 0,
        avgContentProcessingTime: 0,
        successRate: 0,
        requestsPerMinute: 0
      }
    }
  }

  // Private helper methods

  private async addToBuffer(metric: MetricEntry): Promise<void> {
    this.metricBuffer.push(metric)

    // If buffer is full, flush immediately
    if (this.metricBuffer.length >= this.maxBatchSize) {
      await this.flushBuffer()
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.metricBuffer.length === 0) {
      return
    }

    const metricsToFlush = [...this.metricBuffer]
    this.metricBuffer = []

    try {
      await this.ensureMetricsTable()

      // Insert metrics in batch
      await insert('system_metrics')
        .values(metricsToFlush.map(metric => ({
          name: metric.name,
          value: metric.value,
          unit: metric.unit,
          timestamp: metric.timestamp,
          tags: JSON.stringify(metric.tags || {}),
          metadata: JSON.stringify(metric.metadata || {}),
          environment: this.environment
        })))
        .execute()

    } catch (error) {
      console.error('Failed to flush metrics buffer:', error)
      // Re-add metrics to buffer to retry later
      this.metricBuffer.unshift(...metricsToFlush)
    }
  }

  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(async () => {
      await this.flushBuffer()
    }, this.flushInterval)

    // Also record system metrics periodically
    setInterval(async () => {
      await this.recordSystemMetrics()
    }, 30000) // Every 30 seconds
  }

  private async ensureMetricsTable(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS system_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          value NUMERIC NOT NULL,
          unit VARCHAR(50) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          tags JSONB DEFAULT '{}',
          metadata JSONB DEFAULT '{}',  
          environment VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)

      // Create indexes for performance
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(name);
        CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_system_metrics_tags ON system_metrics USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_system_metrics_environment ON system_metrics(environment);
        CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(name, timestamp DESC);
      `)

    } catch (error) {
      console.error('Failed to ensure metrics table exists:', error)
    }
  }

  private normalizeQuery(query: string): string {
    // Normalize SQL queries for consistent metrics
    const normalized = query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\b\d+\b/g, '?') // Replace numbers with placeholders
      .replace(/'[^']*'/g, '?') // Replace string literals
      .substring(0, 100) // Limit length

    const operation = normalized.split(' ')[0] || 'unknown'
    return operation
  }

  /**
   * Graceful shutdown - flush remaining metrics
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    
    await this.flushBuffer()
  }
}

// Export singleton instance
export const metricsService = new MetricsService()

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await metricsService.shutdown()
  })

  process.on('SIGINT', async () => {
    await metricsService.shutdown()
  })
}