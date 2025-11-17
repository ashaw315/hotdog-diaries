import { GET } from '@/app/api/archive/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn()
  },
  logToDatabase: jest.fn()
}))

describe('/api/archive Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/archive', () => {
    it('returns paginated archive items with default parameters', async () => {
      const { db } = await import('@/lib/db')

      // Mock count query
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '100' }]
      })

      // Mock content query
      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            content_type: 'image',
            source_platform: 'reddit',
            content_text: 'Test hotdog',
            content_image_url: 'https://example.com/hotdog.jpg',
            content_video_url: null,
            content_metadata: null,
            original_author: 'testuser',
            original_url: 'https://reddit.com/r/hotdogs/1',
            scraped_at: '2024-01-01T00:00:00.000Z',
            posted_at: '2024-01-02T00:00:00.000Z',
            post_order: 1
          }
        ]
      })

      const mockRequest = new NextRequest('http://localhost/api/archive')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('pagination')
      expect(data.items).toHaveLength(1)
      expect(data.pagination).toEqual({
        total: 100,
        limit: 20,
        offset: 0,
        totalPages: 5,
        currentPage: 1,
        hasMore: true
      })

      // Verify count query was called
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT COUNT(*)')
      )

      // Verify content query was called with default limit=20, offset=0
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('ORDER BY pc.posted_at DESC'),
        [20, 0]
      )
    })

    it('respects custom limit and offset parameters', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '100' }]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive?limit=10&offset=30')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination).toEqual({
        total: 100,
        limit: 10,
        offset: 30,
        totalPages: 10,
        currentPage: 4,
        hasMore: true
      })

      // Verify query was called with custom parameters
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        [10, 30]
      )
    })

    it('caps limit at 100 items', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '500' }]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive?limit=500')
      await GET(mockRequest)

      // Verify query was called with capped limit of 100
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        [100, 0]
      )
    })

    it('correctly calculates hasMore when on last page', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '45' }]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive?limit=20&offset=40')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.pagination.hasMore).toBe(false)
    })

    it('correctly calculates hasMore when more pages exist', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '100' }]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive?limit=20&offset=0')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.pagination.hasMore).toBe(true)
    })

    it('handles gallery images in content_metadata', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '1' }]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            content_type: 'image',
            source_platform: 'reddit',
            content_text: 'Gallery test',
            content_image_url: null,
            content_video_url: null,
            content_metadata: {
              gallery_images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
              image_count: 2
            },
            original_author: 'testuser',
            original_url: 'https://reddit.com/r/hotdogs/1',
            scraped_at: '2024-01-01T00:00:00.000Z',
            posted_at: '2024-01-02T00:00:00.000Z',
            post_order: 1
          }
        ]
      })

      const mockRequest = new NextRequest('http://localhost/api/archive')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.items[0].content_metadata.gallery_images).toHaveLength(2)
      expect(data.items[0].content_metadata.image_count).toBe(2)
    })

    it('returns error response on database failure', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockRejectedValue(new Error('Database connection failed'))

      const mockRequest = new NextRequest('http://localhost/api/archive')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Database connection failed')
    })

    it('handles empty archive gracefully', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '0' }]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.items).toEqual([])
      expect(data.pagination).toEqual({
        total: 0,
        limit: 20,
        offset: 0,
        totalPages: 0,
        currentPage: 1,
        hasMore: false
      })
    })

    it('handles invalid limit parameter gracefully', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '100' }]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive?limit=invalid')
      const response = await GET(mockRequest)

      expect(response.status).toBe(200)
      // Should default to 20
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        [20, 0]
      )
    })

    it('handles invalid offset parameter gracefully', async () => {
      const { db } = await import('@/lib/db')

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: '100' }]
      })

      ;(db.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      })

      const mockRequest = new NextRequest('http://localhost/api/archive?offset=invalid')
      const response = await GET(mockRequest)

      expect(response.status).toBe(200)
      // Should default to 0
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        [20, 0]
      )
    })

    it('logs errors to database when query fails', async () => {
      const { db, logToDatabase } = await import('@/lib/db')

      const testError = new Error('Query timeout')
      ;(db.query as jest.Mock).mockRejectedValue(testError)

      const mockRequest = new NextRequest('http://localhost/api/archive')
      await GET(mockRequest)

      expect(logToDatabase).toHaveBeenCalledWith(
        'error',
        'Failed to get archive content',
        'ArchiveAPI',
        { error: 'Query timeout' }
      )
    })
  })
})
