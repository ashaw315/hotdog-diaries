import { GET, POST } from '@/app/api/admin/imgur/test-connection/route'
import { NextRequest } from 'next/server'

// Mock the services and database
jest.mock('@/lib/services/imgur-scanning', () => ({
  imgurScanningService: {
    testConnection: jest.fn()
  }
}))

jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn()
}))

// Mock environment variables
const mockEnv = (clientId?: string) => {
  const originalEnv = process.env
  process.env = { ...originalEnv }
  if (clientId) {
    process.env.IMGUR_CLIENT_ID = clientId
  } else {
    delete process.env.IMGUR_CLIENT_ID
  }
}

describe('/api/admin/imgur/test-connection', () => {
  const { imgurScanningService } = require('@/lib/services/imgur-scanning')
  const { logToDatabase } = require('@/lib/db')

  beforeEach(() => {
    jest.clearAllMocks()
    mockEnv() // Reset to no client ID
  })

  afterEach(() => {
    // Restore original environment
    jest.resetModules()
  })

  describe('GET request', () => {
    it('should return success with API mode when IMGUR_CLIENT_ID is present', async () => {
      mockEnv('test-client-id-12345')
      
      imgurScanningService.testConnection.mockResolvedValue({
        success: true,
        message: 'Imgur connection successful. Found 1 test results.',
        details: { testResultsCount: 1, hasClientId: true }
      })

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/test-connection')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.mode).toBe('api')
      expect(data.data.environment.hasClientId).toBe(true)
      expect(data.data.environment.clientIdMasked).toBe('test***345')
      expect(data.data.environment.mode).toBe('api')
      expect(logToDatabase).toHaveBeenCalledWith(
        'info',
        'IMGUR_CONNECTION_TEST_SUCCESS',
        expect.stringContaining('api'),
        expect.any(Object)
      )
    })

    it('should return success with mock mode when IMGUR_CLIENT_ID is not present', async () => {
      // No client ID set
      
      imgurScanningService.testConnection.mockResolvedValue({
        success: true,
        message: 'No Imgur Client ID configured, will use mock data',
        details: { mockMode: true }
      })

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/test-connection')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.mode).toBe('mock')
      expect(data.data.environment.hasClientId).toBe(false)
      expect(data.data.environment.clientIdMasked).toBe(null)
      expect(data.data.environment.mode).toBe('mock')
      expect(logToDatabase).toHaveBeenCalledWith(
        'info',
        'IMGUR_CONNECTION_TEST_SUCCESS',
        expect.stringContaining('mock'),
        expect.any(Object)
      )
    })

    it('should return error when connection test fails', async () => {
      mockEnv('test-client-id')
      
      imgurScanningService.testConnection.mockResolvedValue({
        success: false,
        message: 'API connection failed',
        details: { error: 'Network error' }
      })

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/test-connection')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error).toBe('API connection failed')
      expect(logToDatabase).toHaveBeenCalledWith(
        'warning',
        'IMGUR_CONNECTION_TEST_FAILED',
        expect.stringContaining('failed'),
        expect.any(Object)
      )
    })

    it('should handle service errors gracefully', async () => {
      imgurScanningService.testConnection.mockRejectedValue(new Error('Service unavailable'))

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/test-connection')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Service unavailable')
      expect(logToDatabase).toHaveBeenCalledWith(
        'error',
        'IMGUR_CONNECTION_TEST_ERROR',
        expect.stringContaining('Service unavailable'),
        expect.any(Object)
      )
    })

    it('should mask client ID properly for security', async () => {
      // Test various client ID lengths
      const testCases = [
        { clientId: '123', expected: '123***123' }, // Short IDs will show both parts
        { clientId: '1234567', expected: '1234***567' }, // Take first 4 and last 3
        { clientId: '546c25a59c58ad7', expected: '546c***ad7' },
        { clientId: 'very-long-client-id-12345', expected: 'very***345' }
      ]

      for (const testCase of testCases) {
        mockEnv(testCase.clientId)
        
        imgurScanningService.testConnection.mockResolvedValue({
          success: true,
          message: 'Test connection',
          details: {}
        })

        const request = new NextRequest('http://localhost:3000/api/admin/imgur/test-connection')
        const response = await GET(request)
        const data = await response.json()

        expect(data.data.environment.clientIdMasked).toBe(testCase.expected)
      }
    })
  })

  describe('POST request', () => {
    it('should redirect to GET handler', async () => {
      mockEnv('test-client-id')
      
      imgurScanningService.testConnection.mockResolvedValue({
        success: true,
        message: 'Test connection',
        details: {}
      })

      const request = new NextRequest('http://localhost:3000/api/admin/imgur/test-connection', {
        method: 'POST'
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})