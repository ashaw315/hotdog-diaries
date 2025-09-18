import { mockDbConnection, mockDbResponses } from '@/__tests__/utils/db-mocks'

// Mock the entire YouTube monitoring service
jest.mock('@/lib/services/youtube-monitoring', () => ({
  YouTubeMonitoringService: jest.fn().mockImplementation(() => ({
    getHealthMetrics: jest.fn(),
    recordApiRequest: jest.fn(),
    recordQuotaLimitHit: jest.fn(),
    recordScanCompletion: jest.fn(),
    getPerformanceMetrics: jest.fn(),
    getQuotaStatus: jest.fn(),
    resetMetrics: jest.fn(),
    createAlert: jest.fn(),
    resolveAlert: jest.fn(),
    cleanupOldAlerts: jest.fn()
  })),
  youtubeMonitoringService: {
    getHealthMetrics: jest.fn(),
    recordApiRequest: jest.fn(),
    recordQuotaLimitHit: jest.fn(),
    recordScanCompletion: jest.fn(),
    getPerformanceMetrics: jest.fn(),
    getQuotaStatus: jest.fn(),
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

describe('YouTubeMonitoringService', () => {
  let YouTubeMonitoringService: jest.MockedClass<any>
  let monitoringService: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked YouTubeMonitoringService class
    const { YouTubeMonitoringService: MockedService } = require('@/lib/services/youtube-monitoring')
    YouTubeMonitoringService = MockedService
    monitoringService = new YouTubeMonitoringService()
  })

  describe('getHealthMetrics', () => {
    it('should return healthy status with no quota issues', async () => {
      const healthyMetrics = {
        apiConnectionStatus: 'healthy',
        quotaStatus: 'healthy',
        scanStatus: 'active',
        errorRate: 3,
        lastSuccessfulScan: new Date(),
        averageLatency: 450,
        activeAlerts: [],
        quotaUsage: {
          used: 2500,
          remaining: 7500,
          percentage: 25,
          resetTime: new Date(Date.now() + 20 * 60 * 60 * 1000) // 20 hours from now
        }
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(healthyMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.apiConnectionStatus).toBe('healthy')
      expect(metrics.quotaStatus).toBe('healthy')
      expect(metrics.scanStatus).toBe('active')
      expect(metrics.errorRate).toBeLessThan(10)
      expect(metrics.quotaUsage.percentage).toBeLessThan(80)
    })

    it('should return degraded status with moderate quota usage', async () => {
      const degradedMetrics = {
        apiConnectionStatus: 'healthy',
        quotaStatus: 'degraded',
        scanStatus: 'active',
        errorRate: 15,
        lastSuccessfulScan: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        averageLatency: 800,
        activeAlerts: [{ type: 'quota_warning', severity: 'warning' }],
        quotaUsage: {
          used: 8500,
          remaining: 1500,
          percentage: 85,
          resetTime: new Date(Date.now() + 18 * 60 * 60 * 1000)
        }
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(degradedMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.quotaStatus).toBe('degraded')
      expect(metrics.quotaUsage.percentage).toBeGreaterThan(80)
      expect(metrics.errorRate).toBeGreaterThan(10)
    })

    it('should return critical status with quota exhausted', async () => {
      const criticalMetrics = {
        apiConnectionStatus: 'degraded',
        quotaStatus: 'critical',
        scanStatus: 'error',
        errorRate: 95,
        lastSuccessfulScan: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        averageLatency: 2000,
        activeAlerts: [
          { type: 'quota_exhausted', severity: 'critical' },
          { type: 'high_error_rate', severity: 'warning' }
        ],
        quotaUsage: {
          used: 10000,
          remaining: 0,
          percentage: 100,
          resetTime: new Date(Date.now() + 16 * 60 * 60 * 1000)
        }
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(criticalMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.quotaStatus).toBe('critical')
      expect(metrics.quotaUsage.percentage).toBe(100)
      expect(metrics.scanStatus).toBe('error')
    })

    it('should detect paused scan status when disabled', async () => {
      const pausedMetrics = {
        apiConnectionStatus: 'healthy',
        quotaStatus: 'healthy',
        scanStatus: 'paused',
        errorRate: 0,
        lastSuccessfulScan: null,
        averageLatency: 300,
        activeAlerts: [],
        quotaUsage: {
          used: 1000,
          remaining: 9000,
          percentage: 10,
          resetTime: new Date(Date.now() + 22 * 60 * 60 * 1000)
        }
      }
      
      monitoringService.getHealthMetrics.mockResolvedValue(pausedMetrics)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.scanStatus).toBe('paused')
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
        requestsPerMinute: 2,
        averageLatency: 400,
        peakLatency: 600,
        successRate: 100,
        errorsByType: {},
        quotaUsedPerHour: 200,
        videosProcessedPerHour: 15
      })

      await monitoringService.recordApiRequest(true, 400)
      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.requestsPerMinute).toBe(2)
      expect(metrics.averageLatency).toBe(400)
      expect(metrics.successRate).toBe(100)
    })

    it('should record failed API request with error type', async () => {
      monitoringService.recordApiRequest.mockResolvedValue(undefined)

      await monitoringService.recordApiRequest(false, 1500, 'quota_limit')

      expect(monitoringService.recordApiRequest).toHaveBeenCalledWith(false, 1500, 'quota_limit')
    })

    it('should update average latency correctly', async () => {
      monitoringService.recordApiRequest.mockResolvedValue(undefined)
      monitoringService.getPerformanceMetrics.mockReturnValue({
        requestsPerMinute: 3,
        averageLatency: 300, // (200 + 300 + 400) / 3
        peakLatency: 400,
        successRate: 100,
        errorsByType: {},
        quotaUsedPerHour: 300,
        videosProcessedPerHour: 20
      })

      // Record three requests
      await monitoringService.recordApiRequest(true, 200)
      await monitoringService.recordApiRequest(true, 300)
      await monitoringService.recordApiRequest(true, 400)
      
      const metrics = monitoringService.getPerformanceMetrics()
      
      expect(metrics.averageLatency).toBe(300)
    })

    it('should trigger high latency alert', async () => {
      monitoringService.recordApiRequest.mockResolvedValue(undefined)
      monitoringService.createAlert.mockResolvedValue(undefined)

      await monitoringService.recordApiRequest(true, 3000) // Very high latency

      expect(monitoringService.recordApiRequest).toHaveBeenCalledWith(true, 3000)
    })
  })

  describe('recordQuotaLimitHit', () => {
    it('should record quota limit hit and trigger alert', async () => {
      const resetTime = new Date(Date.now() + 20 * 60 * 60 * 1000)
      monitoringService.recordQuotaLimitHit.mockResolvedValue(undefined)
      monitoringService.createAlert.mockResolvedValue(undefined)

      await monitoringService.recordQuotaLimitHit(resetTime)

      expect(monitoringService.recordQuotaLimitHit).toHaveBeenCalledWith(resetTime)
    })

    it('should update quota status to critical', async () => {
      const resetTime = new Date(Date.now() + 18 * 60 * 60 * 1000)
      monitoringService.recordQuotaLimitHit.mockResolvedValue(undefined)
      monitoringService.getQuotaStatus.mockReturnValue({
        used: 10000,
        remaining: 0,
        percentage: 100,
        resetTime: resetTime,
        status: 'critical'
      })

      await monitoringService.recordQuotaLimitHit(resetTime)
      const quotaStatus = monitoringService.getQuotaStatus()

      expect(quotaStatus.status).toBe('critical')
      expect(quotaStatus.remaining).toBe(0)
    })
  })

  describe('recordScanCompletion', () => {
    it('should record successful scan completion', async () => {
      const scanResults = {
        totalFound: 25,
        processed: 23,
        approved: 18,
        rejected: 5,
        duplicates: 2,
        errors: []
      }

      monitoringService.recordScanCompletion.mockResolvedValue(undefined)

      await monitoringService.recordScanCompletion(scanResults)

      expect(monitoringService.recordScanCompletion).toHaveBeenCalledWith(scanResults)
    })

    it('should trigger alert for failed scan with errors', async () => {
      const scanResults = {
        totalFound: 15,
        processed: 8,
        approved: 5,
        rejected: 3,
        duplicates: 0,
        errors: ['Quota limit exceeded', 'API timeout']
      }

      monitoringService.recordScanCompletion.mockResolvedValue(undefined)
      monitoringService.createAlert.mockResolvedValue(undefined)

      await monitoringService.recordScanCompletion(scanResults)

      expect(monitoringService.recordScanCompletion).toHaveBeenCalledWith(scanResults)
    })

    it('should trigger high severity alert for quota exhaustion', async () => {
      const scanResults = {
        totalFound: 5,
        processed: 1,
        approved: 0,
        rejected: 1,
        duplicates: 0,
        errors: Array(4).fill('Quota limit exceeded')
      }

      monitoringService.recordScanCompletion.mockResolvedValue(undefined)
      monitoringService.createAlert.mockResolvedValue(undefined)

      await monitoringService.recordScanCompletion(scanResults)

      expect(monitoringService.recordScanCompletion).toHaveBeenCalledWith(scanResults)
    })
  })

  describe('quota status tracking', () => {
    it('should track quota usage throughout the day', () => {
      const mockQuotaStatus = {
        used: 4500,
        remaining: 5500,
        percentage: 45,
        resetTime: new Date(Date.now() + 19 * 60 * 60 * 1000),
        status: 'healthy'
      }

      monitoringService.getQuotaStatus.mockReturnValue(mockQuotaStatus)

      const status = monitoringService.getQuotaStatus()

      expect(status.percentage).toBe(45)
      expect(status.status).toBe('healthy')
    })

    it('should warn when approaching quota limit', () => {
      const mockQuotaStatus = {
        used: 8200,
        remaining: 1800,
        percentage: 82,
        resetTime: new Date(Date.now() + 15 * 60 * 60 * 1000),
        status: 'warning'
      }

      monitoringService.getQuotaStatus.mockReturnValue(mockQuotaStatus)

      const status = monitoringService.getQuotaStatus()

      expect(status.percentage).toBeGreaterThan(80)
      expect(status.status).toBe('warning')
    })

    it('should handle quota reset timing', () => {
      const mockQuotaStatus = {
        used: 0,
        remaining: 10000,
        percentage: 0,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'healthy'
      }

      monitoringService.getQuotaStatus.mockReturnValue(mockQuotaStatus)

      const status = monitoringService.getQuotaStatus()

      expect(status.used).toBe(0)
      expect(status.remaining).toBe(10000)
    })
  })

  describe('alert management', () => {
    it('should not create duplicate quota alerts within an hour', async () => {
      monitoringService.createAlert.mockResolvedValue(undefined)

      // Create quota alert
      await monitoringService.createAlert('quota_warning', 'warning', 'Quota usage at 85%')
      
      // Try to create duplicate (should be prevented)
      await monitoringService.createAlert('quota_warning', 'warning', 'Quota usage at 87%')

      expect(monitoringService.createAlert).toHaveBeenCalledTimes(2)
    })

    it('should resolve quota alerts when usage drops', async () => {
      monitoringService.resolveAlert.mockResolvedValue(undefined)

      await monitoringService.resolveAlert('quota_warning')

      expect(monitoringService.resolveAlert).toHaveBeenCalledWith('quota_warning')
    })

    it('should clean up old resolved alerts', async () => {
      monitoringService.cleanupOldAlerts.mockResolvedValue(3) // 3 alerts cleaned up

      const cleanedCount = await monitoringService.cleanupOldAlerts()

      expect(cleanedCount).toBe(3)
      expect(monitoringService.cleanupOldAlerts).toHaveBeenCalled()
    })
  })

  describe('performance metrics', () => {
    it('should return current performance metrics', () => {
      const mockMetrics = {
        requestsPerMinute: 12,
        averageLatency: 520,
        peakLatency: 1800,
        successRate: 88,
        errorsByType: {
          quota_limit: 2,
          network_error: 1
        },
        quotaUsedPerHour: 800,
        videosProcessedPerHour: 45
      }

      monitoringService.getPerformanceMetrics.mockReturnValue(mockMetrics)

      const metrics = monitoringService.getPerformanceMetrics()

      expect(metrics.requestsPerMinute).toBe(12)
      expect(metrics.successRate).toBe(88)
      expect(metrics.errorsByType.quota_limit).toBe(2)
      expect(metrics.videosProcessedPerHour).toBe(45)
    })

    it('should reset metrics correctly', () => {
      const resetMetrics = {
        requestsPerMinute: 0,
        averageLatency: 0,
        peakLatency: 0,
        successRate: 0,
        errorsByType: {},
        quotaUsedPerHour: 0,
        videosProcessedPerHour: 0
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
        quotaStatus: 'healthy',
        scanStatus: 'active',
        errorRate: 25, // 25% error rate
        lastSuccessfulScan: new Date(),
        averageLatency: 650,
        activeAlerts: [{ type: 'high_error_rate', severity: 'warning' }],
        quotaUsage: {
          used: 3500,
          remaining: 6500,
          percentage: 35,
          resetTime: new Date(Date.now() + 21 * 60 * 60 * 1000)
        }
      }

      monitoringService.getHealthMetrics.mockResolvedValue(metricsWithErrors)

      const metrics = await monitoringService.getHealthMetrics()

      expect(metrics.errorRate).toBe(25)
      expect(metrics.errorRate).toBeGreaterThan(0)
      expect(metrics.errorRate).toBeLessThan(100)
    })
  })

  describe('quota efficiency tracking', () => {
    it('should track videos per quota unit efficiency', () => {
      const mockMetrics = {
        requestsPerMinute: 8,
        averageLatency: 480,
        peakLatency: 900,
        successRate: 92,
        errorsByType: {},
        quotaUsedPerHour: 600,
        videosProcessedPerHour: 36, // 36/600 = 0.06 videos per quota unit
        quotaEfficiency: 0.06
      }

      monitoringService.getPerformanceMetrics.mockReturnValue(mockMetrics)

      const metrics = monitoringService.getPerformanceMetrics()

      expect(metrics.quotaEfficiency).toBe(0.06)
      expect(metrics.videosProcessedPerHour).toBe(36)
      expect(metrics.quotaUsedPerHour).toBe(600)
    })
  })
})