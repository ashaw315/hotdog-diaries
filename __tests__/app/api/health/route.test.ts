import { GET, HEAD } from '@/app/api/health/route'
import { NextRequest, NextResponse } from 'next/server'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  db: {
    healthCheck: jest.fn().mockResolvedValue({ connected: true, latency: 10 })
  }
}))

// Mock NextResponse
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('next/server').NextRequest,
  NextResponse: {
    json: jest.fn(),
  },
}))

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
      const mockJson = jest.fn()
      ;(NextResponse.json as jest.Mock).mockImplementation(mockJson)

      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'GET' })
      await GET(mockRequest)

      expect(mockJson).toHaveBeenCalledWith(
        {
          status: 'healthy',
          timestamp: '2024-01-01T00:00:00.000Z',
          service: 'hotdog-diaries',
          version: '1.0.0',
          uptime: 12345,
          environment: 'test',
          checks: {
            database: 'pending',
            socialMediaScanner: 'pending',
            contentScheduler: 'pending',
          }
        },
        { status: 200 }
      )
    })

    it('handles errors gracefully', async () => {
      const mockJson = jest.fn()
      ;(NextResponse.json as jest.Mock).mockImplementation(mockJson)
      
      // Mock process.uptime to throw an error
      mockUptime.mockImplementation(() => {
        throw new Error('Uptime error')
      })

      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'GET' })
      await GET(mockRequest)

      expect(mockJson).toHaveBeenCalledWith(
        {
          status: 'unhealthy',
          timestamp: '2024-01-01T00:00:00.000Z',
          service: 'hotdog-diaries',
          error: 'Uptime error',
        },
        { status: 500 }
      )
    })

    it('handles non-Error exceptions', async () => {
      const mockJson = jest.fn()
      ;(NextResponse.json as jest.Mock).mockImplementation(mockJson)
      
      // Mock process.uptime to throw a non-Error
      mockUptime.mockImplementation(() => {
        throw 'String error'
      })

      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'GET' })
      await GET(mockRequest)

      expect(mockJson).toHaveBeenCalledWith(
        {
          status: 'unhealthy',
          timestamp: '2024-01-01T00:00:00.000Z',
          service: 'hotdog-diaries',
          error: 'Unknown error',
        },
        { status: 500 }
      )
    })

    it('uses default environment when NODE_ENV is not set', async () => {
      const originalEnv = process.env.NODE_ENV
      delete process.env.NODE_ENV

      const mockJson = jest.fn()
      ;(NextResponse.json as jest.Mock).mockImplementation(mockJson)

      const mockRequest = new NextRequest('http://localhost/api/health', { method: 'GET' })
      await GET(mockRequest)

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'development',
        }),
        { status: 200 }
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
    })
  })
})