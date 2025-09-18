import { POST } from '@/app/api/admin/giphy/scan/route'
import { NextRequest } from 'next/server'

// Mock the Giphy scanning service with factory function to avoid hoisting issues
jest.mock('@/lib/services/giphy-scanning', () => {
  const mockGiphyScanningService = {
    performScan: jest.fn()
  }
  
  return {
    giphyScanningService: mockGiphyScanningService
  }
})

// Mock database logging
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

describe('/api/admin/giphy/scan', () => {
  let mockGiphyScanningService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Clear environment variables
    delete process.env.GIPHY_API_KEY
    
    // Get the mock service instance
    const { giphyScanningService } = require('@/lib/services/giphy-scanning')
    mockGiphyScanningService = giphyScanningService
  })

  describe('POST', () => {
    it('should successfully trigger Giphy scan with API mode', async () => {
      process.env.GIPHY_API_KEY = 'gph_test_api_key_12345'
      
      const mockScanResult = {
        totalFound: 20,
        processed: 15,
        approved: 12,
        rejected: 3,
        duplicates: 5
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 15 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockGiphyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 15 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.mode).toBe('api')
      expect(data.data.totalFound).toBe(20)
      expect(data.data.processed).toBe(15)
      expect(data.data.approved).toBe(12)
      expect(data.data.rejected).toBe(3)
      expect(data.data.duplicates).toBe(5)
      expect(data.data.maxPostsRequested).toBe(15)
      expect(data.data.timestamp).toBeTruthy()
      expect(data.message).toContain('15 processed, 12 approved')
      expect(data.message).toContain('api mode')
    })

    it('should successfully trigger Giphy scan with mock mode when API key missing', async () => {
      // Ensure GIPHY_API_KEY is not set
      delete process.env.GIPHY_API_KEY
      
      const mockScanResult = {
        totalFound: 5, // Mock mode returns fewer results
        processed: 5,
        approved: 4,
        rejected: 1,
        duplicates: 0
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 10 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockGiphyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 10 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.mode).toBe('mock')
      expect(data.data.totalFound).toBe(5)
      expect(data.message).toContain('mock mode')
    })

    it('should use default maxPosts when not provided', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const mockScanResult = {
        totalFound: 12,
        processed: 10,
        approved: 8,
        rejected: 2,
        duplicates: 2
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockGiphyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 10 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.maxPostsRequested).toBe(10)
    })

    it('should limit maxPosts to 30', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const mockScanResult = {
        totalFound: 25,
        processed: 22,
        approved: 18,
        rejected: 4,
        duplicates: 3
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 50 }) // Requesting more than limit
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockGiphyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 30 })
      expect(response.status).toBe(200)
      expect(data.data.maxPostsRequested).toBe(30)
    })

    it('should handle invalid JSON body gracefully', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const mockScanResult = {
        totalFound: 8,
        processed: 6,
        approved: 5,
        rejected: 1,
        duplicates: 2
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      // Should use default maxPosts (10) when JSON is invalid
      expect(mockGiphyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 10 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle scan failure', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      mockGiphyScanningService.performScan.mockRejectedValue(
        new Error('Giphy API rate limit exceeded')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('rate limit exceeded')
      expect(data.message).toBe('Giphy scan failed')
    })

    it('should handle empty scan results', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const emptyScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0
      }

      mockGiphyScanningService.performScan.mockResolvedValue(emptyScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalFound).toBe(0)
      expect(data.message).toContain('0 processed, 0 approved')
    })

    it('should handle scan with rate limit warnings', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const rateLimitWarningScanResult = {
        totalFound: 10,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 2,
        warnings: ['Rate limit approaching: 40/42 hourly requests used']
      }

      mockGiphyScanningService.performScan.mockResolvedValue(rateLimitWarningScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.warnings).toContain('Rate limit approaching: 40/42 hourly requests used')
    })

    it('should include timestamp in response', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const mockScanResult = {
        totalFound: 10,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 2
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const beforeRequest = Date.now()
      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()
      const afterRequest = Date.now()

      expect(response.status).toBe(200)
      expect(data.data.timestamp).toBeTruthy()
      
      const timestamp = new Date(data.data.timestamp).getTime()
      expect(timestamp).toBeGreaterThanOrEqual(beforeRequest)
      expect(timestamp).toBeLessThanOrEqual(afterRequest)
    })

    it('should handle non-numeric maxPosts parameter', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const mockScanResult = {
        totalFound: 12,
        processed: 10,
        approved: 7,
        rejected: 3,
        duplicates: 2
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 'invalid' })
      })

      const response = await POST(request)
      const data = await response.json()

      // Implementation passes through invalid values resulting in NaN
      expect(mockGiphyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: NaN })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle zero maxPosts parameter', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const mockScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 0 })
      })

      const response = await POST(request)
      const data = await response.json()

      // Should use default maxPosts (10) when value is 0 (falsy)
      expect(mockGiphyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 10 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle negative maxPosts parameter', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const mockScanResult = {
        totalFound: 5,
        processed: 4,
        approved: 3,
        rejected: 1,
        duplicates: 1
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: -5 })
      })

      const response = await POST(request)
      const data = await response.json()

      // Implementation passes through negative values
      expect(mockGiphyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: -5 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should properly handle different API/mock mode responses', async () => {
      // Test API mode first
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const apiMockScanResult = {
        totalFound: 15,
        processed: 12,
        approved: 10,
        rejected: 2,
        duplicates: 3
      }

      mockGiphyScanningService.performScan.mockResolvedValue(apiMockScanResult)

      let request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST'
      })

      let response = await POST(request)
      let data = await response.json()

      expect(data.data.mode).toBe('api')
      expect(data.message).toContain('api mode')

      // Clear and test mock mode
      delete process.env.GIPHY_API_KEY
      jest.clearAllMocks()

      const mockModeScanResult = {
        totalFound: 3,
        processed: 3,
        approved: 2,
        rejected: 1,
        duplicates: 0
      }

      mockGiphyScanningService.performScan.mockResolvedValue(mockModeScanResult)

      request = new NextRequest('http://localhost:3000/api/admin/giphy/scan', {
        method: 'POST'
      })

      response = await POST(request)
      data = await response.json()

      expect(data.data.mode).toBe('mock')
      expect(data.message).toContain('mock mode')
    })
  })
})