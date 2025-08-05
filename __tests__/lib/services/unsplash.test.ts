import { UnsplashService, UnsplashSearchOptions } from '@/lib/services/unsplash'
import { logToDatabase } from '@/lib/db'

// Mock the database logging
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn()
}))

// Mock fetch
global.fetch = jest.fn()

describe('UnsplashService', () => {
  let unsplashService: UnsplashService
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variable for testing
    process.env.UNSPLASH_ACCESS_KEY = 'test-access-key'
    
    unsplashService = new UnsplashService()
  })

  afterEach(() => {
    delete process.env.UNSPLASH_ACCESS_KEY
  })

  describe('constructor', () => {
    it('should initialize with access key from environment', () => {
      expect(unsplashService).toBeDefined()
    })

    it('should warn when access key is missing', () => {
      delete process.env.UNSPLASH_ACCESS_KEY
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      new UnsplashService()
      
      expect(consoleSpy).toHaveBeenCalledWith('Unsplash access key not found in environment variables')
      consoleSpy.mockRestore()
    })
  })

  describe('searchPhotos', () => {
    const mockUnsplashResponse = {
      results: [
        {
          id: 'test-photo-1',
          description: 'Delicious hotdog with mustard',
          alt_description: 'A grilled hotdog on a bun',
          urls: {
            regular: 'https://images.unsplash.com/photo-1/regular.jpg',
            thumb: 'https://images.unsplash.com/photo-1/thumb.jpg'
          },
          user: {
            name: 'Test Photographer',
            links: { html: 'https://unsplash.com/@testphotographer' }
          },
          links: {
            download: 'https://unsplash.com/photos/test-photo-1/download'
          },
          width: 1920,
          height: 1080,
          likes: 150,
          downloads: 500,
          tags: [{ title: 'food' }, { title: 'hotdog' }, { title: 'grill' }],
          color: '#FF5733',
          created_at: '2023-01-01T12:00:00Z'
        },
        {
          id: 'test-photo-2',
          description: 'Random landscape photo',
          alt_description: 'A mountain view',
          urls: {
            regular: 'https://images.unsplash.com/photo-2/regular.jpg',
            thumb: 'https://images.unsplash.com/photo-2/thumb.jpg'
          },
          user: {
            name: 'Nature Photographer',
            links: { html: 'https://unsplash.com/@naturephotographer' }
          },
          links: {
            download: 'https://unsplash.com/photos/test-photo-2/download'
          },
          width: 1920,
          height: 1080,
          likes: 5,
          downloads: 10,
          tags: [{ title: 'landscape' }, { title: 'mountain' }],
          color: '#33A1FF',
          created_at: '2023-01-01T12:00:00Z'
        }
      ]
    }

    it('should search and return processed photos', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUnsplashResponse
      } as Response)

      const options: UnsplashSearchOptions = {
        query: 'hotdog',
        maxResults: 20,
        orientation: 'landscape',
        orderBy: 'relevant'
      }

      const photos = await unsplashService.searchPhotos(options)

      expect(photos).toHaveLength(1) // Only the hotdog photo should pass validation
      expect(photos[0]).toMatchObject({
        id: 'test-photo-1',
        description: 'Delicious hotdog with mustard',
        photographer: 'Test Photographer',
        likes: 150,
        downloads: 500
      })

      expect(logToDatabase).toHaveBeenCalledWith(
        'info',
        'UNSPLASH_SEARCH_SUCCESS',
        expect.stringContaining('Found 1 Unsplash photos for query: hotdog'),
        expect.any(Object)
      )
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      const options: UnsplashSearchOptions = { query: 'hotdog' }

      await expect(unsplashService.searchPhotos(options)).rejects.toThrow(
        'Unsplash search failed: Unsplash API error: 401 - Unauthorized'
      )

      expect(logToDatabase).toHaveBeenCalledWith(
        'error',
        'UNSPLASH_SEARCH_ERROR',
        expect.stringContaining('Unsplash search failed'),
        expect.any(Object)
      )
    })

    it('should throw error when access key is missing', async () => {
      delete process.env.UNSPLASH_ACCESS_KEY
      const service = new UnsplashService()

      await expect(service.searchPhotos({ query: 'hotdog' })).rejects.toThrow(
        'Unsplash search failed: Unsplash access key not configured'
      )
    })

    it('should limit maxResults to 30', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      } as Response)

      await unsplashService.searchPhotos({ query: 'hotdog', maxResults: 100 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=30'),
        expect.any(Object)
      )
    })
  })

  describe('validateUnsplashContent', () => {
    it('should validate hotdog-related content', async () => {
      const validPhoto = {
        id: 'test',
        description: 'A delicious hotdog',
        altDescription: 'Grilled sausage',
        photoUrl: 'http://example.com/photo.jpg',
        thumbnailUrl: 'http://example.com/thumb.jpg',
        photographer: 'Test',
        photographerUrl: 'http://example.com',
        downloadUrl: 'http://example.com/download',
        width: 1920,
        height: 1080,
        likes: 50,
        downloads: 200,
        tags: ['food', 'hotdog'],
        color: '#FF0000',
        createdAt: new Date()
      }

      const isValid = await unsplashService.validateUnsplashContent(validPhoto)
      expect(isValid).toBe(true)
    })

    it('should reject non-hotdog content', async () => {
      const invalidPhoto = {
        id: 'test',
        description: 'A beautiful landscape',
        altDescription: 'Mountain view',
        photoUrl: 'http://example.com/photo.jpg',
        thumbnailUrl: 'http://example.com/thumb.jpg',
        photographer: 'Test',
        photographerUrl: 'http://example.com',
        downloadUrl: 'http://example.com/download',
        width: 1920,
        height: 1080,
        likes: 50,
        downloads: 200,
        tags: ['landscape', 'mountain'],
        color: '#FF0000',
        createdAt: new Date()
      }

      const isValid = await unsplashService.validateUnsplashContent(invalidPhoto)
      expect(isValid).toBe(false)
    })

    it('should reject content with poor engagement', async () => {
      const lowEngagementPhoto = {
        id: 'test',
        description: 'A hotdog photo',
        altDescription: 'Hotdog on plate',
        photoUrl: 'http://example.com/photo.jpg',
        thumbnailUrl: 'http://example.com/thumb.jpg',
        photographer: 'Test',
        photographerUrl: 'http://example.com',
        downloadUrl: 'http://example.com/download',
        width: 1920,
        height: 1080,
        likes: 5,
        downloads: 10,
        tags: ['hotdog'],
        color: '#FF0000',
        createdAt: new Date()
      }

      const isValid = await unsplashService.validateUnsplashContent(lowEngagementPhoto)
      expect(isValid).toBe(false)
    })
  })

  describe('getHotdogSearchTerms', () => {
    it('should return array of hotdog search terms', () => {
      const terms = unsplashService.getHotdogSearchTerms()
      
      expect(Array.isArray(terms)).toBe(true)
      expect(terms.length).toBeGreaterThan(0)
      expect(terms).toContain('hotdog food')
      expect(terms).toContain('sausage grill')
    })
  })

  describe('getApiStatus', () => {
    it('should return status when authenticated', async () => {
      const status = await unsplashService.getApiStatus()
      
      expect(status).toMatchObject({
        isAuthenticated: true,
        requestsUsed: expect.any(Number),
        requestsRemaining: expect.any(Number),
        requestsResetTime: expect.any(Date),
        lastRequest: expect.any(Date)
      })
    })

    it('should return unauthenticated status when access key missing', async () => {
      delete process.env.UNSPLASH_ACCESS_KEY
      const service = new UnsplashService()
      
      const status = await service.getApiStatus()
      
      expect(status).toMatchObject({
        isAuthenticated: false,
        requestsUsed: 0,
        requestsRemaining: 0,
        lastError: 'Access key not configured'
      })
    })
  })

  describe('request limiting', () => {
    it('should track request usage', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      } as Response)

      const initialStatus = await unsplashService.getApiStatus()
      const initialUsed = initialStatus.requestsUsed

      await unsplashService.searchPhotos({ query: 'hotdog' })

      const finalStatus = await unsplashService.getApiStatus()
      expect(finalStatus.requestsUsed).toBe(initialUsed + 1)
    })
  })
})