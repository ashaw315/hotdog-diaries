import { GET } from '@/app/api/admin/youtube/status/route'
import { NextRequest } from 'next/server'

// Mock the YouTube service with factory function to avoid hoisting issues
jest.mock('@/lib/services/youtube', () => {
  const mockYouTubeService = {
    getApiStatus: jest.fn()
  }
  
  return {
    YouTubeService: jest.fn(() => mockYouTubeService)
  }
})

describe('/api/admin/youtube/status', () => {
  let mockYouTubeService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mock service instance
    const { YouTubeService } = require('@/lib/services/youtube')
    mockYouTubeService = new YouTubeService()
  })

  describe('GET', () => {
    it('should return healthy YouTube API status', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        quotaUsed: 2500,
        quotaRemaining: 7500,
        dailyQuotaLimit: 10000,
        quotaResetTime: new Date('2024-01-02T00:00:00Z'),
        lastError: null,
        lastRequest: new Date('2024-01-01T15:30:00Z')
      }

      mockYouTubeService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/status')

      const response = await GET(request)
      const data = await response.json()

      expect(mockYouTubeService.getApiStatus).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isAuthenticated).toBe(true)
      expect(data.data.quotaUsed).toBe(2500)
      expect(data.data.quotaRemaining).toBe(7500)
      expect(data.data.dailyQuotaLimit).toBe(10000)
      expect(data.data.lastError).toBeNull()
    })

    it('should return unauthenticated status when API key is missing', async () => {
      const mockApiStatus = {
        isAuthenticated: false,
        quotaUsed: 0,
        quotaRemaining: 0,
        dailyQuotaLimit: 10000,
        quotaResetTime: new Date('2024-01-02T00:00:00Z'),
        lastError: 'API key not configured',
        lastRequest: null
      }

      mockYouTubeService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isAuthenticated).toBe(false)
      expect(data.data.quotaUsed).toBe(0)
      expect(data.data.quotaRemaining).toBe(0)
      expect(data.data.lastError).toBe('API key not configured')
    })

    it('should return quota exhausted status', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        quotaUsed: 10000,
        quotaRemaining: 0,
        dailyQuotaLimit: 10000,
        quotaResetTime: new Date('2024-01-02T00:00:00Z'),
        lastError: 'Quota exceeded',
        lastRequest: new Date('2024-01-01T20:45:00Z')
      }

      mockYouTubeService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isAuthenticated).toBe(true)
      expect(data.data.quotaUsed).toBe(10000)
      expect(data.data.quotaRemaining).toBe(0)
      expect(data.data.lastError).toBe('Quota exceeded')
    })

    it('should handle service failure', async () => {
      mockYouTubeService.getApiStatus.mockRejectedValue(
        new Error('Failed to connect to YouTube API')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to get YouTube API status')
      expect(data.details).toContain('Failed to connect to YouTube API')
    })

    it('should include default values for unimplemented fields', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        quotaUsed: 1000,
        quotaRemaining: 9000,
        dailyQuotaLimit: 10000,
        quotaResetTime: new Date('2024-01-02T00:00:00Z'),
        lastError: null,
        lastRequest: new Date('2024-01-01T10:00:00Z')
      }

      mockYouTubeService.getApiStatus.mockResolvedValue(mockApiStatus)

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.videosScanned).toBe(0) // Default value
      expect(data.data.channelsFollowed).toBe(0) // Default value  
      expect(data.data.avgViews).toBe(0) // Default value
    })
  })
})