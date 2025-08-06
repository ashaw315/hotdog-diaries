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

describe('Social Media API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Status Endpoints', () => {
    describe('/api/admin/social/status', () => {
      test('GET should return platform statuses for active platforms', async () => {
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
            platform: 'mastodon',
            isEnabled: true,
            isAuthenticated: true,
            lastScanTime: new Date('2024-01-01T11:30:00Z'),
            scanInterval: 45,
            contentType: 'posts',
            healthStatus: 'healthy'
          },
          {
            platform: 'flickr',
            isEnabled: false,
            isAuthenticated: false,
            lastScanTime: null,
            scanInterval: 60,
            contentType: 'images',
            healthStatus: 'disabled'
          },
          {
            platform: 'youtube',
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
        expect(data.data.platforms).toHaveLength(4)
        expect(data.data.platforms[0].platform).toBe('reddit')
        expect(data.data.platforms[2].healthStatus).toBe('disabled')
        expect(data.data.summary.totalPlatforms).toBe(4)
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
          totalPostsFound: 800,
          totalPostsApproved: 640,
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
              platform: 'mastodon',
              contentType: 'posts',
              scans: 30,
              postsFound: 200,
              postsApproved: 160,
              successRate: 80
            },
            {
              platform: 'flickr',
              contentType: 'images',
              scans: 20,
              postsFound: 100,
              postsApproved: 80,
              successRate: 80
            }
          ],
          contentDistribution: {
            posts: 87.5, // (400+160)/640 * 100
            images: 12.5, // 80/640 * 100
            videos: 0
          },
          averageSuccessRate: 80
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
        expect(data.data.platforms.mastodon.successRate).toBe(80)
        expect(data.data.platforms.flickr.averageContentPerScan).toBe(4) // 80/20
      })

      test('GET should handle custom timeRange parameter', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/admin/social/performance?timeRange=7d&includeErrors=true')

        mockSocialMediaService.getUnifiedStats.mockResolvedValue({
          totalScans: 50,
          totalPostsFound: 400,
          totalPostsApproved: 320,
          platformBreakdown: [],
          contentDistribution: { posts: 75, images: 25, videos: 0 },
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
              platform: 'mastodon',
              contentType: 'posts',
              scans: 3,
              postsFound: 30,
              postsApproved: 15,
              successRate: 50
            },
            {
              platform: 'flickr',
              contentType: 'images',
              scans: 2,
              postsFound: 20,
              postsApproved: 5,
              successRate: 25
            }
          ],
          contentDistribution: {
            posts: 83.33, // (10+15)/30 * 100
            images: 16.67, // 5/30 * 100
            videos: 0
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
              platform: 'mastodon',
              contentType: 'posts',
              scans: 20,
              postsFound: 200,
              postsApproved: 160,
              successRate: 80
            },
            {
              platform: 'flickr',
              contentType: 'images',
              scans: 10,
              postsFound: 100,
              postsApproved: 80,
              successRate: 80
            }
          ],
          contentDistribution: {
            posts: 83.33, // (240+160)/480 * 100
            images: 16.67, // 80/480 * 100
            videos: 0
          },
          averageSuccessRate: 80
        }

        mockSocialMediaService.getUnifiedStats.mockResolvedValue(mockUnifiedStats)

        const response = await DistributionGET(mockRequest)
        const data = await response.json()

        expect(mockSocialMediaService.getUnifiedStats).toHaveBeenCalled()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.contentDistribution.posts).toBe(83.33)
        expect(data.data.contentDistribution.images).toBe(16.67)
        expect(data.data.contentDistribution.videos).toBe(0)

        expect(data.data.platformEfficiency).toHaveLength(3)
        expect(data.data.platformEfficiency[0].efficiency).toBe(80)
        expect(data.data.platformEfficiency[0].contentPerScan).toBe(8) // 240/30
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
              postsApproved: 120, // 48%
              successRate: 80
            },
            {
              platform: 'mastodon',
              contentType: 'posts',
              scans: 10,
              postsFound: 100,
              postsApproved: 80, // 32%
              successRate: 80
            },
            {
              platform: 'flickr',
              contentType: 'images',
              scans: 5,
              postsFound: 50,
              postsApproved: 50, // 20%
              successRate: 100
            }
          ],
          contentDistribution: {
            posts: 80, // (120+80)/250 * 100
            images: 20, // 50/250 * 100
            videos: 0
          },
          averageSuccessRate: 86.67
        }

        mockSocialMediaService.getUnifiedStats.mockResolvedValue(mockUnifiedStats)

        const response = await DistributionGET(mockRequest)
        const data = await response.json()

        expect(data.data.contentDistribution.posts).toBe(80)
        expect(data.data.contentDistribution.images).toBe(20)
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
          platform_priority: ['reddit', 'mastodon', 'flickr', 'youtube', 'unsplash'],
          content_balancing_enabled: true,
          reddit_weight: 40,
          mastodon_weight: 25,
          flickr_weight: 15,
          youtube_weight: 15,
          unsplash_weight: 5,
          target_distribution: {
            posts: 65,
            images: 30,
            videos: 5
          },
          rate_limit_coordination: true,
          error_threshold: 5,
          intelligent_scheduling: {
            enabled: true,
            peakContentTimes: {
              reddit: ['09', '12', '15', '18', '21'],
              mastodon: ['08', '11', '14', '17', '19'],
              flickr: ['10', '13', '16', '19', '21']
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
        expect(data.data.platformPriority).toEqual(['reddit', 'mastodon', 'flickr', 'youtube', 'unsplash'])
        expect(data.data.contentBalancing.redditWeight).toBe(40)
        expect(data.data.contentBalancing.mastodonWeight).toBe(25)
        expect(data.data.contentBalancing.flickrWeight).toBe(15)
        expect(data.data.intelligentScheduling.enabled).toBe(true)
        expect(data.data.intelligentScheduling.peakContentTimes.flickr).toContain('19')
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
        expect(data.data.platformPriority).toEqual(['reddit', 'mastodon', 'flickr', 'youtube', 'unsplash'])
        expect(data.data.contentBalancing.targetDistribution.posts).toBe(65)
        expect(data.data.contentBalancing.targetDistribution.images).toBe(30)
        expect(data.data.contentBalancing.targetDistribution.videos).toBe(5)
      })

      test('PUT should update coordination settings', async () => {
        const settingsUpdate = {
          enableCoordination: true,
          scanInterval: 45,
          platformPriority: ['mastodon', 'reddit', 'flickr', 'youtube', 'unsplash'],
          contentBalancing: {
            enabled: true,
            redditWeight: 35,
            mastodonWeight: 30,
            flickrWeight: 20,
            youtubeWeight: 10,
            unsplashWeight: 5
          },
          rateLimitCoordination: true,
          errorThreshold: 3,
          intelligentScheduling: {
            enabled: true,
            peakContentTimes: {
              reddit: ['10', '13', '16', '19'],
              mastodon: ['09', '12', '15', '18'],
              flickr: ['11', '14', '17', '20']
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
            mastodonWeight: 30,
            flickrWeight: 15 // Total is 95, not 100
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
            mastodonWeight: 30,
            flickrWeight: 20 // Total is 110
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
      test('POST should trigger coordinated scan across active platforms', async () => {
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
              platform: 'mastodon',
              success: true,
              scanId: 'mastodon_scan_123',
              postsFound: 8,
              postsApproved: 6
            },
            {
              platform: 'flickr',
              success: false,
              scanId: 'flickr_scan_123',
              error: 'API key not configured'
            }
          ],
          totalPostsFound: 23,
          totalPostsApproved: 18,
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
        expect(data.data.totalPostsApproved).toBe(18)
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
        contentDistribution: { posts: 75, images: 25, videos: 0 },
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