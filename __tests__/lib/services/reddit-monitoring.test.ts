import { RedditMonitoringService, RedditHealthMetrics, RedditAlert } from '@/lib/services/reddit-monitoring'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/db-query-builder', () => ({
  query: jest.fn()
}))

const mockQuery = require('@/lib/db-query-builder').query

describe('RedditMonitoringService', () => {
  let monitoringService: RedditMonitoringService

  beforeEach(() => {
    jest.clearAllMocks()
    monitoringService = new RedditMonitoringService()
    
    // Reset the monitoring service state
    ;(monitoringService as any).alerts = []
    ;(monitoringService as any).metrics = {
      requestsPerMinute: 0,
      successRate: 0,
      averageLatency: 0,
      peakLatency: 0,
      errorsByType: {},
      rateLimitHits: 0,
      postsProcessedPerHour: 0
    }
  })

  describe('getHealthMetrics', () => {
    beforeEach(() => {
      // Mock database query for logs
      mockQuery.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        first: jest.fn()
      })
    })

    it('should return healthy status with no recent errors', async () => {
      const healthyLogs = [
        { log_level: 'info', message: 'Reddit search completed successfully', created_at: new Date() },
        { log_level: 'info', message: 'Reddit API connection successful', created_at: new Date() }
      ]

      mockQuery().limit.mockResolvedValue(healthyLogs)
      mockQuery().first
        .mockResolvedValueOnce({ is_enabled: true, last_scan_time: new Date() }) // scan config
        .mockResolvedValueOnce({ end_time: new Date() }) // last successful scan
        .mockResolvedValueOnce({ count: '0' }) // error count

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.apiConnectionStatus).toBe('healthy')
      expect(metrics.rateLimitStatus).toBe('healthy')
      expect(metrics.scanStatus).toBe('active')
      expect(metrics.errorRate).toBeLessThan(50)
    })

    it('should return degraded status with some errors', async () => {
      const mixedLogs = [
        { log_level: 'error', message: 'Reddit connection failed', created_at: new Date() },
        { log_level: 'error', message: 'API timeout', created_at: new Date() },
        { log_level: 'info', message: 'Reddit search completed', created_at: new Date() }
      ]

      mockQuery().limit.mockResolvedValue(mixedLogs)
      mockQuery().first
        .mockResolvedValueOnce({ is_enabled: true, last_scan_time: new Date() })
        .mockResolvedValueOnce({ end_time: new Date() })
        .mockResolvedValueOnce({ count: '5' })

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.apiConnectionStatus).toBe('degraded')
      expect(metrics.errorRate).toBeGreaterThan(0)
    })

    it('should return down status with many connection errors', async () => {
      const errorLogs = Array(15).fill(null).map(() => ({
        log_level: 'error',
        message: 'Reddit connection failed',
        created_at: new Date()
      }))

      mockQuery().limit.mockResolvedValue(errorLogs)
      mockQuery().first
        .mockResolvedValueOnce({ is_enabled: true, last_scan_time: new Date() })
        .mockResolvedValueOnce(null) // no successful scans
        .mockResolvedValueOnce({ count: '15' })

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.apiConnectionStatus).toBe('down')
      expect(metrics.errorRate).toBeGreaterThan(90)
    })

    it('should detect paused scan status when disabled', async () => {
      mockQuery().limit.mockResolvedValue([])
      mockQuery().first
        .mockResolvedValueOnce({ is_enabled: false }) // disabled config
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ count: '0' })

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.scanStatus).toBe('paused')
    })

    it('should detect error scan status when last scan is old', async () => {
      const oldScanTime = new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago

      mockQuery().limit.mockResolvedValue([])
      mockQuery().first
        .mockResolvedValueOnce({ is_enabled: true, last_scan_time: oldScanTime })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ count: '0' })

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.scanStatus).toBe('error')
    })

    it('should handle database errors gracefully', async () => {
      mockQuery.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.apiConnectionStatus).toBe('degraded')
      expect(metrics.errorRate).toBe(100)
      expect(metrics.alertsTriggered).toBe(1)
    })
  })

  describe('recordApiRequest', () => {
    it('should record successful API request', async () => {
      await monitoringService.recordApiRequest(true, 500)

      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.requestsPerMinute).toBe(1)
      expect(metrics.averageLatency).toBe(500)
      expect(metrics.peakLatency).toBe(500)
    })

    it('should record failed API request with error type', async () => {
      await monitoringService.recordApiRequest(false, 2000, 'timeout')

      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.requestsPerMinute).toBe(1)
      expect(metrics.errorsByType.timeout).toBe(1)
      expect(metrics.peakLatency).toBe(2000)
    })

    it('should update average latency correctly', async () => {
      await monitoringService.recordApiRequest(true, 100)
      await monitoringService.recordApiRequest(true, 300)

      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.averageLatency).toBe(200) // (100 + 300) / 2
    })

    it('should trigger high latency alert', async () => {
      await monitoringService.recordApiRequest(true, 6000) // > 5 second threshold

      const alerts = monitoringService.getActiveAlerts()
      
      expect(alerts).toHaveLength(1)
      expect(alerts[0].type).toBe('api_error')
      expect(alerts[0].message).toContain('latency is high')
    })
  })

  describe('recordRateLimitHit', () => {
    it('should record rate limit hit and trigger alert', async () => {
      const resetTime = new Date(Date.now() + 60000)
      
      await monitoringService.recordRateLimitHit(resetTime)

      const metrics = monitoringService.getPerformanceMetrics()
      const alerts = monitoringService.getActiveAlerts()
      
      expect(metrics.rateLimitHits).toBe(1)
      expect(alerts).toHaveLength(1)
      expect(alerts[0].type).toBe('rate_limit')
      expect(alerts[0].severity).toBe('medium')
    })
  })

  describe('recordScanCompletion', () => {
    it('should record successful scan completion', async () => {
      await monitoringService.recordScanCompletion(10, true, [])

      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.postsProcessedPerHour).toBe(10)
    })

    it('should trigger alert for failed scan with errors', async () => {
      const errors = ['Error 1', 'Error 2', 'Error 3']
      
      await monitoringService.recordScanCompletion(5, false, errors)

      const alerts = monitoringService.getActiveAlerts()
      
      expect(alerts).toHaveLength(1)
      expect(alerts[0].type).toBe('scan_failure')
      expect(alerts[0].severity).toBe('medium')
    })

    it('should trigger high severity alert for many errors', async () => {
      const manyErrors = Array(10).fill('Error')
      
      await monitoringService.recordScanCompletion(0, false, manyErrors)

      const alerts = monitoringService.getActiveAlerts()
      
      expect(alerts).toHaveLength(1)
      expect(alerts[0].severity).toBe('high')
    })
  })

  describe('alert management', () => {
    it('should not create duplicate alerts within an hour', async () => {
      const resetTime = new Date(Date.now() + 60000)
      
      // First rate limit hit
      await monitoringService.recordRateLimitHit(resetTime)
      expect(monitoringService.getActiveAlerts()).toHaveLength(1)
      
      // Second rate limit hit within an hour (should not create new alert)
      await monitoringService.recordRateLimitHit(resetTime)
      expect(monitoringService.getActiveAlerts()).toHaveLength(1)
    })

    it('should resolve alerts', async () => {
      await monitoringService.recordRateLimitHit(new Date())
      
      const alerts = monitoringService.getActiveAlerts()
      expect(alerts).toHaveLength(1)
      
      await monitoringService.resolveAlert(alerts[0].id)
      
      const activeAlerts = monitoringService.getActiveAlerts()
      expect(activeAlerts).toHaveLength(0)
    })

    it('should clean up old resolved alerts', () => {
      // Create an old resolved alert
      const oldAlert: RedditAlert = {
        id: 'old_alert',
        type: 'api_error',
        severity: 'low',
        message: 'Old error',
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        resolved: true,
        resolvedAt: new Date(Date.now() - 25 * 60 * 60 * 1000)
      }
      
      ;(monitoringService as any).alerts = [oldAlert]
      
      monitoringService.resetMetrics()
      
      expect((monitoringService as any).alerts).toHaveLength(0)
    })
  })

  describe('performance metrics', () => {
    it('should return current performance metrics', () => {
      // Manually set some metrics for testing
      ;(monitoringService as any).metrics = {
        requestsPerMinute: 50,
        successRate: 95,
        averageLatency: 200,
        peakLatency: 500,
        errorsByType: { timeout: 2, connection: 1 },
        rateLimitHits: 1,
        postsProcessedPerHour: 100
      }

      const metrics = monitoringService.getPerformanceMetrics()

      expect(metrics.requestsPerMinute).toBe(50)
      expect(metrics.successRate).toBe(95)
      expect(metrics.averageLatency).toBe(200)
      expect(metrics.errorsByType.timeout).toBe(2)
    })

    it('should reset metrics correctly', () => {
      // Set some metrics
      ;(monitoringService as any).metrics.requestsPerMinute = 100
      ;(monitoringService as any).metrics.errorsByType.timeout = 5

      monitoringService.resetMetrics()

      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.requestsPerMinute).toBe(0)
      expect(metrics.errorsByType).toEqual({})
    })
  })

  describe('error rate calculation', () => {
    it('should calculate error rate correctly', async () => {
      // Record successful and failed requests
      await monitoringService.recordApiRequest(true, 100)
      await monitoringService.recordApiRequest(true, 100)
      await monitoringService.recordApiRequest(false, 100, 'error1')
      await monitoringService.recordApiRequest(false, 100, 'error2')

      // Error rate should be 50% (2 errors out of 4 requests)
      // This will trigger a high error rate alert
      const alerts = monitoringService.getActiveAlerts()
      
      expect(alerts.some(alert => alert.type === 'high_error_rate')).toBe(true)
    })
  })
})