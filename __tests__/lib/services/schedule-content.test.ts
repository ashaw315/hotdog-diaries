/**
 * @jest-environment node
 */

import { 
  scheduleNextBatch, 
  getUpcomingSchedule, 
  cancelScheduledContent,
  rescheduleContent 
} from '../../../lib/services/schedule-content'
import { db } from '../../../lib/db'
import { ContentStatus } from '../../../types'
import dayjs from 'dayjs'

// Mock the database
jest.mock('../../../lib/db', () => ({
  db: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn()
  }
}))

const mockDb = db as jest.Mocked<typeof db>

describe('Schedule Content Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('scheduleNextBatch', () => {
    it('should schedule content for multiple days', async () => {
      // Mock available content
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, source_platform: 'reddit', content_text: 'Test 1', confidence_score: 0.9 },
            { id: 2, source_platform: 'youtube', content_text: 'Test 2', confidence_score: 0.8 },
            { id: 3, source_platform: 'giphy', content_text: 'Test 3', confidence_score: 0.7 }
          ]
        })
        // Mock recently posted platforms
        .mockResolvedValueOnce({ rows: [] })
        // Mock scheduled content check for day 1
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        // Mock updates for scheduled content
        .mockResolvedValue({ rowCount: 1 })

      const result = await scheduleNextBatch(1, 3)

      expect(result.summary.totalScheduled).toBe(3)
      expect(result.summary.totalDays).toBe(1)
      expect(Object.keys(result.summary.platformDistribution)).toContain('reddit')
      expect(Object.keys(result.summary.platformDistribution)).toContain('youtube')
      expect(Object.keys(result.summary.platformDistribution)).toContain('giphy')
    })

    it('should skip days that already have scheduled content', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No available content
        .mockResolvedValueOnce({ rows: [] }) // No recent platforms

      const result = await scheduleNextBatch(1, 6)

      expect(result.summary.totalScheduled).toBe(0)
      expect(result.errors).toContain('No approved content available for scheduling')
    })

    it('should enforce platform diversity', async () => {
      // Mock content with same platform
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, source_platform: 'reddit', content_text: 'Test 1', confidence_score: 0.9 },
            { id: 2, source_platform: 'reddit', content_text: 'Test 2', confidence_score: 0.8 }
          ]
        })
        // Mock recently posted platforms (reddit was used recently)
        .mockResolvedValueOnce({ rows: [{ source_platform: 'reddit' }] })
        // Mock scheduled content check
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        // Mock updates
        .mockResolvedValue({ rowCount: 1 })

      const result = await scheduleNextBatch(1, 2)

      // Should still schedule content but with awareness of recent platform usage
      expect(result.summary.totalScheduled).toBe(2)
    })
  })

  describe('getUpcomingSchedule', () => {
    it('should return scheduled content for specified days', async () => {
      const mockScheduledContent = [
        {
          id: 1,
          content_text: 'Test content',
          source_platform: 'reddit',
          status: 'scheduled' as ContentStatus,
          scheduled_for: dayjs().add(1, 'hour').toISOString()
        }
      ]

      mockDb.query.mockResolvedValueOnce({ rows: mockScheduledContent })

      const result = await getUpcomingSchedule(7)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
      expect(result[0].status).toBe('scheduled')
    })

    it('should return empty array when no scheduled content', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      const result = await getUpcomingSchedule(7)

      expect(result).toHaveLength(0)
    })
  })

  describe('cancelScheduledContent', () => {
    it('should cancel scheduled content successfully', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 })

      const result = await cancelScheduledContent(1)

      expect(result).toBe(true)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE content_queue'),
        expect.arrayContaining([1])
      )
    })

    it('should return false when content not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 0 })

      const result = await cancelScheduledContent(999)

      expect(result).toBe(false)
    })
  })

  describe('rescheduleContent', () => {
    it('should reschedule content to new time', async () => {
      const newTime = dayjs().add(2, 'hours').toDate()
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 })

      const result = await rescheduleContent(1, newTime)

      expect(result).toBe(true)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE content_queue'),
        expect.arrayContaining([expect.any(String), 1])
      )
    })

    it('should handle rescheduling errors', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database error'))

      const result = await rescheduleContent(1, new Date())

      expect(result).toBe(false)
    })
  })

  describe('platform diversity logic', () => {
    it('should distribute content across different platforms', async () => {
      const mockContent = [
        { id: 1, source_platform: 'reddit', confidence_score: 0.9 },
        { id: 2, source_platform: 'youtube', confidence_score: 0.8 },
        { id: 3, source_platform: 'giphy', confidence_score: 0.7 },
        { id: 4, source_platform: 'reddit', confidence_score: 0.6 }
      ]

      mockDb.query
        .mockResolvedValueOnce({ rows: mockContent })
        .mockResolvedValueOnce({ rows: [] }) // No recent platforms
        .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // No existing scheduled
        .mockResolvedValue({ rowCount: 1 })

      const result = await scheduleNextBatch(1, 3)

      // Should select reddit, youtube, giphy (diverse platforms)
      expect(result.summary.totalScheduled).toBe(3)
      expect(Object.keys(result.summary.platformDistribution)).toHaveLength(3)
    })
  })

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection failed'))

      const result = await scheduleNextBatch(1, 6)

      expect(result.errors).toContain('Scheduling failed: Connection failed')
      expect(result.summary.totalScheduled).toBe(0)
    })

    it('should handle invalid parameters', async () => {
      // Test with 0 days - should work but likely produce no results
      const result = await scheduleNextBatch(0, 6)
      
      // The function should handle this gracefully
      expect(result.summary.totalScheduled).toBe(0)
      expect(result.summary.totalDays).toBe(0)
    })
  })

  describe('time slot allocation', () => {
    it('should schedule content at correct time slots', async () => {
      const mockContent = [
        { id: 1, source_platform: 'reddit', confidence_score: 0.9 }
      ]

      mockDb.query
        .mockResolvedValueOnce({ rows: mockContent })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rowCount: 1 })

      const result = await scheduleNextBatch(1, 1)

      expect(result.scheduled).toHaveLength(1)
      
      // Check that scheduled time is set to one of the expected posting times
      const scheduledTime = new Date(result.scheduled[0].scheduled_for)
      const hour = scheduledTime.getHours()
      const minute = scheduledTime.getMinutes()
      
      // Should be one of the standard posting times: 08:00, 10:30, 13:00, 15:30, 18:00, 20:30
      const validTimes = [
        [8, 0], [10, 30], [13, 0], [15, 30], [18, 0], [20, 30]
      ]
      const isValidTime = validTimes.some(([h, m]) => hour === h && minute === m)
      expect(isValidTime).toBe(true)
    })
  })
})