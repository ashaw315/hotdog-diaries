/**
 * @jest-environment node
 */

import { POST } from '../../../../../../app/api/admin/schedule/forecast/refill/route'
import { NextRequest } from 'next/server'

// Mock the schedule-content-production functions
jest.mock('../../../../../../lib/jobs/schedule-content-production', () => ({
  generateDailySchedule: jest.fn(),
  refillTwoDays: jest.fn()
}))

import { generateDailySchedule, refillTwoDays } from '../../../../../../lib/jobs/schedule-content-production'

const mockGenerateDailySchedule = generateDailySchedule as jest.MockedFunction<typeof generateDailySchedule>
const mockRefillTwoDays = refillTwoDays as jest.MockedFunction<typeof refillTwoDays>

describe('/api/admin/schedule/forecast/refill', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock environment variable for authorization
    process.env.AUTH_TOKEN = 'test-auth-token'
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Authorization', () => {
    it('should reject requests without authorization token', async () => {
      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16')
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.error).toBe('unauthorized')
    })

    it('should accept requests with valid authorization token', async () => {
      mockGenerateDailySchedule.mockResolvedValue({
        date: '2025-10-16',
        filled: 2,
        slots: []
      } as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('should accept requests with x-admin-token header', async () => {
      mockGenerateDailySchedule.mockResolvedValue({
        date: '2025-10-16',
        filled: 1,
        slots: []
      } as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16', {
        headers: {
          'x-admin-token': 'test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid date format', async () => {
      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=invalid-date', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('invalid date (expected YYYY-MM-DD)')
    })

    it('should accept valid date format', async () => {
      mockGenerateDailySchedule.mockResolvedValue({
        date: '2025-10-16',
        filled: 0,
        slots: []
      } as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('should handle missing date parameter', async () => {
      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('invalid date (expected YYYY-MM-DD)')
    })
  })

  describe('Single-Day Mode (Default)', () => {
    it('should call generateDailySchedule for single-day refill', async () => {
      const mockResult = {
        date: '2025-10-16',
        filled: 3,
        slots: [
          { slot: 0, action: 'created', content_id: 123, platform: 'reddit', level: 'normal' },
          { slot: 1, action: 'kept', content_id: 124 },
          { slot: 2, action: 'skipped', reason: 'no_candidates_available' }
        ]
      }

      mockGenerateDailySchedule.mockResolvedValue(mockResult as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.date).toBe('2025-10-16')
      expect(data.filled).toBe(3)
      expect(data.slots).toEqual(mockResult.slots)
      
      expect(mockGenerateDailySchedule).toHaveBeenCalledWith('2025-10-16', {
        mode: 'refill-missing',
        forceRefill: true
      })
      expect(mockRefillTwoDays).not.toHaveBeenCalled()
    })

    it('should include debug information when requested', async () => {
      const mockResult = {
        date: '2025-10-16',
        filled: 2,
        slots: [
          { slot: 0, action: 'created', content_id: 123, level: 'relaxed' },
          { slot: 1, action: 'updated', content_id: 124, level: 'strict' }
        ],
        debug: {
          environment: 'test',
          candidates_found: 10,
          existing_slots: 4
        }
      }

      mockGenerateDailySchedule.mockResolvedValue(mockResult as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16&debug=1', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.debug).toEqual({
        picked: 2, // created + updated actions
        written: 2,
        skipped: 0,
        constraints: ['relaxed', 'strict'],
        environment: 'test',
        candidates_found: 10,
        existing_slots: 4
      })
    })
  })

  describe('Two-Day Mode', () => {
    it('should call refillTwoDays when twoDays=true', async () => {
      const mockResult = {
        date: '2025-10-16',
        today: {
          before: 2,
          count_added: 4,
          after: 6,
          platforms: { reddit: 2, pixabay: 2 }
        },
        tomorrow: {
          before: 1,
          count_added: 5,
          after: 6,
          platforms: { youtube: 3, tumblr: 2 }
        },
        summary: {
          total_before: 3,
          total_after: 12,
          total_added: 9,
          days_complete: 2,
          combined_platforms: { reddit: 2, pixabay: 2, youtube: 3, tumblr: 2 }
        }
      }

      mockRefillTwoDays.mockResolvedValue(mockResult as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16&twoDays=true', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.mode).toBe('two-days')
      expect(data.date).toBe('2025-10-16')
      expect(data.today).toEqual(mockResult.today)
      expect(data.tomorrow).toEqual(mockResult.tomorrow)
      expect(data.summary).toEqual(mockResult.summary)
      
      expect(mockRefillTwoDays).toHaveBeenCalledWith('2025-10-16')
      expect(mockGenerateDailySchedule).not.toHaveBeenCalled()
    })

    it('should handle twoDays=false as single-day mode', async () => {
      mockGenerateDailySchedule.mockResolvedValue({
        date: '2025-10-16',
        filled: 1,
        slots: []
      } as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16&twoDays=false', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockGenerateDailySchedule).toHaveBeenCalled()
      expect(mockRefillTwoDays).not.toHaveBeenCalled()
    })

    it('should work with twoDays=true and debug=1 combination', async () => {
      const mockResult = {
        date: '2025-10-16',
        today: { before: 0, count_added: 6, after: 6, platforms: { reddit: 6 } },
        tomorrow: { before: 0, count_added: 6, after: 6, platforms: { pixabay: 6 } },
        summary: {
          total_before: 0,
          total_after: 12,
          total_added: 12,
          days_complete: 2,
          combined_platforms: { reddit: 6, pixabay: 6 }
        }
      }

      mockRefillTwoDays.mockResolvedValue(mockResult as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16&twoDays=true&debug=1', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.mode).toBe('two-days')
      // Two-day mode doesn't currently support debug, but should still work
      expect(data.summary.total_added).toBe(12)
    })
  })

  describe('Error Handling', () => {
    it('should handle generateDailySchedule errors gracefully', async () => {
      const error = new Error('Database connection failed')
      mockGenerateDailySchedule.mockRejectedValue(error)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.ok).toBe(false)
      expect(data.error).toBe('Database connection failed')
      expect(data.date).toBe('2025-10-16')
    })

    it('should handle refillTwoDays errors gracefully', async () => {
      const error = new Error('Supabase query failed')
      mockRefillTwoDays.mockRejectedValue(error)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16&twoDays=true', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.ok).toBe(false)
      expect(data.error).toBe('Supabase query failed')
      expect(data.date).toBe('2025-10-16')
    })

    it('should provide postgres error hints when debug=1', async () => {
      const error = new Error('syntax error at or near "ORDER" at character 45')
      mockGenerateDailySchedule.mockRejectedValue(error)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16&debug=1', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.hint).toBe('Raw SQL ORDER BY detected - ensure all queries use Supabase query builder instead of raw SQL')
      expect(data.debug).toBeDefined()
      expect(data.debug.original_error).toContain('syntax error')
    })

    it('should detect and hint missing table errors', async () => {
      const error = new Error('relation "scheduled_posts" does not exist')
      mockRefillTwoDays.mockRejectedValue(error)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16&twoDays=true&debug=1', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.hint).toBe('Database table missing - ensure scheduled_posts table exists and is properly migrated')
    })
  })

  describe('Response Headers', () => {
    it('should include no-store cache control header', async () => {
      mockGenerateDailySchedule.mockResolvedValue({
        date: '2025-10-16',
        filled: 0,
        slots: []
      } as any)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      
      expect(response.headers.get('cache-control')).toBe('no-store')
    })

    it('should include no-store header even for error responses', async () => {
      const error = new Error('Test error')
      mockGenerateDailySchedule.mockRejectedValue(error)

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      const response = await POST(request)
      
      expect(response.headers.get('cache-control')).toBe('no-store')
    })
  })

  describe('Logging', () => {
    it('should log refill start and completion for single-day mode', async () => {
      mockGenerateDailySchedule.mockResolvedValue({
        date: '2025-10-16',
        filled: 3,
        slots: []
      } as any)

      const consoleSpy = jest.spyOn(console, 'log')

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      await POST(request)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Refill endpoint called for 2025-10-16 (debug: false, twoDays: false)')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Refill completed for 2025-10-16: 3 slots filled')
      )
    })

    it('should log two-day refill summary', async () => {
      const mockResult = {
        date: '2025-10-16',
        today: { before: 0, count_added: 6, after: 6, platforms: { reddit: 6 } },
        tomorrow: { before: 0, count_added: 6, after: 6, platforms: { pixabay: 6 } },
        summary: {
          total_before: 0,
          total_after: 12,
          total_added: 12,
          days_complete: 2,
          combined_platforms: { reddit: 6, pixabay: 6 }
        }
      }

      mockRefillTwoDays.mockResolvedValue(mockResult as any)

      const consoleSpy = jest.spyOn(console, 'log')

      const request = new NextRequest('http://localhost/api/admin/schedule/forecast/refill?date=2025-10-16&twoDays=true', {
        headers: {
          'authorization': 'Bearer test-auth-token'
        },
        method: 'POST'
      })
      
      await POST(request)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Refill endpoint called for 2025-10-16 (debug: false, twoDays: true)')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Two-day refill completed for 2025-10-16:')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Total added: 12 slots')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Complete days: 2/2')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🎯 Platform distribution: {"reddit":6,"pixabay":6}')
      )
    })
  })
})