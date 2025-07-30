import { TikTokMonitoringService } from '@/lib/services/tiktok-monitoring'
import { TikTokService } from '@/lib/services/tiktok'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

// Mock dependencies
jest.mock('@/lib/services/tiktok')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db')

const mockTikTokService = TikTokService as jest.MockedClass<typeof TikTokService>
const mockQuery = query as jest.MockedFunction<typeof query>
const mockLogToDatabase = logToDatabase as jest.MockedFunction<typeof logToDatabase>

// Mock fetch globally
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('TikTokMonitoringService', () => {
  let tikTokMonitoringService: TikTokMonitoringService
  let mockTikTokInstance: jest.Mocked<TikTokService>
  let mockSelect: jest.Mock
  let mockFirst: jest.Mock
  let mockInsert: jest.Mock
  let mockWhere: jest.Mock
  let mockOrderBy: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup TikTok service mock
    mockTikTokInstance = {
      testConnection: jest.fn(),
      getValidAccessToken: jest.fn()
    } as any

    mockTikTokService.mockImplementation(() => mockTikTokInstance)
    
    // Setup query builder mocks
    mockSelect = jest.fn().mockReturnThis()
    mockFirst = jest.fn()
    mockInsert = jest.fn()
    mockWhere = jest.fn().mockReturnThis()
    mockOrderBy = jest.fn().mockReturnThis()
    
    mockQuery.mockImplementation(() => ({
      select: mockSelect,
      first: mockFirst,
      insert: mockInsert,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: jest.fn().mockReturnThis()
    }) as any)

    tikTokMonitoringService = new TikTokMonitoringService()
  })

  describe('Health Metrics Collection', () => {
    test('should collect comprehensive health metrics', async () => {
      // Mock connection test success
      mockTikTokInstance.testConnection.mockResolvedValue({
        success: true,
        userInfo: {
          openId: 'test-open-id',
          unionId: 'test-union-id'
        }
      })

      // Mock rate limit data
      mockFirst.mockImplementation((table) => {
        if (table === 'rate_limit_tracking') {
          return Promise.resolve({
            current_usage: 75,
            limit_cap: 100,
            reset_time: new Date(Date.now() + 1800000) // 30 minutes from now
          })
        }
        return Promise.resolve(null)
      })

      // Mock recent scan results
      const mockScanResults = [
        {
          end_time: new Date(Date.now() - 300000), // 5 minutes ago
          videos_found: 10,
          videos_approved: 8,
          errors: []
        },
        {
          end_time: new Date(Date.now() - 900000), // 15 minutes ago
          videos_found: 5,
          videos_approved: 4,
          errors: ['Minor API timeout']
        }
      ]

      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue(mockScanResults)
      }))

      const metrics = await tikTokMonitoringService.getHealthMetrics()

      expect(metrics).toMatchObject({
        platform: 'tiktok',
        timestamp: expect.any(Date),
        isHealthy: true,
        connectionStatus: {
          isConnected: true,
          lastChecked: expect.any(Date),
          userInfo: {
            openId: 'test-open-id',
            unionId: 'test-union-id'
          }
        },
        rateLimits: {
          hourlyQuota: {
            used: 75,
            limit: 100,
            remaining: 25,
            resetTime: expect.any(Date),
            utilizationPercent: 75
          }
        },
        scanPerformance: {
          recentScans: 2,
          averageVideosFound: 7.5,
          averageSuccessRate: 80,
          lastScanTime: expect.any(Date),
          recentErrors: 1
        },
        alerts: expect.any(Array)
      })

      expect(mockTikTokInstance.testConnection).toHaveBeenCalled()
    })

    test('should handle connection failures', async () => {
      mockTikTokInstance.testConnection.mockResolvedValue({
        success: false,
        error: 'Invalid authentication token'
      })

      mockFirst.mockResolvedValue(null)
      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue([])
      }))

      const metrics = await tikTokMonitoringService.getHealthMetrics()

      expect(metrics).toMatchObject({
        platform: 'tiktok',
        isHealthy: false,
        connectionStatus: {
          isConnected: false,
          error: 'Invalid authentication token'
        }
      })

      expect(metrics.alerts).toContainEqual(
        expect.objectContaining({
          type: 'connection_failed',
          severity: 'high',
          message: 'TikTok connection test failed'
        })
      )
    })

    test('should detect rate limit warnings', async () => {
      mockTikTokInstance.testConnection.mockResolvedValue({ success: true })

      // Mock high rate limit usage (90%)
      mockFirst.mockResolvedValue({
        current_usage: 90,
        limit_cap: 100,
        reset_time: new Date(Date.now() + 1800000)
      })

      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue([])
      }))

      const metrics = await tikTokMonitoringService.getHealthMetrics()

      expect(metrics.rateLimits.hourlyQuota.utilizationPercent).toBe(90)
      expect(metrics.alerts).toContainEqual(
        expect.objectContaining({
          type: 'rate_limit_warning',
          severity: 'medium',
          message: expect.stringContaining('90%')
        })
      )
    })

    test('should detect scan performance issues', async () => {
      mockTikTokInstance.testConnection.mockResolvedValue({ success: true })
      mockFirst.mockResolvedValue(null)

      // Mock scans with high error rate
      const mockScanResults = [
        {
          end_time: new Date(Date.now() - 300000),
          videos_found: 2,
          videos_approved: 1,
          errors: ['API timeout', 'Rate limit hit']
        },
        {
          end_time: new Date(Date.now() - 900000),
          videos_found: 1,
          videos_approved: 0,
          errors: ['Authentication failed']
        }
      ]

      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue(mockScanResults)
      }))

      const metrics = await tikTokMonitoringService.getHealthMetrics()

      expect(metrics.scanPerformance.averageSuccessRate).toBe(33.33) // 1 approved out of 3 total
      expect(metrics.alerts).toContainEqual(
        expect.objectContaining({
          type: 'low_success_rate',
          severity: 'medium'
        })
      )
    })
  })

  describe('Performance Monitoring', () => {
    test('should track API response times', async () => {
      const startTime = Date.now()
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { videos: [] } })
      } as Response)

      await tikTokMonitoringService.trackAPICall('search_videos', async () => {
        await new Promise(resolve => setTimeout(resolve, 150)) // Simulate 150ms delay
        return { success: true }
      })

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        platform: 'tiktok',
        metric_type: 'api_response_time',
        metric_value: expect.any(Number),
        metric_data: expect.objectContaining({
          endpoint: 'search_videos',
          success: true,
          responseTime: expect.any(Number)
        })
      }))

      const responseTime = mockInsert.mock.calls[0][0].metric_value
      expect(responseTime).toBeGreaterThan(140) // Should be around 150ms
      expect(responseTime).toBeLessThan(200)
    })

    test('should track API errors and failures', async () => {
      const apiError = new Error('TikTok API rate limit exceeded')

      await tikTokMonitoringService.trackAPICall('search_videos', async () => {
        throw apiError
      })

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        platform: 'tiktok',
        metric_type: 'api_error',
        metric_data: expect.objectContaining({
          endpoint: 'search_videos',
          success: false,
          error: 'TikTok API rate limit exceeded'
        })
      }))

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'TIKTOK_API_ERROR',
        expect.stringContaining('search_videos'),
        expect.objectContaining({
          error: 'TikTok API rate limit exceeded'
        })
      )
    })

    test('should calculate performance statistics', async () => {
      // Mock recent API performance data
      const mockMetrics = [
        {
          metric_type: 'api_response_time',
          metric_value: 120,
          recorded_at: new Date(Date.now() - 300000),
          metric_data: { endpoint: 'search_videos', success: true }
        },
        {
          metric_type: 'api_response_time',
          metric_value: 180,
          recorded_at: new Date(Date.now() - 600000),
          metric_data: { endpoint: 'search_videos', success: true }
        },
        {
          metric_type: 'api_error',
          metric_value: null,
          recorded_at: new Date(Date.now() - 900000),
          metric_data: { endpoint: 'search_videos', success: false }
        }
      ]

      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue(mockMetrics)
      }))

      const stats = await tikTokMonitoringService.getPerformanceStats('1h')

      expect(stats).toMatchObject({
        timeRange: '1h',
        apiCalls: {
          total: 3,
          successful: 2,
          failed: 1,
          successRate: 66.67
        },
        responseTime: {
          average: 150, // (120 + 180) / 2
          min: 120,
          max: 180
        },
        endpoints: {
          search_videos: {
            calls: 3,
            successRate: 66.67,
            averageResponseTime: 150
          }
        }
      })
    })
  })

  describe('Alert Management', () => {
    test('should create alerts for critical issues', async () => {
      const alert = {
        type: 'authentication_failed',
        severity: 'critical' as const,
        message: 'TikTok authentication has failed',
        metadata: { attempts: 3, lastError: 'Invalid token' }
      }

      await tikTokMonitoringService.createAlert(alert)

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        alert_id: expect.any(String),
        platform: 'tiktok',
        alert_type: 'authentication_failed',
        severity: 'critical',
        message: 'TikTok authentication has failed',
        metadata: { attempts: 3, lastError: 'Invalid token' },
        resolved: false
      }))

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'TIKTOK_ALERT_CREATED',
        'TikTok alert created: authentication_failed (critical)',
        expect.objectContaining({
          alertType: 'authentication_failed',
          severity: 'critical'
        })
      )
    })

    test('should get active alerts', async () => {
      const mockAlerts = [
        {
          alert_id: 'alert1',
          alert_type: 'rate_limit_exceeded',
          severity: 'high',
          message: 'Rate limit exceeded',
          metadata: { usage: 95 },
          created_at: new Date(Date.now() - 600000),
          resolved: false
        },
        {
          alert_id: 'alert2',
          alert_type: 'scan_failures',
          severity: 'medium',
          message: 'Multiple scan failures detected',
          metadata: { failures: 5 },
          created_at: new Date(Date.now() - 300000),
          resolved: false
        }
      ]

      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue(mockAlerts)
      }))

      const alerts = await tikTokMonitoringService.getActiveAlerts()

      expect(alerts).toHaveLength(2)
      expect(alerts[0]).toMatchObject({
        alertId: 'alert1',
        type: 'rate_limit_exceeded',
        severity: 'high',
        message: 'Rate limit exceeded'
      })
    })

    test('should resolve alerts', async () => {
      await tikTokMonitoringService.resolveAlert('alert123')

      expect(mockQuery).toHaveBeenCalledWith('platform_alerts')
      expect(mockWhere).toHaveBeenCalledWith('alert_id', 'alert123')
      
      // Check that update was called with resolved status
      const queryResult = mockQuery()
      expect(queryResult.where).toHaveBeenCalledWith('alert_id', 'alert123')
    })

    test('should auto-resolve stale alerts', async () => {
      const staleAlerts = [
        {
          alert_id: 'stale1',
          alert_type: 'rate_limit_warning',
          created_at: new Date(Date.now() - 7200000) // 2 hours ago
        },
        {
          alert_id: 'stale2',
          alert_type: 'connection_timeout',
          created_at: new Date(Date.now() - 10800000) // 3 hours ago
        }
      ]

      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue(staleAlerts)
      }))

      // Mock current health as good
      mockTikTokInstance.testConnection.mockResolvedValue({ success: true })
      mockFirst.mockResolvedValue({
        current_usage: 50,
        limit_cap: 100
      })

      await tikTokMonitoringService.autoResolveStaleAlerts()

      // Should resolve alerts that are no longer relevant
      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.INFO,
        'TIKTOK_ALERTS_AUTO_RESOLVED',
        expect.stringContaining('auto-resolved'),
        expect.any(Object)
      )
    })
  })

  describe('Quota and Rate Limit Monitoring', () => {
    test('should update rate limit usage after API calls', async () => {
      await tikTokMonitoringService.updateRateLimitUsage('hourly', 1)

      expect(mockQuery).toHaveBeenCalledWith('rate_limit_tracking')
      expect(mockWhere).toHaveBeenCalledWith('platform', 'tiktok')
      expect(mockWhere).toHaveBeenCalledWith('limit_type', 'hourly')
    })

    test('should check if rate limit allows more requests', async () => {
      // Mock current usage at 95/100
      mockFirst.mockResolvedValue({
        current_usage: 95,
        limit_cap: 100,
        reset_time: new Date(Date.now() + 1800000)
      })

      const canMakeRequest = await tikTokMonitoringService.canMakeAPIRequest('hourly')

      expect(canMakeRequest).toBe(true) // Still under limit
    })

    test('should prevent requests when rate limit exceeded', async () => {
      // Mock current usage at 100/100
      mockFirst.mockResolvedValue({
        current_usage: 100,
        limit_cap: 100,
        reset_time: new Date(Date.now() + 1800000)
      })

      const canMakeRequest = await tikTokMonitoringService.canMakeAPIRequest('hourly')

      expect(canMakeRequest).toBe(false)
    })

    test('should reset rate limits after reset time', async () => {
      // Mock expired rate limit window
      mockFirst.mockResolvedValue({
        current_usage: 100,
        limit_cap: 100,
        reset_time: new Date(Date.now() - 1000) // Reset time passed
      })

      const canMakeRequest = await tikTokMonitoringService.canMakeAPIRequest('hourly')

      expect(canMakeRequest).toBe(true)
      
      // Should reset the counter
      expect(mockQuery).toHaveBeenCalledWith('rate_limit_tracking')
    })
  })

  describe('Health Status Reporting', () => {
    test('should generate comprehensive health report', async () => {
      // Mock healthy system
      mockTikTokInstance.testConnection.mockResolvedValue({ success: true })
      mockFirst.mockResolvedValue({
        current_usage: 50,
        limit_cap: 100,
        reset_time: new Date(Date.now() + 1800000)
      })
      
      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue([{
          end_time: new Date(Date.now() - 300000),
          videos_found: 10,
          videos_approved: 9,
          errors: []
        }])
      }))

      const report = await tikTokMonitoringService.generateHealthReport()

      expect(report).toMatchObject({
        platform: 'tiktok',
        overallStatus: 'healthy',
        timestamp: expect.any(Date),
        summary: {
          connectionStatus: 'connected',
          rateLimitStatus: 'healthy',
          scanPerformanceStatus: 'good',
          activeAlertsCount: 0
        },
        details: expect.objectContaining({
          connectionStatus: expect.any(Object),
          rateLimits: expect.any(Object),
          scanPerformance: expect.any(Object)
        }),
        recommendations: expect.any(Array)
      })
    })

    test('should generate recommendations based on metrics', async () => {
      // Mock system with issues
      mockTikTokInstance.testConnection.mockResolvedValue({ success: true })
      mockFirst.mockResolvedValue({
        current_usage: 90,
        limit_cap: 100,
        reset_time: new Date(Date.now() + 1800000)
      })
      
      mockOrderBy.mockImplementation(() => ({
        limit: jest.fn().mockResolvedValue([{
          end_time: new Date(Date.now() - 300000),
          videos_found: 10,
          videos_approved: 3, // Low success rate
          errors: ['API timeout', 'Rate limit']
        }])
      }))

      const report = await tikTokMonitoringService.generateHealthReport()

      expect(report.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'rate_limit',
          priority: 'medium',
          message: expect.stringContaining('rate limit usage is high')
        })
      )

      expect(report.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'performance',
          priority: 'high',
          message: expect.stringContaining('success rate is low')
        })
      )
    })
  })

  describe('Error Handling', () => {
    test('should handle monitoring system failures gracefully', async () => {
      mockTikTokInstance.testConnection.mockRejectedValue(new Error('Connection timeout'))

      const metrics = await tikTokMonitoringService.getHealthMetrics()

      expect(metrics).toMatchObject({
        platform: 'tiktok',
        isHealthy: false,
        error: 'Connection timeout'
      })

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'TIKTOK_MONITORING_ERROR',
        expect.stringContaining('Connection timeout'),
        expect.any(Object)
      )
    })

    test('should continue monitoring despite database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database unavailable'))

      const metrics = await tikTokMonitoringService.getHealthMetrics()

      expect(metrics).toMatchObject({
        platform: 'tiktok',
        isHealthy: false,
        error: 'Database unavailable'
      })
    })
  })
})