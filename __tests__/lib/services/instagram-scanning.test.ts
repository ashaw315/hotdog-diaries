import { InstagramScanningService, InstagramScanConfig, InstagramScanResult } from '@/lib/services/instagram-scanning'
import { InstagramService, ProcessedInstagramMedia } from '@/lib/services/instagram'
import { FilteringService } from '@/lib/services/filtering'
import { ContentProcessor } from '@/lib/services/content-processor'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection'
import { instagramMonitoringService } from '@/lib/services/instagram-monitoring'

// Mock dependencies
jest.mock('@/lib/services/instagram')
jest.mock('@/lib/services/filtering')
jest.mock('@/lib/services/content-processor')
jest.mock('@/lib/services/duplicate-detection')
jest.mock('@/lib/services/instagram-monitoring')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const mockInstagramService = jest.mocked(InstagramService)
const mockFilteringService = jest.mocked(FilteringService)
const mockContentProcessor = jest.mocked(ContentProcessor)
const mockDuplicateDetectionService = jest.mocked(DuplicateDetectionService)
const mockInstagramMonitoringService = instagramMonitoringService as jest.Mocked<typeof instagramMonitoringService>

describe('InstagramScanningService', () => {
  let instagramScanningService: InstagramScanningService
  let mockInstagramServiceInstance: jest.Mocked<InstanceType<typeof InstagramService>>
  let mockFilteringServiceInstance: jest.Mocked<InstanceType<typeof FilteringService>>
  let mockContentProcessorInstance: jest.Mocked<InstanceType<typeof ContentProcessor>>
  let mockDuplicateDetectionInstance: jest.Mocked<InstanceType<typeof DuplicateDetectionService>>

  const mockProcessedMedia: ProcessedInstagramMedia = {
    id: 'test_media_123',
    caption: 'Delicious hotdog for lunch! #hotdog #food',
    mediaType: 'IMAGE',
    mediaUrl: 'https://instagram.com/test.jpg',
    permalink: 'https://instagram.com/p/test123',
    username: 'foodlover',
    userId: 'user123',
    timestamp: new Date('2023-01-01T12:00:00Z'),
    likesCount: 25,
    commentsCount: 5,
    hashtags: ['hotdog', 'food'],
    mentions: [],
    isStory: false
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock constructor instances
    mockInstagramServiceInstance = {
      searchHashtags: jest.fn(),
      getApiStatus: jest.fn(),
      validateInstagramContent: jest.fn(),
      getHotdogHashtags: jest.fn().mockReturnValue(['hotdog', 'hotdogs', 'frankfurter']),
    } as any

    mockFilteringServiceInstance = {
      filterContent: jest.fn(),
    } as any

    mockContentProcessorInstance = {
      processContent: jest.fn(),
    } as any

    mockDuplicateDetectionInstance = {
      generateContentHash: jest.fn(),
      checkForDuplicates: jest.fn(),
    } as any

    mockInstagramService.mockImplementation(() => mockInstagramServiceInstance)
    mockFilteringService.mockImplementation(() => mockFilteringServiceInstance)
    mockContentProcessor.mockImplementation(() => mockContentProcessorInstance)
    mockDuplicateDetectionService.mockImplementation(() => mockDuplicateDetectionInstance)

    instagramScanningService = new InstagramScanningService()

    // Mock database queries
    const mockQuery = require('@/lib/db-query-builder')
    mockQuery.query = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      first: jest.fn(),
      upsert: jest.fn().mockReturnValue(Promise.resolve()),
      count: jest.fn().mockReturnThis()
    })
    mockQuery.insert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: 'content_123' })
    })
  })

  describe('constructor', () => {
    it('should initialize all service dependencies', () => {
      expect(instagramScanningService).toBeInstanceOf(InstagramScanningService)
      expect(mockInstagramService).toHaveBeenCalledTimes(1)
      expect(mockFilteringService).toHaveBeenCalledTimes(1)
      expect(mockContentProcessor).toHaveBeenCalledTimes(1)
      expect(mockDuplicateDetectionService).toHaveBeenCalledTimes(1)
    })
  })

  describe('getScanConfig', () => {
    it('should return database configuration when available', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({
        is_enabled: true,
        scan_interval: 45,
        max_posts_per_scan: 30,
        target_hashtags: ['hotdog', 'frankfurter'],
        min_likes: 10,
        include_stories: true,
        last_scan_id: 'scan_123',
        last_scan_time: new Date('2023-01-01T10:00:00Z')
      })

      const config = await instagramScanningService.getScanConfig()

      expect(config).toEqual({
        isEnabled: true,
        scanInterval: 45,
        maxPostsPerScan: 30,
        targetHashtags: ['hotdog', 'frankfurter'],
        minLikes: 10,
        includeStories: true,
        lastScanId: 'scan_123',
        lastScanTime: new Date('2023-01-01T10:00:00Z')
      })
    })

    it('should return default configuration when no database config exists', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue(null)

      const config = await instagramScanningService.getScanConfig()

      expect(config).toEqual({
        isEnabled: false,
        scanInterval: 60,
        maxPostsPerScan: 20,
        targetHashtags: ['hotdog', 'hotdogs', 'frankfurter'],
        minLikes: 5,
        includeStories: false
      })
    })

    it('should handle database errors gracefully', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockRejectedValue(new Error('Database error'))

      const config = await instagramScanningService.getScanConfig()

      expect(config.isEnabled).toBe(false)
      expect(config.scanInterval).toBe(60)
      expect(config.maxPostsPerScan).toBe(20)
    })
  })

  describe('updateScanConfig', () => {
    it('should update configuration successfully', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({
        is_enabled: false,
        scan_interval: 60,
        max_posts_per_scan: 20,
        target_hashtags: ['hotdog'],
        min_likes: 5,
        include_stories: false
      })

      const updateData = {
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 50
      }

      await instagramScanningService.updateScanConfig(updateData)

      expect(mockQuery.query().upsert).toHaveBeenCalledWith({
        is_enabled: true,
        scan_interval: 30,
        max_posts_per_scan: 50,
        target_hashtags: ['hotdog'],
        min_likes: 5,
        include_stories: false,
        last_scan_id: undefined,
        last_scan_time: undefined,
        updated_at: expect.any(Date)
      })
    })

    it('should handle update errors', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({})
      mockQuery.query().upsert.mockRejectedValue(new Error('Update failed'))

      await expect(instagramScanningService.updateScanConfig({ isEnabled: true }))
        .rejects.toThrow('Update failed')
    })
  })

  describe('performScan', () => {
    beforeEach(() => {
      // Mock scan configuration
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({
        is_enabled: true,
        scan_interval: 60,
        max_posts_per_scan: 20,
        target_hashtags: ['hotdog', 'frankfurter'],
        min_likes: 5,
        include_stories: false
      })

      // Mock API status as authenticated
      mockInstagramServiceInstance.getApiStatus.mockResolvedValue({
        isAuthenticated: true,
        rateLimits: { used: 10, remaining: 190, resetTime: new Date() }
      })

      // Mock content processing
      mockInstagramServiceInstance.validateInstagramContent.mockResolvedValue(true)
      mockDuplicateDetectionInstance.generateContentHash.mockResolvedValue('hash123')
      mockDuplicateDetectionInstance.checkForDuplicates.mockResolvedValue(false)
      mockContentProcessorInstance.processContent.mockResolvedValue({ action: 'approved' })
    })

    it('should perform successful scan', async () => {
      mockInstagramServiceInstance.searchHashtags.mockResolvedValue([mockProcessedMedia])

      const result = await instagramScanningService.performScan()

      expect(result.scanId).toMatch(/^instagram_scan_\d+$/)
      expect(result.postsFound).toBe(1)
      expect(result.postsProcessed).toBe(1)
      expect(result.postsApproved).toBe(1)
      expect(result.postsRejected).toBe(0)
      expect(result.duplicatesFound).toBe(0)
      expect(result.errors).toEqual([])
      expect(result.rateLimitHit).toBe(false)
      expect(result.hashtagsScanned).toEqual(['hotdog', 'frankfurter'])

      expect(mockInstagramMonitoringService.recordScanCompletion).toHaveBeenCalledWith(
        1, true, []
      )
    })

    it('should handle multiple hashtags and posts', async () => {
      const secondMedia = { ...mockProcessedMedia, id: 'test_media_456' }
      mockInstagramServiceInstance.searchHashtags
        .mockResolvedValueOnce([mockProcessedMedia])
        .mockResolvedValueOnce([secondMedia])

      const result = await instagramScanningService.performScan()

      expect(result.postsFound).toBe(2)
      expect(result.postsProcessed).toBe(2)
      expect(mockInstagramServiceInstance.searchHashtags).toHaveBeenCalledTimes(2)
    })

    it('should remove duplicate posts', async () => {
      const duplicateMedia = { ...mockProcessedMedia } // Same ID
      mockInstagramServiceInstance.searchHashtags.mockResolvedValue([mockProcessedMedia, duplicateMedia])

      const result = await instagramScanningService.performScan()

      expect(result.postsFound).toBe(2)
      expect(result.duplicatesFound).toBe(1)
      expect(result.postsProcessed).toBe(1)
    })

    it('should track highest engaged post', async () => {
      const highEngagementMedia = {
        ...mockProcessedMedia,
        id: 'high_engagement',
        likesCount: 100,
        commentsCount: 20,
        caption: 'Super popular hotdog post with lots of engagement'
      }
      mockInstagramServiceInstance.searchHashtags.mockResolvedValue([mockProcessedMedia, highEngagementMedia])

      const result = await instagramScanningService.performScan()

      expect(result.highestEngagedPost).toEqual({
        id: 'high_engagement',
        caption: 'Super popular hotdog post with lots of engagement...',
        likesCount: 100,
        username: 'foodlover'
      })
    })

    it('should handle content validation rejection', async () => {
      mockInstagramServiceInstance.searchHashtags.mockResolvedValue([mockProcessedMedia])
      mockInstagramServiceInstance.validateInstagramContent.mockResolvedValue(false)

      const result = await instagramScanningService.performScan()

      expect(result.postsProcessed).toBe(1)
      expect(result.postsRejected).toBe(1)
      expect(result.postsApproved).toBe(0)
    })

    it('should handle duplicate content rejection', async () => {
      mockInstagramServiceInstance.searchHashtags.mockResolvedValue([mockProcessedMedia])
      mockDuplicateDetectionInstance.checkForDuplicates.mockResolvedValue(true)

      const result = await instagramScanningService.performScan()

      expect(result.postsProcessed).toBe(1)
      expect(result.postsRejected).toBe(1)
      expect(result.postsApproved).toBe(0)
    })

    it('should handle content flagging', async () => {
      mockInstagramServiceInstance.searchHashtags.mockResolvedValue([mockProcessedMedia])
      mockContentProcessorInstance.processContent.mockResolvedValue({ action: 'flagged' })

      const result = await instagramScanningService.performScan()

      expect(result.postsProcessed).toBe(1)
      expect(result.postsFlagged).toBe(1)
      expect(result.postsApproved).toBe(0)
    })

    it('should handle hashtag search errors', async () => {
      mockInstagramServiceInstance.searchHashtags
        .mockResolvedValueOnce([mockProcessedMedia])
        .mockRejectedValueOnce(new Error('API error'))

      const result = await instagramScanningService.performScan()

      expect(result.postsFound).toBe(1)
      expect(result.errors).toContain('Hashtag "#frankfurter" search failed: API error')
    })

    it('should handle rate limit errors', async () => {
      mockInstagramServiceInstance.searchHashtags.mockRejectedValue(new Error('Instagram API rate limit exceeded'))

      const result = await instagramScanningService.performScan()

      expect(result.rateLimitHit).toBe(true)
      expect(result.errors[0]).toContain('rate limit')
    })

    it('should fail when scanning is disabled', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({ is_enabled: false })

      await expect(instagramScanningService.performScan()).rejects.toThrow('Instagram scanning is disabled')
    })

    it('should fail when not authenticated', async () => {
      mockInstagramServiceInstance.getApiStatus.mockResolvedValue({
        isAuthenticated: false,
        rateLimits: { used: 0, remaining: 200, resetTime: new Date() }
      })

      await expect(instagramScanningService.performScan()).rejects.toThrow('Instagram not authenticated')
    })

    it('should prevent concurrent scans', async () => {
      mockInstagramServiceInstance.searchHashtags.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 100))
      )

      const scan1Promise = instagramScanningService.performScan()
      const scan2Promise = instagramScanningService.performScan()

      await expect(scan2Promise).rejects.toThrow('Instagram scan already in progress')
      await scan1Promise // Wait for first scan to complete
    })

    it('should record scan results in database', async () => {
      mockInstagramServiceInstance.searchHashtags.mockResolvedValue([mockProcessedMedia])
      const mockInsert = require('@/lib/db-query-builder').insert

      await instagramScanningService.performScan()

      expect(mockInsert).toHaveBeenCalledWith('instagram_scan_results')
      expect(mockInsert().values).toHaveBeenCalledWith(expect.objectContaining({
        scan_id: expect.stringMatching(/^instagram_scan_\d+$/),
        posts_found: 1,
        posts_processed: 1,
        posts_approved: 1,
        hashtags_scanned: ['hotdog', 'frankfurter']
      }))
    })
  })

  describe('startAutomatedScanning', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({
        is_enabled: true,
        scan_interval: 30, // 30 minutes
        max_posts_per_scan: 20,
        target_hashtags: ['hotdog'],
        min_likes: 5,
        include_stories: false
      })

      mockInstagramServiceInstance.getApiStatus.mockResolvedValue({
        isAuthenticated: true,
        rateLimits: { used: 10, remaining: 190, resetTime: new Date() }
      })

      // Mock performScan to avoid actual scanning in tests
      jest.spyOn(instagramScanningService, 'performScan').mockResolvedValue({} as InstagramScanResult)
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should start automated scanning when enabled and authenticated', async () => {
      await instagramScanningService.startAutomatedScanning()

      // Should perform initial scan
      expect(instagramScanningService.performScan).toHaveBeenCalledTimes(1)

      // Advance timer and check periodic scanning
      jest.advanceTimersByTime(30 * 60 * 1000) // 30 minutes
      await Promise.resolve()

      expect(instagramScanningService.performScan).toHaveBeenCalledTimes(2)
    })

    it('should not start when scanning is disabled', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({ is_enabled: false })

      await instagramScanningService.startAutomatedScanning()

      expect(instagramScanningService.performScan).not.toHaveBeenCalled()
    })

    it('should not start when not authenticated', async () => {
      mockInstagramServiceInstance.getApiStatus.mockResolvedValue({
        isAuthenticated: false,
        rateLimits: { used: 0, remaining: 200, resetTime: new Date() }
      })

      await instagramScanningService.startAutomatedScanning()

      expect(instagramScanningService.performScan).not.toHaveBeenCalled()
    })

    it('should handle start errors', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockRejectedValue(new Error('Database error'))

      await expect(instagramScanningService.startAutomatedScanning()).rejects.toThrow('Database error')
    })
  })

  describe('stopAutomatedScanning', () => {
    it('should stop automated scanning', async () => {
      // Start scanning first
      jest.useFakeTimers()
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue({
        is_enabled: true,
        scan_interval: 30,
        max_posts_per_scan: 20,
        target_hashtags: ['hotdog'],
        min_likes: 5,
        include_stories: false
      })
      mockInstagramServiceInstance.getApiStatus.mockResolvedValue({
        isAuthenticated: true,
        rateLimits: { used: 10, remaining: 190, resetTime: new Date() }
      })
      jest.spyOn(instagramScanningService, 'performScan').mockResolvedValue({} as InstagramScanResult)

      await instagramScanningService.startAutomatedScanning()
      await instagramScanningService.stopAutomatedScanning()

      // Should not perform additional scans after stopping
      const initialCallCount = (instagramScanningService.performScan as jest.Mock).mock.calls.length
      jest.advanceTimersByTime(30 * 60 * 1000)
      await Promise.resolve()

      expect(instagramScanningService.performScan).toHaveBeenCalledTimes(initialCallCount)
      jest.useRealTimers()
    })
  })

  describe('getScanStats', () => {
    it('should return statistics from database', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first
        .mockResolvedValueOnce({
          total_scans: '10',
          total_posts_found: '100',
          total_posts_processed: '85',
          total_posts_approved: '75',
          average_likes: '15.5',
          last_scan_time: '2023-01-01T10:00:00Z'
        })
        .mockResolvedValueOnce({
          scan_interval: 60,
          last_scan_time: new Date('2023-01-01T10:00:00Z')
        })

      const stats = await instagramScanningService.getScanStats()

      expect(stats).toEqual({
        totalScans: 10,
        totalPostsFound: 100,
        totalPostsProcessed: 85,
        totalPostsApproved: 75,
        averageLikes: 15.5,
        topHashtags: [],
        topAccounts: [],
        scanFrequency: 60,
        lastScanTime: new Date('2023-01-01T10:00:00Z'),
        nextScanTime: new Date('2023-01-01T11:00:00Z'), // Last scan + interval
        successRate: Math.round((75 / 85) * 100)
      })
    })

    it('should return default stats when database is empty', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue(null)

      const stats = await instagramScanningService.getScanStats()

      expect(stats).toEqual({
        totalScans: 0,
        totalPostsFound: 0,
        totalPostsProcessed: 0,
        totalPostsApproved: 0,
        averageLikes: 0,
        topHashtags: [],
        topAccounts: [],
        scanFrequency: 60,
        lastScanTime: undefined,
        nextScanTime: undefined,
        successRate: 0
      })
    })
  })

  describe('testConnection', () => {
    it('should return success when connection is healthy', async () => {
      mockInstagramServiceInstance.getApiStatus.mockResolvedValue({
        isAuthenticated: true,
        rateLimits: { used: 10, remaining: 190, resetTime: new Date() }
      })

      const result = await instagramScanningService.testConnection()

      expect(result).toEqual({
        success: true,
        message: 'Instagram API connection successful',
        details: expect.objectContaining({
          isAuthenticated: true
        })
      })
    })

    it('should return failure when not authenticated', async () => {
      mockInstagramServiceInstance.getApiStatus.mockResolvedValue({
        isAuthenticated: false,
        rateLimits: { used: 0, remaining: 200, resetTime: new Date() },
        lastError: 'Token expired'
      })

      const result = await instagramScanningService.testConnection()

      expect(result).toEqual({
        success: false,
        message: 'Token expired',
        details: expect.objectContaining({
          isAuthenticated: false
        })
      })
    })

    it('should handle connection test errors', async () => {
      mockInstagramServiceInstance.getApiStatus.mockRejectedValue(new Error('Network error'))

      const result = await instagramScanningService.testConnection()

      expect(result).toEqual({
        success: false,
        message: 'Connection test failed: Network error',
        details: { error: 'Network error' }
      })
    })
  })
})