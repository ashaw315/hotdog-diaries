import { GET } from '@/app/api/admin/unsplash/test/route'
import { NextRequest } from 'next/server'
import { unsplashService } from '@/lib/services/unsplash'

// Mock the unsplash service
jest.mock('@/lib/services/unsplash', () => ({
  unsplashService: {
    getApiStatus: jest.fn(),
    searchPhotos: jest.fn()
  }
}))

const mockUnsplashService = unsplashService as jest.Mocked<typeof unsplashService>

describe('/api/admin/unsplash/test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should test connection successfully with authenticated API', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 25,
        requestsRemaining: 475,
        lastError: null
      }

      const mockTestPhotos = [
        {
          id: 'test-photo',
          description: 'Test hotdog photo',
          photoUrl: 'https://example.com/test.jpg'
        }
      ]

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)
      mockUnsplashService.searchPhotos.mockResolvedValue(mockTestPhotos)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: 'Unsplash API connection successful',
        data: {
          isAuthenticated: true,
          requestsUsed: 25,
          requestsRemaining: 475,
          testSearchResults: 1,
          connectionTime: expect.any(String)
        }
      })

      expect(mockUnsplashService.getApiStatus).toHaveBeenCalled()
      expect(mockUnsplashService.searchPhotos).toHaveBeenCalledWith({
        query: 'hotdog',
        maxResults: 1
      })
    })

    it('should handle authenticated API but search failure', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 30,
        requestsRemaining: 470,
        lastError: null
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)
      mockUnsplashService.searchPhotos.mockRejectedValue(new Error('Search failed'))

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: false,
        message: 'Unsplash API authenticated but search failed',
        data: {
          isAuthenticated: true,
          searchError: 'Search failed',
          connectionTime: expect.any(String)
        }
      })
    })

    it('should handle unauthenticated API', async () => {
      const mockApiStatus = {
        isAuthenticated: false,
        requestsUsed: 0,
        requestsRemaining: 0,
        lastError: 'Invalid API key'
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: false,
        message: 'Invalid API key',
        data: {
          isAuthenticated: false,
          lastError: 'Invalid API key',
          connectionTime: expect.any(String)
        }
      })

      expect(mockUnsplashService.searchPhotos).not.toHaveBeenCalled()
    })

    it('should handle unauthenticated API with default error message', async () => {
      const mockApiStatus = {
        isAuthenticated: false,
        requestsUsed: 0,
        requestsRemaining: 0,
        lastError: null
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: false,
        message: 'Unsplash API not authenticated',
        data: {
          isAuthenticated: false,
          lastError: null,
          connectionTime: expect.any(String)
        }
      })
    })

    it('should handle connection test errors', async () => {
      mockUnsplashService.getApiStatus.mockRejectedValue(new Error('Connection timeout'))

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        message: 'Connection test failed',
        error: 'Connection timeout'
      })
    })

    it('should include valid connection timestamps', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 10,
        requestsRemaining: 490,
        lastError: null
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)
      mockUnsplashService.searchPhotos.mockResolvedValue([])

      const beforeRequest = Date.now()
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()
      const afterRequest = Date.now()

      expect(response.status).toBe(200)
      
      const connectionTime = new Date(data.data.connectionTime).getTime()
      expect(connectionTime).toBeGreaterThanOrEqual(beforeRequest)
      expect(connectionTime).toBeLessThanOrEqual(afterRequest)
    })

    it('should handle search with multiple test results', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 15,
        requestsRemaining: 485,
        lastError: null
      }

      const mockTestPhotos = [
        {
          id: 'test-photo-1',
          description: 'First test hotdog',
          photoUrl: 'https://example.com/test1.jpg'
        }
      ]

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)
      mockUnsplashService.searchPhotos.mockResolvedValue(mockTestPhotos)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.testSearchResults).toBe(1)
      expect(data.data.requestsUsed).toBe(15)
      expect(data.data.requestsRemaining).toBe(485)
    })

    it('should handle API quota exhaustion scenario', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 50,
        requestsRemaining: 0,
        lastError: 'Rate limit exceeded'
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)
      mockUnsplashService.searchPhotos.mockRejectedValue(new Error('Rate limit exceeded'))

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.message).toContain('search failed')
      expect(data.data.searchError).toBe('Rate limit exceeded')
    })

    it('should validate API status data structure', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 20,
        requestsRemaining: 480,
        lastError: null
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)
      mockUnsplashService.searchPhotos.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveProperty('isAuthenticated')
      expect(data.data).toHaveProperty('requestsUsed')
      expect(data.data).toHaveProperty('requestsRemaining')
      expect(data.data).toHaveProperty('testSearchResults')
      expect(data.data).toHaveProperty('connectionTime')
      
      expect(typeof data.data.isAuthenticated).toBe('boolean')
      expect(typeof data.data.requestsUsed).toBe('number')
      expect(typeof data.data.requestsRemaining).toBe('number')
      expect(typeof data.data.testSearchResults).toBe('number')
      expect(typeof data.data.connectionTime).toBe('string')
    })
  })
})