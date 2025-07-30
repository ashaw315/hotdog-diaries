import { SocialMediaService, PlatformScanResult, UnifiedScanResult } from '@/lib/services/social-media'
import { redditScanningService } from '@/lib/services/reddit-scanning'
import { instagramScanningService } from '@/lib/services/instagram-scanning'
import { tikTokScanningService } from '@/lib/services/tiktok-scanning'

// Mock environment variables before importing services
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    REDDIT_CLIENT_ID: 'test_reddit_client_id',
    REDDIT_CLIENT_SECRET: 'test_reddit_client_secret',
    REDDIT_USERNAME: 'test_username',
    REDDIT_PASSWORD: 'test_password',
    REDDIT_USER_AGENT: 'test_user_agent',
    INSTAGRAM_CLIENT_ID: 'test_instagram_client_id',
    INSTAGRAM_CLIENT_SECRET: 'test_instagram_client_secret',
    TIKTOK_CLIENT_KEY: 'test_tiktok_client_key',
    TIKTOK_CLIENT_SECRET: 'test_tiktok_client_secret'
  }
})

afterAll(() => {
  process.env = originalEnv
})

// Mock dependencies
jest.mock('@/lib/services/reddit-scanning')
jest.mock('@/lib/services/instagram-scanning')
jest.mock('@/lib/services/tiktok-scanning')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const mockRedditScanningService = redditScanningService as jest.Mocked<typeof redditScanningService>
const mockInstagramScanningService = instagramScanningService as jest.Mocked<typeof instagramScanningService>
const mockTikTokScanningService = tikTokScanningService as jest.Mocked<typeof tikTokScanningService>

describe('SocialMediaService', () => {
  let socialMediaService: SocialMediaService

  beforeEach(() => {
    jest.clearAllMocks()
    socialMediaService = new SocialMediaService()
  })

  describe('performCoordinatedScan', () => {
    const mockRedditScanResult = {
      scanId: 'reddit_scan_123',
      startTime: new Date(),
      endTime: new Date(),
      postsFound: 15,
      postsProcessed: 12,
      postsApproved: 8,
      postsRejected: 4,
      postsFlagged: 0,
      duplicatesFound: 3,
      errors: [],
      rateLimitHit: false,
      subredditsScanned: ['hotdogs', 'food']
    }

    const mockInstagramScanResult = {
      scanId: 'instagram_scan_123',
      startTime: new Date(),
      endTime: new Date(),
      postsFound: 10,
      postsProcessed: 8,
      postsApproved: 6,
      postsRejected: 2,
      postsFlagged: 0,
      duplicatesFound: 2,
      errors: [],
      rateLimitHit: false,
      hashtagsScanned: ['hotdog', 'frankfurter']
    }

    const mockTikTokScanResult = {
      scanId: 'tiktok_scan_123',
      startTime: new Date(),
      endTime: new Date(),
      videosFound: 8,
      videosProcessed: 7,
      videosApproved: 5,
      videosRejected: 2,
      videosFlagged: 0,
      duplicatesFound: 1,
      errors: [],
      rateLimitHit: false,
      keywordsScanned: ['hotdog', 'sausage'],
      hashtagsScanned: ['foodtok', 'grilling']
    }

    beforeEach(() => {
      // Mock coordination config
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          enable_coordination: true,
          scan_interval: 45,
          platform_priority: ['reddit', 'instagram', 'tiktok'],
          content_balancing_enabled: true,
          reddit_weight: 40,
          instagram_weight: 35,
          tiktok_weight: 25,
          rate_limit_coordination: true,
          error_threshold: 5
        })
      })

      // Mock platform configs
      mockRedditScanningService.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 25,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 10,
        sortBy: 'hot',
        timeRange: 'week',
        includeNSFW: false
      })

      mockInstagramScanningService.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 60,
        maxPostsPerScan: 20,
        targetHashtags: ['hotdog'],
        minLikes: 5,
        includeStories: false
      })

      mockTikTokScanningService.getConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 120,
        maxVideosPerScan: 15,
        targetKeywords: ['hotdog', 'sausage'],
        targetHashtags: ['foodtok'],
        minViews: 100,
        maxDuration: 180,
        sortBy: 'relevance'
      })

      // Mock connection tests
      mockRedditScanningService.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanningService.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockTikTokScanningService.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
    })

    it('should perform coordinated scan successfully', async () => {
      mockRedditScanningService.performScan.mockResolvedValue(mockRedditScanResult)
      mockInstagramScanningService.performScan.mockResolvedValue(mockInstagramScanResult)
      mockTikTokScanningService.performScan.mockResolvedValue(mockTikTokScanResult)

      const result = await socialMediaService.performCoordinatedScan()

      expect(result.platforms).toHaveLength(3)
      expect(result.totalPostsFound).toBe(33) // 15 + 10 + 8
      expect(result.totalPostsApproved).toBe(19) // 8 + 6 + 5
      expect(result.successfulPlatforms).toBe(3)
      expect(result.failedPlatforms).toBe(0)
      expect(mockRedditScanningService.performScan).toHaveBeenCalledTimes(1)
      expect(mockInstagramScanningService.performScan).toHaveBeenCalledTimes(1)
      expect(mockTikTokScanningService.performScan).toHaveBeenCalledTimes(1)
    })

    it('should handle platform failures gracefully', async () => {
      mockRedditScanningService.performScan.mockResolvedValue(mockRedditScanResult)
      mockInstagramScanningService.performScan.mockRejectedValue(new Error('Instagram API error'))
      mockTikTokScanningService.performScan.mockResolvedValue(mockTikTokScanResult)

      const result = await socialMediaService.performCoordinatedScan()

      expect(result.platforms).toHaveLength(3)
      expect(result.successfulPlatforms).toBe(2)
      expect(result.failedPlatforms).toBe(1)
      expect(result.totalPostsFound).toBe(23) // Reddit + TikTok posts (15 + 8)
      expect(result.totalPostsApproved).toBe(13) // Reddit + TikTok approved (8 + 5)
    })

    it('should skip disabled platforms', async () => {
      mockRedditScanningService.getScanConfig.mockResolvedValue({
        isEnabled: false, // Disabled
        scanInterval: 30,
        maxPostsPerScan: 25,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 10,
        sortBy: 'hot',
        timeRange: 'week',
        includeNSFW: false
      })

      mockInstagramScanningService.performScan.mockResolvedValue(mockInstagramScanResult)
      mockTikTokScanningService.performScan.mockResolvedValue(mockTikTokScanResult)

      const result = await socialMediaService.performCoordinatedScan()

      expect(result.platforms).toHaveLength(2) // Instagram and TikTok
      expect(mockRedditScanningService.performScan).not.toHaveBeenCalled()
      expect(mockInstagramScanningService.performScan).toHaveBeenCalledTimes(1)
      expect(mockTikTokScanningService.performScan).toHaveBeenCalledTimes(1)
    })

    it('should skip unauthenticated platforms', async () => {
      mockRedditScanningService.testConnection.mockResolvedValue({ success: false, message: 'Not authenticated' })
      mockInstagramScanningService.performScan.mockResolvedValue(mockInstagramScanResult)
      mockTikTokScanningService.performScan.mockResolvedValue(mockTikTokScanResult)

      const result = await socialMediaService.performCoordinatedScan()

      expect(result.platforms).toHaveLength(2) // Instagram and TikTok
      expect(mockRedditScanningService.performScan).not.toHaveBeenCalled()
      expect(mockInstagramScanningService.performScan).toHaveBeenCalledTimes(1)
      expect(mockTikTokScanningService.performScan).toHaveBeenCalledTimes(1)
    })

    it('should handle scan already in progress', async () => {
      // Set scanning flag
      ;(socialMediaService as any).isCoordinatedScanRunning = true

      await expect(socialMediaService.performCoordinatedScan()).rejects.toThrow('Coordinated scan already in progress')
    })

    it('should respect platform priority order', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({
        enable_coordination: true,
        scan_interval: 45,
        platform_priority: ['tiktok', 'instagram', 'reddit'], // TikTok first
        content_balancing_enabled: true,
        reddit_weight: 40,
        instagram_weight: 35,
        tiktok_weight: 25,
        rate_limit_coordination: true,
        error_threshold: 5
      })

      let scanOrder: string[] = []
      mockRedditScanningService.performScan.mockImplementation(async () => {
        scanOrder.push('reddit')
        return mockRedditScanResult
      })
      mockInstagramScanningService.performScan.mockImplementation(async () => {
        scanOrder.push('instagram')
        return mockInstagramScanResult
      })
      mockTikTokScanningService.performScan.mockImplementation(async () => {
        scanOrder.push('tiktok')
        return mockTikTokScanResult
      })

      await socialMediaService.performCoordinatedScan()

      expect(scanOrder).toEqual(['tiktok', 'instagram', 'reddit']) // TikTok should be first
    })
  })

  describe('getPlatformStatuses', () => {
    it('should return status for all platforms', async () => {
      mockRedditScanningService.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 25,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 10,
        sortBy: 'hot',
        timeRange: 'week',
        includeNSFW: false,
        lastScanTime: new Date()
      })

      mockInstagramScanningService.getScanConfig.mockResolvedValue({
        isEnabled: false, // Disabled
        scanInterval: 60,
        maxPostsPerScan: 20,
        targetHashtags: ['hotdog'],
        minLikes: 5,
        includeStories: false
      })

      mockTikTokScanningService.getConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 120,
        maxVideosPerScan: 15,
        targetKeywords: ['hotdog'],
        targetHashtags: ['foodtok'],
        minViews: 100,
        maxDuration: 180,
        sortBy: 'relevance',
        lastScanTime: new Date()
      })

      mockRedditScanningService.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanningService.testConnection.mockResolvedValue({ success: false, message: 'Not authenticated' })
      mockTikTokScanningService.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      const statuses = await socialMediaService.getPlatformStatuses()

      expect(statuses).toHaveLength(3)
      
      const redditStatus = statuses.find(s => s.platform === 'reddit')
      expect(redditStatus).toMatchObject({
        platform: 'reddit',
        isEnabled: true,
        isAuthenticated: true,
        lastScanTime: expect.any(Date)
      })

      const instagramStatus = statuses.find(s => s.platform === 'instagram')
      expect(instagramStatus).toMatchObject({
        platform: 'instagram',
        isEnabled: false,
        isAuthenticated: false
      })

      const tiktokStatus = statuses.find(s => s.platform === 'tiktok')
      expect(tiktokStatus).toMatchObject({
        platform: 'tiktok',
        isEnabled: true,
        isAuthenticated: true,
        lastScanTime: expect.any(Date)
      })
    })

    it('should handle errors when getting platform statuses', async () => {
      mockRedditScanningService.getScanConfig.mockRejectedValue(new Error('Database error'))
      mockInstagramScanningService.getScanConfig.mockRejectedValue(new Error('Database error'))
      mockTikTokScanningService.getConfig.mockRejectedValue(new Error('Database error'))

      const statuses = await socialMediaService.getPlatformStatuses()

      // Should still return some statuses even with errors
      expect(Array.isArray(statuses)).toBe(true)
    })
  })

  describe('getUnifiedStats', () => {
    it('should return combined statistics from all platforms', async () => {
      const mockRedditStats = {
        totalScans: 10,
        totalPostsFound: 100,
        totalPostsProcessed: 90,
        totalPostsApproved: 80,
        averageScore: 25.5,
        topSubreddits: [],
        topAuthors: [],
        scanFrequency: 30,
        lastScanTime: new Date('2023-01-01'),
        successRate: 88.89
      }

      const mockInstagramStats = {
        totalScans: 5,
        totalPostsFound: 50,
        totalPostsProcessed: 45,
        totalPostsApproved: 40,
        averageLikes: 15.2,
        topHashtags: [],
        topAccounts: [],
        scanFrequency: 60,
        lastScanTime: new Date('2023-01-02'),
        successRate: 88.89
      }

      const mockTikTokStats = {
        totalScans: 3,
        totalVideosFound: 30,
        totalVideosProcessed: 25,
        totalVideosApproved: 20,
        averageViews: 2500,
        topKeywords: [],
        topHashtags: [],
        scanFrequency: 120,
        lastScanTime: new Date('2023-01-03'), // Most recent
        successRate: 80.0
      }

      mockRedditScanningService.getScanStats.mockResolvedValue(mockRedditStats)
      mockInstagramScanningService.getScanStats.mockResolvedValue(mockInstagramStats)
      mockTikTokScanningService.getStats.mockResolvedValue(mockTikTokStats)

      const unifiedStats = await socialMediaService.getUnifiedStats()

      expect(unifiedStats).toEqual({
        totalScans: 18, // 10 + 5 + 3
        totalPostsFound: 180, // 100 + 50 + 30
        totalPostsApproved: 140, // 80 + 40 + 20
        platformBreakdown: [
          {
            platform: 'reddit',
            contentType: 'posts',
            scans: 10,
            postsFound: 100,
            postsApproved: 80,
            successRate: 88.89
          },
          {
            platform: 'instagram',
            contentType: 'images',
            scans: 5,
            postsFound: 50,
            postsApproved: 40,
            successRate: 88.89
          },
          {
            platform: 'tiktok',
            contentType: 'videos',
            scans: 3,
            postsFound: 30,
            postsApproved: 20,
            successRate: 80.0
          }
        ],
        contentDistribution: {
          posts: 57.14, // 80/140 * 100
          images: 28.57, // 40/140 * 100
          videos: 14.29  // 20/140 * 100
        },
        averageSuccessRate: 85.95, // Weighted average
        lastScanTime: new Date('2023-01-03') // Most recent from TikTok
      })
    })

    it('should handle errors when getting unified stats', async () => {
      mockRedditScanningService.getScanStats.mockRejectedValue(new Error('Stats error'))
      mockInstagramScanningService.getScanStats.mockRejectedValue(new Error('Stats error'))
      mockTikTokScanningService.getStats.mockRejectedValue(new Error('Stats error'))

      const unifiedStats = await socialMediaService.getUnifiedStats()

      expect(unifiedStats).toEqual({
        totalScans: 0,
        totalPostsFound: 0,
        totalPostsApproved: 0,
        platformBreakdown: [],
        contentDistribution: {
          posts: 0,
          images: 0,
          videos: 0
        },
        averageSuccessRate: 0
      })
    })
  })

  describe('startCoordinatedScanning', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should start coordinated scanning when enabled', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          enable_coordination: true,
          scan_interval: 45,
          platform_priority: ['reddit', 'instagram', 'tiktok'],
          content_balancing_enabled: true,
          reddit_weight: 40,
          instagram_weight: 35,
          tiktok_weight: 25,
          rate_limit_coordination: true,
          error_threshold: 5
        })
      })

      mockRedditScanningService.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 25,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 10,
        sortBy: 'hot',
        timeRange: 'week',
        includeNSFW: false
      })

      mockInstagramScanningService.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 60,
        maxPostsPerScan: 20,
        targetHashtags: ['hotdog'],
        minLikes: 5,
        includeStories: false
      })

      mockTikTokScanningService.getConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 120,
        maxVideosPerScan: 15,
        targetKeywords: ['hotdog'],
        targetHashtags: ['foodtok'],
        minViews: 100,
        maxDuration: 180,
        sortBy: 'relevance'
      })

      mockRedditScanningService.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanningService.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockTikTokScanningService.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      const performScanSpy = jest.spyOn(socialMediaService, 'performCoordinatedScan').mockResolvedValue({} as UnifiedScanResult)

      await socialMediaService.startCoordinatedScanning()

      // Should perform initial scan
      expect(performScanSpy).toHaveBeenCalledTimes(1)

      // Advance timer and check periodic scanning
      jest.advanceTimersByTime(45 * 60 * 1000) // 45 minutes
      await Promise.resolve() // Allow async operations to complete

      expect(performScanSpy).toHaveBeenCalledTimes(2)
    })

    it('should not start when coordination is disabled', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          enable_coordination: false, // Disabled
          scan_interval: 45,
          platform_priority: ['reddit', 'instagram', 'tiktok'],
          content_balancing_enabled: true,
          reddit_weight: 40,
          instagram_weight: 35,
          tiktok_weight: 25,
          rate_limit_coordination: true,
          error_threshold: 5
        })
      })

      const performScanSpy = jest.spyOn(socialMediaService, 'performCoordinatedScan').mockResolvedValue({} as UnifiedScanResult)

      await socialMediaService.startCoordinatedScanning()

      expect(performScanSpy).not.toHaveBeenCalled()
    })
  })

  describe('stopCoordinatedScanning', () => {
    it('should stop coordinated scanning', async () => {
      await socialMediaService.stopCoordinatedScanning()
      // This test mainly ensures no errors are thrown
      expect(true).toBe(true)
    })
  })

  describe('platform coordination logic', () => {
    it('should coordinate rate limits between platforms', async () => {
      // This would test the rate limit coordination logic
      // For now, just ensure the coordination config is respected
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          enable_coordination: true,
          scan_interval: 45,
          platform_priority: ['reddit', 'instagram', 'tiktok'],
          content_balancing_enabled: true,
          reddit_weight: 40,
          instagram_weight: 35,
          tiktok_weight: 25,
          rate_limit_coordination: true, // This should be respected
          error_threshold: 5
        })
      })

      const config = await (socialMediaService as any).getCoordinationConfig()
      expect(config.rateLimitCoordination).toBe(true)
    })

    it('should handle content balancing configuration', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          enable_coordination: true,
          scan_interval: 45,
          platform_priority: ['reddit', 'instagram', 'tiktok'],
          content_balancing_enabled: true,
          reddit_weight: 50,
          instagram_weight: 30,
          tiktok_weight: 20,
          rate_limit_coordination: true,
          error_threshold: 5
        })
      })

      const config = await (socialMediaService as any).getCoordinationConfig()
      expect(config.contentBalancing.enabled).toBe(true)
      expect(config.contentBalancing.redditWeight).toBe(50)
      expect(config.contentBalancing.instagramWeight).toBe(30)
      expect(config.contentBalancing.tiktokWeight).toBe(20)
    })
  })
})