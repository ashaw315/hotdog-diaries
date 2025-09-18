import { POST } from '@/app/api/admin/youtube/scan/route'
import { NextRequest } from 'next/server'

// Mock the YouTube scanning service with factory function to avoid hoisting issues
jest.mock('@/lib/services/youtube-scanning', () => {
  const mockYoutubeScanningService = {
    performScan: jest.fn()
  }
  
  return {
    youtubeScanningService: mockYoutubeScanningService
  }
})

describe('/api/admin/youtube/scan', () => {
  let mockYoutubeScanningService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mock service instance
    const { youtubeScanningService } = require('@/lib/services/youtube-scanning')
    mockYoutubeScanningService = youtubeScanningService
  })

  describe('POST', () => {
    it('should successfully trigger YouTube scan', async () => {
      const mockScanResult = {
        scanId: 'youtube_scan_123',
        startTime: new Date('2024-01-01T12:00:00Z'),
        endTime: new Date('2024-01-01T12:05:00Z'),
        videosFound: 15,
        videosProcessed: 12,
        videosApproved: 8,
        videosRejected: 4,
        videosFlagged: 0,
        duplicatesFound: 3,
        quotaUsed: 350,
        searchTermsUsed: ['hotdog recipe', 'best hotdogs'],
        errors: [],
        nextScanTime: new Date('2024-01-01T14:00:00Z'),
        highestViewedVideo: {
          id: 'abc123',
          title: 'Ultimate Hotdog Recipe',
          viewCount: 125000
        }
      }

      mockYoutubeScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockYoutubeScanningService.performScan).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.scanId).toBe('youtube_scan_123')
      expect(data.data.videosFound).toBe(15)
      expect(data.data.videosApproved).toBe(8)
      expect(data.data.quotaUsed).toBe(350)
      expect(data.data.highestViewedVideo.title).toBe('Ultimate Hotdog Recipe')
    })

    it('should handle scan with errors', async () => {
      const mockScanResultWithErrors = {
        scanId: 'youtube_scan_124',
        startTime: new Date('2024-01-01T13:00:00Z'),
        endTime: new Date('2024-01-01T13:03:00Z'),
        videosFound: 8,
        videosProcessed: 5,
        videosApproved: 3,
        videosRejected: 2,
        videosFlagged: 1,
        duplicatesFound: 2,
        quotaUsed: 200,
        searchTermsUsed: ['grilling hotdogs'],
        errors: [
          'Failed to process video xyz123: API timeout',
          'Quota warning: 85% of daily limit used'
        ],
        nextScanTime: new Date('2024-01-01T15:00:00Z'),
        highestViewedVideo: null
      }

      mockYoutubeScanningService.performScan.mockResolvedValue(mockScanResultWithErrors)

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.errors).toHaveLength(2)
      expect(data.data.errors[0]).toContain('API timeout')
      expect(data.data.videosFlagged).toBe(1)
    })

    it('should handle scan failure', async () => {
      mockYoutubeScanningService.performScan.mockRejectedValue(
        new Error('YouTube API quota exceeded')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('YouTube scan failed')
      expect(data.details).toContain('quota exceeded')
    })

    it('should handle empty scan results', async () => {
      const emptyScanResult = {
        scanId: 'youtube_scan_125',
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T14:01:00Z'),
        videosFound: 0,
        videosProcessed: 0,
        videosApproved: 0,
        videosRejected: 0,
        videosFlagged: 0,
        duplicatesFound: 0,
        quotaUsed: 100,
        searchTermsUsed: ['hotdog challenge'],
        errors: [],
        nextScanTime: new Date('2024-01-01T16:00:00Z'),
        highestViewedVideo: null
      }

      mockYoutubeScanningService.performScan.mockResolvedValue(emptyScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.videosFound).toBe(0)
      expect(data.data.quotaUsed).toBe(100) // Still uses quota for search
    })

    it('should handle null nextScanTime gracefully', async () => {
      const scanResult = {
        scanId: 'youtube_scan_127',
        startTime: new Date('2024-01-01T16:00:00Z'),
        endTime: new Date('2024-01-01T16:01:00Z'),
        videosFound: 2,
        videosProcessed: 2,
        videosApproved: 1,
        videosRejected: 1,
        videosFlagged: 0,
        duplicatesFound: 0,
        quotaUsed: 120,
        searchTermsUsed: ['gourmet hotdogs'],
        errors: [],
        nextScanTime: null, // No next scan scheduled
        highestViewedVideo: null
      }

      mockYoutubeScanningService.performScan.mockResolvedValue(scanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/youtube/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.nextScanTime).toBeUndefined()
    })
  })
})