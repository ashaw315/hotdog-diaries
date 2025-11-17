import { GET } from '@/app/api/archive/[id]/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createSimpleClient: jest.fn()
}))

jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn()
}))

describe('/api/archive/[id] Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/archive/[id]', () => {
    it('returns item with navigation info', async () => {
      const { createSimpleClient } = await import('@/utils/supabase/server')

      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn()
      }

      ;(createSimpleClient as jest.Mock).mockReturnValue(mockSupabase)

      // Mock item query
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 1,
          content_queue_id: 2,
          posted_at: '2024-01-02T00:00:00.000Z',
          scheduled_time: null,
          post_order: 2,
          created_at: '2024-01-02T00:00:00.000Z',
          content_queue: {
            id: 2,
            content_text: 'Test hotdog',
            content_type: 'image',
            source_platform: 'reddit',
            original_url: 'https://reddit.com/r/hotdogs/1',
            original_author: 'testuser',
            content_image_url: 'https://example.com/hotdog.jpg',
            content_video_url: null,
            content_metadata: null,
            scraped_at: '2024-01-01T00:00:00.000Z'
          }
        },
        error: null
      })

      // Mock prev query (newer)
      mockSupabase.single.mockResolvedValueOnce({
        data: { content_queue_id: 3 },
        error: null
      })

      // Mock next query (older)
      mockSupabase.single.mockResolvedValueOnce({
        data: { content_queue_id: 1 },
        error: null
      })

      const mockRequest = new NextRequest('http://localhost/api/archive/2')
      const response = await GET(mockRequest, { params: { id: '2' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('item')
      expect(data).toHaveProperty('navigation')
      expect(data.item.id).toBe(2)
      expect(data.navigation).toEqual({
        prevId: 3,
        nextId: 1
      })
    })

    it('returns 404 when item not found', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive/999')
      const response = await GET(mockRequest, { params: { id: '999' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Item not found')
    })

    it('returns 400 for invalid ID', async () => {
      const mockRequest = new NextRequest('http://localhost/api/archive/invalid')
      const response = await GET(mockRequest, { params: { id: 'invalid' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Invalid ID')
    })

    it('handles item with no previous (newest item)', async () => {
      const { db } = await import('@/lib/db')

      // Mock item query
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 100,
            content_type: 'image',
            source_platform: 'reddit',
            content_text: 'Newest hotdog',
            content_image_url: 'https://example.com/hotdog.jpg',
            content_video_url: null,
            content_metadata: null,
            original_author: 'testuser',
            original_url: 'https://reddit.com/r/hotdogs/100',
            scraped_at: '2024-01-01T00:00:00.000Z',
            posted_at: '2024-01-10T00:00:00.000Z',
            post_order: 100
          }
        ]
      })

      // Mock prev query (no newer item)
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      // Mock next query (older exists)
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 99 }]
      })

      const mockRequest = new NextRequest('http://localhost/api/archive/100')
      const response = await GET(mockRequest, { params: { id: '100' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.navigation).toEqual({
        prevId: null,
        nextId: 99
      })
    })

    it('handles item with no next (oldest item)', async () => {
      const { db } = await import('@/lib/db')

      // Mock item query
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            content_type: 'image',
            source_platform: 'reddit',
            content_text: 'Oldest hotdog',
            content_image_url: 'https://example.com/hotdog.jpg',
            content_video_url: null,
            content_metadata: null,
            original_author: 'testuser',
            original_url: 'https://reddit.com/r/hotdogs/1',
            scraped_at: '2024-01-01T00:00:00.000Z',
            posted_at: '2024-01-01T00:00:00.000Z',
            post_order: 1
          }
        ]
      })

      // Mock prev query (newer exists)
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 2 }]
      })

      // Mock next query (no older item)
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive/1')
      const response = await GET(mockRequest, { params: { id: '1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.navigation).toEqual({
        prevId: 2,
        nextId: null
      })
    })

    it('handles item with gallery metadata', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            content_type: 'image',
            source_platform: 'reddit',
            content_text: 'Gallery hotdog',
            content_image_url: null,
            content_video_url: null,
            content_metadata: {
              gallery_images: [
                'https://example.com/1.jpg',
                'https://example.com/2.jpg',
                'https://example.com/3.jpg'
              ],
              image_count: 3
            },
            original_author: 'testuser',
            original_url: 'https://reddit.com/r/hotdogs/5',
            scraped_at: '2024-01-01T00:00:00.000Z',
            posted_at: '2024-01-05T00:00:00.000Z',
            post_order: 5
          }
        ]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 6 }] })
      ;(db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 4 }] })

      const mockRequest = new NextRequest('http://localhost/api/archive/5')
      const response = await GET(mockRequest, { params: { id: '5' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.item.content_metadata.gallery_images).toHaveLength(3)
      expect(data.item.content_metadata.image_count).toBe(3)
    })

    it('handles video content type', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            content_type: 'video',
            source_platform: 'reddit',
            content_text: 'Video hotdog',
            content_image_url: 'https://example.com/thumb.jpg',
            content_video_url: 'https://example.com/video.mp4',
            content_metadata: null,
            original_author: 'testuser',
            original_url: 'https://reddit.com/r/hotdogs/10',
            scraped_at: '2024-01-01T00:00:00.000Z',
            posted_at: '2024-01-10T00:00:00.000Z',
            post_order: 10
          }
        ]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({ rows: [] })
      ;(db.query as jest.Mock).mockResolvedValueOnce({ rows: [] })

      const mockRequest = new NextRequest('http://localhost/api/archive/10')
      const response = await GET(mockRequest, { params: { id: '10' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.item.content_type).toBe('video')
      expect(data.item.content_video_url).toBe('https://example.com/video.mp4')
    })

    it('handles text-only content', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 15,
            content_type: 'text',
            source_platform: 'reddit',
            content_text: 'Just a great hotdog story',
            content_image_url: null,
            content_video_url: null,
            content_metadata: null,
            original_author: 'testuser',
            original_url: 'https://reddit.com/r/hotdogs/15',
            scraped_at: '2024-01-01T00:00:00.000Z',
            posted_at: '2024-01-15T00:00:00.000Z',
            post_order: 15
          }
        ]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({ rows: [] })
      ;(db.query as jest.Mock).mockResolvedValueOnce({ rows: [] })

      const mockRequest = new NextRequest('http://localhost/api/archive/15')
      const response = await GET(mockRequest, { params: { id: '15' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.item.content_type).toBe('text')
      expect(data.item.content_text).toBe('Just a great hotdog story')
      expect(data.item.content_image_url).toBeNull()
      expect(data.item.content_video_url).toBeNull()
    })

    it('returns error response on database failure', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockRejectedValue(new Error('Database connection failed'))

      const mockRequest = new NextRequest('http://localhost/api/archive/1')
      const response = await GET(mockRequest, { params: { id: '1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Database connection failed')
    })

    it('logs errors to database when query fails', async () => {
      const { db, logToDatabase } = await import('@/lib/db')

      const testError = new Error('Query timeout')
      ;(db.query as jest.Mock).mockRejectedValue(testError)

      const mockRequest = new NextRequest('http://localhost/api/archive/1')
      await GET(mockRequest, { params: { id: '1' } })

      expect(logToDatabase).toHaveBeenCalledWith(
        'error',
        'Failed to get archive item',
        'ArchiveItemAPI',
        {
          id: '1',
          error: 'Query timeout'
        }
      )
    })

    it('correctly orders prev/next based on posted_at timestamps', async () => {
      const { db } = await import('@/lib/db')

      // Current item posted at 2024-01-05
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 50,
            content_type: 'image',
            source_platform: 'reddit',
            content_text: 'Middle item',
            content_image_url: 'https://example.com/hotdog.jpg',
            content_video_url: null,
            content_metadata: null,
            original_author: 'testuser',
            original_url: 'https://reddit.com/r/hotdogs/50',
            scraped_at: '2024-01-01T00:00:00.000Z',
            posted_at: '2024-01-05T00:00:00.000Z',
            post_order: 50
          }
        ]
      })

      // Prev (newer) should be item with posted_at > current
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 75 }] // posted after 2024-01-05
      })

      // Next (older) should be item with posted_at < current
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 25 }] // posted before 2024-01-05
      })

      const mockRequest = new NextRequest('http://localhost/api/archive/50')
      const response = await GET(mockRequest, { params: { id: '50' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.navigation.prevId).toBe(75) // newer item
      expect(data.navigation.nextId).toBe(25) // older item

      // Verify the queries use correct WHERE clauses
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('WHERE pc.posted_at >'),
        [50]
      )
      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('WHERE pc.posted_at <'),
        [50]
      )
    })
  })
})
