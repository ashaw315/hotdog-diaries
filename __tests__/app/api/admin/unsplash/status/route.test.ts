import { GET } from '@/app/api/admin/unsplash/status/route'
import { NextRequest } from 'next/server'

// Mock the Unsplash service with factory function to avoid hoisting issues
jest.mock('@/lib/services/unsplash', () => {
  const mockUnsplashService = {
    getApiStatus: jest.fn()
  }
  
  return {
    unsplashService: mockUnsplashService
  }
})

describe('/api/admin/unsplash/status', () => {
  let mockUnsplashService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mock service instance
    const { unsplashService } = require('@/lib/services/unsplash')
    mockUnsplashService = unsplashService
  })

  describe('GET', () => {
    it('should return comprehensive Unsplash API status', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 125,
        requestsRemaining: 375,
        requestsResetTime: new Date(Date.now() + 3600000).toISOString(),
        lastError: null,
        lastRequest: new Date().toISOString()
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/status')

      const response = await GET(request)
      const data = await response.json()

      expect(mockUnsplashService.getApiStatus).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isAuthenticated).toBe(true)
      expect(data.data.requestsUsed).toBe(125)
      expect(data.data.requestsRemaining).toBe(375)
      expect(data.data.requestsResetTime).toBeTruthy()
      expect(data.data.lastError).toBeNull()
      expect(data.data.lastRequest).toBeTruthy()
      expect(data.data.photosScanned).toBe(0) // Will be populated from database in full implementation
      expect(data.data.avgLikes).toBe(0) // Will be populated from database in full implementation
    })

    it('should return status when API is not authenticated', async () => {
      const mockApiStatus = {
        isAuthenticated: false,
        requestsUsed: 0,
        requestsRemaining: 0,
        requestsResetTime: null,
        lastError: 'Invalid API key',
        lastRequest: null
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isAuthenticated).toBe(false)
      expect(data.data.requestsUsed).toBe(0)
      expect(data.data.requestsRemaining).toBe(0)
      expect(data.data.lastError).toBe('Invalid API key')
    })

    it('should handle API status with rate limit exhaustion', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 50,
        requestsRemaining: 0,
        requestsResetTime: new Date(Date.now() + 1800000).toISOString(), // 30 minutes
        lastError: 'Rate limit exceeded',
        lastRequest: new Date().toISOString()
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.requestsRemaining).toBe(0)
      expect(data.data.lastError).toBe('Rate limit exceeded')
      expect(data.data.requestsResetTime).toBeTruthy()
    })

    it('should handle service failure', async () => {
      mockUnsplashService.getApiStatus.mockRejectedValue(
        new Error('Failed to connect to Unsplash API')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to get Unsplash API status')
      expect(data.details).toBe('Failed to connect to Unsplash API')
    })

    it('should include request timing information', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 25,
        requestsRemaining: 475,
        requestsResetTime: new Date(Date.now() + 3600000).toISOString(),
        lastError: null,
        lastRequest: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.lastRequest).toBeTruthy()
      expect(new Date(data.data.lastRequest).getTime()).toBeLessThan(Date.now())
    })

    it('should handle missing API credentials', async () => {
      const mockApiStatus = {
        isAuthenticated: false,
        requestsUsed: 0,
        requestsRemaining: 50, // Demo mode limits
        requestsResetTime: null,
        lastError: 'No API key configured',
        lastRequest: null
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isAuthenticated).toBe(false)
      expect(data.data.lastError).toBe('No API key configured')
      expect(data.data.requestsRemaining).toBe(50) // Demo mode
    })

    it('should handle network connectivity issues', async () => {
      mockUnsplashService.getApiStatus.mockRejectedValue(
        new Error('Network timeout: Unable to reach Unsplash API')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to get Unsplash API status')
      expect(data.details).toContain('Network timeout')
    })

    it('should return status with high usage metrics', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        requestsUsed: 45,
        requestsRemaining: 5,
        requestsResetTime: new Date(Date.now() + 600000).toISOString(), // 10 minutes
        lastError: null,
        lastRequest: new Date().toISOString()
      }

      mockUnsplashService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.requestsUsed).toBe(45)
      expect(data.data.requestsRemaining).toBe(5)
      expect(data.data.requestsResetTime).toBeTruthy()
    })
  })
})