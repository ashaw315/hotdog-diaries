import { logToDatabase } from '@/lib/db'
import { query, insert } from '@/lib/db-query-builder'
import { LogLevel } from '@/types'

export interface YouTubeApiMetrics {
  requestCount: number
  successCount: number
  errorCount: number
  averageResponseTime: number
  quotaUsed: number
  quotaRemaining: number
  lastRequestTime?: Date
  lastErrorTime?: Date
  lastErrorType?: string
}

export interface YouTubeHealthMetrics {
  isHealthy: boolean
  uptime: number
  errorRate: number
  averageLatency: number
  quotaUsagePercent: number
  recentErrors: string[]
  lastSuccessfulRequest?: Date
}

export class YouTubeMonitoringService {
  private metrics: YouTubeApiMetrics = {
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    quotaUsed: 0,
    quotaRemaining: 10000
  }

  /**
   * Record an API request and its outcome
   */
  async recordApiRequest(success: boolean, responseTime: number, errorType?: string): Promise<void> {
    try {
      this.metrics.requestCount++
      this.metrics.lastRequestTime = new Date()

      if (success) {
        this.metrics.successCount++
      } else {
        this.metrics.errorCount++
        this.metrics.lastErrorTime = new Date()
        this.metrics.lastErrorType = errorType
      }

      // Update average response time
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) / this.metrics.requestCount

      // Store in database for historical tracking
      await insert('system_metrics')
        .values({
          metric_name: 'youtube_api_request',
          metric_value: responseTime,
          metric_unit: 'ms',
          component: 'YouTubeService',
          metadata: JSON.stringify({
            success,
            errorType,
            requestCount: this.metrics.requestCount,
            successRate: this.getSuccessRate()
          }),
          created_at: new Date()
        })

      // Log significant events
      if (!success) {
        await logToDatabase(
          LogLevel.WARNING,
          'YOUTUBE_API_ERROR',
          `YouTube API request failed: ${errorType || 'unknown error'}`,
          {
            responseTime,
            errorType,
            successRate: this.getSuccessRate(),
            requestCount: this.metrics.requestCount
          }
        )
      }

      // Alert on high error rates
      if (this.metrics.requestCount >= 10 && this.getSuccessRate() < 0.8) {
        await this.triggerAlert('high_error_rate', `YouTube API success rate dropped to ${(this.getSuccessRate() * 100).toFixed(1)}%`)
      }

      // Alert on high latency
      if (responseTime > 10000) { // 10 seconds
        await this.triggerAlert('high_latency', `YouTube API latency is high: ${responseTime}ms`)
      }

    } catch (error) {
      console.error('Failed to record YouTube API request:', error)
    }
  }

  /**
   * Record quota limit hit
   */
  async recordQuotaLimitHit(resetTime: Date): Promise<void> {
    try {
      await logToDatabase(
        LogLevel.WARNING,
        'YOUTUBE_QUOTA_LIMIT_HIT',
        `YouTube API quota limit reached. Reset at ${resetTime.toISOString()}`,
        {
          quotaUsed: this.metrics.quotaUsed,
          resetTime: resetTime.toISOString(),
          requestCount: this.metrics.requestCount
        }
      )

      await this.triggerAlert('quota_limit', `YouTube API quota exhausted. Resets at ${resetTime.toLocaleString()}`)

    } catch (error) {
      console.error('Failed to record YouTube quota limit hit:', error)
    }
  }

  /**
   * Record successful scan completion
   */
  async recordScanCompletion(videosProcessed: number, success: boolean, errors: string[] = []): Promise<void> {
    try {
      await insert('system_metrics')
        .values({
          metric_name: 'youtube_scan_completion',
          metric_value: videosProcessed,
          metric_unit: 'videos',
          component: 'YouTubeScanningService',
          metadata: JSON.stringify({
            success,
            videosProcessed,
            errorCount: errors.length,
            errors: errors.slice(0, 5) // Limit stored errors
          }),
          created_at: new Date()
        })

      if (success) {
        await logToDatabase(
          LogLevel.INFO,
          'YOUTUBE_SCAN_SUCCESS',
          `YouTube scan completed successfully: ${videosProcessed} videos processed`,
          {
            videosProcessed,
            errorCount: errors.length
          }
        )
      } else {
        await logToDatabase(
          LogLevel.ERROR,
          'YOUTUBE_SCAN_FAILURE',
          `YouTube scan failed with ${errors.length} errors`,
          {
            videosProcessed,
            errors: errors.slice(0, 3)
          }
        )
      }

    } catch (error) {
      console.error('Failed to record YouTube scan completion:', error)
    }
  }

  /**
   * Update quota usage metrics
   */
  updateQuotaUsage(used: number, remaining: number): void {
    this.metrics.quotaUsed = used
    this.metrics.quotaRemaining = remaining
  }

  /**
   * Get current API metrics
   */
  getMetrics(): YouTubeApiMetrics {
    return { ...this.metrics }
  }

  /**
   * Get health status
   */
  async getHealthMetrics(): Promise<YouTubeHealthMetrics> {
    try {
      // Get recent error logs
      const recentErrors = await this.getRecentErrors()

      const errorRate = this.getErrorRate()
      const quotaUsagePercent = (this.metrics.quotaUsed / (this.metrics.quotaUsed + this.metrics.quotaRemaining)) * 100

      return {
        isHealthy: errorRate < 0.2 && this.metrics.averageResponseTime < 5000 && quotaUsagePercent < 90,
        uptime: this.calculateUptime(),
        errorRate,
        averageLatency: this.metrics.averageResponseTime,
        quotaUsagePercent,
        recentErrors,
        lastSuccessfulRequest: this.metrics.lastRequestTime
      }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_HEALTH_CHECK_ERROR',
        `Failed to get YouTube health metrics: ${error.message}`,
        { error: error.message }
      )

      return {
        isHealthy: false,
        uptime: 0,
        errorRate: 1,
        averageLatency: 0,
        quotaUsagePercent: 0,
        recentErrors: [error.message]
      }
    }
  }

  /**
   * Get success rate percentage
   */
  private getSuccessRate(): number {
    if (this.metrics.requestCount === 0) return 1
    return this.metrics.successCount / this.metrics.requestCount
  }

  /**
   * Get error rate percentage  
   */
  private getErrorRate(): number {
    if (this.metrics.requestCount === 0) return 0
    return this.metrics.errorCount / this.metrics.requestCount
  }

  /**
   * Calculate service uptime based on recent successful requests
   */
  private calculateUptime(): number {
    if (!this.metrics.lastRequestTime) return 0
    
    const now = new Date()
    const timeSinceLastRequest = now.getTime() - this.metrics.lastRequestTime.getTime()
    
    // Consider service "up" if last request was within 1 hour and successful
    if (timeSinceLastRequest < 60 * 60 * 1000 && this.getSuccessRate() > 0.5) {
      return 99.9 // High uptime
    }
    
    return Math.max(0, 100 - (this.getErrorRate() * 100))
  }

  /**
   * Get recent error messages
   */
  private async getRecentErrors(): Promise<string[]> {
    try {
      const recentLogs = await query('system_logs')
        .select(['message'])
        .where('component', 'YouTubeService')
        .where('log_level', 'error')
        .where('created_at', '>', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
        .orderBy('created_at', 'desc')
        .limit(5)

      return recentLogs.map(log => log.message)

    } catch (error) {
      return [`Failed to fetch recent errors: ${error.message}`]
    }
  }

  /**
   * Trigger monitoring alerts
   */
  private async triggerAlert(alertType: string, message: string): Promise<void> {
    try {
      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_ALERT_TRIGGERED',
        message,
        {
          alertType,
          metrics: this.getMetrics(),
          timestamp: new Date().toISOString()
        }
      )

      // Could integrate with external alerting services here
      console.warn(`🚨 YouTube Alert [${alertType}]: ${message}`)

    } catch (error) {
      console.error('Failed to trigger YouTube alert:', error)
    }
  }

  /**
   * Reset metrics (useful for testing or daily resets)
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      quotaUsed: 0,
      quotaRemaining: 10000
    }
  }
}

export const youtubeMonitoringService = new YouTubeMonitoringService()