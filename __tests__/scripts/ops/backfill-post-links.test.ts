/**
 * Tests for Backfill Post Links Script
 * 
 * Validates orphan post detection and matching logic.
 */

import { backfillOrphanPosts } from '../../../scripts/ops/backfill-post-links'
import { db } from '../../../lib/db'
import { createSimpleClient } from '../../../utils/supabase/server'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Mock dependencies
jest.mock('../../../lib/db')
jest.mock('../../../utils/supabase/server')
jest.mock('fs')
jest.mock('path')

const mockDb = db as jest.Mocked<typeof db>
const mockCreateSimpleClient = createSimpleClient as jest.MockedFunction<typeof createSimpleClient>
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>
const mockJoin = join as jest.MockedFunction<typeof join>

describe('Backfill Post Links Script', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    is: jest.fn(),
    order: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock console methods to reduce test noise
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    
    // Setup environment
    process.env.NODE_ENV = 'development'
    delete process.env.DATABASE_URL
    
    // Setup default mocks
    mockDb.connect.mockResolvedValue()
    mockDb.disconnect.mockResolvedValue()
    mockCreateSimpleClient.mockReturnValue(mockSupabaseClient as any)
    mockJoin.mockImplementation((...segments) => segments.join('/'))
  })

  describe('orphan detection', () => {
    it('should find orphan posts correctly', async () => {
      // Mock orphan posts query
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              content_queue_id: 100,
              platform: 'reddit',
              posted_at: '2025-01-15T14:30:00Z',
              scheduled_post_id: null
            },
            {
              id: 2,
              content_queue_id: 101,
              platform: 'youtube',
              posted_at: '2025-01-15T18:15:00Z',
              scheduled_post_id: null
            }
          ]
        } as any)
        // Mock scheduled posts query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              content_id: 100,
              platform: 'reddit',
              scheduled_post_time: '2025-01-15T14:32:00Z', // 2 minutes later
              scheduled_slot_index: 2
            },
            {
              id: 11,
              content_id: 102, // Different content
              platform: 'youtube',
              scheduled_post_time: '2025-01-15T18:00:00Z',
              scheduled_slot_index: 3
            }
          ]
        } as any)

      // Mock process.argv to simulate CLI call
      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15']

      try {
        await backfillOrphanPosts()

        // Verify orphan detection queries were called
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('scheduled_post_id IS NULL'),
          expect.any(Array)
        )
        
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('FROM scheduled_posts'),
          expect.any(Array)
        )

        // Verify report generation
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          expect.stringContaining('backfill-2025-01-15.md'),
          expect.stringContaining('# Backfill Report: 2025-01-15'),
          'utf8'
        )
      } finally {
        process.argv = originalArgv
      }
    })

    it('should handle empty orphan result gracefully', async () => {
      // Mock no orphan posts
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15']

      try {
        await backfillOrphanPosts()

        // Should still generate report
        expect(mockWriteFileSync).toHaveBeenCalled()
        const reportContent = mockWriteFileSync.mock.calls[0][1] as string
        expect(reportContent).toContain('Total Orphan Posts:** 0')
      } finally {
        process.argv = originalArgv
      }
    })
  })

  describe('matching strategies', () => {
    const mockOrphanPosts = [
      {
        id: 1,
        content_queue_id: 100,
        platform: 'reddit',
        posted_at: '2025-01-15T14:30:00Z',
        scheduled_post_id: null
      },
      {
        id: 2,
        content_queue_id: 200,
        platform: 'youtube',
        posted_at: '2025-01-15T18:00:00Z',
        scheduled_post_id: null
      }
    ]

    const mockScheduledPosts = [
      {
        id: 10,
        content_id: 100, // Exact match
        platform: 'reddit',
        scheduled_post_time: '2025-01-15T14:32:00Z', // 2 minutes later
        scheduled_slot_index: 2
      },
      {
        id: 11,
        content_id: 300, // Different content
        platform: 'youtube',
        scheduled_post_time: '2025-01-15T18:05:00Z', // 5 minutes later, same platform
        scheduled_slot_index: 3
      }
    ]

    it('should prefer exact content_id matches within time tolerance', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: mockOrphanPosts } as any)
        .mockResolvedValueOnce({ rows: mockScheduledPosts } as any)

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15']

      try {
        await backfillOrphanPosts()

        const reportContent = mockWriteFileSync.mock.calls[0][1] as string
        
        // Should find exact match for first orphan
        expect(reportContent).toContain('exact_content_id')
        expect(reportContent).toContain('| 1 | 100 |') // Orphan ID 1, content 100
        
        // Should find platform match for second orphan
        expect(reportContent).toContain('platform_nearest')
        expect(reportContent).toContain('| 2 | 200 |') // Orphan ID 2, content 200
      } finally {
        process.argv = originalArgv
      }
    })

    it('should fall back to platform matching when content_id does not match', async () => {
      const orphanWithNoExactMatch = [{
        id: 3,
        content_queue_id: 999, // No matching scheduled post
        platform: 'reddit',
        posted_at: '2025-01-15T14:30:00Z',
        scheduled_post_id: null
      }]

      const scheduledWithDifferentContent = [{
        id: 20,
        content_id: 888, // Different content
        platform: 'reddit', // Same platform
        scheduled_post_time: '2025-01-15T14:45:00Z', // 15 minutes later
        scheduled_slot_index: 2
      }]

      mockDb.query
        .mockResolvedValueOnce({ rows: orphanWithNoExactMatch } as any)
        .mockResolvedValueOnce({ rows: scheduledWithDifferentContent } as any)

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15']

      try {
        await backfillOrphanPosts()

        const reportContent = mockWriteFileSync.mock.calls[0][1] as string
        expect(reportContent).toContain('platform_nearest')
        expect(reportContent).toContain('15.0') // 15 minute delta
      } finally {
        process.argv = originalArgv
      }
    })

    it('should report no match when no suitable candidates exist', async () => {
      const orphanPost = [{
        id: 4,
        content_queue_id: 999,
        platform: 'reddit',
        posted_at: '2025-01-15T14:30:00Z',
        scheduled_post_id: null
      }]

      const scheduledPostTooFar = [{
        id: 30,
        content_id: 888,
        platform: 'youtube', // Different platform
        scheduled_post_time: '2025-01-15T20:00:00Z', // 5+ hours later
        scheduled_slot_index: 5
      }]

      mockDb.query
        .mockResolvedValueOnce({ rows: orphanPost } as any)
        .mockResolvedValueOnce({ rows: scheduledPostTooFar } as any)

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15']

      try {
        await backfillOrphanPosts()

        const reportContent = mockWriteFileSync.mock.calls[0][1] as string
        expect(reportContent).toContain('no_match')
        expect(reportContent).toContain('N/A') // No schedule ID
      } finally {
        process.argv = originalArgv
      }
    })
  })

  describe('dry run vs write mode', () => {
    const mockOrphanWithMatch = [{
      id: 5,
      content_queue_id: 500,
      platform: 'reddit',
      posted_at: '2025-01-15T14:30:00Z',
      scheduled_post_id: null
    }]

    const mockScheduledMatch = [{
      id: 50,
      content_id: 500,
      platform: 'reddit',
      scheduled_post_time: '2025-01-15T14:32:00Z',
      scheduled_slot_index: 2
    }]

    it('should not apply updates in dry run mode (default)', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: mockOrphanWithMatch } as any)
        .mockResolvedValueOnce({ rows: mockScheduledMatch } as any)

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15'] // No --write flag

      try {
        await backfillOrphanPosts()

        // Should not call UPDATE queries
        const updateCalls = mockDb.query.mock.calls.filter(call => 
          call[0].includes('UPDATE posted_content')
        )
        expect(updateCalls).toHaveLength(0)

        const reportContent = mockWriteFileSync.mock.calls[0][1] as string
        expect(reportContent).toContain('Mode:** DRY RUN')
        expect(reportContent).toContain('Updates Applied:** 0')
      } finally {
        process.argv = originalArgv
      }
    })

    it('should apply updates in write mode', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: mockOrphanWithMatch } as any)
        .mockResolvedValueOnce({ rows: mockScheduledMatch } as any)
        .mockResolvedValueOnce({ rowCount: 1 } as any) // Successful update

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15', '--write']

      try {
        await backfillOrphanPosts()

        // Should call UPDATE query
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE posted_content'),
          expect.arrayContaining([50, 5]) // scheduled_post_id=50, orphan_id=5
        )

        const reportContent = mockWriteFileSync.mock.calls[0][1] as string
        expect(reportContent).toContain('Mode:** WRITE')
        expect(reportContent).toContain('Updates Applied:** 1')
      } finally {
        process.argv = originalArgv
      }
    })
  })

  describe('Supabase environment', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
      process.env.NODE_ENV = 'production'
    })

    it('should work with Supabase client', async () => {
      // Setup Supabase client mocks
      mockSupabaseClient.from.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.select.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.gte.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.lte.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.is.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.order.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.update.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient)

      // Mock orphan posts query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [{
                    id: 1,
                    content_queue_id: 100,
                    platform: 'reddit',
                    posted_at: '2025-01-15T14:30:00Z',
                    scheduled_post_id: null
                  }],
                  error: null
                })
              })
            })
          })
        })
      } as any)

      // Mock scheduled posts query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [{
                  id: 10,
                  content_id: 100,
                  platform: 'reddit',
                  scheduled_post_time: '2025-01-15T14:32:00Z',
                  scheduled_slot_index: 2
                }],
                error: null
              })
            })
          })
        })
      } as any)

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15']

      try {
        await backfillOrphanPosts()

        expect(mockCreateSimpleClient).toHaveBeenCalled()
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('posted_content')
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      } finally {
        process.argv = originalArgv
      }
    })

    afterEach(() => {
      delete process.env.DATABASE_URL
      process.env.NODE_ENV = 'test'
    })
  })

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection failed'))

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', '2025-01-15']

      try {
        await backfillOrphanPosts()

        // Should still generate report with error
        const reportContent = mockWriteFileSync.mock.calls[0][1] as string
        expect(reportContent).toContain('## Errors')
        expect(reportContent).toContain('Connection failed')
      } finally {
        process.argv = originalArgv
      }
    })

    it('should validate date parameter format', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const originalArgv = process.argv
      process.argv = ['node', 'script.ts', '--date', 'invalid-date']

      try {
        await backfillOrphanPosts()
        
        // Should handle gracefully and still attempt to run
        expect(mockDb.query).toHaveBeenCalled()
      } finally {
        process.argv = originalArgv
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
})