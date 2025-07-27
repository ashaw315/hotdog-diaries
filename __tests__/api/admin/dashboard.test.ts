import { NextRequest } from 'next/server'
import { jest } from '@jest/globals'
import { GET as getStats } from '@/app/api/admin/dashboard/stats/route'
import { GET as getActivity } from '@/app/api/admin/dashboard/activity/route'

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  NextAuthUtils: {
    verifyRequestAuth: jest.fn()
  }
}))

jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn()
  }
}))

describe('/api/admin/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/admin/dashboard/stats', () => {
    it('returns dashboard statistics for authenticated user', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')
      const { db } = await import('@/lib/db')

      // Mock authentication
      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      // Mock database queries
      ;(db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '150' }] }) // Total content
        .mockResolvedValueOnce({ rows: [{ count: '25' }] }) // Pending content
        .mockResolvedValueOnce({ rows: [{ count: '6' }] }) // Posted today
        .mockResolvedValueOnce({ rows: [{ total_views: '50000' }] }) // Total views
        .mockResolvedValueOnce({ rows: [{ posted_at: '2024-01-01T10:00:00Z' }] }) // Last post
        .mockResolvedValueOnce({ rows: [{ avg_engagement: '3.5' }] }) // Avg engagement

      const request = new NextRequest('http://localhost:3000/api/admin/dashboard/stats')
      const response = await getStats(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        totalContent: 150,
        pendingContent: 25,
        postedToday: 6,
        totalViews: 50000,
        lastPostTime: expect.any(Date),
        nextPostTime: expect.any(Date),
        avgEngagement: 3.5,
        systemStatus: 'online'
      })
    })

    it('returns 401 for unauthenticated user', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: false,
        user: null
      })

      const request = new NextRequest('http://localhost:3000/api/admin/dashboard/stats')
      const response = await getStats(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('handles database errors gracefully', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')
      const { db } = await import('@/lib/db')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      ;(db.query as jest.Mock).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/dashboard/stats')
      const response = await getStats(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch dashboard statistics' })
    })
  })

  describe('GET /api/admin/dashboard/activity', () => {
    it('returns recent activity for authenticated user', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')
      const { db } = await import('@/lib/db')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      const mockContent = [
        {
          id: '1',
          title: 'Test Content',
          status: 'posted',
          created_at: '2024-01-01T10:00:00Z',
          posted_at: '2024-01-01T10:00:00Z',
          updated_at: null
        },
        {
          id: '2',
          title: 'Pending Content',
          status: 'pending',
          created_at: '2024-01-01T09:00:00Z',
          posted_at: null,
          updated_at: null
        }
      ]

      ;(db.query as jest.Mock).mockResolvedValue({ rows: mockContent })

      const request = new NextRequest('http://localhost:3000/api/admin/dashboard/activity')
      const response = await getActivity(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(2)
      expect(data[0]).toEqual({
        id: 'posted-1',
        type: 'posted',
        description: 'Posted: Test Content',
        timestamp: expect.any(String)
      })
    })

    it('returns 401 for unauthenticated user', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: false,
        user: null
      })

      const request = new NextRequest('http://localhost:3000/api/admin/dashboard/activity')
      const response = await getActivity(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('handles database errors gracefully', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')
      const { db } = await import('@/lib/db')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      ;(db.query as jest.Mock).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/dashboard/activity')
      const response = await getActivity(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch dashboard activity' })
    })
  })
})