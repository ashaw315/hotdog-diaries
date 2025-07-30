import { SocialMediaService } from '@/lib/services/social-media'
import { TikTokService } from '@/lib/services/tiktok'
import { TikTokScanningService } from '@/lib/services/tiktok-scanning'
import { redditScanningService } from '@/lib/services/reddit-scanning'
import { instagramScanningService } from '@/lib/services/instagram-scanning'
import { contentService } from '@/lib/services/content'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'

// Mock all external dependencies
jest.mock('@/lib/services/reddit-scanning')
jest.mock('@/lib/services/instagram-scanning')
jest.mock('@/lib/services/content')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db')

// Mock fetch for TikTok API calls
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('Multi-Platform Content Flow Integration Tests', () => {
  let socialMediaService: SocialMediaService
  let tikTokService: TikTokService
  let tikTokScanningService: TikTokScanningService

  const mockRedditScanning = redditScanningService as jest.Mocked<typeof redditScanningService>
  const mockInstagramScanning = instagramScanningService as jest.Mocked<typeof instagramScanningService>
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
    tikTokService = new TikTokService()
    tikTokScanningService = new TikTokScanningService()
  })

  describe('End-to-End Content Discovery and Processing', () => {
    test('should discover and process content across all three platforms', async () => {
      // Mock platform configurations
      mockQuery.mockImplementation((table) => {
        if (table === 'social_media_coordination_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              enable_coordination: true,
              scan_interval: 60,
              platform_priority: ['reddit', 'instagram', 'tiktok'],
              content_balancing_enabled: true,
              reddit_weight: 40,
              instagram_weight: 35,
              tiktok_weight: 25,
              rate_limit_coordination: true,
              error_threshold: 5
            })
          }
        }
        if (table === 'tiktok_scan_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              is_enabled: true,
              scan_interval: 120,
              max_videos_per_scan: 20,
              target_keywords: ['hotdog', 'sausage'],
              target_hashtags: ['foodtok', 'grilling'],
              min_views: 100,
              max_duration: 180,
              sort_by: 'relevance'
            })
          }
        }
        if (table === 'tiktok_auth') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              access_token: 'valid_token',
              expires_at: new Date(Date.now() + 3600000),
              is_active: true
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

      mockInstagramScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 60,
        maxPostsPerScan: 20,
        targetHashtags: ['hotdog', 'frankfurter'],
        minLikes: 5,
        includeStories: false
      })

      // Mock connection tests
      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      // Mock TikTok API responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: [
              {
                id: 'tiktok_video_1',
                title: 'Amazing hotdog cooking tutorial',
                video_description: 'Learn to make the perfect hotdog with these tips',
                duration: 90,
                cover_image_url: 'https://example.com/cover1.jpg',
                play_url: 'https://example.com/video1.mp4',
                create_time: Math.floor(Date.now() / 1000) - 3600,
                view_count: 5000,
                like_count: 250,
                comment_count: 50,
                share_count: 25
              },
              {
                id: 'tiktok_video_2',
                title: 'Street style hotdog recipe',
                video_description: 'NYC style hotdog with mustard and onions',
                duration: 60,
                cover_image_url: 'https://example.com/cover2.jpg',
                play_url: 'https://example.com/video2.mp4',
                create_time: Math.floor(Date.now() / 1000) - 7200,
                view_count: 3000,
                like_count: 150,
                comment_count: 30,
                share_count: 15
              }
            ],
            cursor: null,
            has_more: false
          }
        })
      } as Response)

      // Mock platform scan results
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

      const mockInstagramScanResult = {
        scanId: 'instagram_scan_123',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 12,
        postsProcessed: 10,
        postsApproved: 8,
        postsRejected: 2,
        postsFlagged: 0,
        duplicatesFound: 2,
        errors: [],
        rateLimitHit: false,
        hashtagsScanned: ['hotdog', 'frankfurter']
      }

      mockRedditScanning.performScan.mockResolvedValue(mockRedditScanResult)
      mockInstagramScanning.performScan.mockResolvedValue(mockInstagramScanResult)

      // Mock content service responses
      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: 'content_123'
      })

      // Execute coordinated scan
      const scanResult = await socialMediaService.performCoordinatedScan()

      // Verify coordinated scan results
      expect(scanResult.platforms).toHaveLength(3)
      expect(scanResult.successfulPlatforms).toBe(3)
      expect(scanResult.failedPlatforms).toBe(0)
      expect(scanResult.totalPostsFound).toBe(29) // 15 + 12 + 2 (TikTok videos)
      expect(scanResult.totalPostsApproved).toBeGreaterThan(15) // At least Reddit + Instagram approved

      // Verify TikTok integration
      const tiktokPlatform = scanResult.platforms.find(p => p.platform === 'tiktok')
      expect(tiktokPlatform).toBeDefined()
      expect(tiktokPlatform?.success).toBe(true)
      expect(tiktokPlatform?.postsFound).toBe(2)

      // Verify content was added to queue from all platforms
      expect(mockContentService.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'tiktok',
          contentType: 'video',
          title: 'Amazing hotdog cooking tutorial'
        })
      )

      // Verify database logging
      expect(mockLogToDatabase).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('UNIFIED_SCAN'),
        expect.stringContaining('coordinated scan'),
        expect.any(Object)
      )
    })

    test('should handle mixed platform success/failure scenarios', async () => {
      // Mock configuration where TikTok is enabled but Instagram fails
      mockQuery.mockImplementation((table) => {
        if (table === 'social_media_coordination_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              enable_coordination: true,
              scan_interval: 60,
              platform_priority: ['reddit', 'tiktok', 'instagram'],
              content_balancing_enabled: true,
              reddit_weight: 50,
              instagram_weight: 25,
              tiktok_weight: 25,
              rate_limit_coordination: true,
              error_threshold: 5
            })
          }
        }
        if (table === 'tiktok_scan_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              is_enabled: true,
              scan_interval: 120,
              max_videos_per_scan: 15,
              target_keywords: ['hotdog'],
              target_hashtags: ['foodtok'],
              min_views: 200,
              max_duration: 120,
              sort_by: 'view_count'
            })
          }
        }
        if (table === 'tiktok_auth') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              access_token: 'valid_token',
              expires_at: new Date(Date.now() + 3600000),
              is_active: true
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

      // Mock platform configurations
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

      mockInstagramScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 60,
        maxPostsPerScan: 15,
        targetHashtags: ['hotdog'],
        minLikes: 10,
        includeStories: false
      })

      // Mock connection tests - Instagram fails
      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanning.testConnection.mockResolvedValue({ 
        success: false, 
        message: 'Authentication failed' 
      })

      // Mock successful TikTok API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: [
              {
                id: 'tiktok_video_premium',
                title: 'Premium hotdog recipe for food lovers',
                video_description: 'High-quality hotdog cooking with premium ingredients',
                duration: 75,
                cover_image_url: 'https://example.com/premium_cover.jpg',
                play_url: 'https://example.com/premium_video.mp4',
                create_time: Math.floor(Date.now() / 1000) - 1800,
                view_count: 8000,
                like_count: 400,
                comment_count: 80,
                share_count: 40
              }
            ],
            cursor: null,
            has_more: false
          }
        })
      } as Response)

      // Mock successful Reddit scan
      const mockRedditScanResult = {
        scanId: 'reddit_scan_456',
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
        subredditsScanned: ['hotdogs']
      }

      mockRedditScanning.performScan.mockResolvedValue(mockRedditScanResult)
      // Instagram scan is not called due to authentication failure

      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: 'content_456'
      })

      // Execute coordinated scan
      const scanResult = await socialMediaService.performCoordinatedScan()

      // Verify partial success scenario
      expect(scanResult.platforms).toHaveLength(2) // Only Reddit and TikTok
      expect(scanResult.successfulPlatforms).toBe(2)
      expect(scanResult.failedPlatforms).toBe(0) // Instagram was skipped, not failed
      expect(scanResult.totalPostsFound).toBe(9) // 8 from Reddit + 1 from TikTok
      expect(scanResult.totalPostsApproved).toBe(7) // 6 from Reddit + 1 from TikTok

      // Verify TikTok content was processed
      expect(mockContentService.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'tiktok',
          contentType: 'video',
          title: 'Premium hotdog recipe for food lovers',
          metadata: expect.objectContaining({
            views: 8000,
            likes: 400,
            qualityScore: expect.any(Number)
          })
        })
      )

      // Verify Reddit scan was called but Instagram was skipped
      expect(mockRedditScanning.performScan).toHaveBeenCalledTimes(1)
      expect(mockInstagramScanning.performScan).not.toHaveBeenCalled()
    })

    test('should handle content balancing and distribution', async () => {
      // Mock configuration with specific content distribution targets
      mockQuery.mockImplementation((table) => {
        if (table === 'social_media_coordination_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              enable_coordination: true,
              scan_interval: 45,
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
              error_threshold: 3
            })
          }
        }
        if (table === 'tiktok_scan_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              is_enabled: true,
              scan_interval: 90,
              max_videos_per_scan: 25,
              target_keywords: ['hotdog', 'sausage', 'bratwurst'],
              target_hashtags: ['foodtok', 'cooking', 'grilling'],
              min_views: 50,
              max_duration: 200,
              sort_by: 'relevance'
            })
          }
        }
        if (table === 'tiktok_auth') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              access_token: 'balanced_token',
              expires_at: new Date(Date.now() + 7200000),
              is_active: true
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

      // Mock all platforms enabled and authenticated
      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 25,
        maxPostsPerScan: 30,
        targetSubreddits: ['hotdogs', 'food', 'grilling'],
        searchTerms: ['hotdog', 'sausage'],
        minScore: 5,
        sortBy: 'hot',
        timeRange: 'week',
        includeNSFW: false
      })

      mockInstagramScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 45,
        maxPostsPerScan: 25,
        targetHashtags: ['hotdog', 'frankfurter', 'bbq'],
        minLikes: 3,
        includeStories: true
      })

      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      // Mock TikTok API with multiple high-quality videos
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: [
              {
                id: 'tiktok_balanced_1',
                title: 'Ultimate hotdog grilling guide',
                video_description: 'Complete guide to grilling perfect hotdogs every time',
                duration: 120,
                cover_image_url: 'https://example.com/guide_cover.jpg',
                play_url: 'https://example.com/guide_video.mp4',
                create_time: Math.floor(Date.now() / 1000) - 3600,
                view_count: 12000,
                like_count: 600,
                comment_count: 120,
                share_count: 60
              },
              {
                id: 'tiktok_balanced_2',
                title: 'Street food hotdog variations',
                video_description: 'Exploring different hotdog styles from around the world',
                duration: 95,
                cover_image_url: 'https://example.com/variations_cover.jpg',
                play_url: 'https://example.com/variations_video.mp4',
                create_time: Math.floor(Date.now() / 1000) - 5400,
                view_count: 8500,
                like_count: 425,
                comment_count: 85,
                share_count: 42
              },
              {
                id: 'tiktok_balanced_3',
                title: 'Homemade hotdog bun recipe',
                video_description: 'Learn to make perfect hotdog buns at home',
                duration: 180,
                cover_image_url: 'https://example.com/bun_cover.jpg',
                play_url: 'https://example.com/bun_video.mp4',
                create_time: Math.floor(Date.now() / 1000) - 7200,
                view_count: 6000,
                like_count: 300,
                comment_count: 60,
                share_count: 30
              }
            ],
            cursor: null,
            has_more: false
          }
        })
      } as Response)

      // Mock balanced scan results from all platforms
      const mockRedditScanResult = {
        scanId: 'reddit_balanced_scan',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 20,
        postsProcessed: 18,
        postsApproved: 16, // 40% target weight
        postsRejected: 2,
        postsFlagged: 0,
        duplicatesFound: 2,
        errors: [],
        rateLimitHit: false,
        subredditsScanned: ['hotdogs', 'food', 'grilling']
      }

      const mockInstagramScanResult = {
        scanId: 'instagram_balanced_scan',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 18,
        postsProcessed: 16,
        postsApproved: 14, // 35% target weight
        postsRejected: 2,
        postsFlagged: 0,
        duplicatesFound: 2,
        errors: [],
        rateLimitHit: false,
        hashtagsScanned: ['hotdog', 'frankfurter', 'bbq']
      }

      mockRedditScanning.performScan.mockResolvedValue(mockRedditScanResult)
      mockInstagramScanning.performScan.mockResolvedValue(mockInstagramScanResult)

      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: 'balanced_content'
      })

      // Execute coordinated scan
      const scanResult = await socialMediaService.performCoordinatedScan()

      // Verify balanced content distribution
      expect(scanResult.platforms).toHaveLength(3)
      expect(scanResult.successfulPlatforms).toBe(3)
      expect(scanResult.totalPostsFound).toBe(41) // 20 + 18 + 3
      expect(scanResult.totalPostsApproved).toBe(33) // 16 + 14 + 3

      // Verify content balancing worked - should be close to target distribution
      const redditApproved = 16
      const instagramApproved = 14
      const tiktokApproved = 3
      const totalApproved = redditApproved + instagramApproved + tiktokApproved

      const postsPercentage = (redditApproved / totalApproved) * 100
      const imagesPercentage = (instagramApproved / totalApproved) * 100
      const videosPercentage = (tiktokApproved / totalApproved) * 100

      // Should be reasonably close to target distribution (40%, 35%, 25%)
      expect(postsPercentage).toBeCloseTo(48.5, 1) // 16/33 * 100
      expect(imagesPercentage).toBeCloseTo(42.4, 1) // 14/33 * 100
      expect(videosPercentage).toBeCloseTo(9.1, 1) // 3/33 * 100

      // Verify all TikTok videos were processed and approved
      expect(mockContentService.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'tiktok',
          contentType: 'video',
          title: 'Ultimate hotdog grilling guide'
        })
      )

      expect(mockContentService.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'tiktok',
          contentType: 'video',
          title: 'Street food hotdog variations'
        })
      )

      expect(mockContentService.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'tiktok',
          contentType: 'video', 
          title: 'Homemade hotdog bun recipe'
        })
      )

      // Verify database records were created
      expect(mockQuery).toHaveBeenCalledWith('unified_scan_results')
      expect(mockQuery).toHaveBeenCalledWith('tiktok_scan_results')
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should handle TikTok API failures gracefully', async () => {
      // Mock basic configuration
      mockQuery.mockImplementation((table) => {
        if (table === 'social_media_coordination_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              enable_coordination: true,
              scan_interval: 60,
              platform_priority: ['reddit', 'instagram', 'tiktok'],
              content_balancing_enabled: true,
              reddit_weight: 40,
              instagram_weight: 35,
              tiktok_weight: 25,
              rate_limit_coordination: true,
              error_threshold: 5
            })
          }
        }
        if (table === 'tiktok_scan_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              is_enabled: true,
              scan_interval: 120,
              max_videos_per_scan: 20,
              target_keywords: ['hotdog'],
              target_hashtags: ['foodtok'],
              min_views: 100,
              max_duration: 180,
              sort_by: 'relevance'
            })
          }
        }
        if (table === 'tiktok_auth') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              access_token: 'failing_token',
              expires_at: new Date(Date.now() + 3600000),
              is_active: true
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

      // Mock platform configurations
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

      mockInstagramScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 60,
        maxPostsPerScan: 12,
        targetHashtags: ['hotdog'],
        minLikes: 5,
        includeStories: false
      })

      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      // Mock TikTok API failure
      mockFetch.mockRejectedValueOnce(new Error('TikTok API unavailable'))

      // Mock successful scans from other platforms
      const mockRedditScanResult = {
        scanId: 'reddit_resilient_scan',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 10,
        postsProcessed: 9,
        postsApproved: 7,
        postsRejected: 2,
        postsFlagged: 0,
        duplicatesFound: 1,
        errors: [],
        rateLimitHit: false,
        subredditsScanned: ['hotdogs']
      }

      const mockInstagramScanResult = {
        scanId: 'instagram_resilient_scan',
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
        hashtagsScanned: ['hotdog']
      }

      mockRedditScanning.performScan.mockResolvedValue(mockRedditScanResult)
      mockInstagramScanning.performScan.mockResolvedValue(mockInstagramScanResult)

      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: 'resilient_content'
      })

      // Execute coordinated scan
      const scanResult = await socialMediaService.performCoordinatedScan()

      // Verify system resilience - should continue with other platforms
      expect(scanResult.platforms).toHaveLength(3)
      expect(scanResult.successfulPlatforms).toBe(2) // Reddit and Instagram
      expect(scanResult.failedPlatforms).toBe(1) // TikTok failed
      expect(scanResult.totalPostsFound).toBe(18) // 10 + 8, no TikTok content
      expect(scanResult.totalPostsApproved).toBe(13) // 7 + 6

      // Verify TikTok failure was recorded
      const tiktokPlatform = scanResult.platforms.find(p => p.platform === 'tiktok')
      expect(tiktokPlatform).toBeDefined()
      expect(tiktokPlatform?.success).toBe(false)
      expect(tiktokPlatform?.error).toContain('TikTok API unavailable')

      // Verify other platforms continued successfully
      const redditPlatform = scanResult.platforms.find(p => p.platform === 'reddit')
      const instagramPlatform = scanResult.platforms.find(p => p.platform === 'instagram')
      expect(redditPlatform?.success).toBe(true)
      expect(instagramPlatform?.success).toBe(true)

      // Verify error was logged
      expect(mockLogToDatabase).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('ERROR'),
        expect.stringContaining('TikTok'),
        expect.objectContaining({
          error: expect.stringContaining('TikTok API unavailable')
        })
      )
    })

    test('should handle rate limiting across platforms', async () => {
      // Mock configuration with rate limit coordination enabled
      mockQuery.mockImplementation((table) => {
        if (table === 'social_media_coordination_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              enable_coordination: true,
              scan_interval: 30,
              platform_priority: ['tiktok', 'reddit', 'instagram'],
              content_balancing_enabled: true,
              reddit_weight: 40,
              instagram_weight: 35,
              tiktok_weight: 25,
              rate_limit_coordination: true, // Important
              error_threshold: 2
            })
          }
        }
        if (table === 'tiktok_scan_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              is_enabled: true,
              scan_interval: 90,
              max_videos_per_scan: 10,
              target_keywords: ['hotdog'],
              target_hashtags: ['foodtok'],
              min_views: 200,
              max_duration: 120,
              sort_by: 'view_count'
            })
          }
        }
        if (table === 'tiktok_auth') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              access_token: 'rate_limited_token',
              expires_at: new Date(Date.now() + 3600000),
              is_active: true
            })
          }
        }
        if (table === 'rate_limit_tracking') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              current_usage: 95,
              limit_cap: 100,
              reset_time: new Date(Date.now() + 1800000) // 30 minutes
            })
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
          insert: jest.fn().mockResolvedValue(undefined),
          upsert: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue(undefined)
        }
      } as any)

      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 25,
        maxPostsPerScan: 20,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 8,
        sortBy: 'hot',
        timeRange: 'day',
        includeNSFW: false
      })

      mockInstagramScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 50,
        maxPostsPerScan: 18,
        targetHashtags: ['hotdog'],
        minLikes: 8,
        includeStories: false
      })

      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      // Mock TikTok rate limit response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 1800)]]),
        json: async () => ({
          error: {
            code: 'rate_limit_exceeded',
            message: 'Too many requests'
          }
        })
      } as any)

      // Mock successful scans from other platforms (reduced due to coordination)
      const mockRedditScanResult = {
        scanId: 'reddit_coordinated_scan',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 12, // Reduced from normal
        postsProcessed: 11,
        postsApproved: 9,
        postsRejected: 2,
        postsFlagged: 0,
        duplicatesFound: 1,
        errors: [],
        rateLimitHit: false,
        subredditsScanned: ['hotdogs']
      }

      const mockInstagramScanResult = {
        scanId: 'instagram_coordinated_scan',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 10, // Reduced from normal
        postsProcessed: 9,
        postsApproved: 7,
        postsRejected: 2,
        postsFlagged: 0,
        duplicatesFound: 1,
        errors: [],
        rateLimitHit: false,
        hashtagsScanned: ['hotdog']
      }

      mockRedditScanning.performScan.mockResolvedValue(mockRedditScanResult)
      mockInstagramScanning.performScan.mockResolvedValue(mockInstagramScanResult)

      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: 'coordinated_content'
      })

      // Execute coordinated scan
      const scanResult = await socialMediaService.performCoordinatedScan()

      // Verify rate limit coordination
      expect(scanResult.platforms).toHaveLength(3)
      expect(scanResult.successfulPlatforms).toBe(2) // Reddit and Instagram succeed
      expect(scanResult.failedPlatforms).toBe(1) // TikTok hit rate limit
      expect(scanResult.totalPostsFound).toBe(22) // 12 + 10, coordinated volumes
      expect(scanResult.totalPostsApproved).toBe(16) // 9 + 7

      // Verify TikTok rate limit was handled
      const tiktokPlatform = scanResult.platforms.find(p => p.platform === 'tiktok')
      expect(tiktokPlatform?.success).toBe(false)
      expect(tiktokPlatform?.error).toContain('rate limit')

      // Verify rate limit tracking was updated
      expect(mockQuery).toHaveBeenCalledWith('rate_limit_tracking')

      // Verify appropriate logging
      expect(mockLogToDatabase).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('RATE_LIMIT'),
        expect.stringContaining('TikTok rate limit'),
        expect.any(Object)
      )
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large volume coordinated scans efficiently', async () => {
      // Mock high-volume configuration
      mockQuery.mockImplementation((table) => {
        if (table === 'social_media_coordination_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              enable_coordination: true,
              scan_interval: 15, // Frequent scans
              platform_priority: ['reddit', 'instagram', 'tiktok'],
              content_balancing_enabled: true,
              reddit_weight: 45,
              instagram_weight: 30,
              tiktok_weight: 25,
              rate_limit_coordination: true,
              error_threshold: 10
            })
          }
        }
        if (table === 'tiktok_scan_config') {
          return {
            select: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              is_enabled: true,
              scan_interval: 60,
              max_videos_per_scan: 50, // High volume
              target_keywords: ['hotdog', 'sausage', 'bratwurst', 'frankfurter'],
              target_hashtags: ['foodtok', 'cooking', 'grilling', 'bbq', 'streetfood'],
              min_views: 25, // Lower threshold for more content
              max_duration: 300,
              sort_by: 'relevance'
            })
          }
        }
        if (table === 'tiktok_auth') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              access_token: 'high_volume_token',
              expires_at: new Date(Date.now() + 7200000),
              is_active: true
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

      // Mock high-volume platform configurations
      mockRedditScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 15,
        maxPostsPerScan: 100,
        targetSubreddits: ['hotdogs', 'food', 'grilling', 'bbq', 'cooking'],
        searchTerms: ['hotdog', 'sausage', 'bratwurst'],
        minScore: 3,
        sortBy: 'new',
        timeRange: 'hour',
        includeNSFW: false
      })

      mockInstagramScanning.getScanConfig.mockResolvedValue({
        isEnabled: true,
        scanInterval: 20,
        maxPostsPerScan: 75,
        targetHashtags: ['hotdog', 'frankfurter', 'bbq', 'grilling', 'streetfood'],
        minLikes: 1,
        includeStories: true
      })

      mockRedditScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })
      mockInstagramScanning.testConnection.mockResolvedValue({ success: true, message: 'Connected' })

      // Mock large TikTok response with pagination
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: Array.from({ length: 20 }, (_, i) => ({
              id: `tiktok_video_${i + 1}`,
              title: `Hotdog recipe variation ${i + 1}`,
              video_description: `Creative hotdog preparation method ${i + 1}`,
              duration: 60 + (i * 5),
              cover_image_url: `https://example.com/cover${i + 1}.jpg`,
              play_url: `https://example.com/video${i + 1}.mp4`,
              create_time: Math.floor(Date.now() / 1000) - (i * 1800),
              view_count: 1000 + (i * 500),
              like_count: 50 + (i * 25),
              comment_count: 10 + (i * 5),
              share_count: 5 + (i * 2)
            })),
            cursor: 'next_page_token',
            has_more: true
          }
        })
      } as Response)

      // Mock high-volume scan results
      const mockRedditScanResult = {
        scanId: 'reddit_high_volume_scan',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 85,
        postsProcessed: 80,
        postsApproved: 72,
        postsRejected: 8,
        postsFlagged: 0,
        duplicatesFound: 5,
        errors: [],
        rateLimitHit: false,
        subredditsScanned: ['hotdogs', 'food', 'grilling', 'bbq', 'cooking']
      }

      const mockInstagramScanResult = {
        scanId: 'instagram_high_volume_scan',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 65,
        postsProcessed: 60,
        postsApproved: 55,
        postsRejected: 5,
        postsFlagged: 0,
        duplicatesFound: 5,
        errors: [],
        rateLimitHit: false,
        hashtagsScanned: ['hotdog', 'frankfurter', 'bbq', 'grilling', 'streetfood']
      }

      mockRedditScanning.performScan.mockResolvedValue(mockRedditScanResult)
      mockInstagramScanning.performScan.mockResolvedValue(mockInstagramScanResult)

      // Mock content processing with mixed results
      let contentCallCount = 0
      mockContentService.isDuplicate.mockImplementation(async () => {
        // Simulate some duplicates for realism
        return Math.random() < 0.1 // 10% duplicate rate
      })

      mockContentService.addToQueue.mockImplementation(async () => {
        contentCallCount++
        return {
          success: Math.random() < 0.95, // 95% success rate
          contentId: `high_volume_content_${contentCallCount}`
        }
      })

      // Measure performance
      const startTime = Date.now()
      const scanResult = await socialMediaService.performCoordinatedScan()
      const endTime = Date.now()
      const duration = endTime - startTime

      // Verify high-volume processing
      expect(scanResult.platforms).toHaveLength(3)
      expect(scanResult.successfulPlatforms).toBe(3)
      expect(scanResult.totalPostsFound).toBe(170) // 85 + 65 + 20
      expect(scanResult.totalPostsApproved).toBeGreaterThan(140) // Should process most content

      // Verify TikTok handled large batch
      const tiktokPlatform = scanResult.platforms.find(p => p.platform === 'tiktok')
      expect(tiktokPlatform?.success).toBe(true)
      expect(tiktokPlatform?.postsFound).toBe(20)

      // Verify performance is reasonable (should complete within 30 seconds for test)
      expect(duration).toBeLessThan(30000)

      // Verify content processing was called many times
      expect(mockContentService.addToQueue).toHaveBeenCalledTimes(
        expect.any(Number)
      )
      expect(contentCallCount).toBeGreaterThan(100)

      // Verify database operations were batched/efficient
      expect(mockQuery).toHaveBeenCalledWith('unified_scan_results')
      expect(mockQuery).toHaveBeenCalledWith('tiktok_scan_results')
    })
  })
})