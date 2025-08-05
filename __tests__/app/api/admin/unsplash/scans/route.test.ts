import { GET } from '@/app/api/admin/unsplash/scans/route'
import { NextRequest } from 'next/server'

describe('/api/admin/unsplash/scans', () => {
  describe('GET', () => {
    it('should return scan history with default limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scans')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: {
          scans: expect.any(Array),
          totalScans: expect.any(Number)
        },
        message: 'Recent Unsplash scans retrieved successfully',
        timestamp: expect.any(String)
      })

      // Validate scan structure
      if (data.data.scans.length > 0) {
        const scan = data.data.scans[0]
        expect(scan).toHaveProperty('scanId')
        expect(scan).toHaveProperty('startTime')
        expect(scan).toHaveProperty('endTime')
        expect(scan).toHaveProperty('photosFound')
        expect(scan).toHaveProperty('photosProcessed')
        expect(scan).toHaveProperty('photosApproved')
        expect(scan).toHaveProperty('photosRejected')
        expect(scan).toHaveProperty('photosFlagged')
        expect(scan).toHaveProperty('duplicatesFound')
        expect(scan).toHaveProperty('requestsUsed')
        expect(scan).toHaveProperty('searchTermsUsed')
        expect(scan).toHaveProperty('highestRatedPhoto')

        // Validate timestamps
        expect(new Date(scan.startTime).toISOString()).toBe(scan.startTime)
        expect(new Date(scan.endTime).toISOString()).toBe(scan.endTime)

        // Validate highest rated photo
        expect(scan.highestRatedPhoto).toHaveProperty('id')
        expect(scan.highestRatedPhoto).toHaveProperty('description')
        expect(scan.highestRatedPhoto).toHaveProperty('likes')
        expect(scan.highestRatedPhoto).toHaveProperty('downloads')
        expect(scan.highestRatedPhoto).toHaveProperty('photographerName')
      }
    })

    it('should respect limit parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scans?limit=5')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.scans.length).toBeLessThanOrEqual(5)
    })

    it('should handle invalid limit parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scans?limit=invalid')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.scans.length).toBeLessThanOrEqual(10) // Should default to 10
    })

    it('should handle zero limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scans?limit=0')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.scans).toHaveLength(0)
    })

    it('should handle large limit values', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scans?limit=1000')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should be limited by available sample data
      expect(data.data.scans.length).toBeLessThanOrEqual(data.data.totalScans)
    })

    it('should validate scan data consistency', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scans')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)

      if (data.data.scans.length > 0) {
        const scan = data.data.scans[0]
        
        // Validate numeric fields are numbers
        expect(typeof scan.photosFound).toBe('number')
        expect(typeof scan.photosProcessed).toBe('number')
        expect(typeof scan.photosApproved).toBe('number')
        expect(typeof scan.photosRejected).toBe('number')
        expect(typeof scan.photosFlagged).toBe('number')
        expect(typeof scan.duplicatesFound).toBe('number')
        expect(typeof scan.requestsUsed).toBe('number')

        // Validate logical relationships
        expect(scan.photosProcessed).toBeLessThanOrEqual(scan.photosFound)
        expect(scan.photosApproved + scan.photosRejected + scan.photosFlagged).toBeLessThanOrEqual(scan.photosProcessed)

        // Validate arrays
        expect(Array.isArray(scan.searchTermsUsed)).toBe(true)
        expect(scan.searchTermsUsed.length).toBeGreaterThan(0)

        // Validate end time is after start time
        expect(new Date(scan.endTime).getTime()).toBeGreaterThan(new Date(scan.startTime).getTime())
      }
    })

    it('should handle errors gracefully', async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Create a request that might cause an error
      const request = {
        url: 'invalid-url'
      } as NextRequest

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: expect.any(String),
        timestamp: expect.any(String)
      })

      consoleSpy.mockRestore()
    })
  })
})