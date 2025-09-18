import { POST } from '@/app/api/admin/pixabay/scan/route'
import { NextRequest } from 'next/server'

// Mock the Pixabay scanning service
jest.mock('@/lib/services/pixabay-scanning', () => ({
  pixabayScanningService: {
    performScan: jest.fn()
  }
}))

// Mock database logging
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const { pixabayScanningService } = require('@/lib/services/pixabay-scanning')

describe('/api/admin/pixabay/scan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    console.log = jest.fn()
    console.error = jest.fn()
  })

  describe('POST', () => {
    it('should perform regular scan successfully', async () => {
      const mockScanResult = {
        totalFound: 20,
        processed: 18,
        approved: 12,
        rejected: 6,
        duplicates: 2,
        errors: []
      }

      pixabayScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: expect.stringContaining('Pixabay scan completed: 12 approved, 6 rejected'),
        data: expect.objectContaining({
          scanId: expect.stringMatching(/^pixabay_scan_\d+$/),
          startTime: expect.any(String),
          endTime: expect.any(String),
          duration: expect.stringMatching(/\d+ms/),
          imagesFound: 20,
          imagesProcessed: 18,
          imagesApproved: 12,
          imagesRejected: 6,
          duplicatesFound: 2,
          errors: [],
          nextScanTime: expect.any(String)
        })
      })

      expect(pixabayScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 10 })
    })

    it('should handle custom maxPosts parameter', async () => {
      const mockScanResult = {
        totalFound: 15,
        processed: 15,
        approved: 10,
        rejected: 5,
        duplicates: 0,
        errors: []
      }

      pixabayScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 15 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.imagesFound).toBe(15)
      expect(pixabayScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 15 })
    })

    it('should handle scan with no results', async () => {
      const mockScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: []
      }

      pixabayScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: 'Pixabay scan completed: 0 approved, 0 rejected',
        data: expect.objectContaining({
          imagesFound: 0,
          imagesProcessed: 0,
          imagesApproved: 0,
          imagesRejected: 0
        })
      })
    })

    it('should handle scan with errors', async () => {
      const mockScanResult = {
        totalFound: 10,
        processed: 8,
        approved: 5,
        rejected: 3,
        duplicates: 2,
        errors: ['API rate limit exceeded', 'Image processing failed']
      }

      pixabayScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.errors).toEqual(['API rate limit exceeded', 'Image processing failed'])
    })

    it('should handle invalid JSON body gracefully', async () => {
      const mockScanResult = {
        totalFound: 12,
        processed: 10,
        approved: 8,
        rejected: 2,
        duplicates: 2,
        errors: []
      }

      pixabayScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(pixabayScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 10 }) // Should use default
    })

    it('should handle invalid maxPosts parameter', async () => {
      const mockScanResult = {
        totalFound: 8,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 0,
        errors: []
      }

      pixabayScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST',
        body: JSON.stringify({ maxPosts: 'invalid' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(pixabayScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 10 }) // Should use default
    })

    it('should return valid scan result structure', async () => {
      const mockScanResult = {
        totalFound: 25,
        processed: 22,
        approved: 18,
        rejected: 4,
        duplicates: 3,
        errors: []
      }

      pixabayScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.data).toHaveProperty('scanId')
      expect(data.data).toHaveProperty('startTime')
      expect(data.data).toHaveProperty('endTime')
      expect(data.data).toHaveProperty('duration')
      expect(data.data).toHaveProperty('imagesFound')
      expect(data.data).toHaveProperty('imagesProcessed')
      expect(data.data).toHaveProperty('imagesApproved')
      expect(data.data).toHaveProperty('imagesRejected')
      expect(data.data).toHaveProperty('duplicatesFound')
      expect(data.data).toHaveProperty('errors')
      expect(data.data).toHaveProperty('nextScanTime')

      // Validate timestamps are valid ISO strings
      expect(new Date(data.data.startTime).toISOString()).toBe(data.data.startTime)
      expect(new Date(data.data.endTime).toISOString()).toBe(data.data.endTime)
      expect(new Date(data.data.nextScanTime).toISOString()).toBe(data.data.nextScanTime)

      // Validate duration format
      expect(data.data.duration).toMatch(/^\d+ms$/)

      // Validate scan ID format
      expect(data.data.scanId).toMatch(/^pixabay_scan_\d+$/)
    })

    it('should handle service errors gracefully', async () => {
      pixabayScanningService.performScan.mockRejectedValue(new Error('Pixabay API key not configured'))

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: 'Pixabay scan failed',
        details: 'Pixabay API key not configured'
      })
    })

    it('should handle network timeouts', async () => {
      pixabayScanningService.performScan.mockRejectedValue(new Error('Network timeout'))

      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: 'Pixabay scan failed',
        details: 'Network timeout'
      })
    })

    it('should include proper timing information', async () => {
      const mockScanResult = {
        totalFound: 15,
        processed: 15,
        approved: 12,
        rejected: 3,
        duplicates: 0,
        errors: []
      }

      pixabayScanningService.performScan.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockScanResult), 100) // Simulate 100ms scan
        })
      })

      const beforeRequest = Date.now()
      const request = new NextRequest('http://localhost:3000/api/admin/pixabay/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()
      const afterRequest = Date.now()

      expect(response.status).toBe(200)
      
      const startTime = new Date(data.data.startTime).getTime()
      const endTime = new Date(data.data.endTime).getTime()
      
      expect(startTime).toBeGreaterThanOrEqual(beforeRequest)
      expect(endTime).toBeLessThanOrEqual(afterRequest)
      expect(endTime).toBeGreaterThan(startTime)
      
      // Duration should be reasonable
      const durationMs = parseInt(data.data.duration.replace('ms', ''))
      expect(durationMs).toBeGreaterThan(50) // At least 50ms due to setTimeout
      expect(durationMs).toBeLessThan(5000) // Less than 5 seconds for test
    })
  })
})