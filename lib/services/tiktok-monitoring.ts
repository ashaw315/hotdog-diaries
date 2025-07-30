import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { query } from '@/lib/db-query-builder'

export interface TikTokHealthMetrics {
  authenticationStatus: 'healthy' | 'warning' | 'critical'
  rateLimitStatus: 'healthy' | 'warning' | 'critical'
  scanStatus: 'active' | 'paused' | 'error'
  errorRate: number // percentage of failed requests in last hour
  averageResponseTime: number // milliseconds
  lastSuccessfulScan?: Date
  uptime: number // percentage uptime in last 24 hours
  alertsTriggered: number // number of alerts in last hour
  tokenExpiry?: Date
  quotaUsage: {
    hourly: { used: number; limit: number; percentage: number }
    daily: { used: number; limit: number; percentage: number }
  }
}

export interface TikTokAlert {
  id: string
  type: 'rate_limit' | 'auth_error' | 'scan_failure' | 'high_error_rate' | 'token_expiry' | 'api_error' | 'quota_exceeded'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  metadata?: Record<string, any>
}

export interface TikTokPerformanceMetrics {
  requestsPerHour: number
  successRate: number
  averageLatency: number
  peakLatency: number
  errorsByType: Record<string, number>
  rateLimitHits: number
  videosProcessedPerHour: number
  authenticationRefreshes: number
  quotaUsage: {
    hourlyUsed: number
    dailyUsed: number
  }
}

export class TikTokMonitoringService {
  private static readonly ERROR_RATE_THRESHOLD = 20 // 20% error rate threshold
  private static readonly LATENCY_THRESHOLD = 10000 // 10 seconds latency threshold
  private static readonly HOURLY_QUOTA_WARNING_THRESHOLD = 80 // 80% of hourly quota used
  private static readonly DAILY_QUOTA_WARNING_THRESHOLD = 90 // 90% of daily quota used
  private static readonly TOKEN_EXPIRY_WARNING_HOURS = 24 // Warn when token expires within 24 hours
  
  private alerts: TikTokAlert[] = []
  private metrics: TikTokPerformanceMetrics = {
    requestsPerHour: 0,
    successRate: 0,
    averageLatency: 0,
    peakLatency: 0,
    errorsByType: {},
    rateLimitHits: 0,
    videosProcessedPerHour: 0,
    authenticationRefreshes: 0,
    quotaUsage: {
      hourlyUsed: 0,
      dailyUsed: 0
    }
  }

  /**
   * Get current TikTok health status
   */
  async getHealthMetrics(): Promise<TikTokHealthMetrics> {
    try {
      // Check API connection status by looking at recent logs
      const recentApiLogs = await query('system_logs')
        .select(['log_level', 'message', 'created_at'])
        .where('component', 'like', 'TIKTOK_%')
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
      const quotaUsage = await this.getQuotaUsage()

      return {
        authenticationStatus,
        rateLimitStatus,
        scanStatus,
        errorRate,
        averageResponseTime,
        lastSuccessfulScan,
        uptime,
        alertsTriggered,
        tokenExpiry,
        quotaUsage
      }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TIKTOK_HEALTH_CHECK_ERROR',
        `Failed to get TikTok health metrics: ${error.message}`,
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
        alertsTriggered: 1,
        quotaUsage: {
          hourly: { used: 0, limit: 100, percentage: 0 },
          daily: { used: 0, limit: 1000, percentage: 0 }
        }
      }
    }
  }

  /**
   * Record a TikTok API request for monitoring
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
      if (latency > TikTokMonitoringService.LATENCY_THRESHOLD) {
        await logToDatabase(
          LogLevel.WARNING,
          'TIKTOK_HIGH_LATENCY',
          `TikTok API request took ${latency}ms`,
          { latency, success, errorType }
        )
      }

    } catch (error) {
      console.error('Failed to record TikTok API request:', error)
    }
  }

  /**
   * Record a rate limit hit
   */
  async recordRateLimitHit(resetTime: Date, quotaType: 'hourly' | 'daily' = 'hourly'): Promise<void> {
    try {
      this.metrics.rateLimitHits++

      await this.triggerAlert({
        type: 'rate_limit',
        severity: quotaType === 'daily' ? 'critical' : 'high',
        message: `TikTok API ${quotaType} rate limit exceeded. Reset at ${resetTime.toISOString()}`,
        metadata: { resetTime: resetTime.toISOString(), quotaType }
      })

    } catch (error) {
      console.error('Failed to record TikTok rate limit hit:', error)
    }
  }

  /**
   * Record quota usage for monitoring
   */
  async recordQuotaUsage(hourlyUsed: number, dailyUsed: number, hourlyLimit: number = 100, dailyLimit: number = 1000): Promise<void> {
    try {
      this.metrics.quotaUsage.hourlyUsed = hourlyUsed
      this.metrics.quotaUsage.dailyUsed = dailyUsed

      const hourlyPercentage = (hourlyUsed / hourlyLimit) * 100
      const dailyPercentage = (dailyUsed / dailyLimit) * 100

      // Check for quota warnings
      if (hourlyPercentage >= TikTokMonitoringService.HOURLY_QUOTA_WARNING_THRESHOLD) {
        await this.triggerAlert({
          type: 'quota_exceeded',
          severity: hourlyPercentage >= 95 ? 'critical' : 'high',
          message: `TikTok hourly quota ${hourlyPercentage.toFixed(1)}% used (${hourlyUsed}/${hourlyLimit})`,
          metadata: { quotaType: 'hourly', used: hourlyUsed, limit: hourlyLimit, percentage: hourlyPercentage }
        })
      }

      if (dailyPercentage >= TikTokMonitoringService.DAILY_QUOTA_WARNING_THRESHOLD) {
        await this.triggerAlert({
          type: 'quota_exceeded',
          severity: dailyPercentage >= 98 ? 'critical' : 'high',
          message: `TikTok daily quota ${dailyPercentage.toFixed(1)}% used (${dailyUsed}/${dailyLimit})`,
          metadata: { quotaType: 'daily', used: dailyUsed, limit: dailyLimit, percentage: dailyPercentage }
        })
      }

    } catch (error) {
      console.error('Failed to record TikTok quota usage:', error)
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
          'TIKTOK_TOKEN_REFRESH_SUCCESS',
          'TikTok access token refreshed successfully',
          { newExpiryDate }
        )
      } else {
        await this.triggerAlert({
          type: 'auth_error',
          severity: 'critical',
          message: 'TikTok token refresh failed',
          metadata: { success }
        })
      }

    } catch (error) {
      console.error('Failed to record TikTok token refresh:', error)
    }
  }

  /**
   * Record a scan completion
   */
  async recordScanCompletion(videosProcessed: number, success: boolean, errors: string[]): Promise<void> {
    try {
      if (success) {
        this.metrics.videosProcessedPerHour += videosProcessed
      }

      // Check for scan-related issues
      if (!success || errors.length > 0) {
        await this.triggerAlert({
          type: 'scan_failure',
          severity: errors.length > 5 ? 'critical' : errors.length > 2 ? 'high' : 'medium',
          message: `TikTok scan completed with ${errors.length} errors`,
          metadata: { videosProcessed, errors: errors.slice(0, 5) } // Limit errors in metadata
        })
      }

    } catch (error) {
      console.error('Failed to record TikTok scan completion:', error)
    }
  }

  /**
   * Check for token expiry and trigger warning
   */
  async checkTokenExpiry(): Promise<void> {
    try {
      const tokenExpiry = await this.getTokenExpiryDate()
      
      if (tokenExpiry) {
        const hoursUntilExpiry = (tokenExpiry.getTime() - Date.now()) / (1000 * 60 * 60)
        
        if (hoursUntilExpiry <= TikTokMonitoringService.TOKEN_EXPIRY_WARNING_HOURS) {
          await this.triggerAlert({
            type: 'token_expiry',
            severity: hoursUntilExpiry <= 2 ? 'critical' : hoursUntilExpiry <= 12 ? 'high' : 'medium',
            message: `TikTok token expires in ${Math.ceil(hoursUntilExpiry)} hours`,
            metadata: { 
              expiryDate: tokenExpiry.toISOString(),
              hoursUntilExpiry: Math.ceil(hoursUntilExpiry)
            }
          })
        }
      }

    } catch (error) {
      console.error('Failed to check TikTok token expiry:', error)
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): TikTokPerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): TikTokAlert[] {
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
        'TIKTOK_ALERT_RESOLVED',
        `TikTok alert resolved: ${alert.message}`,
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
      videosProcessedPerHour: 0,
      authenticationRefreshes: 0,
      quotaUsage: {
        hourlyUsed: 0,
        dailyUsed: 0
      }
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
      const authRecord = await query('tiktok_auth')
        .select(['expires_at', 'is_active'])
        .where('is_active', true)
        .orderBy('created_at', 'desc')
        .first()

      if (!authRecord) {
        return 'critical' // No authentication
      }

      const expiryDate = new Date(authRecord.expires_at)
      const hoursUntilExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60)

      if (hoursUntilExpiry <= 2) {
        return 'critical' // Expires within 2 hours
      } else if (hoursUntilExpiry <= 24) {
        return 'warning' // Expires within 24 hours
      } else {
        return 'healthy'
      }

    } catch (error) {
      return 'critical'
    }
  }

  private determineRateLimitStatus(logs: any[]): 'healthy' | 'warning' | 'critical' {
    const rateLimitLogs = logs.filter(log => 
      log.message.toLowerCase().includes('rate limit') || 
      log.message.toLowerCase().includes('quota')
    )

    if (rateLimitLogs.length > 5) return 'critical'
    if (rateLimitLogs.length > 2) return 'warning'
    return 'healthy'
  }

  private async determineScanStatus(): Promise<'active' | 'paused' | 'error'> {
    try {
      const config = await query('tiktok_scan_config')
        .select(['is_enabled', 'last_scan_time'])
        .first()

      if (!config || !config.is_enabled) return 'paused'

      // Check if last scan was more than 4 hours ago
      if (config.last_scan_time) {
        const lastScan = new Date(config.last_scan_time)
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
        
        if (lastScan < fourHoursAgo) return 'error'
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
      const result = await query('tiktok_scan_results')
        .select(['end_time'])
        .where('videos_approved', '>', 0)
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
        .where('component', 'like', 'TIKTOK_%')
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
      const authRecord = await query('tiktok_auth')
        .select(['expires_at'])
        .where('is_active', true)
        .orderBy('created_at', 'desc')
        .first()

      return authRecord ? new Date(authRecord.expires_at) : undefined
    } catch (error) {
      return undefined
    }
  }

  private async getQuotaUsage(): Promise<TikTokHealthMetrics['quotaUsage']> {
    // This would typically be retrieved from the TikTok service or database
    // For now, return current metrics
    const hourlyUsed = this.metrics.quotaUsage.hourlyUsed
    const dailyUsed = this.metrics.quotaUsage.dailyUsed
    const hourlyLimit = 100
    const dailyLimit = 1000

    return {
      hourly: {
        used: hourlyUsed,
        limit: hourlyLimit,
        percentage: Math.round((hourlyUsed / hourlyLimit) * 100)
      },
      daily: {
        used: dailyUsed,
        limit: dailyLimit,
        percentage: Math.round((dailyUsed / dailyLimit) * 100)
      }
    }
  }

  private countRecentAlerts(): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.alerts.filter(alert => alert.timestamp > oneHourAgo).length
  }

  private async checkPerformanceThresholds(success: boolean, latency: number, errorType?: string): Promise<void> {
    // Check error rate
    const currentErrorRate = this.calculateCurrentErrorRate()
    if (currentErrorRate > TikTokMonitoringService.ERROR_RATE_THRESHOLD) {
      await this.triggerAlert({
        type: 'high_error_rate',
        severity: 'critical',
        message: `TikTok API error rate is ${currentErrorRate}%`,
        metadata: { errorRate: currentErrorRate }
      })
    }

    // Check latency
    if (latency > TikTokMonitoringService.LATENCY_THRESHOLD) {
      await this.triggerAlert({
        type: 'api_error',
        severity: 'high',
        message: `TikTok API latency is high: ${latency}ms`,
        metadata: { latency }
      })
    }
  }

  private calculateCurrentErrorRate(): number {
    const totalRequests = this.metrics.requestsPerHour
    const totalErrors = Object.values(this.metrics.errorsByType).reduce((sum, count) => sum + count, 0)
    
    return totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0
  }

  private async triggerAlert(alertData: Omit<TikTokAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(alert => 
      alert.type === alertData.type && 
      !alert.resolved &&
      Date.now() - alert.timestamp.getTime() < 60 * 60 * 1000 // Within last hour
    )

    if (existingAlert) {
      return // Don't create duplicate alerts
    }

    const alert: TikTokAlert = {
      id: `tiktok_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      'TIKTOK_ALERT_TRIGGERED',
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

export const tiktokMonitoringService = new TikTokMonitoringService()