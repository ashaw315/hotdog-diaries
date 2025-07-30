import { GET as StatusGET } from '@/app/api/admin/social/status/route'
import { GET as PerformanceGET } from '@/app/api/admin/social/performance/route'
import { GET as DistributionGET } from '@/app/api/admin/social/distribution/route'
import { GET as SettingsGET, PUT as SettingsPUT } from '@/app/api/admin/social/settings/route'
import { POST as ScanAllPOST } from '@/app/api/admin/social/scan-all/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/services/social-media')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db')

const mockSocialMediaService = {
  getPlatformStatuses: jest.fn(),
  getUnifiedStats: jest.fn(),
  performCoordinatedScan: jest.fn(),
  getPerformanceMetrics: jest.fn()
}

// Mock the service imports
jest.doMock('@/lib/services/social-media', () => ({
  socialMediaService: mockSocialMediaService
}))

const mockQuery = jest.fn()
jest.doMock('@/lib/db-query-builder', () => ({
  query: mockQuery
}))

describe('Unified Social Media API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Status Endpoints', () => {
    describe('/api/admin/social/status', () => {
      test('GET should return unified platform statuses', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/status')

        const mockPlatformStatuses = [
          {
            platform: 'reddit',
            isEnabled: true,
            isAuthenticated: true,
            lastScanTime: new Date('2024-01-01T12:00:00Z'),
            scanInterval: 30,
            contentType: 'posts',
            healthStatus: 'healthy'
          },
          {
            platform: 'instagram',
            isEnabled: true,
            isAuthenticated: true,
            lastScanTime: new Date('2024-01-01T11:30:00Z'),
            scanInterval: 60,
            contentType: 'images',
            healthStatus: 'healthy'
          },
          {
            platform: 'tiktok',
            isEnabled: false,
            isAuthenticated: false,
            lastScanTime: null,
            scanInterval: 120,
            contentType: 'videos',
            healthStatus: 'disabled'
          }
        ]

        mockSocialMediaService.getPlatformStatuses.mockResolvedValue(mockPlatformStatuses)

        const response = await StatusGET(mockRequest)
        const data = await response.json()

        expect(mockSocialMediaService.getPlatformStatuses).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.platforms).toHaveLength(3)
        expect(data.data.platforms[0].platform).toBe('reddit')
        expect(data.data.platforms[2].healthStatus).toBe('disabled')
        expect(data.data.summary.totalPlatforms).toBe(3)
        expect(data.data.summary.enabledPlatforms).toBe(2)
        expect(data.data.summary.authenticatedPlatforms).toBe(2)
      })

      test('GET should handle platform status errors', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/status')

        mockSocialMediaService.getPlatformStatuses.mockRejectedValue(new Error('Database connection failed'))

        const response = await StatusGET(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Database connection failed')
      })
    })
  })

  describe('Performance Endpoints', () => {
    describe('/api/admin/social/performance', () => {
      test('GET should return performance metrics with default timeRange', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/performance')

        const mockUnifiedStats = {
          totalScans: 100,
          totalPostsFound: 1000,
          totalPostsApproved: 800,
          platformBreakdown: [
            {
              platform: 'reddit',
              contentType: 'posts',
              scans: 50,
              postsFound: 500,
              postsApproved: 400,
              successRate: 80
            },
            {
              platform: 'instagram',
              contentType: 'images',
              scans: 30,
              postsFound: 300,
              postsApproved: 250,
              successRate: 83.33
            },
            {
              platform: 'tiktok',
              contentType: 'videos',
              scans: 20,
              postsFound: 200,
              postsApproved: 150,
              successRate: 75
            }
          ],
          contentDistribution: {
            posts: 50, // 400/800 * 100
            images: 31.25, // 250/800 * 100
            videos: 18.75 // 150/800 * 100
          },
          averageSuccessRate: 79.44
        }

        mockSocialMediaService.getUnifiedStats.mockResolvedValue(mockUnifiedStats)

        // Mock database queries for scan results
        mockQuery.mockImplementation((table) => ({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([
            {
              end_time: new Date(Date.now() - 300000),
              posts_found: 10,
              posts_approved: 8,
              errors: []
            }
          ])
        }))

        const response = await PerformanceGET(mockRequest)
        const data = await response.json()

        expect(mockSocialMediaService.getUnifiedStats).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.timeRange).toBe('24h')
        expect(data.data.overview.totalScans).toBe(100)
        expect(data.data.platforms.reddit.totalScans).toBe(50)
        expect(data.data.platforms.instagram.successRate).toBe(83)
        expect(data.data.platforms.tiktok.averageContentPerScan).toBe(8) // 150/20 (rounded)
      })

      test('GET should handle custom timeRange parameter', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/performance?timeRange=7d&includeErrors=true')

        mockSocialMediaService.getUnifiedStats.mockResolvedValue({
          totalScans: 50,
          totalPostsFound: 500,
          totalPostsApproved: 400,
          platformBreakdown: [],
          contentDistribution: { posts: 60, images: 25, videos: 15 },
          averageSuccessRate: 80
        })

        mockQuery.mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([])
        }))

        const response = await PerformanceGET(mockRequest)
        const data = await response.json()

        expect(data.data.timeRange).toBe('7d')
        expect(data.data.trends.errorFrequency).not.toBeNull()
      })

      test('GET should generate performance recommendations', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/performance')

        const mockUnifiedStats = {
          totalScans: 10,
          totalPostsFound: 100,
          totalPostsApproved: 30, // Low success rate
          platformBreakdown: [
            {
              platform: 'reddit',
              contentType: 'posts',
              scans: 5,
              postsFound: 50,
              postsApproved: 10,
              successRate: 20 // Very low
            },
            {
              platform: 'instagram',
              contentType: 'images',
              scans: 3,
              postsFound: 30,
              postsApproved: 15,
              successRate: 50
            },
            {
              platform: 'tiktok',
              contentType: 'videos',
              scans: 2,
              postsFound: 20,
              postsApproved: 5,
              successRate: 25
            }
          ],
          contentDistribution: {
            posts: 33.33, // Below target of 40%
            images: 50, // Above target of 35%
            videos: 16.67 // Below target of 25%
          },
          averageSuccessRate: 31.67
        }

        mockSocialMediaService.getUnifiedStats.mockResolvedValue(mockUnifiedStats)

        mockQuery.mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([
            {
              end_time: new Date(Date.now() - 7200000), // 2 hours ago - stale
              posts_found: 5,
              posts_approved: 1,
              errors: ['API timeout']
            }
          ])
        }))

        const response = await PerformanceGET(mockRequest)
        const data = await response.json()

        expect(data.data.recommendations).toContainEqual(
          expect.objectContaining({
            type: 'content_balance',
            priority: 'medium',
            message: expect.stringContaining('Text post content is low')
          })
        )

        expect(data.data.recommendations).toContainEqual(
          expect.objectContaining({
            type: 'performance',
            priority: 'high',
            message: expect.stringContaining('success rate is low')
          })
        )

        expect(data.data.recommendations).toContainEqual(
          expect.objectContaining({
            type: 'activity',
            priority: 'high',
            message: expect.stringContaining('No recent scanning activity')
          })
        )
      })
    })
  })

  describe('Distribution Endpoints', () => {
    describe('/api/admin/social/distribution', () => {
      test('GET should return content distribution analysis', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/distribution')

        const mockUnifiedStats = {
          totalScans: 60,
          totalPostsFound: 600,
          totalPostsApproved: 480,
          platformBreakdown: [
            {
              platform: 'reddit',
              contentType: 'posts',
              scans: 30,
              postsFound: 300,
              postsApproved: 240,
              successRate: 80
            },
            {
              platform: 'instagram',
              contentType: 'images',
              scans: 20,
              postsFound: 200,
              postsApproved: 160,
              successRate: 80
            },
            {
              platform: 'tiktok',
              contentType: 'videos',
              scans: 10,
              postsFound: 100,
              postsApproved: 80,
              successRate: 80
            }
          ],
          contentDistribution: {
            posts: 50, // 240/480 * 100
            images: 33.33, // 160/480 * 100
            videos: 16.67 // 80/480 * 100
          },
          averageSuccessRate: 80
        }

        mockSocialMediaService.getUnifiedStats.mockResolvedValue(mockUnifiedStats)

        const response = await DistributionGET(mockRequest)
        const data = await response.json()

        expect(mockSocialMediaService.getUnifiedStats).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.contentDistribution.posts).toBe(50)
        expect(data.data.contentDistribution.images).toBe(33.33)
        expect(data.data.contentDistribution.videos).toBe(16.67)

        expect(data.data.contentBalance.isBalanced).toBe(false) // Posts over target, videos under

        expect(data.data.platformEfficiency).toHaveLength(3)
        expect(data.data.platformEfficiency[0].efficiency).toBe(80)
        expect(data.data.platformEfficiency[0].contentPerScan).toBe(8) // 240/30

        expect(data.data.contentBalance.recommendations).toContainEqual(
          expect.stringContaining('Consider increasing TikTok scanning frequency to boost video content')
        )
      })

      test('GET should handle balanced content distribution', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/distribution')

        const mockUnifiedStats = {
          totalScans: 30,
          totalPostsFound: 300,
          totalPostsApproved: 250,
          platformBreakdown: [
            {
              platform: 'reddit',
              contentType: 'posts',
              scans: 15,
              postsFound: 150,
              postsApproved: 100, // 40%
              successRate: 66.67
            },
            {
              platform: 'instagram',
              contentType: 'images',
              scans: 10,
              postsFound: 100,
              postsApproved: 87, // 34.8% (close to 35%)
              successRate: 87
            },
            {
              platform: 'tiktok',
              contentType: 'videos',
              scans: 5,
              postsFound: 50,
              postsApproved: 63, // 25.2% (close to 25%)
              successRate: 126 // This would be capped at 100 in real implementation
            }
          ],
          contentDistribution: {
            posts: 40,
            images: 34.8,
            videos: 25.2
          },
          averageSuccessRate: 83.22
        }

        mockSocialMediaService.getUnifiedStats.mockResolvedValue(mockUnifiedStats)

        const response = await DistributionGET(mockRequest)
        const data = await response.json()

        expect(data.data.contentBalance.isBalanced).toBe(true) // Within 10% tolerance
        expect(data.data.contentBalance.recommendations).toHaveLength(0) // No recommendations needed
      })
    })
  })

  describe('Settings Endpoints', () => {
    describe('/api/admin/social/settings', () => {
      test('GET should return coordination settings', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/settings')

        const mockConfig = {
          enable_coordination: true,
          scan_interval: 60,
          platform_priority: ['reddit', 'instagram', 'tiktok'],
          content_balancing_enabled: true,
          reddit_weight: 40,
          instagram_weight: 35,
          tiktok_weight: 25,
          target_distribution: {
            posts: 40,
            images: 35,
            videos: 25
          },
          rate_limit_coordination: true,
          error_threshold: 5,
          intelligent_scheduling: {
            enabled: true,
            peakContentTimes: {
              reddit: ['09', '12', '15', '18', '21'],
              instagram: ['08', '11', '14', '17', '19'],
              tiktok: ['16', '18', '20', '21', '22']
            },
            adaptiveIntervals: true
          }
        }

        mockQuery.mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockConfig)
        }))

        const response = await SettingsGET(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.enableCoordination).toBe(true)
        expect(data.data.scanInterval).toBe(60)
        expect(data.data.platformPriority).toEqual(['reddit', 'instagram', 'tiktok'])
        expect(data.data.contentBalancing.redditWeight).toBe(40)
        expect(data.data.contentBalancing.instagramWeight).toBe(35)
        expect(data.data.contentBalancing.tiktokWeight).toBe(25)
        expect(data.data.intelligentScheduling.enabled).toBe(true)
        expect(data.data.intelligentScheduling.peakContentTimes.tiktok).toContain('20')
      })

      test('GET should return default settings when none exist', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/settings')

        mockQuery.mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null)
        }))

        const response = await SettingsGET(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.enableCoordination).toBe(true)
        expect(data.data.scanInterval).toBe(60)
        expect(data.data.platformPriority).toEqual(['reddit', 'instagram', 'tiktok'])
        expect(data.data.contentBalancing.targetDistribution.posts).toBe(40)
        expect(data.data.contentBalancing.targetDistribution.images).toBe(35)
        expect(data.data.contentBalancing.targetDistribution.videos).toBe(25)
      })

      test('PUT should update coordination settings', async () => {
        const settingsUpdate = {
          enableCoordination: true,
          scanInterval: 45,
          platformPriority: ['tiktok', 'instagram', 'reddit'],
          contentBalancing: {
            enabled: true,
            redditWeight: 35,
            instagramWeight: 40,
            tiktokWeight: 25
          },
          rateLimitCoordination: true,
          errorThreshold: 3,
          intelligentScheduling: {
            enabled: true,
            peakContentTimes: {
              reddit: ['10', '13', '16', '19'],
              instagram: ['09', '12', '15', '18'],
              tiktok: ['17', '19', '21', '22']
            },
            adaptiveIntervals: false
          }
        }

        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/settings', {
          method: 'PUT',
          body: JSON.stringify(settingsUpdate)
        })

        mockQuery.mockImplementation(() => ({
          upsert: jest.fn().mockResolvedValue()
        }))

        const response = await SettingsPUT(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.message).toContain('updated successfully')
      })

      test('PUT should validate settings', async () => {
        const invalidSettings = {
          scanInterval: 10, // Too low
          platformPriority: ['invalid_platform'],
          contentBalancing: {
            redditWeight: 50,
            instagramWeight: 30,
            tiktokWeight: 15 // Total is 95, not 100
          },
          errorThreshold: -1 // Invalid
        }

        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/settings', {
          method: 'PUT',
          body: JSON.stringify(invalidSettings)
        })

        const response = await SettingsPUT(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.error).toContain('scanInterval must be a number >= 15 minutes')
      })

      test('PUT should validate platform weights sum to 100', async () => {
        const invalidWeights = {
          contentBalancing: {
            redditWeight: 60,
            instagramWeight: 30,
            tiktokWeight: 20 // Total is 110
          }
        }

        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/settings', {
          method: 'PUT',
          body: JSON.stringify(invalidWeights)
        })

        const response = await SettingsPUT(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Platform weights must sum to 100')
      })
    })
  })

  describe('Scan Endpoints', () => {
    describe('/api/admin/social/scan-all', () => {
      test('POST should trigger coordinated scan across all platforms', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/scan-all', {
          method: 'POST'
        })

        const mockScanResult = {
          scanId: 'unified_scan_123',
          startTime: new Date('2024-01-01T12:00:00Z'),
          endTime: new Date('2024-01-01T12:05:00Z'),
          platforms: [
            {
              platform: 'reddit',
              success: true,
              scanId: 'reddit_scan_123',
              postsFound: 15,
              postsApproved: 12
            },
            {
              platform: 'instagram',
              success: true,
              scanId: 'instagram_scan_123',
              postsFound: 10,
              postsApproved: 8
            },
            {
              platform: 'tiktok',
              success: false,
              scanId: 'tiktok_scan_123',
              error: 'Authentication failed'
            }
          ],
          totalPostsFound: 25,
          totalPostsApproved: 20,
          successfulPlatforms: 2,
          failedPlatforms: 1
        }

        mockSocialMediaService.performCoordinatedScan.mockResolvedValue(mockScanResult)

        const response = await ScanAllPOST(mockRequest)
        const data = await response.json()

        expect(mockSocialMediaService.performCoordinatedScan).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.scanId).toBe('unified_scan_123')
        expect(data.data.totalPostsApproved).toBe(20)
        expect(data.data.successfulPlatforms).toBe(2)
        expect(data.data.failedPlatforms).toBe(1)
        expect(data.data.duration).toBeGreaterThan(0)
        expect(data.data.averageSuccessRate).toBe(66.67) // 2/3 * 100
      })

      test('POST should handle scan already in progress', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/scan-all', {
          method: 'POST'
        })

        mockSocialMediaService.performCoordinatedScan.mockRejectedValue(
          new Error('Coordinated scan already in progress')
        )

        const response = await ScanAllPOST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(409)
        expect(data.success).toBe(false)
        expect(data.error).toContain('already in progress')
      })

      test('POST should handle complete scan failure', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/scan-all', {
          method: 'POST'
        })

        mockSocialMediaService.performCoordinatedScan.mockRejectedValue(
          new Error('All platforms failed to authenticate')
        )

        const response = await ScanAllPOST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('All platforms failed')
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle database connection failures', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/status')

      mockSocialMediaService.getPlatformStatuses.mockRejectedValue(
        new Error('Database connection timeout')
      )

      const response = await StatusGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Database connection timeout')
    })

    test('should handle malformed JSON in request body', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/settings', {
        method: 'PUT',
        body: '{invalid json'
      })

      const response = await SettingsPUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('JSON')
    })

    test('should sanitize error messages for security', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/status')

      mockSocialMediaService.getPlatformStatuses.mockRejectedValue(
        new Error('Database password: secret123 failed')
      )

      const response = await StatusGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      // Should not expose sensitive information
      expect(data.error).not.toContain('secret123')
      expect(data.error).not.toContain('password')
    })
  })

  describe('Query Parameter Validation', () => {
    test('should validate timeRange parameter', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/performance?timeRange=invalid')

      mockSocialMediaService.getUnifiedStats.mockResolvedValue({
        totalScans: 0,
        totalPostsFound: 0,
        totalPostsApproved: 0,
        platformBreakdown: [],
        contentDistribution: { posts: 0, images: 0, videos: 0 },
        averageSuccessRate: 0
      })

      mockQuery.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      }))

      const response = await PerformanceGET(mockRequest)
      const data = await response.json()

      // Should default to 24h when invalid timeRange provided
      expect(data.data.timeRange).toBe('24h')
    })

    test('should handle includeErrors parameter', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/performance?includeErrors=false')

      mockSocialMediaService.getUnifiedStats.mockResolvedValue({
        totalScans: 10,
        totalPostsFound: 100,
        totalPostsApproved: 80,
        platformBreakdown: [],
        contentDistribution: { posts: 50, images: 30, videos: 20 },
        averageSuccessRate: 80
      })

      mockQuery.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      }))

      const response = await PerformanceGET(mockRequest)
      const data = await response.json()

      expect(data.data.trends.errorFrequency).toBeNull()
    })
  })
})