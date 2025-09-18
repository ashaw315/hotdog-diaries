import { GET } from '@/app/api/admin/pixabay/status/route'
import { NextRequest } from 'next/server'

describe('/api/admin/pixabay/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return healthy status with API key configured', async () => {
      process.env.PIXABAY_API_KEY = 'test-pixabay-key-12345'

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        platform: 'pixabay',
        status: 'active',
        authentication: 'connected',
        health: 'healthy',
        lastScan: null,
        contentFound: 0,
        errorRate: 0,
        stats: {
          imagesFound: 0,
          totalQueries: 0
        }
      })
    })

    it('should return disconnected status without API key', async () => {
      delete process.env.PIXABAY_API_KEY

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        platform: 'pixabay',
        status: 'active',
        authentication: 'disconnected',
        health: 'healthy',
        lastScan: null,
        contentFound: 0,
        errorRate: 0,
        stats: {
          imagesFound: 0,
          totalQueries: 0
        }
      })
    })

    it('should return consistent status structure', async () => {
      process.env.PIXABAY_API_KEY = 'test-key'

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('platform')
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('authentication')
      expect(data).toHaveProperty('health')
      expect(data).toHaveProperty('lastScan')
      expect(data).toHaveProperty('contentFound')
      expect(data).toHaveProperty('errorRate')
      expect(data).toHaveProperty('stats')
      
      expect(typeof data.success).toBe('boolean')
      expect(typeof data.platform).toBe('string')
      expect(typeof data.status).toBe('string')
      expect(typeof data.authentication).toBe('string')
      expect(typeof data.health).toBe('string')
      expect(typeof data.contentFound).toBe('number')
      expect(typeof data.errorRate).toBe('number')
      expect(typeof data.stats).toBe('object')
      expect(typeof data.stats.imagesFound).toBe('number')
      expect(typeof data.stats.totalQueries).toBe('number')
    })

    it('should return pixabay platform identifier', async () => {
      const response = await GET()
      const data = await response.json()

      expect(data.platform).toBe('pixabay')
    })

    it('should return active status', async () => {
      const response = await GET()
      const data = await response.json()

      expect(data.status).toBe('active')
    })

    it('should return healthy health status', async () => {
      const response = await GET()
      const data = await response.json()

      expect(data.health).toBe('healthy')
    })

    it('should handle empty API key as disconnected', async () => {
      process.env.PIXABAY_API_KEY = ''

      const response = await GET()
      const data = await response.json()

      expect(data.authentication).toBe('disconnected')
    })
  })
})