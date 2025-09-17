import { GET, HEAD } from '@/app/api/health/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  db: {
    healthCheck: jest.fn()
  }
}))

jest.mock('@/lib/api-middleware', () => ({
  withErrorHandling: jest.fn((handler) => handler),
  validateRequestMethod: jest.fn(),
  createSuccessResponse: jest.fn()
}))

// Mock NextResponse for HEAD requests
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return {
    ...actual,
    NextResponse: class MockNextResponse extends Response {
      constructor(body?: BodyInit | null, init?: ResponseInit) {
        super(body, init)
      }
    }
  }
})

// Mock process.uptime
const mockUptime = jest.fn(() => 12345)
Object.defineProperty(process, 'uptime', {
  value: mockUptime,
  configurable: true,
})

describe('/api/health Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set a consistent date for testing
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('GET /api/health', () => {
    it('returns healthy status with correct structure', async () => {
      const { db } = await import('@/lib/db')
      const { createSuccessResponse } = await import('@/lib/api-middleware')

      // Mock healthy database
      ;(db.healthCheck as jest.Mock).mockResolvedValue({ 
        connected: true, 
        latency: 10 
      })

      // Mock successful response
      const mockResponse = { json: () => Promise.resolve({}), status: 200 }
      ;(createSuccessResponse as jest.Mock).mockReturnValue(mockResponse)

      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'GET' })
      const response = await GET(mockRequest)

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: '2024-01-01T00:00:00.000Z',
          service: 'hotdog-diaries',
          version: '1.0.0',
          uptime: 12345,
          environment: 'test',
          checks: expect.objectContaining({
            database: { connected: true, latency: 10 },
            socialMediaScanner: 'pending',
            contentScheduler: 'pending'
          })
        }),
        undefined,
        200
      )
      expect(response).toBe(mockResponse)
    })

    it('returns unhealthy status when database fails', async () => {
      const { db } = await import('@/lib/db')
      const { createSuccessResponse } = await import('@/lib/api-middleware')

      // Mock unhealthy database
      ;(db.healthCheck as jest.Mock).mockResolvedValue({ 
        connected: false, 
        error: 'Connection failed' 
      })

      const mockResponse = { json: () => Promise.resolve({}), status: 503 }
      ;(createSuccessResponse as jest.Mock).mockReturnValue(mockResponse)

      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'GET' })
      const response = await GET(mockRequest)

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy'
        }),
        undefined,
        503
      )
      expect(response.status).toBe(503)
    })

    it('handles database errors gracefully', async () => {
      const { db } = await import('@/lib/db')

      // Mock database throwing error
      ;(db.healthCheck as jest.Mock).mockRejectedValue(new Error('Database connection failed'))

      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'GET' })
      
      // Since withErrorHandling is mocked to pass through, this will throw
      await expect(GET(mockRequest)).rejects.toThrow('Database connection failed')
    })

    it('includes development metadata in development environment', async () => {
      const { db } = await import('@/lib/db')
      const { createSuccessResponse } = await import('@/lib/api-middleware')
      
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      ;(db.healthCheck as jest.Mock).mockResolvedValue({ 
        connected: true, 
        latency: 5 
      })

      const mockResponse = { json: () => Promise.resolve({}), status: 200 }
      ;(createSuccessResponse as jest.Mock).mockReturnValue(mockResponse)

      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'GET' })
      await GET(mockRequest)

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          responseTime: expect.any(Number),
          memory: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number),
            external: expect.any(Number)
          })
        }),
        undefined,
        200
      )

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('HEAD /api/health', () => {
    it('returns empty response with 200 status', async () => {
      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'HEAD' })
      const response = await HEAD(mockRequest)

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
      expect(response.body).toBeNull()
    })
  })
})