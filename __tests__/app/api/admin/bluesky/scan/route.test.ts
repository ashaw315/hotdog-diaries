import { POST } from '@/app/api/admin/bluesky/scan/route'
import { NextRequest } from 'next/server'

// Mock the Bluesky scanning service with factory function to avoid hoisting issues
jest.mock('@/lib/services/bluesky-scanning', () => {
  const mockBlueskyService = {
    performScan: jest.fn()
  }
  
  return {
    blueskyService: mockBlueskyService
  }
})

// Mock database logging
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

describe('/api/admin/bluesky/scan', () => {
  let mockBlueskyService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mock service instance
    const { blueskyService } = require('@/lib/services/bluesky-scanning')
    mockBlueskyService = blueskyService
  })

  describe('POST', () => {
    it('should successfully trigger Bluesky scan with default parameters', async () => {
      const mockScanResult = {
        totalFound: 25,
        processed: 20,
        approved: 15,
        rejected: 5,
        duplicates: 5,
        errors: 0
      }

      mockBlueskyService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockBlueskyService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('15 approved, 5 rejected')
      expect(data.data.scanId).toContain('bluesky_scan_')
      expect(data.data.postsFound).toBe(25)
      expect(data.data.postsProcessed).toBe(20)
      expect(data.data.postsApproved).toBe(15)
      expect(data.data.postsRejected).toBe(5)
      expect(data.data.duplicatesFound).toBe(5)
      expect(data.data.errors).toBe(0)
      expect(data.data.nextScanTime).toBeTruthy()
    })

    it('should successfully trigger Bluesky scan with custom maxPosts', async () => {
      const mockScanResult = {
        totalFound: 15,
        processed: 10,
        approved: 8,
        rejected: 2,
        duplicates: 5,
        errors: 0
      }

      mockBlueskyService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 10 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockBlueskyService.performScan).toHaveBeenCalledWith({ maxPosts: 10 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.postsProcessed).toBe(10)
      expect(data.data.postsApproved).toBe(8)
    })

    it('should handle scan with partial errors', async () => {
      const mockScanResult = {
        totalFound: 20,
        processed: 15,
        approved: 10,
        rejected: 5,
        duplicates: 5,
        errors: 5 // Some posts failed to process
      }

      mockBlueskyService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.errors).toBe(5)
      expect(data.data.postsProcessed).toBe(15) // Still processed some
    })

    it('should handle complete scan failure', async () => {
      mockBlueskyService.performScan.mockRejectedValue(
        new Error('Bluesky authentication failed')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Bluesky scan failed')
      expect(data.details).toContain('authentication failed')
    })

    it('should handle empty scan results', async () => {
      const emptyScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: 0
      }

      mockBlueskyService.performScan.mockResolvedValue(emptyScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.postsFound).toBe(0)
      expect(data.message).toContain('0 approved, 0 rejected')
    })

    it('should handle invalid request body gracefully', async () => {
      const mockScanResult = {
        totalFound: 10,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 2,
        errors: 0
      }

      mockBlueskyService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      // Should use default maxPosts (20) when JSON is invalid
      expect(mockBlueskyService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle non-numeric maxPosts parameter', async () => {
      const mockScanResult = {
        totalFound: 12,
        processed: 10,
        approved: 7,
        rejected: 3,
        duplicates: 2,
        errors: 0
      }

      mockBlueskyService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 'invalid' })
      })

      const response = await POST(request)
      const data = await response.json()

      // Should use default maxPosts (20) when value is not a number
      expect(mockBlueskyService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should include duration calculation in response', async () => {
      const mockScanResult = {
        totalFound: 18,
        processed: 15,
        approved: 12,
        rejected: 3,
        duplicates: 3,
        errors: 0
      }

      mockBlueskyService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.duration).toMatch(/\d+ms/)
      expect(data.data.startTime).toBeTruthy()
      expect(data.data.endTime).toBeTruthy()
      
      // Verify start time is before or equal to end time (timing can be very fast in tests)
      const startTime = new Date(data.data.startTime)
      const endTime = new Date(data.data.endTime)
      expect(startTime.getTime()).toBeLessThanOrEqual(endTime.getTime())
    })

    it('should schedule next scan time 4 hours later', async () => {
      const mockScanResult = {
        totalFound: 20,
        processed: 16,
        approved: 12,
        rejected: 4,
        duplicates: 4,
        errors: 0
      }

      mockBlueskyService.performScan.mockResolvedValue(mockScanResult)

      const beforeRequest = Date.now()
      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()
      const afterRequest = Date.now()

      expect(response.status).toBe(200)
      
      const nextScanTime = new Date(data.data.nextScanTime)
      const expectedMinTime = new Date(beforeRequest + 240 * 60 * 1000) // 4 hours
      const expectedMaxTime = new Date(afterRequest + 240 * 60 * 1000) // 4 hours
      
      expect(nextScanTime.getTime()).toBeGreaterThanOrEqual(expectedMinTime.getTime())
      expect(nextScanTime.getTime()).toBeLessThanOrEqual(expectedMaxTime.getTime())
    })
  })
})