/**
 * @jest-environment node
 */

import { ensureDayFilled, refillTwoDays } from '../../../lib/jobs/schedule-content-production'
import { db } from '../../../lib/db'

// Mock the database and Supabase
jest.mock('../../../lib/db', () => ({
  db: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn()
  }
}))

jest.mock('@/utils/supabase/server', () => ({
  createSimpleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis()
    }))
  }))
}))

const mockDb = db as jest.Mocked<typeof db>

describe('Two-Day Refill Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset environment to test mode
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL_SQLITE = './test_db.db'
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('ensureDayFilled', () => {
    it('should fill day with normal strategy when pool is adequate', async () => {
      // Mock adequate content pool
      mockDb.query
        .mockResolvedValueOnce({ // getScheduledPosts - existing 2 slots
          rows: [
            { id: 1, scheduled_slot_index: 0, content_id: 100 },
            { id: 2, scheduled_slot_index: 1, content_id: 101 }
          ]
        })
        .mockResolvedValueOnce({ // getCandidates - plenty available
          rows: [
            { id: 200, source_platform: 'reddit', content_type: 'text', confidence_score: 0.9 },
            { id: 201, source_platform: 'pixabay', content_type: 'image', confidence_score: 0.8 },
            { id: 202, source_platform: 'youtube', content_type: 'video', confidence_score: 0.7 },
            { id: 203, source_platform: 'tumblr', content_type: 'text', confidence_score: 0.6 }
          ]
        })
        .mockResolvedValueOnce({ // insertScheduledPosts
          rowCount: 4
        })

      const result = await ensureDayFilled('2025-10-16', { aggressiveFallback: false })

      expect(result.before).toBe(2)
      expect(result.count_added).toBe(4)
      expect(result.after).toBe(6)
      expect(result.platforms).toEqual({
        reddit: 1,
        pixabay: 1,
        youtube: 1,
        tumblr: 1
      })
    })

    it('should use aggressive fallback when normal strategy insufficient', async () => {
      // Mock small content pool requiring aggressive mode
      mockDb.query
        .mockResolvedValueOnce({ // getScheduledPosts - only 1 slot filled
          rows: [
            { id: 1, scheduled_slot_index: 0, content_id: 100 }
          ]
        })
        .mockResolvedValueOnce({ // getCandidates normal (ingest_priority >= 0) - insufficient
          rows: [
            { id: 200, source_platform: 'reddit', content_type: 'text', confidence_score: 0.9 }
          ]
        })
        .mockResolvedValueOnce({ // insertScheduledPosts - partial fill
          rowCount: 1
        })
        .mockResolvedValueOnce({ // getScheduledPosts again for aggressive check
          rows: [
            { id: 1, scheduled_slot_index: 0, content_id: 100 },
            { id: 2, scheduled_slot_index: 1, content_id: 200 }
          ]
        })
        .mockResolvedValueOnce({ // getCandidates aggressive (ingest_priority >= -1) - more available
          rows: [
            { id: 300, source_platform: 'lemmy', content_type: 'text', confidence_score: 0.4 },
            { id: 301, source_platform: 'imgur', content_type: 'image', confidence_score: 0.3 },
            { id: 302, source_platform: 'giphy', content_type: 'gif', confidence_score: 0.2 },
            { id: 303, source_platform: 'bluesky', content_type: 'text', confidence_score: 0.1 }
          ]
        })
        .mockResolvedValueOnce({ // insertScheduledPosts - complete fill
          rowCount: 4
        })

      const result = await ensureDayFilled('2025-10-16', { aggressiveFallback: true })

      expect(result.before).toBe(1)
      expect(result.count_added).toBe(5) // 1 normal + 4 aggressive
      expect(result.after).toBe(6)
      expect(result.platforms).toEqual({
        reddit: 1,
        lemmy: 1,
        imgur: 1,
        giphy: 1,
        bluesky: 1
      })
    })

    it('should handle small pool gracefully when aggressive fallback still insufficient', async () => {
      // Mock very small content pool
      mockDb.query
        .mockResolvedValueOnce({ // getScheduledPosts - empty
          rows: []
        })
        .mockResolvedValueOnce({ // getCandidates normal - only 1 item
          rows: [
            { id: 200, source_platform: 'reddit', content_type: 'text', confidence_score: 0.9 }
          ]
        })
        .mockResolvedValueOnce({ // insertScheduledPosts
          rowCount: 1
        })
        .mockResolvedValueOnce({ // getScheduledPosts again for aggressive check
          rows: [
            { id: 1, scheduled_slot_index: 0, content_id: 200 }
          ]
        })
        .mockResolvedValueOnce({ // getCandidates aggressive - only 2 more items
          rows: [
            { id: 300, source_platform: 'lemmy', content_type: 'text', confidence_score: 0.2 },
            { id: 301, source_platform: 'imgur', content_type: 'image', confidence_score: 0.1 }
          ]
        })
        .mockResolvedValueOnce({ // insertScheduledPosts
          rowCount: 2
        })

      const result = await ensureDayFilled('2025-10-16', { aggressiveFallback: true })

      expect(result.before).toBe(0)
      expect(result.count_added).toBe(3) // 1 normal + 2 aggressive
      expect(result.after).toBe(3) // Still < 6 slots
      expect(result.platforms).toEqual({
        reddit: 1,
        lemmy: 1,
        imgur: 1
      })
    })

    it('should handle ET boundary correctness for date calculations', async () => {
      // Mock timezone-sensitive date test
      mockDb.query
        .mockResolvedValueOnce({ // getScheduledPosts
          rows: []
        })
        .mockResolvedValueOnce({ // getCandidates
          rows: [
            { id: 200, source_platform: 'reddit', content_type: 'text', confidence_score: 0.9 }
          ]
        })
        .mockResolvedValueOnce({ // insertScheduledPosts
          rowCount: 1
        })

      // Test with specific ET date that could have timezone issues
      const result = await ensureDayFilled('2025-03-09', { aggressiveFallback: false }) // DST transition date

      expect(result.before).toBe(0)
      expect(result.count_added).toBe(1)
      expect(result.after).toBe(1)
      
      // Verify the database was called with correct UTC conversion
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('2025-03-09'), // Should handle DST correctly
        expect.any(Array)
      )
    })
  })

  describe('refillTwoDays', () => {
    it('should orchestrate both today and tomorrow with aggressive fallback', async () => {
      // Mock successful fills for both days
      mockDb.query
        // Today calls
        .mockResolvedValueOnce({ rows: [] }) // getScheduledPosts today
        .mockResolvedValueOnce({ // getCandidates today
          rows: [
            { id: 200, source_platform: 'reddit', content_type: 'text', confidence_score: 0.9 },
            { id: 201, source_platform: 'pixabay', content_type: 'image', confidence_score: 0.8 },
            { id: 202, source_platform: 'youtube', content_type: 'video', confidence_score: 0.7 }
          ]
        })
        .mockResolvedValueOnce({ rowCount: 3 }) // insertScheduledPosts today
        .mockResolvedValueOnce({ // getScheduledPosts today check
          rows: [
            { id: 1, scheduled_slot_index: 0, content_id: 200 },
            { id: 2, scheduled_slot_index: 1, content_id: 201 },
            { id: 3, scheduled_slot_index: 2, content_id: 202 }
          ]
        })
        .mockResolvedValueOnce({ // getCandidates today aggressive
          rows: [
            { id: 300, source_platform: 'tumblr', content_type: 'text', confidence_score: 0.4 },
            { id: 301, source_platform: 'lemmy', content_type: 'image', confidence_score: 0.3 },
            { id: 302, source_platform: 'imgur', content_type: 'gif', confidence_score: 0.2 }
          ]
        })
        .mockResolvedValueOnce({ rowCount: 3 }) // insertScheduledPosts today aggressive
        // Tomorrow calls
        .mockResolvedValueOnce({ rows: [] }) // getScheduledPosts tomorrow
        .mockResolvedValueOnce({ // getCandidates tomorrow
          rows: [
            { id: 400, source_platform: 'bluesky', content_type: 'text', confidence_score: 0.8 },
            { id: 401, source_platform: 'giphy', content_type: 'gif', confidence_score: 0.7 }
          ]
        })
        .mockResolvedValueOnce({ rowCount: 2 }) // insertScheduledPosts tomorrow
        .mockResolvedValueOnce({ // getScheduledPosts tomorrow check
          rows: [
            { id: 4, scheduled_slot_index: 0, content_id: 400 },
            { id: 5, scheduled_slot_index: 1, content_id: 401 }
          ]
        })
        .mockResolvedValueOnce({ // getCandidates tomorrow aggressive
          rows: [
            { id: 500, source_platform: 'pixabay', content_type: 'image', confidence_score: 0.3 },
            { id: 501, source_platform: 'reddit', content_type: 'text', confidence_score: 0.2 },
            { id: 502, source_platform: 'youtube', content_type: 'video', confidence_score: 0.1 },
            { id: 503, source_platform: 'tumblr', content_type: 'text', confidence_score: 0.05 }
          ]
        })
        .mockResolvedValueOnce({ rowCount: 4 }) // insertScheduledPosts tomorrow aggressive

      const result = await refillTwoDays('2025-10-16')

      expect(result.date).toBe('2025-10-16')
      expect(result.today.before).toBe(0)
      expect(result.today.after).toBe(6)
      expect(result.today.count_added).toBe(6)
      expect(result.tomorrow.before).toBe(0)
      expect(result.tomorrow.after).toBe(6)
      expect(result.tomorrow.count_added).toBe(6)
      
      expect(result.summary.total_before).toBe(0)
      expect(result.summary.total_after).toBe(12)
      expect(result.summary.total_added).toBe(12)
      expect(result.summary.days_complete).toBe(2)
      
      // Verify combined platform statistics
      expect(result.summary.combined_platforms).toEqual({
        reddit: 2, // 1 today + 1 tomorrow
        pixabay: 2, // 1 today + 1 tomorrow
        youtube: 2, // 1 today + 1 tomorrow
        tumblr: 2, // 1 today + 1 tomorrow
        lemmy: 1, // 1 today
        imgur: 1, // 1 today
        bluesky: 1, // 1 tomorrow
        giphy: 1 // 1 tomorrow
      })
    })

    it('should handle tomorrow calculation correctly across month boundaries', async () => {
      // Mock for month boundary test (e.g., 2025-10-31 → 2025-11-01)
      mockDb.query
        .mockResolvedValue({ rows: [], rowCount: 0 }) // All queries return empty for simplicity

      const result = await refillTwoDays('2025-10-31')

      expect(result.date).toBe('2025-10-31')
      
      // Verify that database queries were made for both 2025-10-31 and 2025-11-01
      const queryCallsString = mockDb.query.mock.calls.map(call => call[0]).join(' ')
      expect(queryCallsString).toContain('2025-10-31')
      expect(queryCallsString).toContain('2025-11-01')
    })

    it('should log structured summary with emoji indicators', async () => {
      // Mock minimal successful scenario
      mockDb.query
        .mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 })

      const consoleSpy = jest.spyOn(console, 'log')

      await refillTwoDays('2025-10-16')

      // Verify structured logging with emoji indicators
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Two-day refill orchestrator starting')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📅 Processing: Today=2025-10-16, Tomorrow=2025-10-17')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🎉 Two-day refill complete:')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Total slots:')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Complete days:')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🎯 Platform distribution:')
      )
    })
  })

  describe('Platform Counter Accuracy', () => {
    it('should accurately reflect platform adds per individual day', async () => {
      // Mock specific platform distribution
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // today initial
        .mockResolvedValueOnce({ // today candidates
          rows: [
            { id: 200, source_platform: 'reddit', content_type: 'text' },
            { id: 201, source_platform: 'reddit', content_type: 'text' },
            { id: 202, source_platform: 'pixabay', content_type: 'image' }
          ]
        })
        .mockResolvedValueOnce({ rowCount: 3 })
        .mockResolvedValueOnce({ rows: [1,2,3] }) // today check (3 slots)
        .mockResolvedValueOnce({ // today aggressive
          rows: [
            { id: 300, source_platform: 'youtube', content_type: 'video' },
            { id: 301, source_platform: 'youtube', content_type: 'video' },
            { id: 302, source_platform: 'tumblr', content_type: 'text' }
          ]
        })
        .mockResolvedValueOnce({ rowCount: 3 })

      const result = await ensureDayFilled('2025-10-16', { aggressiveFallback: true })

      expect(result.platforms).toEqual({
        reddit: 2,
        pixabay: 1,
        youtube: 2,
        tumblr: 1
      })
      expect(result.count_added).toBe(6)
    })

    it('should combine platform counters correctly across two days', async () => {
      // Mock different platform distributions for each day
      mockDb.query
        // Today: reddit=2, pixabay=1
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [
            { id: 200, source_platform: 'reddit', content_type: 'text' },
            { id: 201, source_platform: 'reddit', content_type: 'text' },
            { id: 202, source_platform: 'pixabay', content_type: 'image' }
          ]
        })
        .mockResolvedValueOnce({ rowCount: 3 })
        .mockResolvedValueOnce({ rows: [1,2,3] })
        .mockResolvedValueOnce({ rows: [] }) // no aggressive needed for today
        .mockResolvedValueOnce({ rowCount: 0 })
        // Tomorrow: reddit=1, youtube=2
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [
            { id: 300, source_platform: 'reddit', content_type: 'text' },
            { id: 301, source_platform: 'youtube', content_type: 'video' },
            { id: 302, source_platform: 'youtube', content_type: 'video' }
          ]
        })
        .mockResolvedValueOnce({ rowCount: 3 })
        .mockResolvedValueOnce({ rows: [1,2,3] })
        .mockResolvedValueOnce({ rows: [] }) // no aggressive needed for tomorrow
        .mockResolvedValueOnce({ rowCount: 0 })

      const result = await refillTwoDays('2025-10-16')

      expect(result.summary.combined_platforms).toEqual({
        reddit: 3, // 2 today + 1 tomorrow
        pixabay: 1, // 1 today + 0 tomorrow
        youtube: 2  // 0 today + 2 tomorrow
      })
    })
  })
})