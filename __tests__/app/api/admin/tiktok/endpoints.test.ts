import { GET, POST } from '@/app/api/admin/tiktok/authenticate/route'
import { GET as SettingsGET, PUT as SettingsPUT } from '@/app/api/admin/tiktok/settings/route'
import { POST as ScanPOST } from '@/app/api/admin/tiktok/scan/route'
import { GET as StatsGET } from '@/app/api/admin/tiktok/stats/route'
import { GET as StatusGET } from '@/app/api/admin/tiktok/status/route'
import { GET as TestConnectionGET } from '@/app/api/admin/tiktok/test-connection/route'
import { GET as ScanHistoryGET } from '@/app/api/admin/tiktok/scan-history/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/services/tiktok')
jest.mock('@/lib/services/tiktok-scanning')
jest.mock('@/lib/services/tiktok-monitoring')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db')

const mockTikTokService = {
  authenticate: jest.fn(),
  testConnection: jest.fn(),
  searchVideos: jest.fn()
}

const mockTikTokScanningService = {
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
  performScan: jest.fn(),
  getStats: jest.fn(),
  getRecentScans: jest.fn()
}

const mockTikTokMonitoringService = {
  getHealthMetrics: jest.fn(),
  generateHealthReport: jest.fn()
}

// Mock the service imports
jest.doMock('@/lib/services/tiktok', () => ({
  TikTokService: jest.fn(() => mockTikTokService)
}))

jest.doMock('@/lib/services/tiktok-scanning', () => ({
  TikTokScanningService: jest.fn(() => mockTikTokScanningService)
}))

jest.doMock('@/lib/services/tiktok-monitoring', () => ({
  TikTokMonitoringService: jest.fn(() => mockTikTokMonitoringService)
}))

describe('TikTok API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication Endpoints', () => {
    describe('/api/admin/tiktok/authenticate', () => {
      test('POST should handle OAuth callback', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/authenticate', {
          method: 'POST',
          body: JSON.stringify({
            code: 'auth_code_123',
            redirectUri: 'https://example.com/callback'
          })
        })

        mockTikTokService.authenticate.mockResolvedValue({
          success: true,
          openId: 'test_open_id',
          accessToken: 'test_access_token'
        })

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(mockTikTokService.authenticate).toHaveBeenCalledWith('auth_code_123', 'https://example.com/callback')
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.openId).toBe('test_open_id')
      })

      test('POST should handle authentication failures', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/authenticate', {
          method: 'POST',
          body: JSON.stringify({
            code: 'invalid_code',
            redirectUri: 'https://example.com/callback'
          })
        })

        mockTikTokService.authenticate.mockResolvedValue({
          success: false,
          error: 'Invalid authorization code'
        })

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Invalid authorization code')
      })

      test('GET should return OAuth URL', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/authenticate?redirectUri=https://example.com/callback')

        const response = await GET(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.authUrl).toContain('https://www.tiktok.com/v2/auth/authorize')
        expect(data.data.authUrl).toContain('client_key=')
        expect(data.data.authUrl).toContain('redirect_uri=')
      })
    })

    describe('/api/admin/tiktok/test-connection', () => {
      test('GET should test TikTok connection', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/test-connection')

        mockTikTokService.testConnection.mockResolvedValue({
          success: true,
          userInfo: {
            openId: 'test_open_id',
            unionId: 'test_union_id',
            avatarUrl: 'https://example.com/avatar.jpg'
          }
        })

        const response = await TestConnectionGET(mockRequest)
        const data = await response.json()

        expect(mockTikTokService.testConnection).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.userInfo.openId).toBe('test_open_id')
      })

      test('GET should handle connection failures', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/test-connection')

        mockTikTokService.testConnection.mockResolvedValue({
          success: false,
          error: 'No valid authentication'
        })

        const response = await TestConnectionGET(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.error).toContain('No valid authentication')
      })
    })
  })

  describe('Settings Endpoints', () => {
    describe('/api/admin/tiktok/settings', () => {
      test('GET should return TikTok scan settings', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/settings')

        const mockConfig = {
          isEnabled: true,
          scanInterval: 120,
          maxVideosPerScan: 20,
          targetKeywords: ['hotdog', 'sausage'],
          targetHashtags: ['foodtok', 'grilling'],
          minViews: 100,
          maxDuration: 180,
          sortBy: 'relevance'
        }

        mockTikTokScanningService.getConfig.mockResolvedValue(mockConfig)

        const response = await SettingsGET(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data).toEqual(mockConfig)
      })

      test('PUT should update TikTok scan settings', async () => {
        const settingsUpdate = {
          isEnabled: true,
          scanInterval: 90,
          maxVideosPerScan: 25,
          targetKeywords: ['hotdog', 'bratwurst', 'frankfurter'],
          minViews: 200
        }

        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/settings', {
          method: 'PUT',
          body: JSON.stringify(settingsUpdate)
        })

        mockTikTokScanningService.updateConfig.mockResolvedValue()

        const response = await SettingsPUT(mockRequest)
        const data = await response.json()

        expect(mockTikTokScanningService.updateConfig).toHaveBeenCalledWith(settingsUpdate)
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      test('PUT should validate settings', async () => {
        const invalidSettings = {
          scanInterval: 10, // Too low
          maxVideosPerScan: -5 // Invalid
        }

        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/settings', {
          method: 'PUT',
          body: JSON.stringify(invalidSettings)
        })

        const response = await SettingsPUT(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.error).toContain('scanInterval must be at least 15 minutes')
      })
    })
  })

  describe('Scan Endpoints', () => {
    describe('/api/admin/tiktok/scan', () => {
      test('POST should trigger TikTok scan', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/scan', {
          method: 'POST'
        })

        const mockScanResult = {
          scanId: 'tiktok_scan_123',
          startTime: new Date(),
          endTime: new Date(),
          videosFound: 15,
          videosProcessed: 12,
          videosApproved: 10,
          videosRejected: 2,
          videosFlagged: 0,
          duplicatesFound: 3,
          success: true,
          errors: []
        }

        mockTikTokScanningService.performScan.mockResolvedValue(mockScanResult)

        const response = await ScanPOST(mockRequest)
        const data = await response.json()

        expect(mockTikTokScanningService.performScan).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.scanId).toBe('tiktok_scan_123')
        expect(data.data.videosApproved).toBe(10)
      })

      test('POST should handle scan failures', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/scan', {
          method: 'POST'
        })

        mockTikTokScanningService.performScan.mockRejectedValue(new Error('TikTok API error'))

        const response = await ScanPOST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('TikTok API error')
      })
    })

    describe('/api/admin/tiktok/scan-history', () => {
      test('GET should return scan history', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/scan-history?limit=10')

        const mockScanHistory = [
          {
            scanId: 'scan1',
            startTime: new Date('2024-01-01T10:00:00Z'),
            endTime: new Date('2024-01-01T10:05:00Z'),
            videosFound: 20,
            videosApproved: 15,
            videosRejected: 5,
            success: true
          },
          {
            scanId: 'scan2',
            startTime: new Date('2024-01-01T08:00:00Z'),
            endTime: new Date('2024-01-01T08:03:00Z'),
            videosFound: 10,
            videosApproved: 8,
            videosRejected: 2,
            success: true
          }
        ]

        mockTikTokScanningService.getRecentScans.mockResolvedValue(mockScanHistory)

        const response = await ScanHistoryGET(mockRequest)
        const data = await response.json()

        expect(mockTikTokScanningService.getRecentScans).toHaveBeenCalledWith(10)
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data).toHaveLength(2)
        expect(data.data[0].scanId).toBe('scan1')
      })
    })
  })

  describe('Statistics Endpoints', () => {
    describe('/api/admin/tiktok/stats', () => {
      test('GET should return TikTok statistics', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/stats')

        const mockStats = {
          totalScans: 50,
          totalVideosFound: 500,
          totalVideosApproved: 400,
          totalVideosRejected: 80,
          totalDuplicates: 20,
          averageVideosPerScan: 10,
          successRate: 80,
          recentErrorCount: 2,
          topKeywords: ['hotdog', 'sausage', 'grilling'],
          topHashtags: ['foodtok', 'cooking', 'bbq'],
          averageViews: 2500,
          lastScanTime: new Date('2024-01-01T12:00:00Z')
        }

        mockTikTokScanningService.getStats.mockResolvedValue(mockStats)

        const response = await StatsGET(mockRequest)
        const data = await response.json()

        expect(mockTikTokScanningService.getStats).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.totalScans).toBe(50)
        expect(data.data.successRate).toBe(80)
        expect(data.data.topKeywords).toContain('hotdog')
      })
    })
  })

  describe('Status Endpoints', () => {
    describe('/api/admin/tiktok/status', () => {
      test('GET should return TikTok platform status', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/status')

        const mockHealthMetrics = {
          platform: 'tiktok',
          timestamp: new Date(),
          isHealthy: true,
          connectionStatus: {
            isConnected: true,
            lastChecked: new Date(),
            userInfo: {
              openId: 'test_open_id',
              unionId: 'test_union_id'
            }
          },
          rateLimits: {
            hourlyQuota: {
              used: 75,
              limit: 100,
              remaining: 25,
              resetTime: new Date(Date.now() + 1800000),
              utilizationPercent: 75
            },
            dailyQuota: {
              used: 500,
              limit: 1000,
              remaining: 500,
              resetTime: new Date(Date.now() + 86400000),
              utilizationPercent: 50
            }
          },
          scanPerformance: {
            recentScans: 5,
            averageVideosFound: 12,
            averageSuccessRate: 85,
            lastScanTime: new Date(),
            recentErrors: 0
          },
          alerts: []
        }

        mockTikTokMonitoringService.getHealthMetrics.mockResolvedValue(mockHealthMetrics)

        const response = await StatusGET(mockRequest)
        const data = await response.json()

        expect(mockTikTokMonitoringService.getHealthMetrics).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.isHealthy).toBe(true)
        expect(data.data.rateLimits.hourlyQuota.utilizationPercent).toBe(75)
        expect(data.data.scanPerformance.averageSuccessRate).toBe(85)
      })

      test('GET should handle unhealthy status', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/status')

        const mockHealthMetrics = {
          platform: 'tiktok',
          timestamp: new Date(),
          isHealthy: false,
          connectionStatus: {
            isConnected: false,
            error: 'Authentication failed'
          },
          rateLimits: {
            hourlyQuota: {
              used: 100,
              limit: 100,
              remaining: 0,
              resetTime: new Date(Date.now() + 1800000),
              utilizationPercent: 100
            }
          },
          scanPerformance: {
            recentScans: 2,
            averageVideosFound: 2,
            averageSuccessRate: 25,
            lastScanTime: new Date(),
            recentErrors: 5
          },
          alerts: [
            {
              type: 'rate_limit_exceeded',
              severity: 'high',
              message: 'TikTok hourly rate limit exceeded'
            },
            {
              type: 'connection_failed',
              severity: 'critical',
              message: 'TikTok authentication failed'
            }
          ]
        }

        mockTikTokMonitoringService.getHealthMetrics.mockResolvedValue(mockHealthMetrics)

        const response = await StatusGET(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.isHealthy).toBe(false)
        expect(data.data.alerts).toHaveLength(2)
        expect(data.data.alerts[0].severity).toBe('high')
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle service initialization errors', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/stats')

      mockTikTokScanningService.getStats.mockRejectedValue(new Error('Service initialization failed'))

      const response = await StatsGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Service initialization failed')
    })

    test('should handle malformed request bodies', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/settings', {
        method: 'PUT',
        body: 'invalid json'
      })

      const response = await SettingsPUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid JSON')
    })

    test('should handle database connection errors', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/settings')

      mockTikTokScanningService.getConfig.mockRejectedValue(new Error('Database connection failed'))

      const response = await SettingsGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Database connection failed')
    })
  })

  describe('Request Validation', () => {
    test('should validate scan settings parameters', async () => {
      const invalidSettings = {
        scanInterval: 'invalid', // Should be number
        maxVideosPerScan: -10, // Should be positive
        targetKeywords: 'not-array', // Should be array
        minViews: 'invalid' // Should be number
      }

      const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/settings', {
        method: 'PUT',
        body: JSON.stringify(invalidSettings)
      })

      const response = await SettingsPUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('validation')
    })

    test('should validate authentication parameters', async () => {
      const invalidAuth = {
        // Missing required fields
      }

      const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/authenticate', {
        method: 'POST',
        body: JSON.stringify(invalidAuth)
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('code')
    })
  })

  describe('Rate Limiting', () => {
    test('should respect TikTok API rate limits', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/scan', {
        method: 'POST'
      })

      mockTikTokScanningService.performScan.mockRejectedValue(new Error('Rate limit exceeded'))

      const response = await ScanPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Rate limit exceeded')
    })
  })

  describe('Security', () => {
    test('should sanitize error messages', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/stats')

      mockTikTokScanningService.getStats.mockRejectedValue(new Error('Database password: secret123'))

      const response = await StatsGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      // Should not expose sensitive information
      expect(data.error).not.toContain('secret123')
      expect(data.error).not.toContain('password')
    })

    test('should validate authorization', async () => {
      // This would test authorization middleware if implemented
      // For now, just ensure endpoints don't expose sensitive data without proper auth
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/tiktok/settings')

      const response = await SettingsGET(mockRequest)
      const data = await response.json()

      // Should not expose API keys or secrets in response
      expect(JSON.stringify(data)).not.toContain('client_secret')
      expect(JSON.stringify(data)).not.toContain('access_token')
    })
  })
})