import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/content/route'
import { ContentService } from '@/lib/services/content'
import { ContentType, SourcePlatform } from '@/types'

// Mock ContentService
jest.mock('@/lib/services/content')
const mockContentService = ContentService as jest.Mocked<typeof ContentService>

// Mock NextRequest
const createMockRequest = (url: string, options: any = {}) => {
  return {
    url,
    method: options.method || 'GET',
    headers: new Headers(options.headers || {}),
    json: options.json ? () => Promise.resolve(options.json) : undefined,
    nextUrl: new URL(url)
  } as NextRequest
}

describe('/api/content', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/content', () => {
    it('should return posted content with default pagination', async () => {
      const mockContent = [
        {
          id: 1,
          content_text: 'Test hotdog content',
          content_type: ContentType.TEXT,
          source_platform: SourcePlatform.TWITTER,
          original_url: 'https://twitter.com/test/1',
          is_posted: true,
          is_approved: true,
          posted_at: new Date()
        }
      ]

      const mockResult = {
        items: mockContent,
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      }

      mockContentService.getPostedContent.mockResolvedValue(mockResult)

      const request = createMockRequest('http://localhost:3000/api/content')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
      expect(mockContentService.getPostedContent).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        {}
      )
    })

    it('should handle pagination parameters', async () => {
      const mockResult = {
        items: [],
        pagination: {
          total: 0,
          page: 2,
          limit: 5,
          totalPages: 0
        }
      }

      mockContentService.getPostedContent.mockResolvedValue(mockResult)

      const request = createMockRequest('http://localhost:3000/api/content?page=2&limit=5')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockContentService.getPostedContent).toHaveBeenCalledWith(
        { page: 2, limit: 5 },
        {}
      )
    })

    it('should handle filter parameters', async () => {
      const mockResult = {
        items: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0
        }
      }

      mockContentService.getPostedContent.mockResolvedValue(mockResult)

      const request = createMockRequest(
        'http://localhost:3000/api/content?content_type=image&source_platform=instagram&author=testuser'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockContentService.getPostedContent).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        {
          content_type: 'image',
          source_platform: 'instagram',
          author: 'testuser'
        }
      )
    })

    it('should handle service errors', async () => {
      mockContentService.getPostedContent.mockRejectedValue(new Error('Database error'))

      const request = createMockRequest('http://localhost:3000/api/content')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch content')
    })

    it('should validate pagination limits', async () => {
      const mockResult = {
        items: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 100, // Should be clamped to 100
          totalPages: 0
        }
      }

      mockContentService.getPostedContent.mockResolvedValue(mockResult)

      const request = createMockRequest('http://localhost:3000/api/content?limit=500')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockContentService.getPostedContent).toHaveBeenCalledWith(
        { page: 1, limit: 100 }, // Should be clamped to 100
        {}
      )
    })
  })

  describe('POST /api/content', () => {
    it('should create content successfully', async () => {
      const contentData = {
        content_text: 'New hotdog content',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.TWITTER,
        original_url: 'https://twitter.com/test/new',
        original_author: 'testuser'
      }

      const mockCreatedContent = {
        id: 1,
        ...contentData,
        content_hash: 'mock-hash',
        is_posted: false,
        is_approved: false,
        scraped_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }

      mockContentService.createContent.mockResolvedValue(mockCreatedContent)

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        json: contentData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockCreatedContent)
      expect(mockContentService.createContent).toHaveBeenCalledWith(contentData)
    })

    it('should handle validation errors', async () => {
      const invalidData = {
        content_type: 'invalid',
        source_platform: SourcePlatform.TWITTER,
        original_url: 'invalid-url'
      }

      mockContentService.createContent.mockRejectedValue(new Error('Validation failed: Invalid content type'))

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        json: invalidData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Validation failed')
    })

    it('should handle duplicate content errors', async () => {
      const contentData = {
        content_text: 'Duplicate content',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.TWITTER,
        original_url: 'https://twitter.com/test/duplicate'
      }

      mockContentService.createContent.mockRejectedValue(
        new Error('Duplicate content detected. Existing content ID: 5')
      )

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        json: contentData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Duplicate content detected')
    })

    it('should handle missing request body', async () => {
      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
        // No json body
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Request body is required')
    })

    it('should handle invalid JSON', async () => {
      const request = {
        url: 'http://localhost:3000/api/content',
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.reject(new Error('Invalid JSON')),
        nextUrl: new URL('http://localhost:3000/api/content')
      } as NextRequest

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid JSON in request body')
    })

    it('should handle service errors', async () => {
      const contentData = {
        content_text: 'Test content',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.TWITTER,
        original_url: 'https://twitter.com/test/1'
      }

      mockContentService.createContent.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        json: contentData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to create content')
    })

    it('should include correct response headers', async () => {
      const contentData = {
        content_text: 'Test content',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.TWITTER,
        original_url: 'https://twitter.com/test/1'
      }

      const mockCreatedContent = {
        id: 1,
        ...contentData,
        content_hash: 'mock-hash',
        is_posted: false,
        is_approved: false,
        scraped_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }

      mockContentService.createContent.mockResolvedValue(mockCreatedContent)

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        json: contentData
      })

      const response = await POST(request)

      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    })
  })
})