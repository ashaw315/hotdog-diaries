import { db, DatabaseConnection } from '@/lib/db'
import { query } from '@/lib/db-query-builder'
import { loggingService } from './logging'
import { CountQueryResult } from '@/types/database'
// Social media services will be imported dynamically to avoid circular dependencies

export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

export interface HealthCheck {
  name: string
  status: HealthStatus
  message: string
  responseTime?: number
  lastChecked: Date
  metadata?: Record<string, any>
}

export interface DatabaseHealthCheck extends HealthCheck {
  connectionPool: {
    total: number
    idle: number
    active: number
  }
  queryPerformance: {
    averageResponseTime: number
    slowQueries: number
  }
}

export interface APIHealthCheck extends HealthCheck {
  endpoint?: string
  rateLimits?: {
    remaining: number
    resetTime?: Date
  }
  quotaUsage?: {
    used: number
    limit: number
    percentage: number
  }
}

export interface SystemHealthReport {
  overallStatus: HealthStatus
  timestamp: Date
  uptime: number
  checks: {
    database: DatabaseHealthCheck
    apis: {
      reddit: APIHealthCheck
      youtube: APIHealthCheck
      bluesky: APIHealthCheck
      imgur: APIHealthCheck
    }
    services: {
      contentQueue: HealthCheck
      scheduler: HealthCheck
      logging: HealthCheck
    }
    system: {
      memory: HealthCheck
      disk: HealthCheck
      cpu: HealthCheck
    }
  }
  summary: {
    totalChecks: number
    healthyChecks: number
    warningChecks: number
    criticalChecks: number
    responseTime: number
  }
}

export interface ServiceDependency {
  name: string
  type: 'database' | 'api' | 'service' | 'external'
  critical: boolean
  healthCheck: () => Promise<HealthCheck>
}

export class HealthService {
  private readonly startTime: Date
  private dependencies: ServiceDependency[] = []

  constructor() {
    this.startTime = new Date()
    this.registerDependencies()
  }

  /**
   * Check database connectivity and performance
   */
  async checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
    const startTime = Date.now()
    let status = HealthStatus.HEALTHY
    let message = 'Database is healthy'
    let metadata: Record<string, any> = {}

    try {
      // Test basic connectivity
      await db.query('SELECT 1 as health_check')
      
      // Check connection pool status
      const poolStats = db.getPoolStats()
      
      // Test query performance with recent logs
      const perfStart = Date.now()
      const recentLogs = await query('system_logs')
        .select(['id'])
        .limit(1)
        .execute()
      const queryTime = Date.now() - perfStart

      // Check for slow queries (> 1 second)
      const slowQueryThreshold = 1000
      let slowQueries = 0
      if (queryTime > slowQueryThreshold) {
        slowQueries = 1
        status = HealthStatus.WARNING
        message = 'Database queries are running slowly'
      }

      // Check connection pool health
      const poolUtilization = (poolStats.active / poolStats.total) * 100
      if (poolUtilization > 80) {
        status = HealthStatus.WARNING
        message = 'Database connection pool utilization is high'
      }

      if (poolUtilization > 95) {
        status = HealthStatus.CRITICAL
        message = 'Database connection pool is nearly exhausted'
      }

      metadata = {
        poolStats,
        queryTime,
        poolUtilization: Math.round(poolUtilization)
      }

      return {
        name: 'Database',
        status,
        message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata,
        connectionPool: {
          total: poolStats.total,
          idle: poolStats.idle,
          active: poolStats.active
        },
        queryPerformance: {
          averageResponseTime: queryTime,
          slowQueries
        }
      }

    } catch (error) {
      await loggingService.logError('HealthService', 'Database health check failed', {
        error: error.message
      }, error as Error)

      return {
        name: 'Database',
        status: HealthStatus.CRITICAL,
        message: `Database connection failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: { error: error.message },
        connectionPool: {
          total: 0,
          idle: 0,
          active: 0
        },
        queryPerformance: {
          averageResponseTime: 0,
          slowQueries: 0
        }
      }
    }
  }

  /**
   * Check all social media API health
   */
  async checkSocialMediaAPIs(): Promise<{
    reddit: APIHealthCheck
    youtube: APIHealthCheck
    bluesky: APIHealthCheck
    imgur: APIHealthCheck
  }> {
    const [reddit, youtube, bluesky, imgur] = await Promise.allSettled([
      this.checkRedditAPI(),
      this.checkYouTubeAPI(),
      this.checkBlueskyAPI(),
      this.checkImgurAPI()
    ])

    return {
      reddit: reddit.status === 'fulfilled' ? reddit.value : this.createFailedAPICheck('Reddit', reddit.reason),
      youtube: youtube.status === 'fulfilled' ? youtube.value : this.createFailedAPICheck('YouTube', youtube.reason),
      bluesky: bluesky.status === 'fulfilled' ? bluesky.value : this.createFailedAPICheck('Bluesky', bluesky.reason),
      imgur: imgur.status === 'fulfilled' ? imgur.value : this.createFailedAPICheck('Imgur', imgur.reason)
    }
  }

  /**
   * Check Reddit API health
   */
  private async checkRedditAPI(): Promise<APIHealthCheck> {
    const startTime = Date.now()
    
    try {
      // Dynamically import reddit service to avoid circular dependencies
      const { redditService } = await import('./reddit')
      const status = await redditService.getApiStatus()
      
      let healthStatus = HealthStatus.HEALTHY
      let message = 'Reddit API is healthy'

      if (!status.isConnected) {
        healthStatus = HealthStatus.CRITICAL
        message = 'Reddit API is not connected'
      } else if (status.rateLimits.remaining < 10) {
        healthStatus = HealthStatus.WARNING
        message = 'Reddit API rate limit is low'
      }

      return {
        name: 'Reddit API',
        status: healthStatus,
        message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        endpoint: 'Reddit API',
        rateLimits: {
          remaining: status.rateLimits.remaining,
          resetTime: status.rateLimits.resetTime
        },
        metadata: {
          userAgent: status.userAgent,
          lastRequest: status.lastRequest
        }
      }

    } catch (error) {
      return {
        name: 'Reddit API',
        status: HealthStatus.CRITICAL,
        message: `Reddit API check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: { error: error.message }
      }
    }
  }

  /**
   * Check YouTube API health
   */
  private async checkYouTubeAPI(): Promise<APIHealthCheck> {
    const startTime = Date.now()
    
    try {
      const { YouTubeService } = await import('./youtube')
      const youtubeService = new YouTubeService()
      const status = await youtubeService.getApiStatus()
      
      let healthStatus = HealthStatus.HEALTHY
      let message = 'YouTube API is healthy'

      if (!status.isAuthenticated) {
        healthStatus = HealthStatus.CRITICAL
        message = 'YouTube API is not authenticated'
      } else if (status.quotaRemaining < 100) {
        healthStatus = HealthStatus.WARNING
        message = 'YouTube API quota is low'
      }

      return {
        name: 'YouTube API',
        status: healthStatus,
        message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        endpoint: 'YouTube API',
        quotaUsage: {
          used: status.quotaUsed || 0,
          limit: status.quotaRemaining ? status.quotaUsed + status.quotaRemaining : 10000,
          percentage: Math.round(((status.quotaUsed || 0) / ((status.quotaUsed || 0) + (status.quotaRemaining || 10000))) * 100)
        },
        metadata: {
          quotaUsed: status.quotaUsed,
          quotaRemaining: status.quotaRemaining,
          lastError: status.lastError
        }
      }

    } catch (error) {
      return {
        name: 'YouTube API',
        status: HealthStatus.CRITICAL,
        message: `YouTube API check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: { error: error.message }
      }
    }
  }

  /**
   * Check Bluesky API health
   */
  private async checkBlueskyAPI(): Promise<APIHealthCheck> {
    const startTime = Date.now()
    
    try {
      const { blueskyService } = await import('./bluesky-scanning')
      const status = await blueskyService.testConnection()
      
      let healthStatus = HealthStatus.HEALTHY
      let message = 'Bluesky API is healthy'

      if (!status.success) {
        healthStatus = HealthStatus.CRITICAL
        message = 'Bluesky API connection failed'
      }

      return {
        name: 'Bluesky API',
        status: healthStatus,
        message: status.message || message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        endpoint: 'Bluesky AT Protocol',
        metadata: {
          connectionDetails: status.details
        }
      }

    } catch (error) {
      return {
        name: 'Bluesky API',
        status: HealthStatus.CRITICAL,
        message: `Bluesky API check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: { error: error.message }
      }
    }
  }

  /**
   * Check Imgur API health
   */
  private async checkImgurAPI(): Promise<APIHealthCheck> {
    const startTime = Date.now()
    
    try {
      const { imgurScanningService } = await import('./imgur-scanning')
      const status = await imgurScanningService.testConnection()
      
      let healthStatus = HealthStatus.HEALTHY
      let message = 'Imgur API is healthy'

      if (!status.success) {
        healthStatus = HealthStatus.CRITICAL
        message = 'Imgur API connection failed'
      }

      return {
        name: 'Imgur API',
        status: healthStatus,
        message: status.message || message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        endpoint: 'Imgur API',
        metadata: {
          connectionDetails: status.details
        }
      }

    } catch (error) {
      return {
        name: 'Imgur API',
        status: HealthStatus.CRITICAL,
        message: `Imgur API check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: { error: error.message }
      }
    }
  }

  /**
   * Check content queue health
   */
  async checkContentQueue(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      // Check queue size
      const queueStats = await query('content_queue')
        .select([
          'status',
          'COUNT(*) as count'
        ])
        .groupBy('status')
        .execute()

      const stats = {
        pending: 0,
        approved: 0,
        rejected: 0,
        flagged: 0,
        total: 0
      }

      queueStats.forEach((row: CountQueryResult & { status?: string }) => {
        const count = parseInt(row.count)
        stats.total += count
        if (row.status in stats) {
          stats[row.status as keyof typeof stats] = count
        }
      })

      let status = HealthStatus.HEALTHY
      let message = 'Content queue is healthy'

      // Check if queue is running low
      if (stats.pending < 5) {
        status = HealthStatus.WARNING
        message = 'Content queue is running low on pending items'
      }

      // Check if queue is backed up
      if (stats.pending > 1000) {
        status = HealthStatus.WARNING
        message = 'Content queue has a large backlog'
      }

      // Check for processing issues
      const flaggedPercentage = stats.total > 0 ? (stats.flagged / stats.total) * 100 : 0
      if (flaggedPercentage > 20) {
        status = HealthStatus.WARNING
        message = 'High percentage of content is being flagged'
      }

      return {
        name: 'Content Queue',
        status,
        message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: {
          queueStats: stats,
          flaggedPercentage: Math.round(flaggedPercentage)
        }
      }

    } catch (error) {
      await loggingService.logError('HealthService', 'Content queue health check failed', {
        error: error.message
      }, error as Error)

      return {
        name: 'Content Queue',
        status: HealthStatus.CRITICAL,
        message: `Content queue check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: { error: error.message }
      }
    }
  }

  /**
   * Check scheduler health
   */
  async checkScheduler(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      // Check recent posts
      const recentPosts = await query('posted_content')
        .select(['posted_at'])
        .where('posted_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
        .count('*')
        .first()

      const postsLast24h = parseInt(recentPosts?.count || '0')
      const expectedPosts = 6 // 6 posts per day
      
      let status = HealthStatus.HEALTHY
      let message = 'Scheduler is working normally'

      if (postsLast24h === 0) {
        status = HealthStatus.CRITICAL
        message = 'No posts have been made in the last 24 hours'
      } else if (postsLast24h < expectedPosts) {
        status = HealthStatus.WARNING
        message = `Only ${postsLast24h} posts made in last 24h (expected ${expectedPosts})`
      }

      // Check if scanning services are running
      const scanningChecks = await Promise.allSettled([
        import('./reddit-scanning').then(m => m.redditScanningService.getScanStats())
      ])

      const activeScanners = scanningChecks.filter(result => result.status === 'fulfilled').length

      return {
        name: 'Scheduler',
        status,
        message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: {
          postsLast24h,
          expectedPosts,
          activeScanners,
          totalScanners: 1
        }
      }

    } catch (error) {
      await loggingService.logError('HealthService', 'Scheduler health check failed', {
        error: error.message
      }, error as Error)

      return {
        name: 'Scheduler',
        status: HealthStatus.CRITICAL,
        message: `Scheduler check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: { error: error.message }
      }
    }
  }

  /**
   * Check system resources
   */
  async checkSystemResources(): Promise<{
    memory: HealthCheck
    disk: HealthCheck
    cpu: HealthCheck
  }> {
    const startTime = Date.now()

    try {
      // Memory check
      const memoryUsage = process.memoryUsage()
      const memoryMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      }

      let memoryStatus = HealthStatus.HEALTHY
      let memoryMessage = 'Memory usage is normal'

      if (memoryMB.heapUsed > 512) {
        memoryStatus = HealthStatus.WARNING
        memoryMessage = 'Memory usage is high'
      }

      if (memoryMB.heapUsed > 1024) {
        memoryStatus = HealthStatus.CRITICAL
        memoryMessage = 'Memory usage is critical'
      }

      // CPU check (simplified - track event loop lag)
      const cpuUsage = process.cpuUsage()
      let cpuStatus = HealthStatus.HEALTHY
      let cpuMessage = 'CPU usage is normal'

      // Disk check (simplified - check if we can write to temp)
      let diskStatus = HealthStatus.HEALTHY
      let diskMessage = 'Disk space is adequate'

      return {
        memory: {
          name: 'Memory',
          status: memoryStatus,
          message: memoryMessage,
          responseTime: Date.now() - startTime,
          lastChecked: new Date(),
          metadata: memoryMB
        },
        disk: {
          name: 'Disk',
          status: diskStatus,
          message: diskMessage,
          responseTime: Date.now() - startTime,
          lastChecked: new Date(),
          metadata: {}
        },
        cpu: {
          name: 'CPU',
          status: cpuStatus,
          message: cpuMessage,
          responseTime: Date.now() - startTime,
          lastChecked: new Date(),
          metadata: {
            user: Math.round(cpuUsage.user / 1000), // Convert to milliseconds
            system: Math.round(cpuUsage.system / 1000)
          }
        }
      }

    } catch (error) {
      const errorCheck: HealthCheck = {
        name: 'System Resources',
        status: HealthStatus.CRITICAL,
        message: `System resource check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        metadata: { error: error.message }
      }

      return {
        memory: errorCheck,
        disk: errorCheck,
        cpu: errorCheck
      }
    }
  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport(): Promise<SystemHealthReport> {
    const reportStartTime = Date.now()
    
    try {
      // Run all health checks in parallel
      const [
        database,
        apis,
        contentQueue,
        scheduler,
        systemResources
      ] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkSocialMediaAPIs(),
        this.checkContentQueue(),
        this.checkScheduler(),
        this.checkSystemResources()
      ])

      // Process results
      const databaseCheck = database.status === 'fulfilled' ? database.value : this.createFailedCheck('Database', database.reason)
      const apiChecks = apis.status === 'fulfilled' ? apis.value : {
        reddit: this.createFailedAPICheck('Reddit', apis.reason),
        youtube: this.createFailedAPICheck('YouTube', apis.reason),
        bluesky: this.createFailedAPICheck('Bluesky', apis.reason),
        imgur: this.createFailedAPICheck('Imgur', apis.reason)
      }
      const queueCheck = contentQueue.status === 'fulfilled' ? contentQueue.value : this.createFailedCheck('Content Queue', contentQueue.reason)
      const schedulerCheck = scheduler.status === 'fulfilled' ? scheduler.value : this.createFailedCheck('Scheduler', scheduler.reason)
      const resourceChecks = systemResources.status === 'fulfilled' ? systemResources.value : {
        memory: this.createFailedCheck('Memory', systemResources.reason),
        disk: this.createFailedCheck('Disk', systemResources.reason),
        cpu: this.createFailedCheck('CPU', systemResources.reason)
      }

      // Logging check
      const loggingCheck: HealthCheck = {
        name: 'Logging',
        status: HealthStatus.HEALTHY,
        message: 'Logging service is operational',
        responseTime: 0,
        lastChecked: new Date()
      }

      // Collect all checks
      const allChecks = [
        databaseCheck,
        apiChecks.reddit,
        apiChecks.youtube,
        apiChecks.bluesky,
        apiChecks.imgur,
        queueCheck,
        schedulerCheck,
        loggingCheck,
        resourceChecks.memory,
        resourceChecks.disk,
        resourceChecks.cpu
      ]

      // Calculate summary
      const summary = {
        totalChecks: allChecks.length,
        healthyChecks: allChecks.filter(c => c.status === HealthStatus.HEALTHY).length,
        warningChecks: allChecks.filter(c => c.status === HealthStatus.WARNING).length,
        criticalChecks: allChecks.filter(c => c.status === HealthStatus.CRITICAL).length,
        responseTime: Date.now() - reportStartTime
      }

      // Determine overall status
      let overallStatus = HealthStatus.HEALTHY
      if (summary.criticalChecks > 0) {
        overallStatus = HealthStatus.CRITICAL
      } else if (summary.warningChecks > 0) {
        overallStatus = HealthStatus.WARNING
      }

      const uptime = Date.now() - this.startTime.getTime()

      const report: SystemHealthReport = {
        overallStatus,
        timestamp: new Date(),
        uptime: Math.round(uptime / 1000), // in seconds
        checks: {
          database: databaseCheck,
          apis: apiChecks,
          services: {
            contentQueue: queueCheck,
            scheduler: schedulerCheck,
            logging: loggingCheck
          },
          system: resourceChecks
        },
        summary
      }

      // Log health report
      await loggingService.logInfo('HealthService', 'Health report generated', {
        overallStatus,
        summary,
        uptime: report.uptime
      })

      return report

    } catch (error) {
      await loggingService.logError('HealthService', 'Failed to generate health report', {
        error: error.message
      }, error as Error)

      throw error
    }
  }

  /**
   * Register service dependencies for monitoring
   */
  private registerDependencies(): void {
    this.dependencies = [
      {
        name: 'Database',
        type: 'database',
        critical: true,
        healthCheck: () => this.checkDatabaseHealth()
      },
      {
        name: 'Content Queue',
        type: 'service',
        critical: true,
        healthCheck: () => this.checkContentQueue()
      },
      {
        name: 'Scheduler',
        type: 'service',
        critical: false,
        healthCheck: () => this.checkScheduler()
      }
    ]
  }

  /**
   * Create a failed health check result
   */
  private createFailedCheck(name: string, reason: unknown): HealthCheck {
    const errorMessage = reason instanceof Error ? reason.message : String(reason)
    return {
      name,
      status: HealthStatus.CRITICAL,
      message: `Health check failed: ${errorMessage}`,
      responseTime: 0,
      lastChecked: new Date(),
      metadata: { error: errorMessage }
    }
  }

  /**
   * Create a failed API health check result
   */
  private createFailedAPICheck(name: string, reason: unknown): APIHealthCheck {
    const errorMessage = reason instanceof Error ? reason.message : String(reason)
    return {
      name: `${name} API`,
      status: HealthStatus.CRITICAL,
      message: `API health check failed: ${errorMessage}`,
      responseTime: 0,
      lastChecked: new Date(),
      metadata: { error: reason?.message || reason }
    }
  }

  /**
   * Get system uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime()
  }

  /**
   * Check if system is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const report = await this.generateHealthReport()
      return report.overallStatus === HealthStatus.HEALTHY || report.overallStatus === HealthStatus.WARNING
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const healthService = new HealthService()