import { POST } from '@/app/api/admin/unsplash/scan/route'
import { NextRequest } from 'next/server'

describe('/api/admin/unsplash/scan', () => {
  describe('POST', () => {
    it('should perform regular scan successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: expect.objectContaining({
          scanId: expect.stringMatching(/^unsplash_\d+$/),
          startTime: expect.any(String),
          endTime: expect.any(String),
          photosFound: 20,
          photosProcessed: 18,
          photosApproved: 12,
          photosRejected: 4,
          photosFlagged: 2,
          duplicatesFound: 0,
          requestsUsed: 4,
          searchTermsUsed: ['hotdog', 'frankfurter'],
          highestRatedPhoto: expect.objectContaining({
            id: 'new_sample',
            description: 'Fresh hotdog scan result',
            likes: 156,
            downloads: 890,
            photographerName: 'Test Photographer'
          })
        }),
        message: expect.stringContaining('Scan completed: 18/20 photos processed'),
        timestamp: expect.any(String)
      })
    })

    it('should perform test scan when test parameter is true', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scan?test=true', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: expect.objectContaining({
          scanId: expect.stringMatching(/^unsplash_\d+$/),
          photosFound: 5,
          photosProcessed: 5,
          photosApproved: 3,
          photosRejected: 1,
          photosFlagged: 1,
          requestsUsed: 1,
          searchTermsUsed: ['hotdog', 'frankfurter']
        }),
        message: expect.stringContaining('Test scan completed: 5/5 photos processed')
      })
    })

    it('should handle scan parameters correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scan?test=false', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.photosFound).toBe(20) // Regular scan numbers
      expect(data.message).toContain('Scan completed')
      expect(data.message).not.toContain('Test scan')
    })

    it('should return valid scan result structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/scan', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.data).toHaveProperty('scanId')
      expect(data.data).toHaveProperty('startTime')
      expect(data.data).toHaveProperty('endTime')
      expect(data.data).toHaveProperty('photosFound')
      expect(data.data).toHaveProperty('photosProcessed')
      expect(data.data).toHaveProperty('photosApproved')
      expect(data.data).toHaveProperty('photosRejected')
      expect(data.data).toHaveProperty('photosFlagged')
      expect(data.data).toHaveProperty('duplicatesFound')
      expect(data.data).toHaveProperty('requestsUsed')
      expect(data.data).toHaveProperty('searchTermsUsed')
      expect(data.data).toHaveProperty('highestRatedPhoto')

      // Validate timestamps are valid ISO strings
      expect(new Date(data.data.startTime).toISOString()).toBe(data.data.startTime)
      expect(new Date(data.data.endTime).toISOString()).toBe(data.data.endTime)

      // Validate search terms array
      expect(Array.isArray(data.data.searchTermsUsed)).toBe(true)
      expect(data.data.searchTermsUsed.length).toBeGreaterThan(0)

      // Validate highest rated photo structure
      expect(data.data.highestRatedPhoto).toHaveProperty('id')
      expect(data.data.highestRatedPhoto).toHaveProperty('description')
      expect(data.data.highestRatedPhoto).toHaveProperty('likes')
      expect(data.data.highestRatedPhoto).toHaveProperty('downloads')
      expect(data.data.highestRatedPhoto).toHaveProperty('photographerName')
    })

    it('should handle errors gracefully', async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Create a request that might cause an error (invalid URL)
      const request = {
        url: 'invalid-url'
      } as NextRequest

      const response = await POST(request)
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