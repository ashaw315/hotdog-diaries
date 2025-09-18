import { POST } from '@/app/api/admin/scan-tumblr-now/route'
import { NextRequest } from 'next/server'

// Mock the Tumblr scanning service with factory function to avoid hoisting issues
jest.mock('@/lib/services/tumblr-scanning', () => {
  const mockTumblrScanningService = {
    performScan: jest.fn(),
    testConnection: jest.fn()
  }
  
  return {
    tumblrScanningService: mockTumblrScanningService
  }
})

describe('/api/admin/scan-tumblr-now', () => {
  let mockTumblrScanningService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Clear environment variables
    delete process.env.TUMBLR_API_KEY
    
    // Get the mock service instance
    const { tumblrScanningService } = require('@/lib/services/tumblr-scanning')
    mockTumblrScanningService = tumblrScanningService
  })

  describe('POST', () => {
    it('should successfully trigger Tumblr scan with API mode and admin auth', async () => {
      process.env.TUMBLR_API_KEY = 'tumblr_api_key_123'
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful',
        details: { authenticated: true }
      }

      const mockScanResult = {
        totalFound: 25,
        processed: 20,
        approved: 15,
        rejected: 5,
        duplicates: 5,
        errors: []
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockResolvedValue(mockScanResult)

      // Create request with admin authorization header
      const adminToken = Buffer.from(JSON.stringify({ username: 'admin', id: 1 })).toString('base64')
      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ maxPosts: 20 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockTumblrScanningService.testConnection).toHaveBeenCalled()
      expect(mockTumblrScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Successfully added 15 creative Tumblr posts')
      expect(data.posts_added).toBe(15)
      expect(data.stats.totalFound).toBe(25)
      expect(data.stats.processed).toBe(20)
      expect(data.stats.approved).toBe(15)
      expect(data.stats.rejected).toBe(5)
      expect(data.stats.duplicates).toBe(5)
      expect(data.stats.platform).toBe('tumblr')
      expect(data.stats.usingMockData).toBe(false)
      expect(data.stats.searchTags).toEqual(['hotdog', 'hot dog', 'food photography', 'food blog'])
    })

    it('should successfully trigger Tumblr scan with header auth', async () => {
      process.env.TUMBLR_API_KEY = 'tumblr_api_key_123'
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful'
      }

      const mockScanResult = {
        totalFound: 12,
        processed: 10,
        approved: 8,
        rejected: 2,
        duplicates: 2,
        errors: []
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
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
      expect(data.posts_added).toBe(8)
    })

    it('should handle mock mode when API key missing', async () => {
      // Ensure TUMBLR_API_KEY is not set
      delete process.env.TUMBLR_API_KEY
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful (mock mode)'
      }

      const mockScanResult = {
        totalFound: 5,
        processed: 5,
        approved: 3,
        rejected: 2,
        duplicates: 0,
        errors: []
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
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
      expect(data.message).toContain('Successfully added 3 creative Tumblr posts')
      expect(data.stats.usingMockData).toBe(true)
      expect(data.stats.searchTags).toEqual(['mock'])
    })

    it('should handle case with no approved posts (API mode)', async () => {
      process.env.TUMBLR_API_KEY = 'tumblr_api_key_123'
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful'
      }

      const mockScanResult = {
        totalFound: 15,
        processed: 15,
        approved: 0, // No posts approved
        rejected: 15,
        duplicates: 0,
        errors: []
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.message).toContain('No new content added')
      expect(data.posts_added).toBe(0)
    })

    it('should handle case with no approved posts (mock mode)', async () => {
      // Mock mode should return 200 even with no approved content
      delete process.env.TUMBLR_API_KEY
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful (mock mode)'
      }

      const mockScanResult = {
        totalFound: 3,
        processed: 3,
        approved: 0, // No posts approved
        rejected: 3,
        duplicates: 0,
        errors: []
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200) // Mock mode returns 200 even with no approved content
      expect(data.success).toBe(false)
      expect(data.message).toContain('Mock scan completed - configure TUMBLR_API_KEY for live data')
      expect(data.posts_added).toBe(0)
    })

    it('should handle connection test failure', async () => {
      process.env.TUMBLR_API_KEY = 'invalid_api_key'
      
      const mockConnectionTest = {
        success: false,
        message: 'Tumblr API authentication failed',
        details: { error: 'Invalid API key' }
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Tumblr API connection failed')
      expect(data.posts_added).toBe(0)
    })

    it('should handle authentication failure', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST'
        // No authentication headers
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle scan failure', async () => {
      process.env.TUMBLR_API_KEY = 'tumblr_api_key_123'
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful'
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockRejectedValue(
        new Error('Tumblr API rate limit exceeded')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('rate limit exceeded')
      expect(data.posts_added).toBe(0)
    })

    it('should use default maxPosts when not provided', async () => {
      process.env.TUMBLR_API_KEY = 'tumblr_api_key_123'
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful'
      }

      const mockScanResult = {
        totalFound: 15,
        processed: 12,
        approved: 8,
        rejected: 4,
        duplicates: 3,
        errors: []
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
        // No body provided
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockTumblrScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle invalid JSON body gracefully', async () => {
      process.env.TUMBLR_API_KEY = 'tumblr_api_key_123'
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful'
      }

      const mockScanResult = {
        totalFound: 10,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 2,
        errors: []
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        },
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      // Should use default maxPosts (20) when JSON is invalid
      expect(mockTumblrScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle scan with errors but some success', async () => {
      process.env.TUMBLR_API_KEY = 'tumblr_api_key_123'
      
      const mockConnectionTest = {
        success: true,
        message: 'Tumblr connection successful'
      }

      const mockScanResult = {
        totalFound: 20,
        processed: 15,
        approved: 8,
        rejected: 7,
        duplicates: 5,
        errors: ['Failed to process 5 posts due to network timeouts']
      }

      mockTumblrScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockTumblrScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-tumblr-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true) // Still successful because some posts were approved
      expect(data.posts_added).toBe(8)
      expect(data.stats.errors).toBe(1) // Number of error messages
    })
  })
})