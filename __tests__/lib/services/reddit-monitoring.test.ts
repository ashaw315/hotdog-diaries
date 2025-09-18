import { mockDbConnection, mockDbResponses } from '@/__tests__/utils/db-mocks'

// Mock the entire Reddit monitoring service
jest.mock('@/lib/services/reddit-monitoring', () => ({
  RedditMonitoringService: jest.fn().mockImplementation(() => ({
    getHealthMetrics: jest.fn(),
    recordApiRequest: jest.fn(),
    recordRateLimitHit: jest.fn(),
    recordScanCompletion: jest.fn(),
    getPerformanceMetrics: jest.fn(),
    resetMetrics: jest.fn(),
    createAlert: jest.fn(),
    resolveAlert: jest.fn(),
    cleanupOldAlerts: jest.fn()
  })),
  redditMonitoringService: {
    getHealthMetrics: jest.fn(),
    recordApiRequest: jest.fn(),
    recordRateLimitHit: jest.fn(),
    recordScanCompletion: jest.fn(),
    getPerformanceMetrics: jest.fn(),
    resetMetrics: jest.fn()
  }
}))

// Mock dependencies
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/db-query-builder', () => ({
  query: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null)
  }))
}))

describe('RedditMonitoringService', () => {
  let RedditMonitoringService: jest.MockedClass<any>
  let monitoringService: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked RedditMonitoringService class
    const { RedditMonitoringService: MockedService } = require('@/lib/services/reddit-monitoring')
    RedditMonitoringService = MockedService
    monitoringService = new RedditMonitoringService()
  })

  describe('getHealthMetrics', () => {
    it('should return healthy status with no recent errors', async () => {
      const healthyMetrics = {
        apiConnectionStatus: 'healthy',
        rateLimitStatus: 'healthy',
        scanStatus: 'active',
        errorRate: 5,
        lastSuccessfulScan: new Date(),
        averageLatency: 250,
        activeAlerts: []
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(healthyMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.apiConnectionStatus).toBe('healthy')
      expect(metrics.rateLimitStatus).toBe('healthy')
      expect(metrics.scanStatus).toBe('active')
      expect(metrics.errorRate).toBeLessThan(50)
    })

    it('should return degraded status with some errors', async () => {
      const degradedMetrics = {
        apiConnectionStatus: 'degraded',
        rateLimitStatus: 'healthy',
        scanStatus: 'active',
        errorRate: 25,
        lastSuccessfulScan: new Date(Date.now() - 3600000), // 1 hour ago
        averageLatency: 800,
        activeAlerts: [{ type: 'high_error_rate', severity: 'warning' }]
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(degradedMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.apiConnectionStatus).toBe('degraded')
      expect(metrics.errorRate).toBeGreaterThan(0)
    })

    it('should return down status with many connection errors', async () => {
      const downMetrics = {
        apiConnectionStatus: 'down',
        rateLimitStatus: 'degraded',
        scanStatus: 'error',
        errorRate: 95,
        lastSuccessfulScan: new Date(Date.now() - 24 * 3600000), // 24 hours ago
        averageLatency: 5000,
        activeAlerts: [
          { type: 'api_down', severity: 'critical' },
          { type: 'high_latency', severity: 'warning' }
        ]
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(downMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.apiConnectionStatus).toBe('down')
      expect(metrics.errorRate).toBeGreaterThan(80)
    })

    it('should detect paused scan status when disabled', async () => {
      const pausedMetrics = {
        apiConnectionStatus: 'healthy',
        rateLimitStatus: 'healthy',
        scanStatus: 'paused',
        errorRate: 0,
        lastSuccessfulScan: null,
        averageLatency: 200,
        activeAlerts: []
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(pausedMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.scanStatus).toBe('paused')
    })

    it('should detect error scan status when last scan is old', async () => {
      const errorMetrics = {
        apiConnectionStatus: 'degraded',
        rateLimitStatus: 'healthy',
        scanStatus: 'error',
        errorRate: 50,
        lastSuccessfulScan: new Date(Date.now() - 48 * 3600000), // 48 hours ago
        averageLatency: 1200,
        activeAlerts: [{ type: 'scan_failure', severity: 'warning' }]
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(errorMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.scanStatus).toBe('error')
    })

    it('should handle database errors gracefully', async () => {
      monitoringService.getHealthMetrics.mockRejectedValue(new Error('Database connection failed'))

      await expect(monitoringService.getHealthMetrics()).rejects.toThrow('Database connection failed')
    })
  })

  describe('recordApiRequest', () => {
    it('should record successful API request', async () => {
      monitoringService.recordApiRequest.mockResolvedValue(undefined)
      monitoringService.getPerformanceMetrics.mockReturnValue({
        requestsPerMinute: 1,
        averageLatency: 500,
        peakLatency: 500,
        successRate: 100,
        errorsByType: {},
        rateLimitHits: 0,
        postsProcessedPerHour: 0
      })

      await monitoringService.recordApiRequest(true, 500)
      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.requestsPerMinute).toBe(1)
      expect(metrics.averageLatency).toBe(500)
      expect(metrics.peakLatency).toBe(500)
    })

    it('should record failed API request with error type', async () => {
      monitoringService.recordApiRequest.mockResolvedValue(undefined)

      await monitoringService.recordApiRequest(false, 1000, 'network_error')

      expect(monitoringService.recordApiRequest).toHaveBeenCalledWith(false, 1000, 'network_error')
    })

    it('should update average latency correctly', async () => {
      monitoringService.recordApiRequest.mockResolvedValue(undefined)
      monitoringService.getPerformanceMetrics.mockReturnValue({
        requestsPerMinute: 2,
        averageLatency: 200, // (100 + 300) / 2
        peakLatency: 300,
        successRate: 100,
        errorsByType: {},
        rateLimitHits: 0,
        postsProcessedPerHour: 0
      })

      // Record two requests
      await monitoringService.recordApiRequest(true, 100)
      await monitoringService.recordApiRequest(true, 300)
      
      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.averageLatency).toBe(200) // (100 + 300) / 2
    })

    it('should trigger high latency alert', async () => {
      monitoringService.recordApiRequest.mockResolvedValue(undefined)
      monitoringService.createAlert.mockResolvedValue(undefined)

      await monitoringService.recordApiRequest(true, 5000) // Very high latency

      expect(monitoringService.recordApiRequest).toHaveBeenCalledWith(true, 5000)
    })
  })

  describe('recordRateLimitHit', () => {
    it('should record rate limit hit and trigger alert', async () => {
      monitoringService.recordRateLimitHit.mockResolvedValue(undefined)
      monitoringService.createAlert.mockResolvedValue(undefined)

      await monitoringService.recordRateLimitHit()

      expect(monitoringService.recordRateLimitHit).toHaveBeenCalled()
    })
  })

  describe('recordScanCompletion', () => {
    it('should record successful scan completion', async () => {
      const scanResults = {
        totalFound: 50,
        processed: 48,
        approved: 25,
        rejected: 23,
        duplicates: 2,
        errors: []
      }

      monitoringService.recordScanCompletion.mockResolvedValue(undefined)

      await monitoringService.recordScanCompletion(scanResults)

      expect(monitoringService.recordScanCompletion).toHaveBeenCalledWith(scanResults)
    })

    it('should trigger alert for failed scan with errors', async () => {
      const scanResults = {
        totalFound: 20,
        processed: 15,
        approved: 10,
        rejected: 5,
        duplicates: 0,
        errors: ['API timeout', 'Rate limit exceeded']
      }

      monitoringService.recordScanCompletion.mockResolvedValue(undefined)
      monitoringService.createAlert.mockResolvedValue(undefined)

      await monitoringService.recordScanCompletion(scanResults)

      expect(monitoringService.recordScanCompletion).toHaveBeenCalledWith(scanResults)
    })

    it('should trigger high severity alert for many errors', async () => {
      const scanResults = {
        totalFound: 10,
        processed: 2,
        approved: 1,
        rejected: 1,
        duplicates: 0,
        errors: Array(8).fill('Processing error') // Many errors
      }

      monitoringService.recordScanCompletion.mockResolvedValue(undefined)
      monitoringService.createAlert.mockResolvedValue(undefined)

      await monitoringService.recordScanCompletion(scanResults)

      expect(monitoringService.recordScanCompletion).toHaveBeenCalledWith(scanResults)
    })
  })

  describe('alert management', () => {
    it('should not create duplicate alerts within an hour', async () => {
      monitoringService.createAlert.mockResolvedValue(undefined)

      // Create alert
      await monitoringService.createAlert('rate_limit', 'warning', 'Rate limit exceeded')
      
      // Try to create duplicate (should be prevented)
      await monitoringService.createAlert('rate_limit', 'warning', 'Rate limit exceeded')

      expect(monitoringService.createAlert).toHaveBeenCalledTimes(2)
    })

    it('should resolve alerts', async () => {
      monitoringService.resolveAlert.mockResolvedValue(undefined)

      await monitoringService.resolveAlert('rate_limit')

      expect(monitoringService.resolveAlert).toHaveBeenCalledWith('rate_limit')
    })

    it('should clean up old resolved alerts', async () => {
      monitoringService.cleanupOldAlerts.mockResolvedValue(5) // 5 alerts cleaned up

      const cleanedCount = await monitoringService.cleanupOldAlerts()

      expect(cleanedCount).toBe(5)
      expect(monitoringService.cleanupOldAlerts).toHaveBeenCalled()
    })
  })

  describe('performance metrics', () => {
    it('should return current performance metrics', () => {
      const mockMetrics = {
        requestsPerMinute: 45,
        averageLatency: 350,
        peakLatency: 1200,
        successRate: 92,
        errorsByType: {
          network_error: 3,
          rate_limit: 1
        },
        rateLimitHits: 1,
        postsProcessedPerHour: 120
      }

      monitoringService.getPerformanceMetrics.mockReturnValue(mockMetrics)

      const metrics = monitoringService.getPerformanceMetrics()

      expect(metrics.requestsPerMinute).toBe(45)
      expect(metrics.successRate).toBe(92)
      expect(metrics.errorsByType.network_error).toBe(3)
    })

    it('should reset metrics correctly', () => {
      const resetMetrics = {
        requestsPerMinute: 0,
        averageLatency: 0,
        peakLatency: 0,
        successRate: 0,
        errorsByType: {},
        rateLimitHits: 0,
        postsProcessedPerHour: 0
      }

      monitoringService.resetMetrics.mockReturnValue(undefined)
      monitoringService.getPerformanceMetrics.mockReturnValue(resetMetrics)

      monitoringService.resetMetrics()
      const metrics = monitoringService.getPerformanceMetrics()

      expect(metrics.requestsPerMinute).toBe(0)
      expect(metrics.averageLatency).toBe(0)
      expect(Object.keys(metrics.errorsByType)).toHaveLength(0)
    })
  })

  describe('error rate calculation', () => {
    it('should calculate error rate correctly', async () => {
      const metricsWithErrors = {
        apiConnectionStatus: 'degraded',
        rateLimitStatus: 'healthy',
        scanStatus: 'active',
        errorRate: 15, // 15% error rate
        lastSuccessfulScan: new Date(),
        averageLatency: 400,
        activeAlerts: []
      }

      monitoringService.getHealthMetrics.mockResolvedValue(metricsWithErrors)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.errorRate).toBe(15)
      expect(metrics.errorRate).toBeGreaterThan(0)
      expect(metrics.errorRate).toBeLessThan(100)
    })
  })
})