import { InstagramMonitoringService, InstagramHealthMetrics, InstagramAlert, InstagramPerformanceMetrics } from '@/lib/services/instagram-monitoring'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))
jest.mock('@/lib/db-query-builder')

const mockQuery = require('@/lib/db-query-builder').query
const mockLogToDatabase = require('@/lib/db').logToDatabase

describe('InstagramMonitoringService', () => {
  let instagramMonitoringService: InstagramMonitoringService

  beforeEach(() => {
    jest.clearAllMocks()
    instagramMonitoringService = new InstagramMonitoringService()

    // Mock database query builder
    mockQuery.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn()
    })
  })

  describe('constructor', () => {
    it('should initialize with default metrics', () => {
      expect(instagramMonitoringService).toBeInstanceOf(InstagramMonitoringService)
      const metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics).toEqual({
        requestsPerHour: 0,
        successRate: 0,
        averageLatency: 0,
        peakLatency: 0,
        errorsByType: {},
        rateLimitHits: 0,
        postsProcessedPerHour: 0,
        authenticationRefreshes: 0
      })
    })
  })

  describe('getHealthMetrics', () => {
    beforeEach(() => {
      // Mock system logs query
      mockQuery().first
        .mockResolvedValueOnce([]) // Recent API logs
        .mockResolvedValueOnce({ is_active: true, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }) // Auth status
        .mockResolvedValueOnce({ is_enabled: true, last_scan_time: new Date() }) // Scan config
        .mockResolvedValueOnce({ end_time: new Date() }) // Last successful scan
        .mockResolvedValueOnce({ count: '0' }) // Uptime calculation
        .mockResolvedValueOnce({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }) // Token expiry
    })

    it('should return healthy status when all systems are working', async () => {
      const healthMetrics = await instagramMonitoringService.getHealthMetrics()

      expect(healthMetrics).toEqual(expect.objectContaining({
        authenticationStatus: expect.stringMatching(/^(healthy|warning|critical)$/),
        rateLimitStatus: expect.stringMatching(/^(healthy|warning|critical)$/),
        scanStatus: expect.stringMatching(/^(active|paused|error)$/),
        errorRate: expect.any(Number),
        averageResponseTime: expect.any(Number),
        uptime: expect.any(Number),
        alertsTriggered: expect.any(Number)
      }))
    })

    it('should return critical status when health check fails', async () => {
      mockQuery().first.mockRejectedValue(new Error('Database error'))

      const healthMetrics = await instagramMonitoringService.getHealthMetrics()

      expect(healthMetrics).toEqual({
        authenticationStatus: 'critical',
        rateLimitStatus: 'warning',
        scanStatus: 'error',
        errorRate: 100,
        averageResponseTime: 0,
        uptime: 0,
        alertsTriggered: 1
      })
      expect(mockLogToDatabase).toHaveBeenCalledWith(
        expect.any(String),
        'INSTAGRAM_HEALTH_CHECK_ERROR',
        expect.stringContaining('Failed to get Instagram health metrics'),
        expect.any(Object)
      )
    })

    it('should determine authentication status correctly', async () => {
      // Mock healthy authentication
      mockQuery().first
        .mockResolvedValueOnce([]) // Recent logs
        .mockResolvedValueOnce({ is_active: true, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }) // 30 days from now
        .mockResolvedValueOnce({ is_enabled: true, last_scan_time: new Date() })
        .mockResolvedValueOnce({ end_time: new Date() })
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })

      const healthMetrics = await instagramMonitoringService.getHealthMetrics()
      expect(healthMetrics.authenticationStatus).toBe('healthy')
    })

    it('should determine warning status for expiring tokens', async () => {
      // Mock token expiring in 3 days
      const expiryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      mockQuery().first
        .mockResolvedValueOnce([]) // Recent logs
        .mockResolvedValueOnce({ is_active: true, expires_at: expiryDate })
        .mockResolvedValueOnce({ is_enabled: true, last_scan_time: new Date() })
        .mockResolvedValueOnce({ end_time: new Date() })
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ expires_at: expiryDate })

      const healthMetrics = await instagramMonitoringService.getHealthMetrics()
      expect(healthMetrics.authenticationStatus).toBe('warning')
    })

    it('should determine rate limit status from logs', async () => {
      // Mock logs with rate limit hits
      const rateLimitLogs = [
        { log_level: 'warning', message: 'Instagram API rate limit exceeded', created_at: new Date() },
        { log_level: 'warning', message: 'Rate limit hit again', created_at: new Date() }
      ]
      mockQuery().first
        .mockResolvedValueOnce(rateLimitLogs)
        .mockResolvedValueOnce({ is_active: true, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
        .mockResolvedValueOnce({ is_enabled: true, last_scan_time: new Date() })
        .mockResolvedValueOnce({ end_time: new Date() })
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })

      const healthMetrics = await instagramMonitoringService.getHealthMetrics()
      expect(healthMetrics.rateLimitStatus).toBe('warning')
    })
  })

  describe('recordApiRequest', () => {
    it('should record successful API request', async () => {
      await instagramMonitoringService.recordApiRequest(true, 1500)

      const metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics.requestsPerHour).toBe(1)
      expect(metrics.averageLatency).toBe(1500)
      expect(metrics.peakLatency).toBe(1500)
    })

    it('should record failed API request with error type', async () => {
      await instagramMonitoringService.recordApiRequest(false, 3000, 'auth_error')

      const metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics.requestsPerHour).toBe(1)
      expect(metrics.errorsByType['auth_error']).toBe(1)
      expect(metrics.peakLatency).toBe(3000)
    })

    it('should log high latency requests', async () => {
      await instagramMonitoringService.recordApiRequest(true, 10000) // 10 seconds

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        expect.any(String),
        'INSTAGRAM_HIGH_LATENCY',
        'Instagram API request took 10000ms',
        { latency: 10000, success: true, errorType: undefined }
      )
    })

    it('should handle recording errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockLogToDatabase.mockRejectedValue(new Error('Logging failed'))

      await instagramMonitoringService.recordApiRequest(true, 1000)

      expect(consoleSpy).toHaveBeenCalledWith('Failed to record Instagram API request:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('recordRateLimitHit', () => {
    it('should record rate limit hit and trigger alert', async () => {
      const resetTime = new Date(Date.now() + 60 * 60 * 1000)

      await instagramMonitoringService.recordRateLimitHit(resetTime)

      const metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics.rateLimitHits).toBe(1)

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0]).toEqual(expect.objectContaining({
        type: 'rate_limit',
        severity: 'medium',
        message: expect.stringContaining('Instagram API rate limit exceeded'),
        resolved: false
      }))
    })

    it('should handle recording errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const resetTime = new Date()
      
      // Simulate error in alert triggering
      mockLogToDatabase.mockRejectedValue(new Error('Alert failed'))

      await instagramMonitoringService.recordRateLimitHit(resetTime)

      expect(consoleSpy).toHaveBeenCalledWith('Failed to record Instagram rate limit hit:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('recordTokenRefresh', () => {
    it('should record successful token refresh', async () => {
      const newExpiryDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

      await instagramMonitoringService.recordTokenRefresh(true, newExpiryDate)

      const metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics.authenticationRefreshes).toBe(1)

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        expect.any(String),
        'INSTAGRAM_TOKEN_REFRESH_SUCCESS',
        'Instagram access token refreshed successfully',
        { newExpiryDate }
      )
    })

    it('should record failed token refresh and trigger alert', async () => {
      await instagramMonitoringService.recordTokenRefresh(false)

      const metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics.authenticationRefreshes).toBe(1)

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0]).toEqual(expect.objectContaining({
        type: 'auth_error',
        severity: 'high',
        message: 'Instagram token refresh failed',
        resolved: false
      }))
    })
  })

  describe('recordScanCompletion', () => {
    it('should record successful scan completion', async () => {
      await instagramMonitoringService.recordScanCompletion(25, true, [])

      const metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics.postsProcessedPerHour).toBe(25)
    })

    it('should record failed scan and trigger alert', async () => {
      const errors = ['API error 1', 'API error 2', 'Rate limit hit']

      await instagramMonitoringService.recordScanCompletion(10, false, errors)

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0]).toEqual(expect.objectContaining({
        type: 'scan_failure',
        severity: 'medium',
        message: 'Instagram scan completed with 3 errors',
        metadata: { postsProcessed: 10, errors: errors.slice(0, 3) }
      }))
    })

    it('should trigger high severity alert for many errors', async () => {
      const manyErrors = ['error1', 'error2', 'error3', 'error4', 'error5']

      await instagramMonitoringService.recordScanCompletion(5, true, manyErrors)

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts[0].severity).toBe('high')
    })
  })

  describe('checkTokenExpiry', () => {
    it('should trigger critical alert for token expiring within 1 day', async () => {
      const expiryDate = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours from now
      mockQuery().first.mockResolvedValue({ expires_at: expiryDate, is_active: true })

      await instagramMonitoringService.checkTokenExpiry()

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0]).toEqual(expect.objectContaining({
        type: 'token_expiry',
        severity: 'critical',
        message: expect.stringContaining('expires in 1 days')
      }))
    })

    it('should trigger high alert for token expiring within 7 days', async () => {
      const expiryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      mockQuery().first.mockResolvedValue({ expires_at: expiryDate, is_active: true })

      await instagramMonitoringService.checkTokenExpiry()

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts[0].severity).toBe('high')
    })

    it('should not trigger alert for healthy token', async () => {
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      mockQuery().first.mockResolvedValue({ expires_at: expiryDate, is_active: true })

      await instagramMonitoringService.checkTokenExpiry()

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(0)
    })

    it('should handle missing token gracefully', async () => {
      mockQuery().first.mockResolvedValue(null)

      await instagramMonitoringService.checkTokenExpiry()

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(0)
    })
  })

  describe('getActiveAlerts', () => {
    it('should return only unresolved alerts', async () => {
      // Trigger some alerts
      await instagramMonitoringService.recordRateLimitHit(new Date())
      await instagramMonitoringService.recordTokenRefresh(false)

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(2)
      expect(activeAlerts.every(alert => !alert.resolved)).toBe(true)
    })

    it('should not return resolved alerts', async () => {
      // Trigger an alert
      await instagramMonitoringService.recordRateLimitHit(new Date())
      
      const alerts = instagramMonitoringService.getActiveAlerts()
      expect(alerts).toHaveLength(1)

      // Resolve the alert
      await instagramMonitoringService.resolveAlert(alerts[0].id)

      const activeAlertsAfterResolve = instagramMonitoringService.getActiveAlerts()
      expect(activeAlertsAfterResolve).toHaveLength(0)
    })
  })

  describe('resolveAlert', () => {
    it('should resolve an existing alert', async () => {
      // Trigger an alert
      await instagramMonitoringService.recordRateLimitHit(new Date())

      const alerts = instagramMonitoringService.getActiveAlerts()
      const alertId = alerts[0].id

      await instagramMonitoringService.resolveAlert(alertId)

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(0)

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        expect.any(String),
        'INSTAGRAM_ALERT_RESOLVED',
        expect.stringContaining('Instagram alert resolved'),
        { alertId, alertType: 'rate_limit' }
      )
    })

    it('should handle non-existent alert ID gracefully', async () => {
      await instagramMonitoringService.resolveAlert('non-existent-id')

      // Should not throw error or log anything
      expect(mockLogToDatabase).not.toHaveBeenCalledWith(
        expect.any(String),
        'INSTAGRAM_ALERT_RESOLVED',
        expect.any(String),
        expect.any(Object)
      )
    })
  })

  describe('resetMetrics', () => {
    it('should reset performance metrics', async () => {
      // Generate some metrics
      await instagramMonitoringService.recordApiRequest(true, 1500)
      await instagramMonitoringService.recordApiRequest(false, 2000, 'rate_limit')
      await instagramMonitoringService.recordRateLimitHit(new Date())

      let metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics.requestsPerHour).toBe(2)
      expect(metrics.rateLimitHits).toBe(1)

      instagramMonitoringService.resetMetrics()

      metrics = instagramMonitoringService.getPerformanceMetrics()
      expect(metrics).toEqual({
        requestsPerHour: 0,
        successRate: 0,
        averageLatency: 0,
        peakLatency: 0,
        errorsByType: {},
        rateLimitHits: 0,
        postsProcessedPerHour: 0,
        authenticationRefreshes: 0
      })
    })

    it('should remove old resolved alerts', async () => {
      // Trigger and resolve an alert
      await instagramMonitoringService.recordRateLimitHit(new Date())
      const alerts = instagramMonitoringService.getActiveAlerts()
      await instagramMonitoringService.resolveAlert(alerts[0].id)

      // Simulate alert being old (resolved 25 hours ago)
      const resolvedAlert = (instagramMonitoringService as any).alerts[0]
      resolvedAlert.resolvedAt = new Date(Date.now() - 25 * 60 * 60 * 1000)

      instagramMonitoringService.resetMetrics()

      // Alert should be removed
      const allAlerts = (instagramMonitoringService as any).alerts
      expect(allAlerts).toHaveLength(0)
    })
  })

  describe('performance thresholds', () => {
    it('should trigger high error rate alert', async () => {
      // Simulate high error rate by recording many failed requests
      for (let i = 0; i < 20; i++) {
        await instagramMonitoringService.recordApiRequest(false, 1000, 'api_error')
      }
      
      // Record a few successful requests to establish a baseline
      for (let i = 0; i < 5; i++) {
        await instagramMonitoringService.recordApiRequest(true, 1000)
      }

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      const errorRateAlert = activeAlerts.find(alert => alert.type === 'high_error_rate')
      expect(errorRateAlert).toBeDefined()
      expect(errorRateAlert?.severity).toBe('high')
    })

    it('should trigger latency alert for slow requests', async () => {
      await instagramMonitoringService.recordApiRequest(true, 15000) // 15 seconds

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      const latencyAlert = activeAlerts.find(alert => alert.type === 'api_error')
      expect(latencyAlert).toBeDefined()
      expect(latencyAlert?.message).toContain('latency is high')
    })
  })

  describe('alert deduplication', () => {
    it('should not create duplicate alerts within same hour', async () => {
      const resetTime = new Date(Date.now() + 60 * 60 * 1000)

      // Trigger same type of alert multiple times
      await instagramMonitoringService.recordRateLimitHit(resetTime)
      await instagramMonitoringService.recordRateLimitHit(resetTime)
      await instagramMonitoringService.recordRateLimitHit(resetTime)

      const activeAlerts = instagramMonitoringService.getActiveAlerts()
      const rateLimitAlerts = activeAlerts.filter(alert => alert.type === 'rate_limit')
      expect(rateLimitAlerts).toHaveLength(1) // Should only create one alert
    })
  })
})