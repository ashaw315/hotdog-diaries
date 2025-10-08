/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET, POST, PUT } from '../../../../../app/api/admin/queue/schedule/route'

// Mock the schedule service
jest.mock('../../../../../lib/services/schedule-content', () => ({
  scheduleNextBatch: jest.fn(),
  getUpcomingSchedule: jest.fn(),
  cancelScheduledContent: jest.fn(),
  rescheduleContent: jest.fn()
}))

// Mock the API middleware
jest.mock('../../../../../lib/api-middleware', () => ({
  validateRequestMethod: jest.fn(),
  createSuccessResponse: jest.fn((data, message) => 
    new Response(JSON.stringify({ success: true, data, message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  ),
  handleApiError: jest.fn((error) => 
    new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  ),
  authenticateAdmin: jest.fn()
}))

import { 
  scheduleNextBatch, 
  getUpcomingSchedule, 
  cancelScheduledContent,
  rescheduleContent 
} from '../../../../../lib/services/schedule-content'

const mockScheduleNextBatch = scheduleNextBatch as jest.MockedFunction<typeof scheduleNextBatch>
const mockGetUpcomingSchedule = getUpcomingSchedule as jest.MockedFunction<typeof getUpcomingSchedule>
const mockCancelScheduledContent = cancelScheduledContent as jest.MockedFunction<typeof cancelScheduledContent>
const mockRescheduleContent = rescheduleContent as jest.MockedFunction<typeof rescheduleContent>

describe('/api/admin/queue/schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/admin/queue/schedule', () => {
    it('should return upcoming scheduled content', async () => {
      const mockSchedule = [
        {
          id: 1,
          content_text: 'Test content',
          source_platform: 'reddit',
          scheduled_for: '2025-10-08T10:00:00Z',
          status: 'scheduled' as any
        }
      ]

      mockGetUpcomingSchedule.mockResolvedValueOnce(mockSchedule)

      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule?days=7&limit=10')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.schedule).toHaveLength(1)
      expect(data.data.total).toBe(1)
      expect(data.data.summary.totalScheduled).toBe(1)
      expect(mockGetUpcomingSchedule).toHaveBeenCalledWith(7)
    })

    it('should handle limit parameter correctly', async () => {
      const mockSchedule = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        content_text: `Content ${i + 1}`,
        source_platform: 'reddit',
        scheduled_for: '2025-10-08T10:00:00Z',
        status: 'scheduled' as any
      }))

      mockGetUpcomingSchedule.mockResolvedValueOnce(mockSchedule)

      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule?limit=5')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.schedule).toHaveLength(5)
      expect(data.data.total).toBe(20)
    })

    it('should calculate platform distribution correctly', async () => {
      const mockSchedule = [
        { id: 1, source_platform: 'reddit', scheduled_for: '2025-10-08T10:00:00Z', status: 'scheduled' as any },
        { id: 2, source_platform: 'reddit', scheduled_for: '2025-10-08T11:00:00Z', status: 'scheduled' as any },
        { id: 3, source_platform: 'youtube', scheduled_for: '2025-10-08T12:00:00Z', status: 'scheduled' as any }
      ]

      mockGetUpcomingSchedule.mockResolvedValueOnce(mockSchedule)

      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.summary.platformDistribution.reddit).toBe(2)
      expect(data.data.summary.platformDistribution.youtube).toBe(1)
    })
  })

  describe('POST /api/admin/queue/schedule', () => {
    it('should schedule content successfully', async () => {
      const mockResult = {
        scheduled: [
          { id: 1, source_platform: 'reddit', scheduled_for: '2025-10-08T10:00:00Z' }
        ],
        skipped: [],
        errors: [],
        summary: {
          totalScheduled: 1,
          totalDays: 1,
          platformDistribution: { reddit: 1 }
        }
      }

      mockScheduleNextBatch.mockResolvedValueOnce(mockResult)

      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'POST',
        body: JSON.stringify({ daysAhead: 7, postsPerDay: 6 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.summary.totalScheduled).toBe(1)
      expect(mockScheduleNextBatch).toHaveBeenCalledWith(7, 6)
    })

    it('should validate daysAhead parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'POST',
        body: JSON.stringify({ daysAhead: 50, postsPerDay: 6 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('daysAhead must be between 1 and 30')
    })

    it('should validate postsPerDay parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'POST',
        body: JSON.stringify({ daysAhead: 7, postsPerDay: 20 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('postsPerDay must be between 1 and 12')
    })

    it('should use default values when parameters not provided', async () => {
      const mockResult = {
        scheduled: [],
        skipped: [],
        errors: [],
        summary: { totalScheduled: 0, totalDays: 0, platformDistribution: {} }
      }

      mockScheduleNextBatch.mockResolvedValueOnce(mockResult)

      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'POST',
        body: JSON.stringify({})
      })

      await POST(request)

      expect(mockScheduleNextBatch).toHaveBeenCalledWith(7, 6) // Default values
    })
  })

  describe('PUT /api/admin/queue/schedule', () => {
    it('should cancel scheduled content successfully', async () => {
      mockCancelScheduledContent.mockResolvedValueOnce(true)

      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'PUT',
        body: JSON.stringify({ contentId: 1, action: 'cancel' })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockCancelScheduledContent).toHaveBeenCalledWith(1)
    })

    it('should reschedule content successfully', async () => {
      mockRescheduleContent.mockResolvedValueOnce(true)

      const newTime = '2025-10-08T15:00:00Z'
      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'PUT',
        body: JSON.stringify({ 
          contentId: 1, 
          action: 'reschedule', 
          newScheduleTime: newTime 
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockRescheduleContent).toHaveBeenCalledWith(1, newTime)
    })

    it('should validate required parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'PUT',
        body: JSON.stringify({ action: 'cancel' }) // Missing contentId
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('contentId and action are required')
    })

    it('should validate reschedule requires newScheduleTime', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'PUT',
        body: JSON.stringify({ 
          contentId: 1, 
          action: 'reschedule' 
          // Missing newScheduleTime
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('newScheduleTime is required for reschedule action')
    })

    it('should reject invalid actions', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'PUT',
        body: JSON.stringify({ 
          contentId: 1, 
          action: 'invalid_action' 
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid action')
    })

    it('should handle operation failures', async () => {
      mockCancelScheduledContent.mockResolvedValueOnce(false)

      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'PUT',
        body: JSON.stringify({ contentId: 999, action: 'cancel' })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Failed to unschedule content')
    })
  })

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockGetUpcomingSchedule.mockRejectedValueOnce(new Error('Service error'))

      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Service error')
    })

    it('should handle invalid JSON in POST requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/queue/schedule', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      
      // Should use default values when JSON parsing fails
      expect(mockScheduleNextBatch).toHaveBeenCalledWith(7, 6)
    })
  })
})