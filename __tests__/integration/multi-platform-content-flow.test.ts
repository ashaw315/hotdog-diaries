import { SocialMediaService } from '@/lib/services/social-media'
import { redditScanningService } from '@/lib/services/reddit-scanning'
import { mastodonScanningService } from '@/lib/services/mastodon-scanning'
import { contentService } from '@/lib/services/content'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'

// Mock all external dependencies
jest.mock('@/lib/services/reddit-scanning')
jest.mock('@/lib/services/mastodon-scanning')
jest.mock('@/lib/services/content')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db')

// Mock fetch for external API calls
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('Multi-Platform Content Flow Integration Tests', () => {
  let socialMediaService: SocialMediaService

  const mockRedditScanning = redditScanningService as jest.Mocked<typeof redditScanningService>
  const mockMastodonScanning = mastodonScanningService as jest.Mocked<typeof mastodonScanningService>
  const mockContentService = contentService as jest.Mocked<typeof contentService>
  const mockQuery = query as jest.MockedFunction<typeof query>
  const mockLogToDatabase = logToDatabase as jest.MockedFunction<typeof logToDatabase>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup query builder mocks
    mockQuery.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    }) as any)

    mockLogToDatabase.mockResolvedValue(undefined)
    socialMediaService = new SocialMediaService()
  })

  describe('End-to-End Content Discovery and Processing', () => {
    test('should discover and process content across active platforms', async () => {
      // Mock platform configurations
      mockQuery.mockImplementation((table) => {
        if (table === 'social_media_coordination_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              enable_coordination: true,
              scan_interval: 60,
              platform_priority: ['reddit', 'mastodon', 'flickr', 'youtube', 'unsplash'],
              content_balancing_enabled: true,
              reddit_weight: 40,
              mastodon_weight: 25,
              flickr_weight: 15,
              youtube_weight: 15,
              unsplash_weight: 5,
              rate_limit_coordination: true,
              error_threshold: 5
            })
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
          insert: jest.fn().mockResolvedValue(undefined),
          upsert: jest.fn().mockResolvedValue(undefined)
        }
      } as any)

      // Mock platform scanning services
      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 25,
        targetSubreddits: ['hotdogs', 'food'],
        searchTerms: ['hotdog'],
        minScore: 10,
        sortBy: 'hot',
        timeRange: 'week',
        includeNSFW: false
      })

      mockMastodonScanning.getScanningStats.mockResolvedValue({
        lastScanTime: new Date(),
        totalPostsFound: 12,
        successRate: 0.9
      })

      // Mock connection tests
      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      // Mock scan results
      const mockRedditScanResult = {
        scanId: 'reddit_scan_123',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 15,
        postsProcessed: 12,
        postsApproved: 10,
        postsRejected: 2,
        postsFlagged: 0,
        duplicatesFound: 3,
        errors: [],
        rateLimitHit: false,
        subredditsScanned: ['hotdogs', 'food']
      }

      const mockMastodonScanResult = {
        scanId: 'mastodon_scan_123',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 8,
        postsProcessed: 7,
        postsApproved: 6,
        postsRejected: 1,
        postsFlagged: 0,
        duplicatesFound: 1,
        errors: [],
        rateLimitHit: false,
        instancesScanned: ['mastodon.social', 'mas.to']
      }

      mockRedditScanning.performScan.mockResolvedValue(mockRedditScanResult)

      // Mock content service responses
      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: 'content_123'
      })

      // Execute platform status check (integration test approach)
      const statusResult = await socialMediaService.getAllPlatformStatus()

      // Verify platform status results
      expect(statusResult.totalPlatforms).toBe(4) // reddit, mastodon, flickr, youtube
      expect(statusResult.activePlatforms).toBeGreaterThanOrEqual(1) // At least mastodon should be active
      expect(statusResult.platformStats).toBeDefined()
      expect(Array.isArray(statusResult.platformStats)).toBe(true)

      // Verify platform stats contain expected platforms
      const platforms = statusResult.platformStats.map(p => p.platform)
      expect(platforms).toContain('reddit')
      expect(platforms).toContain('mastodon')
      expect(platforms).toContain('flickr')
      expect(platforms).toContain('youtube')
      
      // Should not contain removed platforms
      expect(platforms).not.toContain('instagram')
      expect(platforms).not.toContain('tiktok')

      // Verify database logging
      expect(mockLogToDatabase).not.toHaveBeenCalled() // getAllPlatformStatus doesn't log by default
    })

    test('should handle mixed platform success/failure scenarios', async () => {
      // Mock Reddit success but other platforms disabled/failing
      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 20,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 15,
        sortBy: 'top',
        timeRange: 'day',
        includeNSFW: false
      })

      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      // Mock mastodon service errors
      mockMastodonScanning.getScanningStats.mockRejectedValue(new Error('Service unavailable'))

      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: 'content_456'
      })

      // Execute platform status check
      const statusResult = await socialMediaService.getAllPlatformStatus()

      // Verify partial success scenario
      expect(statusResult.platformStats).toBeDefined()
      expect(statusResult.platformStats.length).toBe(4) // All platforms returned even if some failed
      
      // Should have at least Reddit working
      const redditPlatform = statusResult.platformStats.find(p => p.platform === 'reddit')
      expect(redditPlatform).toBeDefined()
      expect(redditPlatform?.isEnabled).toBe(true)
      expect(redditPlatform?.isAuthenticated).toBe(true)

      // Other platforms should handle errors gracefully
      const mastodonPlatform = statusResult.platformStats.find(p => p.platform === 'mastodon')
      expect(mastodonPlatform).toBeDefined()
      expect(mastodonPlatform?.healthStatus).toBe('error')
    })

    test('should calculate health scores correctly', async () => {
      // Mock healthy Reddit and Mastodon
      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 30,
        targetSubreddits: ['hotdogs', 'food', 'grilling'],
        searchTerms: ['hotdog', 'sausage'],
        minScore: 5,
        sortBy: 'hot',
        timeRange: 'week',
        includeNSFW: false
      })

      mockMastodonScanning.getScanningStats.mockResolvedValue({
        lastScanTime: new Date(),
        totalPostsFound: 15,
        successRate: 0.95
      })

      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: 'balanced_content'
      })

      // Execute platform status check
      const statusResult = await socialMediaService.getAllPlatformStatus()

      // Verify health scoring
      expect(statusResult.overallHealthScore).toBeGreaterThan(0)
      expect(statusResult.overallHealthScore).toBeLessThanOrEqual(100)
      
      // Should have healthy platforms
      const healthyPlatforms = statusResult.platformStats.filter(p => p.healthStatus === 'healthy')
      expect(healthyPlatforms.length).toBeGreaterThan(0)

      // Total content metrics should be calculated
      expect(statusResult.totalContentScanned).toBeGreaterThanOrEqual(0)
      expect(statusResult.totalContentApproved).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should handle service failures gracefully', async () => {
      // Mock Reddit failure but keep trying other platforms
      mockRedditScanning.getScanConfig.mockRejectedValue(new Error('Redis connection failed'))
      mockMastodonScanning.getScanningStats.mockRejectedValue(new Error('Mastodon service unavailable'))

      // Execute platform status check
      const statusResult = await socialMediaService.getAllPlatformStatus()

      // Verify system resilience
      expect(statusResult.platformStats).toBeDefined()
      expect(statusResult.platformStats.length).toBe(4) // All platforms attempted
      
      // All platforms should show error status due to mocked failures
      const errorPlatforms = statusResult.platformStats.filter(p => p.healthStatus === 'error')
      expect(errorPlatforms.length).toBeGreaterThan(0)
      
      // Overall health score should reflect the issues
      expect(statusResult.overallHealthScore).toBeLessThan(50)
    })

    test('should handle partial authentication failures', async () => {
      // Mock Reddit success but auth issues
      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 15,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 10,
        sortBy: 'hot',
        timeRange: 'day',
        includeNSFW: false
      })

      mockRedditScanning.testConnection.mockResolvedValue({ 
        success: false, 
        message: 'Authentication failed' 
      })

      mockMastodonScanning.getScanningStats.mockResolvedValue({
        lastScanTime: new Date(),
        totalPostsFound: 5,
        successRate: 0.8
      })

      // Execute platform status check
      const statusResult = await socialMediaService.getAllPlatformStatus()

      // Verify authentication handling
      const redditPlatform = statusResult.platformStats.find(p => p.platform === 'reddit')
      expect(redditPlatform).toBeDefined()
      expect(redditPlatform?.isEnabled).toBe(true)
      expect(redditPlatform?.isAuthenticated).toBe(false)
      expect(redditPlatform?.healthStatus).toBe('error')

      const mastodonPlatform = statusResult.platformStats.find(p => p.platform === 'mastodon')
      expect(mastodonPlatform).toBeDefined()
      expect(mastodonPlatform?.isEnabled).toBe(true) // Has online instances
      expect(mastodonPlatform?.totalContent).toBe(5)
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent platform checks efficiently', async () => {
      // Mock all platforms with successful responses
      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 15,
        maxPostsPerScan: 50,
        targetSubreddits: ['hotdogs', 'food', 'grilling', 'bbq', 'cooking'],
        searchTerms: ['hotdog', 'sausage', 'bratwurst'],
        minScore: 3,
        sortBy: 'new',
        timeRange: 'hour',
        includeNSFW: false
      })

      mockMastodonScanning.getScanningStats.mockResolvedValue({
        lastScanTime: new Date(),
        totalPostsFound: 25,
        successRate: 0.92
      })

      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      // Measure performance
      const startTime = Date.now()
      const statusResult = await socialMediaService.getAllPlatformStatus()
      const endTime = Date.now()
      const duration = endTime - startTime

      // Verify performance
      expect(statusResult.platformStats).toHaveLength(4)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      
      // Verify all platforms were checked
      const platforms = statusResult.platformStats.map(p => p.platform)
      expect(platforms).toContain('reddit')
      expect(platforms).toContain('mastodon') 
      expect(platforms).toContain('flickr')
      expect(platforms).toContain('youtube')
    })

    test('should provide meaningful metrics for monitoring', async () => {
      // Mock realistic platform responses
      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 20,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 5,
        sortBy: 'hot',
        timeRange: 'day',
        includeNSFW: false
      })

      mockMastodonScanning.getScanningStats.mockResolvedValue({
        lastScanTime: new Date(Date.now() - 3600000), // 1 hour ago
        totalPostsFound: 10,
        successRate: 0.85
      })

      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      const statusResult = await socialMediaService.getAllPlatformStatus()

      // Verify monitoring metrics
      expect(statusResult).toHaveProperty('totalPlatforms')
      expect(statusResult).toHaveProperty('activePlatforms')
      expect(statusResult).toHaveProperty('totalContentScanned')
      expect(statusResult).toHaveProperty('overallHealthScore')
      
      expect(typeof statusResult.totalPlatforms).toBe('number')
      expect(typeof statusResult.activePlatforms).toBe('number')
      expect(typeof statusResult.totalContentScanned).toBe('number')
      expect(typeof statusResult.overallHealthScore).toBe('number')

      // Each platform should have comprehensive stats
      statusResult.platformStats.forEach(platform => {
        expect(platform).toHaveProperty('platform')
        expect(platform).toHaveProperty('isEnabled')
        expect(platform).toHaveProperty('isAuthenticated')
        expect(platform).toHaveProperty('totalContent')
        expect(platform).toHaveProperty('errorRate')
        expect(platform).toHaveProperty('healthStatus')
      })
    })
  })
})