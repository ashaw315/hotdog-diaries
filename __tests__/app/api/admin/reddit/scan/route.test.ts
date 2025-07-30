import { POST, GET } from '@/app/api/admin/reddit/scan/route'
import { NextRequest } from 'next/server'
import { redditScanningService } from '@/lib/services/reddit-scanning'

// Mock dependencies
jest.mock('@/lib/services/reddit-scanning')
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const mockRedditScanningService = redditScanningService as jest.Mocked<typeof redditScanningService>

describe('/api/admin/reddit/scan', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequest = new NextRequest('http://localhost:3000/api/admin/reddit/scan')
  })

  describe('POST /api/admin/reddit/scan', () => {
    it('should successfully perform manual scan', async () => {
      const mockScanResult = {
        scanId: 'scan_123',
        startTime: new Date(),
        endTime: new Date(),
        postsFound: 10,
        postsProcessed: 8,
        postsApproved: 6,
        postsRejected: 2,
        postsFlagged: 0,
        duplicatesFound: 2,
        errors: [],
        rateLimitHit: false,
        subredditsScanned: ['hotdogs', 'food']
      }

      mockRedditScanningService.performScan.mockResolvedValue(mockScanResult)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockScanResult)
      expect(data.message).toContain('8 posts processed, 6 approved')
      expect(mockRedditScanningService.performScan).toHaveBeenCalledTimes(1)
    })

    it('should handle scan errors', async () => {
      const error = new Error('Scan failed due to network error')
      mockRedditScanningService.performScan.mockRejectedValue(error)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Scan failed due to network error')
      expect(data.message).toBe('Manual scan failed')
    })

    it('should handle scan in progress error', async () => {
      const error = new Error('Scan already in progress')
      mockRedditScanningService.performScan.mockRejectedValue(error)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Scan already in progress')
    })

    it('should handle disabled scanning', async () => {
      const error = new Error('Reddit scanning is disabled')
      mockRedditScanningService.performScan.mockRejectedValue(error)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Reddit scanning is disabled')
    })
  })

  describe('GET /api/admin/reddit/scan', () => {
    it('should return scan status when enabled', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 30,
        lastScanTime: new Date(),
        maxPostsPerScan: 25,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 10,
        sortBy: 'hot' as const,
        timeRange: 'week' as const,
        includeNSFW: false
      }

      mockRedditScanningService.getScanConfig.mockResolvedValue(mockConfig)

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isEnabled).toBe(true)
      expect(data.data.canRunManualScan).toBe(true)
      expect(data.data.scanInterval).toBe(30)
    })

    it('should return scan status when disabled', async () => {
      const mockConfig = {
        isEnabled: false,
        scanInterval: 30,
        maxPostsPerScan: 25,
        targetSubreddits: ['hotdogs'],
        searchTerms: ['hotdog'],
        minScore: 10,
        sortBy: 'hot' as const,
        timeRange: 'week' as const,
        includeNSFW: false
      }

      mockRedditScanningService.getScanConfig.mockResolvedValue(mockConfig)

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isEnabled).toBe(false)
      expect(data.data.canRunManualScan).toBe(false)
    })

    it('should handle config retrieval errors', async () => {
      const error = new Error('Database connection failed')
      mockRedditScanningService.getScanConfig.mockRejectedValue(error)

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Database connection failed')
      expect(data.message).toBe('Failed to get scan status')
    })
  })
})