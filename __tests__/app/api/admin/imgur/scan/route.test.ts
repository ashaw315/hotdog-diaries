import { POST, GET } from '@/app/api/admin/imgur/scan/route'
import { NextRequest } from 'next/server'

// Mock the Imgur scanning service with factory function to avoid hoisting issues
jest.mock('@/lib/services/imgur-scanning', () => {
  const mockImgurScanningService = {
    performScan: jest.fn(),
    getScanConfig: jest.fn()
  }
  
  return {
    imgurScanningService: mockImgurScanningService
  }
})

// Mock database logging
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

describe('/api/admin/imgur/scan', () => {
  let mockImgurScanningService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Clear environment variables
    delete process.env.IMGUR_CLIENT_ID
    
    // Get the mock service instance
    const { imgurScanningService } = require('@/lib/services/imgur-scanning')
    mockImgurScanningService = imgurScanningService
  })

  describe('POST', () => {
    it('should successfully trigger Imgur scan with API mode', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id_123'
      
      const mockScanResult = {
        totalFound: 25,
        processed: 20,
        approved: 15,
        rejected: 5,
        duplicates: 5
      }

      mockImgurScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 20 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockImgurScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.mode).toBe('api')
      expect(data.data.totalFound).toBe(25)
      expect(data.data.processed).toBe(20)
      expect(data.data.approved).toBe(15)
      expect(data.data.rejected).toBe(5)
      expect(data.data.duplicates).toBe(5)
      expect(data.data.maxPostsRequested).toBe(20)
      expect(data.data.timestamp).toBeTruthy()
      expect(data.message).toContain('20 processed, 15 approved')
      expect(data.message).toContain('api mode')
    })

    it('should successfully trigger Imgur scan with mock mode when client ID missing', async () => {
      // Ensure IMGUR_CLIENT_ID is not set
      delete process.env.IMGUR_CLIENT_ID
      
      const mockScanResult = {
        totalFound: 10,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 2
      }

      mockImgurScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 15 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockImgurScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 15 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.mode).toBe('mock')
      expect(data.message).toContain('mock mode')
    })

    it('should use default maxPosts when not provided', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      
      const mockScanResult = {
        totalFound: 15,
        processed: 12,
        approved: 9,
        rejected: 3,
        duplicates: 3
      }

      mockImgurScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockImgurScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.maxPostsRequested).toBe(20)
    })

    it('should limit maxPosts to 50', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      
      const mockScanResult = {
        totalFound: 40,
        processed: 35,
        approved: 25,
        rejected: 10,
        duplicates: 5
      }

      mockImgurScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 100 }) // Requesting more than limit
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockImgurScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 50 })
      expect(response.status).toBe(200)
      expect(data.data.maxPostsRequested).toBe(50)
    })

    it('should handle invalid JSON body gracefully', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      
      const mockScanResult = {
        totalFound: 8,
        processed: 6,
        approved: 4,
        rejected: 2,
        duplicates: 2
      }

      mockImgurScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      // Should use default maxPosts (20) when JSON is invalid
      expect(mockImgurScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle scan failure', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      
      mockImgurScanningService.performScan.mockRejectedValue(
        new Error('Imgur API rate limit exceeded')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('rate limit exceeded')
      expect(data.message).toBe('Imgur scan failed')
    })

    it('should handle empty scan results', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      
      const emptyScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0
      }

      mockImgurScanningService.performScan.mockResolvedValue(emptyScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalFound).toBe(0)
      expect(data.message).toContain('0 processed, 0 approved')
    })

    it('should include timestamp in response', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      
      const mockScanResult = {
        totalFound: 10,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 2
      }

      mockImgurScanningService.performScan.mockResolvedValue(mockScanResult)

      const beforeRequest = Date.now()
      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan', {
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
  })

  describe('GET', () => {
    it('should return scan configuration with API mode', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id_123'
      
      const mockConfig = {
        isEnabled: true,
        scanInterval: 180,
        maxImagesPerScan: 25,
        searchTerms: ['hotdog', 'hot dog'],
        includeNSFW: false
      }

      mockImgurScanningService.getScanConfig.mockResolvedValue(mockConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan')

      const response = await GET(request)
      const data = await response.json()

      expect(mockImgurScanningService.getScanConfig).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.mode).toBe('api')
      expect(data.data.configuration).toEqual(mockConfig)
      expect(data.data.environment.hasClientId).toBe(true)
      expect(data.data.environment.nodeEnv).toBe('test')
      expect(data.data.limits.maxPostsPerRequest).toBe(50)
      expect(data.data.limits.recommendedMaxPosts).toBe(20)
      expect(data.message).toContain('api mode')
    })

    it('should return scan configuration with mock mode when client ID missing', async () => {
      delete process.env.IMGUR_CLIENT_ID
      
      const mockConfig = {
        isEnabled: false,
        scanInterval: 180,
        maxImagesPerScan: 0,
        searchTerms: ['hotdog'],
        includeNSFW: false
      }

      mockImgurScanningService.getScanConfig.mockResolvedValue(mockConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.mode).toBe('mock')
      expect(data.data.environment.hasClientId).toBe(false)
      expect(data.message).toContain('mock mode')
    })

    it('should handle getScanConfig failure', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      
      mockImgurScanningService.getScanConfig.mockRejectedValue(
        new Error('Failed to load configuration')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Failed to load configuration')
      expect(data.message).toBe('Failed to retrieve scan configuration')
    })

    it('should include proper environment information', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      process.env.NODE_ENV = 'test'
      
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240,
        maxImagesPerScan: 20,
        searchTerms: ['hotdog'],
        includeNSFW: false
      }

      mockImgurScanningService.getScanConfig.mockResolvedValue(mockConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.environment.hasClientId).toBe(true)
      expect(data.data.environment.nodeEnv).toBe('test')
      expect(typeof data.data.environment.hasClientId).toBe('boolean')
      expect(typeof data.data.environment.nodeEnv).toBe('string')
    })

    it('should include scan limits information', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id'
      
      const mockConfig = { isEnabled: true, scanInterval: 180 }
      mockImgurScanningService.getScanConfig.mockResolvedValue(mockConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/scan')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.limits).toEqual({
        maxPostsPerRequest: 50,
        recommendedMaxPosts: 20
      })
    })
  })
})