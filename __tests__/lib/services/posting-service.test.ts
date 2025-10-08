/**
 * @jest-environment node
 */

import { 
  postNextContent, 
  postScheduledContentDue, 
  getPostingStats,
  postContent
} from '../../../lib/services/posting-service'
import { db } from '../../../lib/db'
import { ContentStatus } from '../../../types'

// Mock the database
jest.mock('../../../lib/db', () => ({
  db: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn()
  }
}))

const mockDb = db as jest.Mocked<typeof db>

describe('Posting Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('postNextContent', () => {
    it('should post scheduled content that is due', async () => {
      const mockScheduledContent = {
        id: 1,
        content_text: 'Test scheduled content',
        source_platform: 'reddit',
        status: 'scheduled' as ContentStatus,
        scheduled_for: new Date(Date.now() - 1000).toISOString() // Due 1 second ago
      }

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockScheduledContent] }) // Scheduled content due
        .mockResolvedValueOnce({ rows: [{ next_order: 100 }] }) // Next post order
        .mockResolvedValueOnce({ rowCount: 1 }) // Update content_queue
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert posted_content
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert system_logs

      const result = await postNextContent()

      expect(result.success).toBe(true)
      expect(result.contentId).toBe(1)
      expect(result.platform).toBe('reddit')
      expect(result.postOrder).toBe(100)
    })

    it('should fallback to approved content when no scheduled content due', async () => {
      const mockApprovedContent = {
        id: 2,
        content_text: 'Test approved content',
        source_platform: 'youtube',
        status: 'approved' as ContentStatus
      }

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No scheduled content due
        .mockResolvedValueOnce({ rows: [mockApprovedContent] }) // Approved content available
        .mockResolvedValueOnce({ rows: [{ next_order: 101 }] }) // Next post order
        .mockResolvedValueOnce({ rowCount: 1 }) // Update content_queue
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert posted_content
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert system_logs

      const result = await postNextContent()

      expect(result.success).toBe(true)
      expect(result.contentId).toBe(2)
      expect(result.platform).toBe('youtube')
    })

    it('should return error when no content available', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No scheduled content
        .mockResolvedValueOnce({ rows: [] }) // No approved content

      const result = await postNextContent()

      expect(result.success).toBe(false)
      expect(result.error).toContain('No approved content available')
    })
  })

  describe('postScheduledContentDue', () => {
    it('should post multiple scheduled content items', async () => {
      const mockScheduledContent = [
        {
          id: 1,
          content_text: 'Test 1',
          source_platform: 'reddit',
          status: 'scheduled' as ContentStatus,
          scheduled_for: new Date(Date.now() - 1000).toISOString()
        },
        {
          id: 2,
          content_text: 'Test 2',
          source_platform: 'youtube',
          status: 'scheduled' as ContentStatus,
          scheduled_for: new Date(Date.now() - 2000).toISOString()
        }
      ]

      mockDb.query
        .mockResolvedValueOnce({ rows: mockScheduledContent }) // Get scheduled content
        .mockResolvedValueOnce({ rows: [{ next_order: 100 }] }) // Next post order for first
        .mockResolvedValueOnce({ rowCount: 1 }) // Update first content
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert first posted_content
        .mockResolvedValueOnce({ rowCount: 1 }) // Log first
        .mockResolvedValueOnce({ rows: [{ next_order: 101 }] }) // Next post order for second
        .mockResolvedValueOnce({ rowCount: 1 }) // Update second content
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert second posted_content
        .mockResolvedValueOnce({ rowCount: 1 }) // Log second

      const result = await postScheduledContentDue()

      expect(result.summary.totalPosted).toBe(2)
      expect(result.summary.platformDistribution.reddit).toBe(1)
      expect(result.summary.platformDistribution.youtube).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle posting errors gracefully', async () => {
      const mockScheduledContent = [
        {
          id: 1,
          content_text: 'Test content',
          source_platform: 'reddit',
          status: 'scheduled' as ContentStatus
        }
      ]

      mockDb.query
        .mockResolvedValueOnce({ rows: mockScheduledContent })
        .mockResolvedValueOnce({ rows: [{ next_order: 100 }] })
        .mockRejectedValueOnce(new Error('Database error')) // Fail on update

      const result = await postScheduledContentDue()

      expect(result.summary.totalPosted).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Failed to post scheduled content')
    })

    it('should return early when no scheduled content due', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      const result = await postScheduledContentDue()

      expect(result.summary.totalPosted).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(result.posted).toHaveLength(0)
    })
  })

  describe('getPostingStats', () => {
    it('should return posting statistics', async () => {
      const mockStats = [
        { total_posted: 10, scheduled_posted: 8, manual_posted: 2 }
      ]
      const mockPlatformStats = [
        { source_platform: 'reddit', count: 5 },
        { source_platform: 'youtube', count: 3 },
        { source_platform: 'giphy', count: 2 }
      ]
      const mockDailyStats = [
        { date: '2025-10-08', count: 5, scheduled: 4, manual: 1 },
        { date: '2025-10-07', count: 5, scheduled: 4, manual: 1 }
      ]

      mockDb.query
        .mockResolvedValueOnce({ rows: mockStats }) // Overall stats
        .mockResolvedValueOnce({ rows: mockPlatformStats }) // Platform distribution
        .mockResolvedValueOnce({ rows: mockDailyStats }) // Daily breakdown

      const result = await getPostingStats(7)

      expect(result.totalPosted).toBe(10)
      expect(result.scheduledPosted).toBe(8)
      expect(result.manualPosted).toBe(2)
      expect(result.platformDistribution.reddit).toBe(5)
      expect(result.dailyBreakdown).toHaveLength(2)
    })

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'))

      const result = await getPostingStats(7)

      expect(result.totalPosted).toBe(0)
      expect(result.scheduledPosted).toBe(0)
      expect(result.manualPosted).toBe(0)
      expect(result.platformDistribution).toEqual({})
      expect(result.dailyBreakdown).toHaveLength(0)
    })
  })

  describe('postContent', () => {
    it('should post content and update database correctly', async () => {
      const mockContent = {
        id: 1,
        content_text: 'Test content',
        source_platform: 'reddit',
        scheduled_for: new Date().toISOString()
      }

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ next_order: 100 }] }) // Get post order
        .mockResolvedValueOnce({ rowCount: 1 }) // Update content_queue
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert posted_content
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert log

      const result = await postContent(mockContent, true)

      expect(result.success).toBe(true)
      expect(result.contentId).toBe(1)
      expect(result.platform).toBe('reddit')
      expect(result.postOrder).toBe(100)
    })

    it('should handle posting failures', async () => {
      const mockContent = {
        id: 1,
        content_text: 'Test content',
        source_platform: 'reddit'
      }

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ next_order: 100 }] })
        .mockRejectedValueOnce(new Error('Database error'))

      const result = await postContent(mockContent, false)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to post content')
    })
  })

  describe('posting order generation', () => {
    it('should generate sequential post orders', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ next_order: 123 }] })

      const mockContent = {
        id: 1,
        content_text: 'Test',
        source_platform: 'reddit'
      }

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ next_order: 123 }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })

      const result = await postContent(mockContent, false)

      expect(result.postOrder).toBe(123)
    })

    it('should fallback to timestamp when order query fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Query failed'))

      const mockContent = {
        id: 1,
        content_text: 'Test',
        source_platform: 'reddit'
      }

      // Mock the remaining queries for successful posting
      mockDb.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })

      const result = await postContent(mockContent, false)

      expect(result.postOrder).toBeGreaterThan(Date.now() - 1000)
    })
  })
})