import { GET, HEAD } from '@/app/api/health/route'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

// Mock the database
jest.mock('@/lib/db')
const mockDb = db as jest.Mocked<typeof db>

// Mock NextRequest
const createMockRequest = (method: string = 'GET', url: string = 'http://localhost:3000/api/health') => {
  return new NextRequest(url, { method })
}

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock process.uptime
    jest.spyOn(process, 'uptime').mockReturnValue(12345)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET /api/health', () => {
    it('should return healthy status when database is connected', async () => {
      mockDb.healthCheck.mockResolvedValue({
        connected: true,
        latency: 25
      })

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('healthy')
      expect(data.data.service).toBe('hotdog-diaries')
      expect(data.data.version).toBe('1.0.0')
      expect(data.data.uptime).toBe(12345)
      expect(data.data.checks.database.connected).toBe(true)
      expect(data.data.checks.database.latency).toBe(25)
    })

    it('should return unhealthy status when database is disconnected', async () => {
      mockDb.healthCheck.mockResolvedValue({
        connected: false,
        error: 'Connection timeout'
      })

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.status).toBe(503)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('unhealthy')
      expect(data.data.checks.database.connected).toBe(false)
      expect(data.data.checks.database.error).toBe('Connection timeout')
    })

    it('should include development metadata in development environment', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      mockDb.healthCheck.mockResolvedValue({
        connected: true,
        latency: 15
      })

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      const data = await response.json()
      expect(data.data.responseTime).toBeDefined()
      expect(data.data.memory).toBeDefined()
      expect(data.data.memory.used).toBeDefined()
      expect(data.data.memory.total).toBeDefined()

      process.env.NODE_ENV = originalEnv
    })

    it('should handle database health check errors', async () => {
      mockDb.healthCheck.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Database connection failed')
    })

    it('should reject invalid HTTP methods', async () => {
      const request = createMockRequest('POST')
      const response = await GET(request)
      
      expect(response.status).toBe(405)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Method POST not allowed')
    })
  })

  describe('HEAD /api/health', () => {
    it('should return 200 status with no body', async () => {
      const request = createMockRequest('HEAD')
      const response = await HEAD(request)
      
      expect(response.status).toBe(200)
      expect(response.body).toBeNull()
    })

    it('should handle HEAD requests even when database is down', async () => {
      mockDb.healthCheck.mockResolvedValue({
        connected: false,
        error: 'Database down'
      })

      const request = createMockRequest('HEAD')
      const response = await HEAD(request)
      
      expect(response.status).toBe(200)
    })
  })

  describe('Security Headers', () => {
    it('should include security headers in response', async () => {
      mockDb.healthCheck.mockResolvedValue({
        connected: true,
        latency: 10
      })

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })
  })

  describe('Response Format', () => {
    it('should return consistent response format', async () => {
      mockDb.healthCheck.mockResolvedValue({
        connected: true,
        latency: 20
      })

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('timestamp')
      expect(data.data).toHaveProperty('status')
      expect(data.data).toHaveProperty('service')
      expect(data.data).toHaveProperty('version')
      expect(data.data).toHaveProperty('uptime')
      expect(data.data).toHaveProperty('environment')
      expect(data.data).toHaveProperty('checks')
      expect(data.data.checks).toHaveProperty('database')
    })

    it('should have valid timestamp format', async () => {
      mockDb.healthCheck.mockResolvedValue({
        connected: true
      })

      const request = createMockRequest('GET')
      const response = await GET(request)
      
      const data = await response.json()
      const timestamp = new Date(data.timestamp)
      
      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.getTime()).not.toBeNaN()
    })
  })
})