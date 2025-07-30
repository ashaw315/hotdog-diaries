import { TikTokScanningService } from '@/lib/services/tiktok-scanning'
import { TikTokService } from '@/lib/services/tiktok'
import { contentService } from '@/lib/services/content'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

// Mock dependencies
jest.mock('@/lib/services/tiktok')
jest.mock('@/lib/services/content')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db')

const mockTikTokService = TikTokService as jest.MockedClass<typeof TikTokService>
const mockContentService = contentService as jest.Mocked<typeof contentService>
const mockQuery = query as jest.MockedFunction<typeof query>
const mockLogToDatabase = logToDatabase as jest.MockedFunction<typeof logToDatabase>

describe('TikTokScanningService', () => {
  let tikTokScanningService: TikTokScanningService
  let mockTikTokInstance: jest.Mocked<TikTokService>
  let mockSelect: jest.Mock
  let mockFirst: jest.Mock
  let mockInsert: jest.Mock
  let mockUpdate: jest.Mock
  let mockWhere: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup TikTok service mock
    mockTikTokInstance = {
      searchVideos: jest.fn(),
      processVideoContent: jest.fn(),
      testConnection: jest.fn()
    } as any

    mockTikTokService.mockImplementation(() => mockTikTokInstance)
    
    // Setup query builder mocks
    mockSelect = jest.fn().mockReturnThis()
    mockFirst = jest.fn()
    mockInsert = jest.fn()
    mockUpdate = jest.fn()
    mockWhere = jest.fn().mockReturnThis()
    
    mockQuery.mockImplementation(() => ({
      select: mockSelect,
      first: mockFirst,
      insert: mockInsert,
      update: mockUpdate,
      where: mockWhere,
      orderBy: jest.fn().mockReturnThis()
    }) as any)

    // Setup content service mocks
    mockContentService.addToQueue = jest.fn()
    mockContentService.isDuplicate = jest.fn()

    tikTokScanningService = new TikTokScanningService()
  })

  describe('Configuration Management', () => {
    test('should get default configuration when none exists', async () => {
      mockFirst.mockResolvedValueOnce(null)

      const config = await tikTokScanningService.getConfig()

      expect(config).toMatchObject({
        isEnabled: false,
        scanInterval: 120,
        maxVideosPerScan: 20,
        targetKeywords: ['hotdog', 'hotdogs', 'frankfurter', 'wiener', 'bratwurst'],
        targetHashtags: ['foodtok', 'hotdogchallenge', 'grilling', 'bbq', 'streetfood'],
        minViews: 100,
        maxDuration: 180,
        sortBy: 'relevance'
      })
    })

    test('should get stored configuration', async () => {
      const storedConfig = {
        is_enabled: true,
        scan_interval: 90,
        max_videos_per_scan: 30,
        target_keywords: ['hotdog', 'sausage'],
        target_hashtags: ['foodtok', 'cooking'],
        min_views: 500,
        max_duration: 120,
        sort_by: 'view_count'
      }

      mockFirst.mockResolvedValueOnce(storedConfig)

      const config = await tikTokScanningService.getConfig()

      expect(config).toMatchObject({
        isEnabled: true,
        scanInterval: 90,
        maxVideosPerScan: 30,
        targetKeywords: ['hotdog', 'sausage'],
        targetHashtags: ['foodtok', 'cooking'],
        minViews: 500,
        maxDuration: 120,
        sortBy: 'view_count'
      })
    })

    test('should update configuration', async () => {
      const updates = {
        isEnabled: true,
        scanInterval: 60,
        maxVideosPerScan: 25,
        targetKeywords: ['hotdog', 'bratwurst', 'sausage'],
        minViews: 200
      }

      await tikTokScanningService.updateConfig(updates)

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        is_enabled: true,
        scan_interval: 60,
        max_videos_per_scan: 25,
        target_keywords: ['hotdog', 'bratwurst', 'sausage'],
        min_views: 200,
        updated_at: expect.any(Date)
      }))

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.INFO,
        'TIKTOK_CONFIG_UPDATED',
        'TikTok scan configuration updated',
        { updatedFields: Object.keys(updates) }
      )
    })
  })

  describe('Scanning Operations', () => {
    beforeEach(() => {
      // Mock default config
      mockFirst.mockResolvedValueOnce({
        is_enabled: true,
        scan_interval: 120,
        max_videos_per_scan: 20,
        target_keywords: ['hotdog', 'sausage'],
        target_hashtags: ['foodtok'],
        min_views: 100,
        max_duration: 180,
        sort_by: 'relevance'
      })
    })

    test('should perform successful scan with keywords and hashtags', async () => {
      const mockVideos = [
        {
          id: 'video1',
          title: 'Amazing hotdog recipe',
          description: 'Delicious hotdog with mustard',
          duration: 60,
          metrics: { views: 1000, likes: 50 },
          qualityScore: 75
        },
        {
          id: 'video2',
          title: 'Street food hotdog',
          description: 'NYC style hotdog',
          duration: 45,
          metrics: { views: 2000, likes: 100 },
          qualityScore: 85
        }
      ]

      mockTikTokInstance.searchVideos.mockResolvedValue(mockVideos)
      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: '123'
      })

      const result = await tikTokScanningService.performScan()

      // Should search with both keywords and hashtags
      expect(mockTikTokInstance.searchVideos).toHaveBeenCalledWith({
        keywords: ['hotdog', 'sausage'],
        hashtags: ['foodtok'],
        maxResults: 20,
        minViews: 100,
        maxDuration: 180,
        sortBy: 'relevance'
      })

      expect(result).toMatchObject({
        scanId: expect.any(String),
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        videosFound: 2,
        videosProcessed: 2,
        videosApproved: 2,
        videosRejected: 0,
        videosFlagged: 0,
        duplicatesFound: 0,
        success: true
      })

      // Should add both videos to queue
      expect(mockContentService.addToQueue).toHaveBeenCalledTimes(2)
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        scan_id: result.scanId,
        videos_found: 2,
        videos_approved: 2
      }))
    })

    test('should handle duplicate detection', async () => {
      const mockVideos = [
        {
          id: 'video1',
          title: 'Original hotdog video',
          description: 'Unique content',
          duration: 60,
          metrics: { views: 1000 },
          qualityScore: 75
        },
        {
          id: 'video2',
          title: 'Duplicate hotdog video',
          description: 'Same content as video1',
          duration: 45,
          metrics: { views: 500 },
          qualityScore: 60
        }
      ]

      mockTikTokInstance.searchVideos.mockResolvedValue(mockVideos)
      mockContentService.isDuplicate
        .mockResolvedValueOnce(false) // First video is unique
        .mockResolvedValueOnce(true)  // Second video is duplicate

      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: '123'
      })

      const result = await tikTokScanningService.performScan()

      expect(result).toMatchObject({
        videosFound: 2,
        videosProcessed: 2,
        videosApproved: 1,
        videosRejected: 0,
        duplicatesFound: 1
      })

      // Should only add unique video to queue
      expect(mockContentService.addToQueue).toHaveBeenCalledTimes(1)
    })

    test('should handle low quality content rejection', async () => {
      const mockVideos = [
        {
          id: 'video1',
          title: 'High quality hotdog video',
          description: 'Detailed cooking instructions',
          duration: 90,
          metrics: { views: 5000, likes: 200 },
          qualityScore: 85 // High quality
        },
        {
          id: 'video2',
          title: 'low quality',
          description: 'bad',
          duration: 10,
          metrics: { views: 50, likes: 1 },
          qualityScore: 15 // Low quality
        }
      ]

      mockTikTokInstance.searchVideos.mockResolvedValue(mockVideos)
      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: true,
        contentId: '123'
      })

      const result = await tikTokScanningService.performScan()

      expect(result).toMatchObject({
        videosFound: 2,
        videosProcessed: 2,
        videosApproved: 1,
        videosRejected: 1,
        duplicatesFound: 0
      })

      // Should only add high quality video
      expect(mockContentService.addToQueue).toHaveBeenCalledTimes(1)
      expect(mockContentService.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'tiktok',
          platformId: 'video1'
        })
      )
    })

    test('should handle flagged content', async () => {
      const mockVideos = [
        {
          id: 'video1',
          title: 'Suspicious hotdog content',
          description: 'Contains inappropriate language or content',
          duration: 60,
          metrics: { views: 1000 },
          qualityScore: 65
        }
      ]

      mockTikTokInstance.searchVideos.mockResolvedValue(mockVideos)
      mockContentService.isDuplicate.mockResolvedValue(false)
      mockContentService.addToQueue.mockResolvedValue({
        success: false,
        error: 'Content flagged for manual review',
        flagged: true
      })

      const result = await tikTokScanningService.performScan()

      expect(result).toMatchObject({
        videosFound: 1,
        videosProcessed: 1,
        videosApproved: 0,
        videosRejected: 0,
        videosFlagged: 1
      })
    })

    test('should skip scanning when disabled', async () => {
      // Mock disabled config
      mockFirst.mockReset()
      mockFirst.mockResolvedValueOnce({
        is_enabled: false
      })

      const result = await tikTokScanningService.performScan()

      expect(result).toMatchObject({
        scanId: expect.any(String),
        success: false,
        error: 'TikTok scanning is disabled'
      })

      expect(mockTikTokInstance.searchVideos).not.toHaveBeenCalled()
      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.WARNING,
        'TIKTOK_SCAN_DISABLED',
        'TikTok scan attempted but scanning is disabled',
        expect.any(Object)
      )
    })

    test('should handle TikTok API errors gracefully', async () => {
      mockTikTokInstance.searchVideos.mockRejectedValue(new Error('TikTok API error'))

      const result = await tikTokScanningService.performScan()

      expect(result).toMatchObject({
        success: false,
        error: 'TikTok API error',
        videosFound: 0,
        videosProcessed: 0
      })

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        videos_found: 0,
        errors: ['TikTok API error']
      }))

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'TIKTOK_SCAN_ERROR',
        expect.stringContaining('TikTok API error'),
        expect.any(Object)
      )
    })
  })

  describe('Scan History and Statistics', () => {
    test('should get recent scan results', async () => {
      const mockResults = [
        {
          scan_id: 'scan1',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T10:05:00Z',
          videos_found: 10,
          videos_approved: 8,
          videos_rejected: 2
        },
        {
          scan_id: 'scan2',
          start_time: '2024-01-01T08:00:00Z',
          end_time: '2024-01-01T08:03:00Z',
          videos_found: 5,
          videos_approved: 4,
          videos_rejected: 1
        }
      ]

      mockQuery.mockImplementation(() => ({
        select: mockSelect.mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResults)
      }) as any)

      const results = await tikTokScanningService.getRecentScans(10)

      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({
        scanId: 'scan1',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:05:00Z'),
        videosFound: 10,
        videosApproved: 8,
        videosRejected: 2
      })
    })

    test('should get scanning statistics', async () => {
      mockQuery.mockImplementation((table) => {
        if (table === 'tiktok_scan_results') {
          return {
            select: jest.fn().mockResolvedValue([{
              total_scans: 50,
              total_videos_found: 500,
              total_videos_approved: 400,
              total_videos_rejected: 80,
              total_duplicates: 20,
              avg_videos_per_scan: 10,
              success_rate: 80
            }])
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ count: 5 })
        }
      } as any)

      const stats = await tikTokScanningService.getStats()

      expect(stats).toMatchObject({
        totalScans: 50,
        totalVideosFound: 500,
        totalVideosApproved: 400,
        totalVideosRejected: 80,
        totalDuplicates: 20,
        averageVideosPerScan: 10,
        successRate: 80,
        recentErrorCount: 5
      })
    })
  })

  describe('Content Processing', () => {
    test('should process video content correctly', async () => {
      const video = {
        id: 'test-video',
        title: 'Amazing Chicago-style hotdog',
        description: 'Learn to make authentic Chicago hotdogs with all the fixings',
        duration: 90,
        coverImageUrl: 'https://example.com/cover.jpg',
        videoUrl: 'https://example.com/video.mp4',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        metrics: {
          views: 5000,
          likes: 250,
          comments: 50,
          shares: 25
        },
        keywords: ['chicago', 'hotdog', 'authentic'],
        qualityScore: 85
      }

      const processed = tikTokScanningService.processVideoForQueue(video)

      expect(processed).toMatchObject({
        platform: 'tiktok',
        platformId: 'test-video',
        contentType: 'video',
        title: 'Amazing Chicago-style hotdog',
        description: 'Learn to make authentic Chicago hotdogs with all the fixings',
        mediaUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/cover.jpg',
        originalUrl: expect.stringContaining('tiktok.com'),
        keywords: ['chicago', 'hotdog', 'authentic'],
        metadata: {
          duration: 90,
          views: 5000,
          likes: 250,
          comments: 50,
          shares: 25,
          qualityScore: 85,
          createdAt: '2024-01-01T12:00:00.000Z'
        }
      })
    })

    test('should calculate quality threshold correctly', async () => {
      expect(tikTokScanningService.meetsQualityThreshold({ qualityScore: 75 } as any)).toBe(true)
      expect(tikTokScanningService.meetsQualityThreshold({ qualityScore: 45 } as any)).toBe(false)
      expect(tikTokScanningService.meetsQualityThreshold({ qualityScore: 50 } as any)).toBe(true) // At threshold
    })

    test('should validate video content correctly', async () => {
      const validVideo = {
        id: 'valid',
        title: 'Great hotdog recipe',
        description: 'Step by step instructions',
        duration: 60,
        metrics: { views: 1000 }
      }

      const invalidVideo = {
        id: '',
        title: '',
        description: '',
        duration: 0,
        metrics: { views: 0 }
      }

      expect(tikTokScanningService.isValidVideo(validVideo as any)).toBe(true)
      expect(tikTokScanningService.isValidVideo(invalidVideo as any)).toBe(false)
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should handle database errors during scanning', async () => {
      mockFirst.mockRejectedValue(new Error('Database connection failed'))

      const result = await tikTokScanningService.performScan()

      expect(result).toMatchObject({
        success: false,
        error: 'Database connection failed'
      })

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'TIKTOK_SCAN_ERROR',
        expect.stringContaining('Database connection failed'),
        expect.any(Object)
      )
    })

    test('should handle partial failures during content processing', async () => {
      const mockVideos = [
        { id: 'video1', title: 'Good video', qualityScore: 75 },
        { id: 'video2', title: 'Another good video', qualityScore: 80 }
      ]

      mockTikTokInstance.searchVideos.mockResolvedValue(mockVideos)
      mockContentService.isDuplicate.mockResolvedValue(false)
      
      // First video succeeds, second fails
      mockContentService.addToQueue
        .mockResolvedValueOnce({ success: true, contentId: '123' })
        .mockRejectedValueOnce(new Error('Queue processing failed'))

      const result = await tikTokScanningService.performScan()

      expect(result).toMatchObject({
        videosFound: 2,
        videosProcessed: 2,
        videosApproved: 1,
        videosRejected: 0,
        success: true // Overall success despite partial failure
      })

      expect(result.errors).toContain('Queue processing failed')
    })
  })
})