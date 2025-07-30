import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { query } from '@/lib/db-query-builder'

export interface RedditHealthMetrics {
  apiConnectionStatus: 'healthy' | 'degraded' | 'down'
  rateLimitStatus: 'healthy' | 'warning' | 'critical'
  scanStatus: 'active' | 'paused' | 'error'
  errorRate: number // percentage of failed requests in last hour
  averageResponseTime: number // milliseconds
  lastSuccessfulScan?: Date
  uptime: number // percentage uptime in last 24 hours
  alertsTriggered: number // number of alerts in last hour
}

export interface RedditAlert {
  id: string
  type: 'rate_limit' | 'api_error' | 'scan_failure' | 'high_error_rate' | 'connection_lost'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  metadata?: Record<string, any>
}

export interface RedditPerformanceMetrics {
  requestsPerMinute: number
  successRate: number
  averageLatency: number
  peakLatency: number
  errorsByType: Record<string, number>
  rateLimitHits: number
  postsProcessedPerHour: number
}

export class RedditMonitoringService {
  private static readonly ERROR_RATE_THRESHOLD = 10 // 10% error rate threshold
  private static readonly LATENCY_THRESHOLD = 5000 // 5 seconds latency threshold
  private static readonly RATE_LIMIT_WARNING_THRESHOLD = 80 // 80% of rate limit used
  
  private alerts: RedditAlert[] = []
  private metrics: RedditPerformanceMetrics = {
    requestsPerMinute: 0,
    successRate: 0,
    averageLatency: 0,
    peakLatency: 0,
    errorsByType: {},
    rateLimitHits: 0,
    postsProcessedPerHour: 0
  }

  /**
   * Get current Reddit health status
   */
  async getHealthMetrics(): Promise<RedditHealthMetrics> {
    try {
      // Check API connection status by looking at recent logs
      const recentApiLogs = await query('system_logs')
        .select(['log_level', 'message', 'created_at'])
        .where('component', 'like', 'REDDIT_%')
        .where('created_at', '>=', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
        .orderBy('created_at', 'desc')
        .limit(100)

      const apiConnectionStatus = this.determineApiConnectionStatus(recentApiLogs)
      const rateLimitStatus = this.determineRateLimitStatus(recentApiLogs)
      const scanStatus = await this.determineScanStatus()
      const errorRate = this.calculateErrorRate(recentApiLogs)
      const averageResponseTime = await this.calculateAverageResponseTime()
      const lastSuccessfulScan = await this.getLastSuccessfulScan()
      const uptime = await this.calculateUptime()
      const alertsTriggered = this.countRecentAlerts()

      return {
        apiConnectionStatus,
        rateLimitStatus,
        scanStatus,
        errorRate,
        averageResponseTime,
        lastSuccessfulScan,
        uptime,
        alertsTriggered
      }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'REDDIT_HEALTH_CHECK_ERROR',
        `Failed to get Reddit health metrics: ${error.message}`,
        { error: error.message }
      )

      // Return degraded status if we can't check health
      return {
        apiConnectionStatus: 'degraded',
        rateLimitStatus: 'warning',
        scanStatus: 'error',
        errorRate: 100,
        averageResponseTime: 0,
        uptime: 0,
        alertsTriggered: 1
      }
    }
  }

  /**
   * Record a Reddit API request for monitoring
   */
  async recordApiRequest(success: boolean, latency: number, errorType?: string): Promise<void> {
    try {
      this.metrics.requestsPerMinute++
      
      if (success) {
        this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2
      } else {
        if (errorType) {
          this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1
        }
      }

      this.metrics.peakLatency = Math.max(this.metrics.peakLatency, latency)

      // Check for performance issues
      await this.checkPerformanceThresholds(success, latency, errorType)

      // Log high latency requests
      if (latency > RedditMonitoringService.LATENCY_THRESHOLD) {
        await logToDatabase(
          LogLevel.WARNING,
          'REDDIT_HIGH_LATENCY',
          `Reddit API request took ${latency}ms`,
          { latency, success, errorType }
        )
      }

    } catch (error) {
      console.error('Failed to record Reddit API request:', error)
    }
  }

  /**
   * Record a rate limit hit
   */
  async recordRateLimitHit(resetTime: Date): Promise<void> {
    try {
      this.metrics.rateLimitHits++

      await this.triggerAlert({
        type: 'rate_limit',
        severity: 'medium',
        message: `Reddit API rate limit exceeded. Reset at ${resetTime.toISOString()}`,
        metadata: { resetTime: resetTime.toISOString() }
      })

    } catch (error) {
      console.error('Failed to record rate limit hit:', error)
    }
  }

  /**
   * Record a scan completion
   */
  async recordScanCompletion(postsProcessed: number, success: boolean, errors: string[]): Promise<void> {
    try {
      if (success) {
        this.metrics.postsProcessedPerHour += postsProcessed
      }

      // Check for scan-related issues
      if (!success || errors.length > 0) {
        await this.triggerAlert({
          type: 'scan_failure',
          severity: errors.length > 5 ? 'high' : 'medium',
          message: `Reddit scan completed with ${errors.length} errors`,
          metadata: { postsProcessed, errors: errors.slice(0, 5) } // Limit errors in metadata
        })
      }

    } catch (error) {
      console.error('Failed to record scan completion:', error)
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): RedditPerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): RedditAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      alert.resolvedAt = new Date()

      await logToDatabase(
        LogLevel.INFO,
        'REDDIT_ALERT_RESOLVED',
        `Reddit alert resolved: ${alert.message}`,
        { alertId, alertType: alert.type }
      )
    }
  }

  /**
   * Clear old metrics (call periodically)
   */
  resetMetrics(): void {
    this.metrics = {
      requestsPerMinute: 0,
      successRate: 0,
      averageLatency: 0,
      peakLatency: 0,
      errorsByType: {},
      rateLimitHits: 0,
      postsProcessedPerHour: 0
    }

    // Remove resolved alerts older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || (alert.resolvedAt && alert.resolvedAt > cutoff)
    )
  }

  private determineApiConnectionStatus(logs: any[]): 'healthy' | 'degraded' | 'down' {
    const recentErrors = logs.filter(log => 
      log.log_level === 'error' && 
      log.message.toLowerCase().includes('connection')
    )

    const recentRequests = logs.filter(log => 
      log.message.toLowerCase().includes('reddit') &&
      (log.message.includes('success') || log.message.includes('completed'))
    )

    if (recentErrors.length > 10) return 'down'
    if (recentErrors.length > 3 || recentRequests.length === 0) return 'degraded'
    return 'healthy'
  }

  private determineRateLimitStatus(logs: any[]): 'healthy' | 'warning' | 'critical' {
    const rateLimitLogs = logs.filter(log => 
      log.message.toLowerCase().includes('rate limit')
    )

    if (rateLimitLogs.length > 5) return 'critical'
    if (rateLimitLogs.length > 1) return 'warning'
    return 'healthy'
  }

  private async determineScanStatus(): Promise<'active' | 'paused' | 'error'> {
    try {
      const config = await query('reddit_scan_config')
        .select(['is_enabled', 'last_scan_time'])
        .first()

      if (!config || !config.is_enabled) return 'paused'

      // Check if last scan was more than 2 hours ago
      if (config.last_scan_time) {
        const lastScan = new Date(config.last_scan_time)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
        
        if (lastScan < twoHoursAgo) return 'error'
      }

      return 'active'

    } catch (error) {
      return 'error'
    }
  }

  private calculateErrorRate(logs: any[]): number {
    const totalLogs = logs.length
    if (totalLogs === 0) return 0

    const errorLogs = logs.filter(log => log.log_level === 'error')
    return Math.round((errorLogs.length / totalLogs) * 100)
  }

  private async calculateAverageResponseTime(): Promise<number> {
    // This would need to be implemented based on how we track response times
    // For now, return a placeholder
    return this.metrics.averageLatency
  }

  private async getLastSuccessfulScan(): Promise<Date | undefined> {
    try {
      const result = await query('reddit_scan_results')
        .select(['end_time'])
        .where('posts_approved', '>', 0)
        .orderBy('end_time', 'desc')
        .first()

      return result ? new Date(result.end_time) : undefined
    } catch (error) {
      return undefined
    }
  }

  private async calculateUptime(): Promise<number> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      const totalPeriods = 24 * 4 // 15-minute periods in 24 hours
      const downPeriods = await query('system_logs')
        .count('*')
        .where('log_level', 'error')
        .where('component', 'like', 'REDDIT_%')
        .where('created_at', '>=', twentyFourHoursAgo)
        .first()

      const downCount = parseInt(downPeriods?.count || '0')
      const uptimePercentage = Math.max(0, ((totalPeriods - downCount) / totalPeriods) * 100)
      
      return Math.round(uptimePercentage)
    } catch (error) {
      return 0
    }
  }

  private countRecentAlerts(): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.alerts.filter(alert => alert.timestamp > oneHourAgo).length
  }

  private async checkPerformanceThresholds(success: boolean, latency: number, errorType?: string): Promise<void> {
    // Check error rate
    const currentErrorRate = this.calculateCurrentErrorRate()
    if (currentErrorRate > RedditMonitoringService.ERROR_RATE_THRESHOLD) {
      await this.triggerAlert({
        type: 'high_error_rate',
        severity: 'high',
        message: `Reddit API error rate is ${currentErrorRate}%`,
        metadata: { errorRate: currentErrorRate }
      })
    }

    // Check latency
    if (latency > RedditMonitoringService.LATENCY_THRESHOLD) {
      await this.triggerAlert({
        type: 'api_error',
        severity: 'medium',
        message: `Reddit API latency is high: ${latency}ms`,
        metadata: { latency }
      })
    }
  }

  private calculateCurrentErrorRate(): number {
    const totalRequests = this.metrics.requestsPerMinute
    const totalErrors = Object.values(this.metrics.errorsByType).reduce((sum, count) => sum + count, 0)
    
    return totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0
  }

  private async triggerAlert(alertData: Omit<RedditAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(alert => 
      alert.type === alertData.type && 
      !alert.resolved &&
      Date.now() - alert.timestamp.getTime() < 60 * 60 * 1000 // Within last hour
    )

    if (existingAlert) {
      return // Don't create duplicate alerts
    }

    const alert: RedditAlert = {
      id: `reddit_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    }

    this.alerts.push(alert)

    // Log the alert
    await logToDatabase(
      alertData.severity === 'critical' ? LogLevel.FATAL :
      alertData.severity === 'high' ? LogLevel.ERROR :
      alertData.severity === 'medium' ? LogLevel.WARN : LogLevel.INFO,
      'REDDIT_ALERT_TRIGGERED',
      alert.message,
      { 
        alertId: alert.id,
        alertType: alert.type,
        severity: alert.severity,
        metadata: alert.metadata
      }
    )
  }
}

export const redditMonitoringService = new RedditMonitoringService()