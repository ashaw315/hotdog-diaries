/**
 * Tests for /api/content route - consolidated endpoint
 * Uses new API middleware and direct database queries
 */

import { NextRequest } from 'next/server'
import { createMockRequest } from '@/__tests__/utils/setup'

// Mock the database first - use function to avoid hoisting issues
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn()
  }
}))

// Mock ContentService
jest.mock('@/lib/services/content', () => ({
  ContentService: {
    createContent: jest.fn()
  }
}))

// Mock validation
jest.mock('@/lib/validation/content', () => ({
  validateContent: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  CreateContentRequest: {}
}))

// Mock api-middleware with proper status code handling
jest.mock('@/lib/api-middleware', () => ({
  withErrorHandling: jest.fn((handler) => {
    return async (request) => {
      try {
        return await handler(request)
      } catch (error) {
        const status = error.statusCode || 500
        const message = error.message || 'Internal server error'
        return Response.json({ error: message }, { status })
      }
    }
  }),
  validateRequestMethod: jest.fn(),
  createSuccessResponse: jest.fn((data, message, status = 200) => 
    Response.json({ success: true, data, message }, { status })
  ),
  createApiError: jest.fn((message, status, code) => {
    const error = new Error(message)
    error.statusCode = status
    error.code = code
    throw error
  }),
  validateJsonBody: jest.fn()
}))

// Import after mocks are set up
import { GET, POST } from '@/app/api/content/route'
import { db } from '@/lib/db'
import { ContentService } from '@/lib/services/content'
import { validateJsonBody } from '@/lib/api-middleware'

// Get the mocked instances
const mockDb = db as jest.Mocked<typeof db>
const mockContentService = ContentService as jest.Mocked<typeof ContentService>
const mockValidateJsonBody = validateJsonBody as jest.MockedFunction<typeof validateJsonBody>

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
          content_type: 'text',
          source_platform: 'reddit',
          original_url: 'https://reddit.com/r/hotdogs/comments/1',
          original_author: 'testuser',
          content_image_url: null,
          content_video_url: null,
          is_posted: true,
          is_approved: true,
          posted_at: new Date().toISOString(),
          scraped_at: new Date().toISOString()
        }
      ]

      // Mock the count query (first call)
      mockDb.query.mockResolvedValueOnce({
        rows: [{ total: 1 }]
      })

      // Mock the content query (second call)
      mockDb.query.mockResolvedValueOnce({
        rows: mockContent
      })

      const request = createMockRequest('http://localhost:3000/api/content')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toHaveLength(1)
      expect(data.data.content[0]).toMatchObject({
        id: 1,
        content_text: 'Test hotdog content',
        source_platform: 'reddit'
      })
      expect(data.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        nextPage: null,
        previousPage: null
      })
    })

    it('should handle pagination parameters', async () => {
      // Mock count query
      mockDb.query.mockResolvedValueOnce({
        rows: [{ total: 0 }]
      })

      // Mock content query
      mockDb.query.mockResolvedValueOnce({
        rows: []
      })

      const request = createMockRequest('http://localhost:3000/api/content?page=2&limit=5')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.pagination.page).toBe(2)
      expect(data.data.pagination.limit).toBe(5)
      
      // Verify the query was called with correct parameters
      expect(mockDb.query).toHaveBeenCalledTimes(2)
      expect(mockDb.query).toHaveBeenLastCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [5, 5] // limit=5, offset=(page-1)*limit=5
      )
    })

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockRequest('http://localhost:3000/api/content')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should validate pagination limits', async () => {
      const request = createMockRequest('http://localhost:3000/api/content?limit=500')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Limit must be between 1 and 100')
    })

    it('should validate page parameter', async () => {
      const request = createMockRequest('http://localhost:3000/api/content?page=0')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Page number must be greater than 0')
    })

    it('should handle database not initialized', async () => {
      mockDb.query.mockRejectedValue(new Error('relation "content_queue" does not exist'))

      const request = createMockRequest('http://localhost:3000/api/content')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toEqual([])
      expect(data.message).toContain('Database not initialized')
    })
  })

  describe('POST /api/content', () => {
    it('should create content successfully', async () => {
      const contentData = {
        content_text: 'New hotdog content',
        content_type: 'text',
        source_platform: 'reddit',
        original_url: 'https://reddit.com/r/hotdogs/comments/new',
        original_author: 'testuser'
      }

      const mockCreatedContent = {
        id: 1,
        ...contentData,
        content_hash: 'mock-hash',
        is_posted: false,
        is_approved: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Mock validateJsonBody to return the content data
      mockValidateJsonBody.mockResolvedValue(contentData)
      mockContentService.createContent.mockResolvedValue(mockCreatedContent)

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        body: contentData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockCreatedContent)
      expect(mockContentService.createContent).toHaveBeenCalledWith(contentData)
    })

    it('should handle validation errors', async () => {
      // Mock validation to fail
      const { validateContent } = require('@/lib/validation/content')
      validateContent.mockReturnValue({
        isValid: false,
        errors: [{ field: 'content_type', message: 'Invalid content type' }]
      })

      const invalidData = {
        content_type: 'invalid',
        source_platform: 'reddit',
        original_url: 'invalid-url'
      }

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        body: invalidData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
    })

    it('should handle duplicate content errors', async () => {
      const contentData = {
        content_text: 'Duplicate content',
        content_type: 'text',
        source_platform: 'reddit',
        original_url: 'https://reddit.com/r/hotdogs/comments/duplicate'
      }

      // Reset validation to pass for this test
      const { validateContent } = require('@/lib/validation/content')
      validateContent.mockReturnValue({ isValid: true, errors: [] })

      mockValidateJsonBody.mockResolvedValue(contentData)
      mockContentService.createContent.mockRejectedValue(
        new Error('Duplicate content detected. Existing content ID: 5')
      )

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        body: contentData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('Duplicate content')
    })

    it('should handle missing request body', async () => {
      // Mock validateJsonBody to throw an error for missing body
      const error = new Error('Invalid JSON in request body')
      error.statusCode = 400
      mockValidateJsonBody.mockRejectedValue(error)

      const request = new Request('http://localhost:3000/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
        // No body
      })

      const response = await POST(request as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should handle service errors', async () => {
      const contentData = {
        content_text: 'Test content',
        content_type: 'text',
        source_platform: 'twitter',
        original_url: 'https://twitter.com/test/1'
      }

      // Reset validation to pass for this test
      const { validateContent } = require('@/lib/validation/content')
      validateContent.mockReturnValue({ isValid: true, errors: [] })

      mockValidateJsonBody.mockResolvedValue(contentData)
      mockContentService.createContent.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockRequest('http://localhost:3000/api/content', {
        method: 'POST',
        body: contentData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })
})