import { GET } from '@/app/api/content/route'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

// Mock the database
jest.mock('@/lib/db')
const mockDb = db as jest.Mocked<typeof db>

// Mock NextRequest
const createMockRequest = (method: string = 'GET', searchParams: Record<string, string> = {}) => {
  const url = new URL('http://localhost:3000/api/content')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return new NextRequest(url.toString(), { method })
}

describe('/api/content', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/content', () => {
    it('should return paginated content successfully', async () => {
      const mockContent = [
        {
          id: 1,
          content_queue_id: 1,
          posted_at: new Date('2024-01-01T12:00:00Z'),
          post_order: 1,
          content_text: 'Amazing hotdog!',
          content_type: 'text',
          source_platform: 'twitter',
          original_url: 'https://twitter.com/test/1'
        },
        {
          id: 2,
          content_queue_id: 2,
          posted_at: new Date('2024-01-01T11:00:00Z'),
          post_order: 2,
          content_text: 'Another hotdog!',
          content_type: 'image',
          source_platform: 'instagram',
          original_url: 'https://instagram.com/test/2'
        }
      ]

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '25' }] } as any) // count query
        .mockResolvedValueOnce({ rows: mockContent } as any) // content query

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.content).toEqual(mockContent)
      expect(data.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
        nextPage: 2,
        previousPage: null
      })
    })

    it('should handle custom pagination parameters', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '50' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const request = createMockRequest('GET', { page: '3', limit: '5' })
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.data.pagination.page).toBe(3)
      expect(data.data.pagination.limit).toBe(5)
      expect(data.data.pagination.total).toBe(50)
      expect(data.data.pagination.totalPages).toBe(10)
      
      // Verify offset calculation: (page - 1) * limit = (3 - 1) * 5 = 10
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [5, 10]
      )
    })

    it('should handle descending order by default', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const request = createMockRequest('GET')
      await GET(request)
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY posted_at DESC'),
        expect.any(Array)
      )
    })

    it('should handle ascending order when specified', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const request = createMockRequest('GET', { order: 'asc' })
      await GET(request)
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY posted_at ASC'),
        expect.any(Array)
      )
    })

    it('should return empty array when no content exists', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.content).toEqual([])
      expect(data.data.pagination.total).toBe(0)
      expect(data.data.pagination.totalPages).toBe(0)
      expect(data.message).toBe('No content found')
    })

    it('should handle database not initialized gracefully', async () => {
      const dbError = new Error('relation "posted_content_with_details" does not exist')
      mockDb.query.mockRejectedValue(dbError)

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.content).toEqual([])
      expect(data.message).toBe('Database not initialized - no content available')
    })

    it('should validate page parameter', async () => {
      const request = createMockRequest('GET', { page: '0' })
      const response = await GET(request)
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Page number must be greater than 0')
      expect(data.code).toBe('INVALID_PAGE')
    })

    it('should validate limit parameter - too small', async () => {
      const request = createMockRequest('GET', { limit: '0' })
      const response = await GET(request)
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Limit must be between 1 and 100')
      expect(data.code).toBe('INVALID_LIMIT')
    })

    it('should validate limit parameter - too large', async () => {
      const request = createMockRequest('GET', { limit: '101' })
      const response = await GET(request)
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Limit must be between 1 and 100')
      expect(data.code).toBe('INVALID_LIMIT')
    })

    it('should validate order parameter', async () => {
      const request = createMockRequest('GET', { order: 'invalid' })
      const response = await GET(request)
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Order must be either "asc" or "desc"')
      expect(data.code).toBe('INVALID_ORDER')
    })

    it('should reject non-GET methods', async () => {
      const request = createMockRequest('POST')
      const response = await GET(request)
      
      expect(response.status).toBe(405)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Method POST not allowed')
      expect(data.code).toBe('METHOD_NOT_ALLOWED')
    })

    it('should handle database query errors', async () => {
      const dbError = new Error('Database connection failed')
      mockDb.query.mockRejectedValue(dbError)

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Database connection failed')
    })

    it('should include security headers', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('should have valid response format', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('timestamp')
      expect(data.data).toHaveProperty('content')
      expect(data.data).toHaveProperty('pagination')
      expect(Array.isArray(data.data.content)).toBe(true)
      
      const pagination = data.data.pagination
      expect(pagination).toHaveProperty('page')
      expect(pagination).toHaveProperty('limit')
      expect(pagination).toHaveProperty('total')
      expect(pagination).toHaveProperty('totalPages')
      expect(pagination).toHaveProperty('hasNextPage')
      expect(pagination).toHaveProperty('hasPreviousPage')
    })
  })
})