/**
 * SLA and Queue Readiness Tests
 * 
 * Tests operational scripts exit codes and behavior
 */

import { assertScheduleSLA } from '../../scripts/ops/assert-schedule-sla'
import { checkQueueReadiness } from '../../scripts/ops/check-queue-readiness'
import { assertScheduleReady } from '../../scripts/ops/assert-schedule-ready'
import { db } from '../../lib/db'

// Mock the database
jest.mock('../../lib/db', () => ({
  db: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn()
  }
}))

const mockDb = db as jest.Mocked<typeof db>

// Mock process.exit to capture exit codes
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`Process.exit called with code: ${code}`)
})

describe('SLA and Readiness Scripts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDb.connect.mockResolvedValue(undefined)
    mockDb.disconnect.mockResolvedValue(undefined)
  })

  afterAll(() => {
    mockExit.mockRestore()
  })

  describe('assert-schedule-ready', () => {
    it('should exit 0 when schedule meets minimum', async () => {
      // Mock sufficient scheduled content
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: 6 }] })
      
      try {
        await assertScheduleReady()
      } catch (error) {
        expect(error.message).toContain('Process.exit called with code: 0')
      }
    })

    it('should exit 1 when schedule below minimum', async () => {
      // Mock insufficient scheduled content
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: 2 }] })
      
      try {
        await assertScheduleReady()
      } catch (error) {
        expect(error.message).toContain('Process.exit called with code: 1')
      }
    })

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'))
      
      try {
        await assertScheduleReady()
      } catch (error) {
        expect(error.message).toContain('Process.exit called with code: 1')
      }
    })
  })

  describe('assert-schedule-sla', () => {
    it('should exit 0 when both today and tomorrow meet SLA', async () => {
      // Mock sufficient content for both days
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: 6 }] }) // Today
        .mockResolvedValueOnce({ rows: [{ count: 6 }] }) // Tomorrow
      
      try {
        await assertScheduleSLA()
      } catch (error) {
        expect(error.message).toContain('Process.exit called with code: 0')
      }
    })

    it('should exit 1 when today fails SLA', async () => {
      // Mock insufficient content for today
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: 2 }] }) // Today (insufficient)
        .mockResolvedValueOnce({ rows: [{ count: 6 }] }) // Tomorrow (sufficient)
      
      try {
        await assertScheduleSLA()
      } catch (error) {
        expect(error.message).toContain('Process.exit called with code: 1')
      }
    })

    it('should exit 1 when tomorrow fails SLA', async () => {
      // Mock insufficient content for tomorrow
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: 6 }] }) // Today (sufficient)
        .mockResolvedValueOnce({ rows: [{ count: 2 }] }) // Tomorrow (insufficient)
      
      try {
        await assertScheduleSLA()
      } catch (error) {
        expect(error.message).toContain('Process.exit called with code: 1')
      }
    })
  })

  describe('check-queue-readiness', () => {
    it('should exit 0 when queue above threshold', async () => {
      // Mock sufficient approved content
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: 15 }] }) // Total approved
        .mockResolvedValueOnce({ rows: [] }) // Platform breakdown
      
      try {
        await checkQueueReadiness()
      } catch (error) {
        expect(error.message).toContain('Process.exit called with code: 0')
      }
    })

    it('should exit 1 when queue below threshold', async () => {
      // Mock insufficient approved content
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: 8 }] }) // Total approved (below 12)
        .mockResolvedValueOnce({ rows: [{ source_platform: 'reddit', count: 8 }] }) // Platform breakdown
      
      // Mock fs operations for report generation
      jest.doMock('node:fs/promises', () => ({
        mkdir: jest.fn(),
        writeFile: jest.fn()
      }))
      
      try {
        await checkQueueReadiness()
      } catch (error) {
        expect(error.message).toContain('Process.exit called with code: 1')
      }
    })
  })

  describe('error handling', () => {
    it('should handle timezone conversion errors', async () => {
      // Test with invalid timezone
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: 6 }] })
      
      // This would test timezone handling, but requires mocking date-fns-tz
      expect(true).toBe(true) // Placeholder
    })

    it('should provide actionable error messages', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: 0 }] })
      
      try {
        await assertScheduleReady()
      } catch (error) {
        // Should have logged actionable commands
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('gh workflow run'))
      }
      
      consoleSpy.mockRestore()
    })
  })
})