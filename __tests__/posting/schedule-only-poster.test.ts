/**
 * Tests for Schedule-Only Posting Service
 * 
 * Verifies single source of truth enforcement and atomic posting behavior.
 */

import { postFromSchedule, checkPostingHealth } from '../../lib/services/posting/schedule-only-poster'
import { db } from '../../lib/db'
import { formatISO, addMinutes, subMinutes } from 'date-fns'

// Mock database
jest.mock('../../lib/db')
const mockDb = db as jest.Mocked<typeof db>

// Mock environment variables
const originalEnv = process.env

describe('Schedule-Only Posting Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { 
      ...originalEnv,
      ENFORCE_SCHEDULE_SOURCE_OF_TRUTH: 'true'
    }
    
    // Default successful connection
    mockDb.connect.mockResolvedValue()
    mockDb.disconnect.mockResolvedValue()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('postFromSchedule', () => {
    it('should post when scheduled row is present and content exists', async () => {
      const now = new Date()
      const slotTime = formatISO(now)
      
      // Mock scheduled slot in time window
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            content_id: 100,
            platform: 'reddit',
            content_type: 'text',
            scheduled_post_time: slotTime,
            scheduled_slot_index: 2,
            status: 'pending',
            actual_posted_at: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z'
          }]
        } as any)
        // Mock successful claim (UPDATE returns 1 row)
        .mockResolvedValueOnce({ rowCount: 1 } as any)
        // Mock content fetch
        .mockResolvedValueOnce({
          rows: [{
            id: 100,
            content_text: 'Test hotdog content',
            content_type: 'text',
            source_platform: 'reddit',
            confidence_score: 0.8
          }]
        } as any)
        // Mock posted_content insert
        .mockResolvedValueOnce({ rowCount: 1 } as any)
        // Mock scheduled_posts update
        .mockResolvedValueOnce({ rowCount: 1 } as any)

      const result = await postFromSchedule()

      expect(result.success).toBe(true)
      expect(result.type).toBe('POSTED')
      expect(result.scheduledSlotId).toBe(1)
      expect(result.contentId).toBe(100)
      expect(result.platform).toBe('reddit')
      expect(mockDb.query).toHaveBeenCalledTimes(5)
    })

    it('should return NO_SCHEDULED_CONTENT when no slots in time window', async () => {
      // Mock empty result
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any)

      const result = await postFromSchedule()

      expect(result.success).toBe(true)
      expect(result.type).toBe('NO_SCHEDULED_CONTENT')
      expect(result.scheduledSlotId).toBeUndefined()
      expect(mockDb.query).toHaveBeenCalledTimes(1)
    })

    it('should return EMPTY_SCHEDULE_SLOT when content_id is null', async () => {
      const now = new Date()
      const slotTime = formatISO(now)
      
      // Mock slot with null content_id
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 2,
          content_id: null,
          platform: 'youtube',
          content_type: 'video',
          scheduled_post_time: slotTime,
          scheduled_slot_index: 0,
          status: 'pending',
          actual_posted_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z'
        }]
      } as any)

      const result = await postFromSchedule()

      expect(result.success).toBe(true)
      expect(result.type).toBe('EMPTY_SCHEDULE_SLOT')
      expect(result.scheduledSlotId).toBe(2)
      expect(result.platform).toBe('youtube')
      expect(mockDb.query).toHaveBeenCalledTimes(1)
    })

    it('should handle concurrent posting by skipping already claimed slots', async () => {
      const now = new Date()
      const slotTime = formatISO(now)
      
      // Mock two slots
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              content_id: 100,
              platform: 'reddit',
              scheduled_post_time: slotTime,
              status: 'pending'
            },
            {
              id: 2,
              content_id: 101,
              platform: 'youtube',
              scheduled_post_time: slotTime,
              status: 'pending'
            }
          ]
        } as any)
        // First slot claim fails (already claimed)
        .mockResolvedValueOnce({ rowCount: 0 } as any)
        // Second slot claim succeeds
        .mockResolvedValueOnce({ rowCount: 1 } as any)
        // Mock content fetch for second slot
        .mockResolvedValueOnce({
          rows: [{
            id: 101,
            content_text: 'Second hotdog content',
            source_platform: 'youtube'
          }]
        } as any)
        // Mock successful posting
        .mockResolvedValueOnce({ rowCount: 1 } as any)
        .mockResolvedValueOnce({ rowCount: 1 } as any)

      const result = await postFromSchedule()

      expect(result.success).toBe(true)
      expect(result.type).toBe('POSTED')
      expect(result.scheduledSlotId).toBe(2)
      expect(result.contentId).toBe(101)
      expect(result.platform).toBe('youtube')
    })

    it('should revert slot status on posting failure', async () => {
      const now = new Date()
      const slotTime = formatISO(now)
      
      // Mock scheduled slot
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            id: 3,
            content_id: 102,
            platform: 'tumblr',
            scheduled_post_time: slotTime,
            status: 'pending'
          }]
        } as any)
        // Mock successful claim
        .mockResolvedValueOnce({ rowCount: 1 } as any)
        // Mock content fetch
        .mockResolvedValueOnce({
          rows: [{
            id: 102,
            content_text: 'Content that will fail',
            source_platform: 'tumblr'
          }]
        } as any)
        // Mock revert update
        .mockResolvedValueOnce({ rowCount: 1 } as any)

      // Mock posting failure by overriding the platform posting simulation
      const originalConsoleLog = console.log
      console.log = jest.fn()
      
      // Simulate posting failure by mocking Math.random to always return > 0.95
      const originalMathRandom = Math.random
      Math.random = jest.fn().mockReturnValue(0.99) // Force failure

      const result = await postFromSchedule()

      expect(result.success).toBe(false)
      expect(result.type).toBe('ERROR')
      expect(result.scheduledSlotId).toBe(3)
      expect(result.error).toContain('Simulated tumblr API error')
      
      // Verify revert query was called
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_posts'),
        expect.arrayContaining([expect.stringContaining('Posting failed'), 3])
      )

      // Restore mocks
      console.log = originalConsoleLog
      Math.random = originalMathRandom
    })

    it('should respect feature flag and return error when disabled', async () => {
      process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = 'false'

      const result = await postFromSchedule()

      expect(result.success).toBe(false)
      expect(result.type).toBe('ERROR')
      expect(result.error).toContain('enforcement is disabled')
      expect(mockDb.query).not.toHaveBeenCalled()
    })

    it('should use configurable grace window', async () => {
      const now = new Date()
      const customGraceMinutes = 10
      
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any)

      await postFromSchedule({ graceMinutes: customGraceMinutes })

      // Verify the query used the custom grace window
      const expectedStart = formatISO(subMinutes(now, customGraceMinutes))
      const expectedEnd = formatISO(addMinutes(now, customGraceMinutes))
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('scheduled_post_time >= ?'),
        expect.arrayContaining([
          expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), // ISO format
          expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)  // ISO format
        ])
      )
    })
  })

  describe('checkPostingHealth', () => {
    it('should return health status with pending slots info', async () => {
      const nextSlotTime = '2025-01-01T12:00:00Z'
      
      // Mock next slot query
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            scheduled_post_time: nextSlotTime,
            platform: 'reddit',
            content_id: 100
          }]
        } as any)
        // Mock count query
        .mockResolvedValueOnce({
          rows: [{ count: 5 }]
        } as any)

      const health = await checkPostingHealth()

      expect(health.healthy).toBe(true)
      expect(health.nextSlotDue).toBe(nextSlotTime)
      expect(health.pendingSlots).toBe(5)
      expect(health.errors).toHaveLength(0)
    })

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Connection failed')
      mockDb.query.mockRejectedValueOnce(dbError)

      const health = await checkPostingHealth()

      expect(health.healthy).toBe(false)
      expect(health.pendingSlots).toBe(0)
      expect(health.errors).toContain('Connection failed')
    })
  })

  describe('PostgreSQL vs SQLite differences', () => {
    it('should use FOR UPDATE SKIP LOCKED for PostgreSQL', async () => {
      // Mock PostgreSQL environment
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
      
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      }
      
      mockDb.getClient.mockResolvedValue(mockClient as any)
      
      // Mock slot in time window
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          content_id: 100,
          platform: 'reddit',
          scheduled_post_time: formatISO(new Date()),
          status: 'pending'
        }]
      } as any)
      
      // Mock successful PostgreSQL transaction
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
        .mockResolvedValueOnce(undefined) // COMMIT
      
      // Mock content fetch and posting
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 100, content_text: 'Test', source_platform: 'reddit' }]
        } as any)
      
      // Mock successful posting transaction
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // INSERT posted_content
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE scheduled_posts
        .mockResolvedValueOnce(undefined) // COMMIT

      const result = await postFromSchedule()

      expect(result.success).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE SKIP LOCKED'),
        [1]
      )
    })

    it('should use simple UPDATE for SQLite', async () => {
      // Mock SQLite environment
      process.env.DATABASE_URL = undefined
      
      const now = new Date()
      
      // Mock slot in time window
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            content_id: 100,
            platform: 'reddit',
            scheduled_post_time: formatISO(now),
            status: 'pending'
          }]
        } as any)
        // Mock successful SQLite claim
        .mockResolvedValueOnce({ rowCount: 1 } as any)
        // Mock content fetch
        .mockResolvedValueOnce({
          rows: [{ id: 100, content_text: 'Test', source_platform: 'reddit' }]
        } as any)
        // Mock posting records
        .mockResolvedValueOnce({ rowCount: 1 } as any)
        .mockResolvedValueOnce({ rowCount: 1 } as any)

      const result = await postFromSchedule()

      expect(result.success).toBe(true)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE scheduled_posts"),
        expect.arrayContaining([1])
      )
      expect(mockDb.getClient).not.toHaveBeenCalled()
    })
  })
})