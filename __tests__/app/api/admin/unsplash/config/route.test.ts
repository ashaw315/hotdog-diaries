import { GET, PUT } from '@/app/api/admin/unsplash/config/route'
import { NextRequest } from 'next/server'

describe('/api/admin/unsplash/config', () => {
  describe('GET', () => {
    it('should return default configuration', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/config')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: {
          isEnabled: false,
          scanInterval: 60,
          maxPhotosPerScan: 20,
          searchTerms: expect.arrayContaining(['hotdog', 'hot dog', 'frankfurter']),
          minDownloads: 100,
          minLikes: 10,
          publishedWithin: 30,
          orientation: 'all',
          contentFilter: 'low'
        },
        message: 'Unsplash configuration retrieved successfully'
      })
    })
  })

  describe('PUT', () => {
    it('should update configuration with valid data', async () => {
      const updates = {
        isEnabled: true,
        scanInterval: 120,
        searchTerms: ['custom', 'hotdog', 'terms']
      }

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/config', {
        method: 'PUT',
        body: JSON.stringify(updates)
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: expect.objectContaining({
          isEnabled: true,
          scanInterval: 120,
          searchTerms: ['custom', 'hotdog', 'terms']
        }),
        message: 'Unsplash configuration updated successfully'
      })
    })

    it('should filter out invalid fields', async () => {
      const updates = {
        isEnabled: true,
        invalidField: 'should be filtered',
        maxPhotosPerScan: 50
      }

      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/config', {
        method: 'PUT', 
        body: JSON.stringify(updates)
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveProperty('isEnabled', true)
      expect(data.data).toHaveProperty('maxPhotosPerScan', 50)
      expect(data.data).not.toHaveProperty('invalidField')
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/unsplash/config', {
        method: 'PUT',
        body: 'invalid json'
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: expect.any(String)
      })
    })
  })
})