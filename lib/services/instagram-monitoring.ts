import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { query } from '@/lib/db-query-builder'

export interface InstagramHealthMetrics {
  authenticationStatus: 'healthy' | 'warning' | 'critical'
  rateLimitStatus: 'healthy' | 'warning' | 'critical'
  scanStatus: 'active' | 'paused' | 'error'
  errorRate: number // percentage of failed requests in last hour
  averageResponseTime: number // milliseconds
  lastSuccessfulScan?: Date
  uptime: number // percentage uptime in last 24 hours
  alertsTriggered: number // number of alerts in last hour
  tokenExpiry?: Date
}

export interface InstagramAlert {
  id: string
  type: 'rate_limit' | 'auth_error' | 'scan_failure' | 'high_error_rate' | 'token_expiry' | 'api_error'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  metadata?: Record<string, any>
}

export interface InstagramPerformanceMetrics {
  requestsPerHour: number
  successRate: number
  averageLatency: number
  peakLatency: number
  errorsByType: Record<string, number>
  rateLimitHits: number
  postsProcessedPerHour: number
  authenticationRefreshes: number
}

export class InstagramMonitoringService {
  private static readonly ERROR_RATE_THRESHOLD = 15 // 15% error rate threshold
  private static readonly LATENCY_THRESHOLD = 8000 // 8 seconds latency threshold
  private static readonly RATE_LIMIT_WARNING_THRESHOLD = 70 // 70% of rate limit used
  private static readonly TOKEN_EXPIRY_WARNING_DAYS = 7 // Warn when token expires within 7 days
  
  private alerts: InstagramAlert[] = []
  private metrics: InstagramPerformanceMetrics = {
    requestsPerHour: 0,
    successRate: 0,
    averageLatency: 0,
    peakLatency: 0,
    errorsByType: {},
    rateLimitHits: 0,
    postsProcessedPerHour: 0,
    authenticationRefreshes: 0
  }

  /**
   * Get current Instagram health status
   */
  async getHealthMetrics(): Promise<InstagramHealthMetrics> {
    try {
      // Check API connection status by looking at recent logs
      const recentApiLogs = await query('system_logs')
        .select(['log_level', 'message', 'created_at'])
        .where('component', 'like', 'INSTAGRAM_%')
        .where('created_at', '>=', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
        .orderBy('created_at', 'desc')
        .limit(100)

      const authenticationStatus = await this.determineAuthenticationStatus()
      const rateLimitStatus = this.determineRateLimitStatus(recentApiLogs)
      const scanStatus = await this.determineScanStatus()
      const errorRate = this.calculateErrorRate(recentApiLogs)
      const averageResponseTime = await this.calculateAverageResponseTime()
      const lastSuccessfulScan = await this.getLastSuccessfulScan()
      const uptime = await this.calculateUptime()
      const alertsTriggered = this.countRecentAlerts()
      const tokenExpiry = await this.getTokenExpiryDate()

      return {
        authenticationStatus,
        rateLimitStatus,
        scanStatus,
        errorRate,
        averageResponseTime,
        lastSuccessfulScan,
        uptime,
        alertsTriggered,
        tokenExpiry
      }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'INSTAGRAM_HEALTH_CHECK_ERROR',
        `Failed to get Instagram health metrics: ${error.message}`,
        { error: error.message }
      )

      // Return degraded status if we can't check health
      return {
        authenticationStatus: 'critical',
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
   * Record an Instagram API request for monitoring
   */
  async recordApiRequest(success: boolean, latency: number, errorType?: string): Promise<void> {
    try {
      this.metrics.requestsPerHour++
      
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
      if (latency > InstagramMonitoringService.LATENCY_THRESHOLD) {
        await logToDatabase(
          LogLevel.WARNING,
          'INSTAGRAM_HIGH_LATENCY',
          `Instagram API request took ${latency}ms`,
          { latency, success, errorType }
        )
      }

    } catch (error) {
      console.error('Failed to record Instagram API request:', error)
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
        message: `Instagram API rate limit exceeded. Reset at ${resetTime.toISOString()}`,
        metadata: { resetTime: resetTime.toISOString() }
      })

    } catch (error) {
      console.error('Failed to record Instagram rate limit hit:', error)
    }
  }

  /**
   * Record authentication token refresh
   */
  async recordTokenRefresh(success: boolean, newExpiryDate?: Date): Promise<void> {
    try {
      this.metrics.authenticationRefreshes++

      if (success && newExpiryDate) {
        await logToDatabase(
          LogLevel.INFO,
          'INSTAGRAM_TOKEN_REFRESH_SUCCESS',
          'Instagram access token refreshed successfully',
          { newExpiryDate }
        )
      } else {
        await this.triggerAlert({
          type: 'auth_error',
          severity: 'high',
          message: 'Instagram token refresh failed',
          metadata: { success }
        })
      }

    } catch (error) {
      console.error('Failed to record Instagram token refresh:', error)
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
          severity: errors.length > 3 ? 'high' : 'medium',
          message: `Instagram scan completed with ${errors.length} errors`,
          metadata: { postsProcessed, errors: errors.slice(0, 3) } // Limit errors in metadata
        })
      }

    } catch (error) {
      console.error('Failed to record Instagram scan completion:', error)
    }
  }

  /**
   * Check for token expiry and trigger warning
   */
  async checkTokenExpiry(): Promise<void> {
    try {
      const tokenExpiry = await this.getTokenExpiryDate()
      
      if (tokenExpiry) {
        const daysUntilExpiry = (tokenExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        
        if (daysUntilExpiry <= InstagramMonitoringService.TOKEN_EXPIRY_WARNING_DAYS) {
          await this.triggerAlert({
            type: 'token_expiry',
            severity: daysUntilExpiry <= 1 ? 'critical' : 'high',
            message: `Instagram token expires in ${Math.ceil(daysUntilExpiry)} days`,
            metadata: { 
              expiryDate: tokenExpiry.toISOString(),
              daysUntilExpiry: Math.ceil(daysUntilExpiry)
            }
          })
        }
      }

    } catch (error) {
      console.error('Failed to check Instagram token expiry:', error)
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): InstagramPerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): InstagramAlert[] {
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
        'INSTAGRAM_ALERT_RESOLVED',
        `Instagram alert resolved: ${alert.message}`,
        { alertId, alertType: alert.type }
      )
    }
  }

  /**
   * Clear old metrics (call periodically)
   */
  resetMetrics(): void {
    this.metrics = {
      requestsPerHour: 0,
      successRate: 0,
      averageLatency: 0,
      peakLatency: 0,
      errorsByType: {},
      rateLimitHits: 0,
      postsProcessedPerHour: 0,
      authenticationRefreshes: 0
    }

    // Remove resolved alerts older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || (alert.resolvedAt && alert.resolvedAt > cutoff)
    )
  }

  // Private helper methods

  private async determineAuthenticationStatus(): Promise<'healthy' | 'warning' | 'critical'> {
    try {
      const authRecord = await query('instagram_auth')
        .select(['expires_at', 'is_active'])
        .where('is_active', true)
        .orderBy('created_at', 'desc')
        .first()

      if (!authRecord) {
        return 'critical' // No authentication
      }

      const expiryDate = new Date(authRecord.expires_at)
      const daysUntilExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)

      if (daysUntilExpiry <= 1) {
        return 'critical' // Expires within 1 day
      } else if (daysUntilExpiry <= 7) {
        return 'warning' // Expires within 7 days
      } else {
        return 'healthy'
      }

    } catch (error) {
      return 'critical'
    }
  }

  private determineRateLimitStatus(logs: any[]): 'healthy' | 'warning' | 'critical' {
    const rateLimitLogs = logs.filter(log => 
      log.message.toLowerCase().includes('rate limit')
    )

    if (rateLimitLogs.length > 3) return 'critical'
    if (rateLimitLogs.length > 1) return 'warning'
    return 'healthy'
  }

  private async determineScanStatus(): Promise<'active' | 'paused' | 'error'> {
    try {
      const config = await query('instagram_scan_config')
        .select(['is_enabled', 'last_scan_time'])
        .first()

      if (!config || !config.is_enabled) return 'paused'

      // Check if last scan was more than 3 hours ago
      if (config.last_scan_time) {
        const lastScan = new Date(config.last_scan_time)
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
        
        if (lastScan < threeHoursAgo) return 'error'
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
    // For now, return the current average latency
    return this.metrics.averageLatency
  }

  private async getLastSuccessfulScan(): Promise<Date | undefined> {
    try {
      const result = await query('instagram_scan_results')
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
        .where('component', 'like', 'INSTAGRAM_%')
        .where('created_at', '>=', twentyFourHoursAgo)
        .first()

      const downCount = parseInt(downPeriods?.count || '0')
      const uptimePercentage = Math.max(0, ((totalPeriods - downCount) / totalPeriods) * 100)
      
      return Math.round(uptimePercentage)
    } catch (error) {
      return 0
    }
  }

  private async getTokenExpiryDate(): Promise<Date | undefined> {
    try {
      const authRecord = await query('instagram_auth')
        .select(['expires_at'])
        .where('is_active', true)
        .orderBy('created_at', 'desc')
        .first()

      return authRecord ? new Date(authRecord.expires_at) : undefined
    } catch (error) {
      return undefined
    }
  }

  private countRecentAlerts(): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.alerts.filter(alert => alert.timestamp > oneHourAgo).length
  }

  private async checkPerformanceThresholds(success: boolean, latency: number, errorType?: string): Promise<void> {
    // Check error rate
    const currentErrorRate = this.calculateCurrentErrorRate()
    if (currentErrorRate > InstagramMonitoringService.ERROR_RATE_THRESHOLD) {
      await this.triggerAlert({
        type: 'high_error_rate',
        severity: 'high',
        message: `Instagram API error rate is ${currentErrorRate}%`,
        metadata: { errorRate: currentErrorRate }
      })
    }

    // Check latency
    if (latency > InstagramMonitoringService.LATENCY_THRESHOLD) {
      await this.triggerAlert({
        type: 'api_error',
        severity: 'medium',
        message: `Instagram API latency is high: ${latency}ms`,
        metadata: { latency }
      })
    }
  }

  private calculateCurrentErrorRate(): number {
    const totalRequests = this.metrics.requestsPerHour
    const totalErrors = Object.values(this.metrics.errorsByType).reduce((sum, count) => sum + count, 0)
    
    return totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0
  }

  private async triggerAlert(alertData: Omit<InstagramAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(alert => 
      alert.type === alertData.type && 
      !alert.resolved &&
      Date.now() - alert.timestamp.getTime() < 60 * 60 * 1000 // Within last hour
    )

    if (existingAlert) {
      return // Don't create duplicate alerts
    }

    const alert: InstagramAlert = {
      id: `instagram_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      'INSTAGRAM_ALERT_TRIGGERED',
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

export const instagramMonitoringService = new InstagramMonitoringService()