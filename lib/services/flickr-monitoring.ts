import { logToDatabase } from '@/lib/db'
import { query, insert } from '@/lib/db-query-builder'
import { LogLevel } from '@/types'

export interface FlickrApiMetrics {
  requestCount: number
  successCount: number
  errorCount: number
  averageResponseTime: number
  requestsUsed: number
  requestsRemaining: number
  lastRequestTime?: Date
  lastErrorTime?: Date
  lastErrorType?: string
}

export interface FlickrHealthMetrics {
  isHealthy: boolean
  uptime: number
  errorRate: number
  averageLatency: number
  requestUsagePercent: number
  recentErrors: string[]
  lastSuccessfulRequest?: Date
}

export class FlickrMonitoringService {
  private metrics: FlickrApiMetrics = {
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    requestsUsed: 0,
    requestsRemaining: 3600
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
          metric_name: 'flickr_api_request',
          metric_value: responseTime,
          metric_unit: 'ms',
          component: 'FlickrService',
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
          'FLICKR_API_ERROR',
          `Flickr API request failed: ${errorType || 'unknown error'}`,
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
        await this.triggerAlert('high_error_rate', `Flickr API success rate dropped to ${(this.getSuccessRate() * 100).toFixed(1)}%`)
      }

      // Alert on high latency
      if (responseTime > 8000) { // 8 seconds
        await this.triggerAlert('high_latency', `Flickr API latency is high: ${responseTime}ms`)
      }

    } catch (error) {
      console.error('Failed to record Flickr API request:', error)
    }
  }

  /**
   * Record rate limit hit
   */
  async recordRateLimitHit(resetTime: Date): Promise<void> {
    try {
      await logToDatabase(
        LogLevel.WARNING,
        'FLICKR_RATE_LIMIT_HIT',
        `Flickr API rate limit reached. Reset at ${resetTime.toISOString()}`,
        {
          requestsUsed: this.metrics.requestsUsed,
          resetTime: resetTime.toISOString(),
          requestCount: this.metrics.requestCount
        }
      )

      await this.triggerAlert('rate_limit', `Flickr API rate limit exceeded. Resets at ${resetTime.toLocaleString()}`)

    } catch (error) {
      console.error('Failed to record Flickr rate limit hit:', error)
    }
  }

  /**
   * Record successful scan completion
   */
  async recordScanCompletion(photosProcessed: number, success: boolean, errors: string[] = []): Promise<void> {
    try {
      await insert('system_metrics')
        .values({
          metric_name: 'flickr_scan_completion',
          metric_value: photosProcessed,
          metric_unit: 'photos',
          component: 'FlickrScanningService',
          metadata: JSON.stringify({
            success,
            photosProcessed,
            errorCount: errors.length,
            errors: errors.slice(0, 5) // Limit stored errors
          }),
          created_at: new Date()
        })

      if (success) {
        await logToDatabase(
          LogLevel.INFO,
          'FLICKR_SCAN_SUCCESS',
          `Flickr scan completed successfully: ${photosProcessed} photos processed`,
          {
            photosProcessed,
            errorCount: errors.length
          }
        )
      } else {
        await logToDatabase(
          LogLevel.ERROR,
          'FLICKR_SCAN_FAILURE',
          `Flickr scan failed with ${errors.length} errors`,
          {
            photosProcessed,
            errors: errors.slice(0, 3)
          }
        )
      }

    } catch (error) {
      console.error('Failed to record Flickr scan completion:', error)
    }
  }

  /**
   * Update request usage metrics
   */
  updateRequestUsage(used: number, remaining: number): void {
    this.metrics.requestsUsed = used
    this.metrics.requestsRemaining = remaining
  }

  /**
   * Get current API metrics
   */
  getMetrics(): FlickrApiMetrics {
    return { ...this.metrics }
  }

  /**
   * Get health status
   */
  async getHealthMetrics(): Promise<FlickrHealthMetrics> {
    try {
      // Get recent error logs
      const recentErrors = await this.getRecentErrors()

      const errorRate = this.getErrorRate()
      const requestUsagePercent = (this.metrics.requestsUsed / (this.metrics.requestsUsed + this.metrics.requestsRemaining)) * 100

      return {
        isHealthy: errorRate < 0.2 && this.metrics.averageResponseTime < 6000 && requestUsagePercent < 90,
        uptime: this.calculateUptime(),
        errorRate,
        averageLatency: this.metrics.averageResponseTime,
        requestUsagePercent,
        recentErrors,
        lastSuccessfulRequest: this.metrics.lastRequestTime
      }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'FLICKR_HEALTH_CHECK_ERROR',
        `Failed to get Flickr health metrics: ${error.message}`,
        { error: error.message }
      )

      return {
        isHealthy: false,
        uptime: 0,
        errorRate: 1,
        averageLatency: 0,
        requestUsagePercent: 0,
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
    
    // Consider service "up" if last request was within 2 hours and successful
    if (timeSinceLastRequest < 2 * 60 * 60 * 1000 && this.getSuccessRate() > 0.5) {
      return 99.5 // High uptime
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
        .where('component', 'FlickrService')
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
        'FLICKR_ALERT_TRIGGERED',
        message,
        {
          alertType,
          metrics: this.getMetrics(),
          timestamp: new Date().toISOString()
        }
      )

      // Could integrate with external alerting services here
      console.warn(`🚨 Flickr Alert [${alertType}]: ${message}`)

    } catch (error) {
      console.error('Failed to trigger Flickr alert:', error)
    }
  }

  /**
   * Reset metrics (useful for testing or hourly resets)
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      requestsUsed: 0,
      requestsRemaining: 3600
    }
  }
}

export const flickrMonitoringService = new FlickrMonitoringService()