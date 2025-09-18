import { GET } from '@/app/api/admin/imgur/status/route'

describe('/api/admin/imgur/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear environment variables
    delete process.env.IMGUR_CLIENT_ID
  })

  describe('GET', () => {
    it('should return connected status when client ID is configured', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_client_id_123'

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.platform).toBe('imgur')
      expect(data.status).toBe('active')
      expect(data.authentication).toBe('connected')
      expect(data.health).toBe('healthy')
      expect(data.lastScan).toBeNull()
      expect(data.contentFound).toBe(0)
      expect(data.errorRate).toBe(0)
      expect(data.stats.imagesFound).toBe(0)
      expect(data.stats.totalQueries).toBe(0)
    })

    it('should return disconnected status when client ID is missing', async () => {
      // Ensure IMGUR_CLIENT_ID is not set
      delete process.env.IMGUR_CLIENT_ID

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.platform).toBe('imgur')
      expect(data.status).toBe('active')
      expect(data.authentication).toBe('disconnected')
      expect(data.health).toBe('healthy')
    })

    it('should return disconnected status when client ID is empty string', async () => {
      process.env.IMGUR_CLIENT_ID = ''

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.authentication).toBe('disconnected')
    })

    it('should return connected status when client ID is whitespace (truthy)', async () => {
      process.env.IMGUR_CLIENT_ID = '   '

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.authentication).toBe('connected') // Implementation considers any truthy string as connected
    })

    it('should have correct response structure', async () => {
      process.env.IMGUR_CLIENT_ID = 'valid_client_id'

      const response = await GET()
      const data = await response.json()

      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('platform')
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('authentication')
      expect(data).toHaveProperty('health')
      expect(data).toHaveProperty('lastScan')
      expect(data).toHaveProperty('contentFound')
      expect(data).toHaveProperty('errorRate')
      expect(data).toHaveProperty('stats')
      expect(data.stats).toHaveProperty('imagesFound')
      expect(data.stats).toHaveProperty('totalQueries')
    })

    it('should always return healthy status', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_id'

      const response = await GET()
      const data = await response.json()

      expect(data.health).toBe('healthy')
    })

    it('should have proper data types', async () => {
      process.env.IMGUR_CLIENT_ID = 'test_id'

      const response = await GET()
      const data = await response.json()

      expect(typeof data.success).toBe('boolean')
      expect(typeof data.platform).toBe('string')
      expect(typeof data.status).toBe('string')
      expect(typeof data.authentication).toBe('string')
      expect(typeof data.health).toBe('string')
      expect(typeof data.contentFound).toBe('number')
      expect(typeof data.errorRate).toBe('number')
      expect(typeof data.stats.imagesFound).toBe('number')
      expect(typeof data.stats.totalQueries).toBe('number')
    })
  })
})