import { GET, POST } from '@/app/api/admin/reddit/settings/route'
import { NextRequest } from 'next/server'
import { redditScanningService } from '@/lib/services/reddit-scanning'

// Mock dependencies
jest.mock('@/lib/services/reddit-scanning')
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const mockRedditScanningService = redditScanningService as jest.Mocked<typeof redditScanningService>

describe('/api/admin/reddit/settings', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/admin/reddit/settings', () => {
    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings')
    })

    it('should successfully retrieve Reddit configuration', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 30,
        maxPostsPerScan: 25,
        targetSubreddits: ['hotdogs', 'food'],
        searchTerms: ['hotdog', 'hot dog'],
        minScore: 10,
        sortBy: 'hot' as const,
        timeRange: 'week' as const,
        includeNSFW: false,
        lastScanTime: new Date(),
        lastScanId: 'scan_123'
      }

      mockRedditScanningService.getScanConfig.mockResolvedValue(mockConfig)

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockConfig)
      expect(data.message).toBe('Reddit configuration retrieved successfully')
    })

    it('should handle configuration retrieval errors', async () => {
      const error = new Error('Database connection failed')
      mockRedditScanningService.getScanConfig.mockRejectedValue(error)

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Database connection failed')
      expect(data.message).toBe('Failed to retrieve Reddit configuration')
    })
  })

  describe('POST /api/admin/reddit/settings', () => {
    const validConfig = {
      isEnabled: true,
      scanInterval: 45,
      maxPostsPerScan: 30,
      minScore: 15,
      sortBy: 'top',
      timeRange: 'day',
      includeNSFW: false,
      targetSubreddits: ['hotdogs', 'food', 'grilling'],
      searchTerms: ['hotdog', 'frankfurter']
    }

    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings', {
        method: 'POST',
        body: JSON.stringify(validConfig),
        headers: { 'Content-Type': 'application/json' }
      })
    })

    it('should successfully update Reddit configuration', async () => {
      const updatedConfig = { ...validConfig, lastScanTime: new Date() }
      
      mockRedditScanningService.updateScanConfig.mockResolvedValue()
      mockRedditScanningService.getScanConfig.mockResolvedValue(updatedConfig)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(updatedConfig)
      expect(data.message).toBe('Reddit configuration updated successfully')
      expect(mockRedditScanningService.updateScanConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          isEnabled: true,
          scanInterval: 45,
          maxPostsPerScan: 30,
          minScore: 15
        })
      )
    })

    it('should validate required fields', async () => {
      const invalidConfig = {} // no fields provided

      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings', {
        method: 'POST',
        body: JSON.stringify(invalidConfig),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('At least one configuration field must be provided')
      expect(data.message).toBe('Invalid configuration data')
    })

    it('should validate scan interval range', async () => {
      const invalidConfig = { ...validConfig, scanInterval: 2 } // below minimum

      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings', {
        method: 'POST',
        body: JSON.stringify(invalidConfig),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Scan interval must be between 5 and 1440 minutes')
    })

    it('should validate max posts per scan range', async () => {
      const invalidConfig = { ...validConfig, maxPostsPerScan: 150 } // above maximum

      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings', {
        method: 'POST',
        body: JSON.stringify(invalidConfig),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Max posts per scan must be between 1 and 100')
    })

    it('should validate minimum score', async () => {
      const invalidConfig = { ...validConfig, minScore: -5 } // negative value

      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings', {
        method: 'POST',
        body: JSON.stringify(invalidConfig),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Minimum score cannot be negative')
    })

    it('should validate array fields', async () => {
      const invalidConfig = { ...validConfig, targetSubreddits: 'not-an-array' }

      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings', {
        method: 'POST',
        body: JSON.stringify(invalidConfig),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Target subreddits must be an array')
    })

    it('should handle update errors', async () => {
      const error = new Error('Database update failed')
      mockRedditScanningService.updateScanConfig.mockRejectedValue(error)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Database update failed')
      expect(data.message).toBe('Failed to update Reddit configuration')
    })

    it('should handle partial configuration updates', async () => {
      const partialConfig = { scanInterval: 60, minScore: 20 }
      const updatedConfig = { ...validConfig, scanInterval: 60, minScore: 20 }

      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings', {
        method: 'POST',
        body: JSON.stringify(partialConfig),
        headers: { 'Content-Type': 'application/json' }
      })

      mockRedditScanningService.updateScanConfig.mockResolvedValue()
      mockRedditScanningService.getScanConfig.mockResolvedValue(updatedConfig)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockRedditScanningService.updateScanConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          scanInterval: 60,
          minScore: 20
        })
      )
    })

    it('should handle malformed JSON', async () => {
      mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/settings', {
        method: 'POST',
        body: 'invalid-json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(500) // JSON parsing error
    })
  })
})