import { POST } from '@/app/api/admin/unsplash/search/route'
import { NextRequest } from 'next/server'
import { unsplashService } from '@/lib/services/unsplash'

// Mock the unsplash service
jest.mock('@/lib/services/unsplash', () => ({
  unsplashService: {
    searchPhotos: jest.fn()
  }
}))

const mockUnsplashService = unsplashService as jest.Mocked<typeof unsplashService>

describe('/api/admin/unsplash/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('should search for photos successfully', async () => {
      const mockPhotos = [
        {
          id: 'test-photo-1',
          description: 'A delicious hotdog',
          altDescription: 'Grilled hotdog on a bun',
          photoUrl: 'https://example.com/photo.jpg',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          photographer: 'Test Photographer',
          photographerUrl: 'https://example.com/photographer',
          downloadUrl: 'https://example.com/download',
          width: 1920,
          height: 1080,
          likes: 150,
          downloads: 500,
          tags: ['food', 'hotdog', 'grill'],
          color: '#FF5733',
          createdAt: new Date('2023-01-01')
        }
      ]

      mockUnsplashService.searchPhotos.mockResolvedValue(mockPhotos)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'hotdog',
          maxResults: 20,
          orientation: 'landscape',
          orderBy: 'relevant'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: {
          query: 'hotdog',
          photos: expect.arrayContaining([
            expect.objectContaining({
              id: 'test-photo-1',
              description: 'A delicious hotdog',
              photographer: 'Test Photographer'
            })
          ]),
          totalFound: 1
        }
      })

      expect(mockUnsplashService.searchPhotos).toHaveBeenCalledWith({
        query: 'hotdog',
        maxResults: 20,
        orientation: 'landscape',
        orderBy: 'relevant'
      })
    })

    it('should validate search query is required', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/search', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        success: false,
        error: 'Search query is required'
      })
    })

    it('should validate search query is a string', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 123
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        success: false,
        error: 'Search query is required'
      })
    })

    it('should limit maxResults to 30', async () => {
      mockUnsplashService.searchPhotos.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'hotdog',
          maxResults: 100
        })
      })

      await POST(request)

      expect(mockUnsplashService.searchPhotos).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: 30
        })
      )
    })

    it('should validate orientation parameter', async () => {
      mockUnsplashService.searchPhotos.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'hotdog',
          orientation: 'invalid'
        })
      })

      await POST(request)

      expect(mockUnsplashService.searchPhotos).toHaveBeenCalledWith(
        expect.objectContaining({
          orientation: 'landscape' // should default to landscape for invalid values
        })
      )
    })

    it('should validate orderBy parameter', async () => {
      mockUnsplashService.searchPhotos.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'hotdog',
          orderBy: 'invalid'
        })
      })

      await POST(request)

      expect(mockUnsplashService.searchPhotos).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'relevant' // should default to relevant for invalid values
        })
      )
    })

    it('should handle service errors', async () => {
      mockUnsplashService.searchPhotos.mockRejectedValue(new Error('API rate limit exceeded'))

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'hotdog'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: 'Unsplash search failed',
        details: 'API rate limit exceeded'
      })
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/search', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: 'Unsplash search failed'
      })
    })
  })
})