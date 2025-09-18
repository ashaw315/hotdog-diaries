import { POST } from '@/app/api/admin/scan-pixabay-now/route'
import { NextRequest } from 'next/server'

// Mock Supabase
jest.mock('@/utils/supabase/server', () => ({
  createSimpleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null })
        }))
      }))
    }))
  }))
}))

describe('/api/admin/scan-pixabay-now', () => {
  const mockPixabayResponse = {
    total: 100,
    totalHits: 50,
    hits: [
      {
        id: 123456,
        tags: 'hotdog, food, grill, barbecue',
        views: 5000,
        likes: 150,
        downloads: 800,
        webformatURL: 'https://pixabay.com/get/hotdog_640.jpg',
        pageURL: 'https://pixabay.com/photos/hotdog-grill-123456/',
        user: 'TestPhotographer'
      },
      {
        id: 789012,
        tags: 'frankfurter, sausage, bun',
        views: 3000,
        likes: 90,
        downloads: 500,
        webformatURL: 'https://pixabay.com/get/frankfurter_640.jpg',
        pageURL: 'https://pixabay.com/photos/frankfurter-789012/',
        user: 'FoodPhotog'
      }
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock successful Pixabay API response by default
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ // First call for API test
        ok: true,
        status: 200,
        json: () => Promise.resolve({ total: 1, hits: [{ id: 'test' }] })
      })
      .mockResolvedValueOnce({ // Second call for actual search
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPixabayResponse)
      })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('POST', () => {
    it('should successfully trigger Pixabay photo scan with admin auth', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      // Mock environment variable
      process.env.PIXABAY_API_KEY = 'test-pixabay-key'

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: expect.stringContaining('Successfully added'),
        images_added: expect.any(Number),
        stats: expect.objectContaining({
          apiReturned: expect.any(Number),
          processed: expect.any(Number),
          added: expect.any(Number)
        })
      })
    })

    it('should successfully trigger Pixabay scan with Bearer token auth', async () => {
      const mockToken = Buffer.from(JSON.stringify({ username: 'admin', id: 1 })).toString('base64')
      
      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${mockToken}`
        }
      })

      process.env.PIXABAY_API_KEY = 'test-pixabay-key'

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject unauthorized requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toMatchObject({
        error: 'Unauthorized'
      })
    })

    it('should handle missing API key gracefully', async () => {
      delete process.env.PIXABAY_API_KEY

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: expect.stringContaining('API key not configured'),
        details: {
          message: 'Missing API key',
          solution: expect.stringContaining('Get a Pixabay API key')
        },
        images_added: 0
      })
    })

    it('should handle invalid API key', async () => {
      process.env.PIXABAY_API_KEY = 'invalid-key'

      // Mock failed API key test
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Invalid API key' } }))
      })

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: expect.stringContaining('authentication failed'),
        details: {
          status: 403,
          solution: expect.stringContaining('invalid or has insufficient permissions')
        },
        images_added: 0
      })
    })

    it('should handle API rate limiting', async () => {
      process.env.PIXABAY_API_KEY = 'test-key'

      // Mock rate limit response
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Rate limit exceeded' } }))
      })

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: expect.stringContaining('authentication failed'),
        details: {
          status: 429,
          solution: expect.stringContaining('rate limit exceeded')
        }
      })
    })

    it('should handle search API errors gracefully', async () => {
      process.env.PIXABAY_API_KEY = 'test-key'

      // Mock successful API test but failed search
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ // API test succeeds
          ok: true,
          status: 200,
          json: () => Promise.resolve({ total: 1, hits: [{ id: 'test' }] })
        })
        .mockResolvedValueOnce({ // Search fails
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve(JSON.stringify({ error: { message: 'Search API error' } }))
        })

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: expect.stringContaining('search failed'),
        details: {
          status: 500,
          query: 'hotdog'
        },
        images_added: 0
      })
    })

    it('should handle no results found', async () => {
      process.env.PIXABAY_API_KEY = 'test-key'

      // Mock API responses with no results
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ // API test
          ok: true,
          status: 200,
          json: () => Promise.resolve({ total: 1, hits: [{ id: 'test' }] })
        })
        .mockResolvedValueOnce({ // Search returns no results
          ok: true,
          status: 200,
          json: () => Promise.resolve({ total: 0, hits: [] })
        })

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: expect.stringContaining('No hotdog images found'),
        images_added: 0
      })
    })

    it('should filter low-quality images correctly', async () => {
      process.env.PIXABAY_API_KEY = 'test-key'

      const lowQualityResponse = {
        total: 2,
        hits: [
          {
            id: 1,
            tags: 'hotdog',
            views: 50, // Below 100 threshold
            likes: 5,  // Below 10 threshold
            downloads: 20,
            webformatURL: 'https://example.com/low-quality.jpg',
            pageURL: 'https://example.com/1',
            user: 'TestUser'
          },
          {
            id: 2,
            tags: 'hotdog',
            views: 500, // Above threshold
            likes: 25,  // Above threshold
            downloads: 200,
            webformatURL: 'https://example.com/high-quality.jpg',
            pageURL: 'https://example.com/2',
            user: 'TestUser'
          }
        ]
      }

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ // API test
          ok: true,
          status: 200,
          json: () => Promise.resolve({ total: 1, hits: [{ id: 'test' }] })
        })
        .mockResolvedValueOnce({ // Search returns mixed quality
          ok: true,
          status: 200,
          json: () => Promise.resolve(lowQualityResponse)
        })

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.stats.qualityFiltered).toBeGreaterThan(0) // Should filter out low-quality images
    })

    it('should handle database insertion errors', async () => {
      process.env.PIXABAY_API_KEY = 'test-key'

      // Mock successful API but failed database insertion
      const { createSimpleClient } = require('@/utils/supabase/server')
      createSimpleClient.mockReturnValue({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { message: 'Database error', code: '42P01' } 
              })
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        success: false,
        error: expect.stringContaining('No new content added'),
        details: expect.objectContaining({
          errors: expect.any(Array)
        })
      })
    })

    it('should handle duplicate content correctly', async () => {
      process.env.PIXABAY_API_KEY = 'test-key'

      // Mock duplicate constraint violation
      const { createSimpleClient } = require('@/utils/supabase/server')
      createSimpleClient.mockReturnValue({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { 
                  message: 'duplicate key value violates unique constraint', 
                  code: '23505' 
                } 
              })
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.details.duplicates).toBeGreaterThan(0)
    })

    it('should handle critical errors gracefully', async () => {
      process.env.PIXABAY_API_KEY = 'test-key'

      // Mock network error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      const request = new NextRequest('http://localhost:3000/api/admin/scan-pixabay-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: expect.stringContaining('Network error'),
        images_added: 0
      })
    })
  })
})