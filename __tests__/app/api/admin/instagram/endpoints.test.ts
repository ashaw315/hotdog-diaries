import { NextRequest } from 'next/server'
import { instagramService } from '@/lib/services/instagram'
import { instagramScanningService } from '@/lib/services/instagram-scanning'
import { instagramMonitoringService } from '@/lib/services/instagram-monitoring'

// Mock all services
jest.mock('@/lib/services/instagram')
jest.mock('@/lib/services/instagram-scanning')
jest.mock('@/lib/services/instagram-monitoring')
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const mockInstagramService = instagramService as jest.Mocked<typeof instagramService>
const mockInstagramScanningService = instagramScanningService as jest.Mocked<typeof instagramScanningService>
const mockInstagramMonitoringService = instagramMonitoringService as jest.Mocked<typeof instagramMonitoringService>

// Helper function to create mock NextRequest
function createMockRequest(method: string, url: string, body?: any): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : undefined
  })
}

describe('Instagram API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('/api/admin/instagram/authenticate', () => {
    let POST: (request: NextRequest) => Promise<Response>

    beforeAll(async () => {
      const module = await import('@/app/api/admin/instagram/authenticate/route')
      POST = module.POST
    })

    it('should authenticate successfully with valid code', async () => {
      const mockTokens = {
        accessToken: 'new_access_token',
        userId: 'user123',
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        scope: ['user_profile', 'user_media']
      }

      mockInstagramService.handleInstagramAuth.mockResolvedValue(mockTokens)

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/authenticate', {
        authCode: 'test_auth_code',
        redirectUri: 'http://localhost:3000/callback'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        userId: 'user123',
        expiresAt: mockTokens.expiresAt.toISOString(),
        scope: ['user_profile', 'user_media']
      })
    })

    it('should handle authentication failure', async () => {
      mockInstagramService.handleInstagramAuth.mockRejectedValue(new Error('Invalid auth code'))

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/authenticate', {
        authCode: 'invalid_code',
        redirectUri: 'http://localhost:3000/callback'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid auth code')
    })

    it('should validate required fields', async () => {
      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/authenticate', {
        // Missing authCode and redirectUri
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('authCode and redirectUri are required')
    })
  })

  describe('/api/admin/instagram/scan', () => {
    let POST: (request: NextRequest) => Promise<Response>

    beforeAll(async () => {
      const module = await import('@/app/api/admin/instagram/scan/route')
      POST = module.POST
    })

    it('should trigger manual scan successfully', async () => {
      const mockScanResult = {
        scanId: 'instagram_scan_123',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 15,
        postsProcessed: 12,
        postsApproved: 8,
        postsRejected: 4,
        postsFlagged: 0,
        duplicatesFound: 3,
        errors: [],
        rateLimitHit: false,
        hashtagsScanned: ['hotdog', 'frankfurter']
      }

      mockInstagramScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/scan')

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockScanResult)
    })

    it('should handle scan errors', async () => {
      mockInstagramScanningService.performScan.mockRejectedValue(new Error('Scan failed'))

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/scan')

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Scan failed')
    })

    it('should handle concurrent scan attempts', async () => {
      mockInstagramScanningService.performScan.mockRejectedValue(new Error('Instagram scan already in progress'))

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/scan')

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.error).toContain('already in progress')
    })
  })

  describe('/api/admin/instagram/settings', () => {
    let GET: (request: NextRequest) => Promise<Response>
    let POST: (request: NextRequest) => Promise<Response>

    beforeAll(async () => {
      const module = await import('@/app/api/admin/instagram/settings/route')
      GET = module.GET
      POST = module.POST
    })

    describe('GET', () => {
      it('should return current settings', async () => {
        const mockConfig = {
          isEnabled: true,
          scanInterval: 45,
          maxPostsPerScan: 30,
          targetHashtags: ['hotdog', 'frankfurter'],
          minLikes: 10,
          includeStories: false
        }

        mockInstagramScanningService.getScanConfig.mockResolvedValue(mockConfig)

        const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/settings')

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data).toEqual(mockConfig)
      })

      it('should handle settings retrieval errors', async () => {
        mockInstagramScanningService.getScanConfig.mockRejectedValue(new Error('Database error'))

        const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/settings')

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Database error')
      })
    })

    describe('POST', () => {
      it('should update settings successfully', async () => {
        const updateData = {
          isEnabled: true,
          scanInterval: 30,
          maxPostsPerScan: 50,
          targetHashtags: ['hotdog', 'frankfurter', 'bratwurst'],
          minLikes: 15,
          includeStories: true
        }

        mockInstagramScanningService.updateScanConfig.mockResolvedValue()

        const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/settings', updateData)

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(mockInstagramScanningService.updateScanConfig).toHaveBeenCalledWith(updateData)
      })

      it('should validate settings data', async () => {
        const invalidData = {
          scanInterval: -10, // Invalid negative interval
          maxPostsPerScan: 'invalid', // Should be number
        }

        const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/settings', invalidData)

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Invalid')
      })

      it('should handle update errors', async () => {
        mockInstagramScanningService.updateScanConfig.mockRejectedValue(new Error('Update failed'))

        const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/settings', {
          isEnabled: true
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Update failed')
      })
    })
  })

  describe('/api/admin/instagram/stats', () => {
    let GET: (request: NextRequest) => Promise<Response>

    beforeAll(async () => {
      const module = await import('@/app/api/admin/instagram/stats/route')
      GET = module.GET
    })

    it('should return Instagram statistics', async () => {
      const mockStats = {
        totalScans: 25,
        totalPostsFound: 500,
        totalPostsProcessed: 450,
        totalPostsApproved: 350,
        averageLikes: 18.5,
        topHashtags: [
          { hashtag: 'hotdog', count: 200, avgLikes: 20.5 },
          { hashtag: 'frankfurter', count: 150, avgLikes: 16.2 }
        ],
        topAccounts: [],
        scanFrequency: 60,
        lastScanTime: new Date('2023-01-01T10:00:00Z'),
        successRate: 77.78
      }

      mockInstagramScanningService.getScanStats.mockResolvedValue(mockStats)

      const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/stats')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(expect.objectContaining({
        totalScans: 25,
        totalPostsFound: 500,
        totalPostsApproved: 350,
        successRate: 77.78
      }))
    })

    it('should handle stats retrieval errors', async () => {
      mockInstagramScanningService.getScanStats.mockRejectedValue(new Error('Stats error'))

      const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/stats')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Stats error')
    })
  })

  describe('/api/admin/instagram/status', () => {
    let GET: (request: NextRequest) => Promise<Response>

    beforeAll(async () => {
      const module = await import('@/app/api/admin/instagram/status/route')
      GET = module.GET
    })

    it('should return Instagram API status', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        rateLimits: {
          used: 50,
          remaining: 150,
          resetTime: new Date()
        },
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastRequest: new Date()
      }

      const mockHealthMetrics = {
        authenticationStatus: 'healthy' as const,
        rateLimitStatus: 'healthy' as const,
        scanStatus: 'active' as const,
        errorRate: 2.5,
        averageResponseTime: 1250,
        uptime: 98.5,
        alertsTriggered: 0
      }

      mockInstagramService.getApiStatus.mockResolvedValue(mockApiStatus)
      mockInstagramMonitoringService.getHealthMetrics.mockResolvedValue(mockHealthMetrics)

      const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        api: mockApiStatus,
        health: mockHealthMetrics
      })
    })

    it('should handle status check errors', async () => {
      mockInstagramService.getApiStatus.mockRejectedValue(new Error('Status check failed'))

      const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Status check failed')
    })
  })

  describe('/api/admin/instagram/test-connection', () => {
    let POST: (request: NextRequest) => Promise<Response>

    beforeAll(async () => {
      const module = await import('@/app/api/admin/instagram/test-connection/route')
      POST = module.POST
    })

    it('should return successful connection test', async () => {
      const mockConnectionResult = {
        success: true,
        message: 'Instagram API connection successful',
        details: {
          isAuthenticated: true,
          rateLimits: { used: 10, remaining: 190, resetTime: new Date() }
        }
      }

      mockInstagramScanningService.testConnection.mockResolvedValue(mockConnectionResult)

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/test-connection')

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockConnectionResult)
    })

    it('should return failed connection test', async () => {
      const mockConnectionResult = {
        success: false,
        message: 'Instagram not authenticated',
        details: {
          isAuthenticated: false,
          lastError: 'Token expired'
        }
      }

      mockInstagramScanningService.testConnection.mockResolvedValue(mockConnectionResult)

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/test-connection')

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200) // Still 200 for successful API call
      expect(data.success).toBe(true)
      expect(data.data.success).toBe(false) // But connection test failed
      expect(data.data.message).toContain('not authenticated')
    })

    it('should handle test connection errors', async () => {
      mockInstagramScanningService.testConnection.mockRejectedValue(new Error('Connection test error'))

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/test-connection')

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Connection test error')
    })
  })

  describe('/api/admin/instagram/scan-history', () => {
    let GET: (request: NextRequest) => Promise<Response>

    beforeAll(async () => {
      const module = await import('@/app/api/admin/instagram/scan-history/route')
      GET = module.GET
    })

    it('should return scan history', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      const mockScanHistory = [
        {
          scan_id: 'instagram_scan_123',
          start_time: new Date('2023-01-01T10:00:00Z'),
          end_time: new Date('2023-01-01T10:05:00Z'),
          posts_found: 15,
          posts_processed: 12,
          posts_approved: 8,
          posts_rejected: 4,
          duplicates_found: 3,
          hashtags_scanned: ['hotdog', 'frankfurter'],
          errors: [],
          rate_limit_hit: false
        },
        {
          scan_id: 'instagram_scan_124',
          start_time: new Date('2023-01-01T11:00:00Z'),
          end_time: new Date('2023-01-01T11:03:00Z'),
          posts_found: 10,
          posts_processed: 9,
          posts_approved: 7,
          posts_rejected: 2,
          duplicates_found: 1,
          hashtags_scanned: ['hotdog'],
          errors: [],
          rate_limit_hit: false
        }
      ]

      mockQuery.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue(Promise.resolve(mockScanHistory))
      })

      const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/scan-history')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0]).toEqual(expect.objectContaining({
        scanId: 'instagram_scan_123',
        postsFound: 15,
        postsApproved: 8
      }))
    })

    it('should handle query parameters for pagination', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue(Promise.resolve([]))
      })

      const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/scan-history?limit=5&offset=10')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockQuery().limit).toHaveBeenCalledWith(5)
    })

    it('should handle scan history retrieval errors', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/scan-history')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Database connection failed')
    })

    it('should return empty array when no scan history exists', async () => {
      const mockQuery = require('@/lib/db-query-builder')
      mockQuery.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue(Promise.resolve([]))
      })

      const request = createMockRequest('GET', 'http://localhost:3000/api/admin/instagram/scan-history')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual([])
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON in request bodies', async () => {
      const module = await import('@/app/api/admin/instagram/authenticate/route')
      const POST = module.POST

      // Create request with malformed JSON
      const request = new NextRequest('http://localhost:3000/api/admin/instagram/authenticate', {
        method: 'POST',
        body: '{"authCode": "test", invalid json}',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid JSON')
    })

    it('should handle missing Content-Type header', async () => {
      const module = await import('@/app/api/admin/instagram/settings/route')
      const POST = module.POST

      const request = new NextRequest('http://localhost:3000/api/admin/instagram/settings', {
        method: 'POST',
        body: JSON.stringify({ isEnabled: true })
        // Missing Content-Type header
      })

      const response = await POST(request)
      
      // Should still process the request if JSON is valid
      expect(response.status).toBeLessThan(500)
    })
  })

  describe('Rate Limiting', () => {
    it('should handle rate-limited requests gracefully', async () => {
      const module = await import('@/app/api/admin/instagram/scan/route')
      const POST = module.POST

      mockInstagramScanningService.performScan.mockRejectedValue(
        new Error('Instagram API rate limit exceeded. Reset in 3600 seconds')
      )

      const request = createMockRequest('POST', 'http://localhost:3000/api/admin/instagram/scan')

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toContain('rate limit')
    })
  })
})