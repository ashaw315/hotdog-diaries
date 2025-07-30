import { RedditScanningService, RedditScanConfig, RedditScanResult } from '@/lib/services/reddit-scanning'
import { RedditService } from '@/lib/services/reddit'
import { FilteringService } from '@/lib/services/filtering'
import { ContentProcessor } from '@/lib/services/content-processor'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection'
import { redditMonitoringService } from '@/lib/services/reddit-monitoring'

// Mock all dependencies
jest.mock('@/lib/services/reddit')
jest.mock('@/lib/services/filtering')
jest.mock('@/lib/services/content-processor')
jest.mock('@/lib/services/duplicate-detection')
jest.mock('@/lib/services/reddit-monitoring')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const mockRedditService = RedditService as jest.MockedClass<typeof RedditService>
const mockFilteringService = FilteringService as jest.MockedClass<typeof FilteringService>
const mockContentProcessor = ContentProcessor as jest.MockedClass<typeof ContentProcessor>
const mockDuplicateDetectionService = DuplicateDetectionService as jest.MockedClass<typeof DuplicateDetectionService>

describe('RedditScanningService', () => {
  let scanningService: RedditScanningService
  let mockRedditInstance: jest.Mocked<RedditService>
  let mockContentProcessorInstance: jest.Mocked<ContentProcessor>

  const mockConfig: RedditScanConfig = {
    isEnabled: true,
    scanInterval: 30,
    maxPostsPerScan: 25,
    targetSubreddits: ['hotdogs', 'food'],
    searchTerms: ['hotdog', 'hot dog'],
    minScore: 10,
    sortBy: 'hot',
    timeRange: 'week',
    includeNSFW: false
  }

  const mockPost = {
    id: 'test123',
    title: 'Great hotdog recipe',
    selftext: 'Here is how to make it',
    subreddit: 'food',
    author: 'chef123',
    createdAt: new Date(),
    score: 25,
    upvoteRatio: 0.9,
    numComments: 5,
    permalink: 'https://reddit.com/r/food/comments/test123',
    url: 'https://example.com',
    imageUrls: ['https://i.redd.it/example.jpg'],
    videoUrls: [],
    mediaUrls: ['https://i.redd.it/example.jpg'],
    isNSFW: false,
    isSpoiler: false,
    isStickied: false,
    isGallery: false,
    isCrosspost: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock instances
    mockRedditInstance = {
      searchSubreddits: jest.fn(),
      validateRedditContent: jest.fn(),
      getHotdogSubreddits: jest.fn().mockReturnValue(['hotdogs', 'food']),
      getHotdogSearchTerms: jest.fn().mockReturnValue(['hotdog', 'hot dog']),
      getApiStatus: jest.fn()
    } as any

    mockContentProcessorInstance = {
      processContent: jest.fn()
    } as any

    mockRedditService.mockImplementation(() => mockRedditInstance)
    mockContentProcessor.mockImplementation(() => mockContentProcessorInstance)

    scanningService = new RedditScanningService()
  })

  describe('performScan', () => {
    beforeEach(() => {
      // Mock query builder
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockConfig),
        upsert: jest.fn().mockResolvedValue(undefined)
      })
      mockQuery.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 1 })
      })
    })

    it('should perform successful scan', async () => {
      mockRedditInstance.searchSubreddits.mockResolvedValue([mockPost])
      mockRedditInstance.validateRedditContent.mockResolvedValue(true)
      mockContentProcessorInstance.processContent.mockResolvedValue({
        success: true,
        contentId: 1,
        action: 'approved',
        analysis: {} as any
      })

      const result = await scanningService.performScan()

      expect(result.postsFound).toBe(1)
      expect(result.postsProcessed).toBe(1)
      expect(result.postsApproved).toBe(1)
      expect(result.errors).toHaveLength(0)
      expect(redditMonitoringService.recordScanCompletion).toHaveBeenCalledWith(1, true, [])
    })

    it('should throw error if scanning is disabled', async () => {
      const disabledConfig = { ...mockConfig, isEnabled: false }
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query().first.mockResolvedValue(disabledConfig)

      await expect(scanningService.performScan()).rejects.toThrow('Reddit scanning is disabled')
    })

    it('should throw error if scan already in progress', async () => {
      // Set scanning flag
      ;(scanningService as any).isScanning = true

      await expect(scanningService.performScan()).rejects.toThrow('Scan already in progress')
    })

    it('should handle search errors gracefully', async () => {
      mockRedditInstance.searchSubreddits.mockRejectedValue(new Error('Search failed'))

      const result = await scanningService.performScan()

      expect(result.errors).toContain('Search term "hotdog" failed: Search failed')
      expect(result.postsFound).toBe(0)
    })

    it('should detect rate limit errors', async () => {
      mockRedditInstance.searchSubreddits.mockRejectedValue(new Error('rate limit exceeded'))

      const result = await scanningService.performScan()

      expect(result.rateLimitHit).toBe(true)
      expect(result.errors).toContain('Search term "hotdog" failed: rate limit exceeded')
    })

    it('should remove duplicate posts', async () => {
      const duplicatePost = { ...mockPost, id: 'test123' }
      mockRedditInstance.searchSubreddits.mockResolvedValue([mockPost, duplicatePost])
      mockRedditInstance.validateRedditContent.mockResolvedValue(true)
      mockContentProcessorInstance.processContent.mockResolvedValue({
        success: true,
        contentId: 1,
        action: 'approved',
        analysis: {} as any
      })

      const result = await scanningService.performScan()

      expect(result.postsFound).toBe(2)
      expect(result.duplicatesFound).toBe(1)
      expect(result.postsProcessed).toBe(1) // Only one unique post processed
    })

    it('should track highest scored post', async () => {
      const highScorePost = { ...mockPost, id: 'high', score: 100, title: 'High Score Post' }
      const lowScorePost = { ...mockPost, id: 'low', score: 20, title: 'Low Score Post' }
      
      mockRedditInstance.searchSubreddits.mockResolvedValue([lowScorePost, highScorePost])
      mockRedditInstance.validateRedditContent.mockResolvedValue(true)
      mockContentProcessorInstance.processContent.mockResolvedValue({
        success: true,
        contentId: 1,
        action: 'approved',
        analysis: {} as any
      })

      const result = await scanningService.performScan()

      expect(result.highestScoredPost).toEqual({
        id: 'high',
        title: 'High Score Post',
        score: 100,
        subreddit: 'food'
      })
    })

    it('should handle content processing failures', async () => {
      mockRedditInstance.searchSubreddits.mockResolvedValue([mockPost])
      mockRedditInstance.validateRedditContent.mockResolvedValue(true)
      mockContentProcessorInstance.processContent.mockRejectedValue(new Error('Processing failed'))

      const result = await scanningService.performScan()

      expect(result.errors).toContain('Post test123 processing failed: Processing failed')
      expect(result.postsProcessed).toBe(0)
    })

    it('should count posts by processing result', async () => {
      const posts = [
        { ...mockPost, id: 'approved' },
        { ...mockPost, id: 'rejected' },
        { ...mockPost, id: 'flagged' }
      ]

      mockRedditInstance.searchSubreddits.mockResolvedValue(posts)
      mockRedditInstance.validateRedditContent.mockResolvedValue(true)
      mockContentProcessorInstance.processContent
        .mockResolvedValueOnce({ success: true, contentId: 1, action: 'approved', analysis: {} as any })
        .mockResolvedValueOnce({ success: true, contentId: 2, action: 'rejected', analysis: {} as any })
        .mockResolvedValueOnce({ success: true, contentId: 3, action: 'flagged', analysis: {} as any })

      const result = await scanningService.performScan()

      expect(result.postsApproved).toBe(1)
      expect(result.postsRejected).toBe(1)
      expect(result.postsFlagged).toBe(1)
    })
  })

  describe('getScanConfig', () => {
    it('should return database config when available', async () => {
      const dbConfig = {
        is_enabled: true,
        scan_interval: 60,
        max_posts_per_scan: 50,
        target_subreddits: ['custom', 'subreddits'],
        search_terms: ['custom', 'terms'],
        min_score: 20,
        sort_by: 'top',
        time_range: 'day',
        include_nsfw: true,
        last_scan_id: 'scan_123',
        last_scan_time: new Date('2023-01-01')
      }

      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(dbConfig)
      })

      const result = await scanningService.getScanConfig()

      expect(result.isEnabled).toBe(true)
      expect(result.scanInterval).toBe(60)
      expect(result.targetSubreddits).toEqual(['custom', 'subreddits'])
      expect(result.lastScanId).toBe('scan_123')
    })

    it('should return default config when database is empty', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      })

      const result = await scanningService.getScanConfig()

      expect(result.isEnabled).toBe(false)
      expect(result.scanInterval).toBe(30)
      expect(result.maxPostsPerScan).toBe(25)
      expect(result.minScore).toBe(10)
      expect(result.sortBy).toBe('hot')
      expect(result.timeRange).toBe('week')
    })

    it('should return defaults on database error', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockImplementation(() => {
        throw new Error('Database error')
      })

      const result = await scanningService.getScanConfig()

      expect(result.isEnabled).toBe(false)
      expect(result.scanInterval).toBe(30)
    })
  })

  describe('updateScanConfig', () => {
    it('should update scan configuration', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      const mockUpsert = jest.fn().mockResolvedValue(undefined)
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockConfig),
        upsert: mockUpsert
      })

      const updateData = { scanInterval: 45, minScore: 15 }
      await scanningService.updateScanConfig(updateData)

      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        scan_interval: 45,
        min_score: 15
      }))
    })
  })

  describe('getScanStats', () => {
    it('should return scan statistics', async () => {
      const mockStatsData = {
        total_scans: '10',
        total_posts_found: '100',
        total_posts_processed: '90',
        total_posts_approved: '80',
        average_score: '25.5',
        last_scan_time: new Date('2023-01-01')
      }

      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockStatsData)
      })

      const stats = await scanningService.getScanStats()

      expect(stats.totalScans).toBe(10)
      expect(stats.totalPostsFound).toBe(100)
      expect(stats.totalPostsProcessed).toBe(90)
      expect(stats.totalPostsApproved).toBe(80)
      expect(stats.averageScore).toBe(25.5)
      expect(stats.successRate).toBeCloseTo(88.89, 2) // 80/90 * 100
    })

    it('should return default stats on error', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockImplementation(() => {
        throw new Error('Database error')
      })

      const stats = await scanningService.getScanStats()

      expect(stats.totalScans).toBe(0)
      expect(stats.totalPostsFound).toBe(0)
      expect(stats.successRate).toBe(0)
    })
  })

  describe('testConnection', () => {
    it('should return success when connection works', async () => {
      mockRedditInstance.getApiStatus.mockResolvedValue({
        isConnected: true,
        rateLimits: { used: 10, remaining: 90, resetTime: new Date() },
        userAgent: 'TestBot/1.0.0'
      })

      const result = await scanningService.testConnection()

      expect(result.success).toBe(true)
      expect(result.message).toBe('Reddit API connection successful')
    })

    it('should return failure when connection fails', async () => {
      mockRedditInstance.getApiStatus.mockResolvedValue({
        isConnected: false,
        rateLimits: { used: 0, remaining: 0, resetTime: new Date() },
        lastError: 'Connection refused',
        userAgent: 'TestBot/1.0.0'
      })

      const result = await scanningService.testConnection()

      expect(result.success).toBe(false)
      expect(result.message).toBe('Connection refused')
    })

    it('should handle connection test errors', async () => {
      mockRedditInstance.getApiStatus.mockRejectedValue(new Error('Test failed'))

      const result = await scanningService.testConnection()

      expect(result.success).toBe(false)
      expect(result.message).toBe('Connection test failed: Test failed')
    })
  })

  describe('startAutomatedScanning', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should start automated scanning when enabled', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockConfig)
      })

      const performScanSpy = jest.spyOn(scanningService, 'performScan').mockResolvedValue({} as RedditScanResult)

      await scanningService.startAutomatedScanning()

      // Should perform initial scan
      expect(performScanSpy).toHaveBeenCalledTimes(1)

      // Advance timer and check periodic scanning
      jest.advanceTimersByTime(30 * 60 * 1000) // 30 minutes
      await Promise.resolve() // Allow async operations to complete

      expect(performScanSpy).toHaveBeenCalledTimes(2)
    })

    it('should not start when scanning is disabled', async () => {
      const disabledConfig = { ...mockConfig, isEnabled: false }
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.query = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(disabledConfig)
      })

      const performScanSpy = jest.spyOn(scanningService, 'performScan').mockResolvedValue({} as RedditScanResult)

      await scanningService.startAutomatedScanning()

      expect(performScanSpy).not.toHaveBeenCalled()
    })
  })

  describe('stopAutomatedScanning', () => {
    it('should stop automated scanning', async () => {
      await scanningService.stopAutomatedScanning()
      // This test mainly ensures no errors are thrown
      expect(true).toBe(true)
    })
  })
})