import { NextRequest } from 'next/server'
import { jest } from '@jest/globals'
import { GET as getQueue } from '@/app/api/admin/content/queue/route'
import { POST as bulkAction } from '@/app/api/admin/content/bulk/route'

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

describe('/api/admin/content', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/admin/content/queue', () => {
    it('returns queued content for authenticated user', async () => {
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
          content_text: 'Test content description',
          platform: 'twitter',
          scheduled_for: null,
          priority: 'high',
          status: 'pending',
          created_at: '2024-01-01T10:00:00Z',
          media_url: 'https://example.com/image.jpg',
          tags: ['hotdog', 'food']
        }
      ]

      ;(db.query as jest.Mock).mockResolvedValue({ rows: mockContent })

      const request = new NextRequest('http://localhost:3000/api/admin/content/queue')
      const response = await getQueue(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(1)
      expect(data[0]).toEqual({
        id: '1',
        title: 'Test Content',
        content_text: 'Test content description',
        platform: 'twitter',
        scheduled_for: undefined,
        priority: 'high',
        status: 'pending',
        created_at: expect.any(Date),
        media_url: 'https://example.com/image.jpg',
        tags: ['hotdog', 'food']
      })
    })

    it('applies filtering and sorting', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')
      const { db } = await import('@/lib/db')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      ;(db.query as jest.Mock).mockResolvedValue({ rows: [] })

      const request = new NextRequest('http://localhost:3000/api/admin/content/queue?sort=priority&filter=pending')
      const response = await getQueue(request)

      expect(response.status).toBe(200)
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = \'pending\''),
        expect.any(Array)
      )
    })

    it('returns 401 for unauthenticated user', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: false,
        user: null
      })

      const request = new NextRequest('http://localhost:3000/api/admin/content/queue')
      const response = await getQueue(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('POST /api/admin/content/bulk', () => {
    it('performs bulk approve action', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')
      const { db } = await import('@/lib/db')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      ;(db.query as jest.Mock).mockResolvedValue({ rowCount: 2 })

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'approve',
          contentIds: ['1', '2']
        })
      })

      const response = await bulkAction(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        message: 'Content approved successfully',
        affectedRows: 2
      })
    })

    it('performs bulk schedule action', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')
      const { db } = await import('@/lib/db')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      ;(db.query as jest.Mock).mockResolvedValue({ rowCount: 1 })

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'schedule',
          contentIds: ['1']
        })
      })

      const response = await bulkAction(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        message: 'Content scheduled successfully',
        affectedRows: 1
      })
    })

    it('performs bulk delete action', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')
      const { db } = await import('@/lib/db')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      ;(db.query as jest.Mock).mockResolvedValue({ rowCount: 1 })

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          contentIds: ['1']
        })
      })

      const response = await bulkAction(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        message: 'Content deleted successfully',
        affectedRows: 1
      })
    })

    it('validates request body', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid',
          contentIds: []
        })
      })

      const response = await bulkAction(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ error: 'Invalid action or content IDs' })
    })

    it('validates content ID format', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: true,
        user: { id: '1', username: 'admin' }
      })

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'approve',
          contentIds: ['invalid-id']
        })
      })

      const response = await bulkAction(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ error: 'Invalid content ID format' })
    })

    it('returns 401 for unauthenticated user', async () => {
      const { NextAuthUtils } = await import('@/lib/auth')

      ;(NextAuthUtils.verifyRequestAuth as jest.Mock).mockResolvedValue({
        success: false,
        user: null
      })

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'approve',
          contentIds: ['1']
        })
      })

      const response = await bulkAction(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })
  })
})