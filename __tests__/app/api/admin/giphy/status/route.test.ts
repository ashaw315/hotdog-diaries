import { GET } from '@/app/api/admin/giphy/status/route'
import { NextRequest } from 'next/server'

// Mock the Giphy scanning service with factory function to avoid hoisting issues
jest.mock('@/lib/services/giphy-scanning', () => {
  const mockGiphyScanningService = {
    getScanConfig: jest.fn(),
    testConnection: jest.fn()
  }
  
  return {
    giphyScanningService: mockGiphyScanningService
  }
})

describe('/api/admin/giphy/status', () => {
  let mockGiphyScanningService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Clear environment variables
    delete process.env.GIPHY_API_KEY
    
    // Get the mock service instance
    const { giphyScanningService } = require('@/lib/services/giphy-scanning')
    mockGiphyScanningService = giphyScanningService
  })

  describe('GET', () => {
    it('should return comprehensive Giphy status with API mode', async () => {
      process.env.GIPHY_API_KEY = 'gph_test_api_key_1234567'
      
      const mockConfig = {
        isEnabled: true,
        scanInterval: 120,
        searchTerms: ['hotdog', 'hot dog', 'corn dog'],
        maxGifsPerScan: 15,
        allowedRatings: ['g', 'pg'],
        hourlyRequestCount: 25,
        dailyRequestCount: 350
      }

      const mockConnection = {
        success: true,
        message: 'Giphy connection successful',
        details: { 
          authenticated: true,
          rateLimitRemaining: 17
        }
      }

      mockGiphyScanningService.getScanConfig.mockResolvedValue(mockConfig)
      mockGiphyScanningService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/status')

      const response = await GET(request)
      const data = await response.json()

      expect(mockGiphyScanningService.getScanConfig).toHaveBeenCalled()
      expect(mockGiphyScanningService.testConnection).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.platform).toBe('giphy')
      expect(data.data.timestamp).toBeTruthy()
      expect(data.data.environment.hasApiKey).toBe(true)
      expect(data.data.environment.apiKeyConfigured).toBe(true)
      expect(data.data.environment.apiKeyLength).toBe(24)
      expect(data.data.environment.apiKeyMasked).toBe('gph_***567')
      expect(data.data.environment.mode).toBe('api')
      expect(data.data.environment.nodeEnv).toBe('test')
      expect(data.data.configuration.isEnabled).toBe(true)
      expect(data.data.configuration.searchTermsCount).toBe(3)
      expect(data.data.configuration.rateLimits.hourlyLimit).toBe(42)
      expect(data.data.configuration.rateLimits.dailyLimit).toBe(1000)
      expect(data.data.connection.isConnected).toBe(true)
      expect(data.data.capabilities.canScan).toBe(true)
      expect(data.data.capabilities.canSearch).toBe(true)
      expect(data.data.capabilities.realTimeMode).toBe(true)
      expect(data.data.capabilities.mockMode).toBe(false)
      expect(data.message).toContain('api mode')
    })

    it('should return comprehensive Giphy status with mock mode', async () => {
      // Ensure GIPHY_API_KEY is not set
      delete process.env.GIPHY_API_KEY
      
      const mockConfig = {
        isEnabled: false,
        scanInterval: 120,
        searchTerms: ['hotdog'],
        maxGifsPerScan: 5,
        allowedRatings: ['g'],
        hourlyRequestCount: 0,
        dailyRequestCount: 0
      }

      const mockConnection = {
        success: true,
        message: 'Giphy connection successful (mock mode)',
        details: { 
          authenticated: false,
          mode: 'mock'
        }
      }

      mockGiphyScanningService.getScanConfig.mockResolvedValue(mockConfig)
      mockGiphyScanningService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.environment.hasApiKey).toBe(false)
      expect(data.data.environment.apiKeyConfigured).toBe(false)
      expect(data.data.environment.apiKeyLength).toBe(0)
      expect(data.data.environment.apiKeyMasked).toBeNull()
      expect(data.data.environment.mode).toBe('mock')
      expect(data.data.connection.isConnected).toBe(true)
      expect(data.data.capabilities.canSearch).toBe(false)
      expect(data.data.capabilities.realTimeMode).toBe(false)
      expect(data.data.capabilities.mockMode).toBe(true)
      expect(data.data.capabilities.rateLimiting).toBe('No rate limiting in mock mode')
      expect(data.message).toContain('mock mode')
    })

    it('should handle connection failure', async () => {
      process.env.GIPHY_API_KEY = 'invalid_api_key'
      
      const mockConfig = {
        isEnabled: true,
        scanInterval: 120,
        searchTerms: ['hotdog'],
        maxGifsPerScan: 15,
        allowedRatings: ['g', 'pg']
      }

      const mockConnection = {
        success: false,
        message: 'Giphy API authentication failed',
        details: { 
          authenticated: false,
          error: 'Invalid API key'
        }
      }

      mockGiphyScanningService.getScanConfig.mockResolvedValue(mockConfig)
      mockGiphyScanningService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.connection.isConnected).toBe(false)
      expect(data.data.connection.message).toBe('Giphy API authentication failed')
    })

    it('should include rate limit information when available', async () => {
      process.env.GIPHY_API_KEY = 'valid_api_key'
      
      const mockConfig = {
        isEnabled: true,
        scanInterval: 120,
        searchTerms: ['hotdog', 'hot dog'],
        maxGifsPerScan: 20,
        allowedRatings: ['g', 'pg'],
        hourlyRequestCount: 38,
        dailyRequestCount: 750
      }

      const mockConnection = {
        success: true,
        message: 'Giphy connection successful',
        details: { authenticated: true }
      }

      mockGiphyScanningService.getScanConfig.mockResolvedValue(mockConfig)
      mockGiphyScanningService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.configuration.rateLimits.hourly).toBe(38)
      expect(data.data.configuration.rateLimits.daily).toBe(750)
      expect(data.data.configuration.rateLimits.hourlyLimit).toBe(42)
      expect(data.data.configuration.rateLimits.dailyLimit).toBe(1000)
    })

    it('should handle service failure', async () => {
      process.env.GIPHY_API_KEY = 'test_key'
      
      mockGiphyScanningService.getScanConfig.mockRejectedValue(
        new Error('Failed to get Giphy configuration')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Failed to get Giphy configuration')
      expect(data.message).toBe('Failed to retrieve Giphy status')
    })

    it('should mask API key properly in different lengths', async () => {
      // Test with different API key lengths
      const testCases = [
        { key: 'abc123', expected: 'abc1***123' }, // 6 chars: first 4 + *** + last 3
        { key: 'a1b2c3d4e5', expected: 'a1b2***4e5' }, // 10 chars
        { key: 'short', expected: 'shor***ort' }, // 5 chars
        { key: 'ab', expected: 'ab***ab' } // 2 chars - edge case
      ]

      for (const testCase of testCases) {
        process.env.GIPHY_API_KEY = testCase.key
        
        const mockConfig = { isEnabled: true, searchTerms: ['test'] }
        const mockConnection = { success: true, message: 'test', details: {} }
        
        mockGiphyScanningService.getScanConfig.mockResolvedValue(mockConfig)
        mockGiphyScanningService.testConnection.mockResolvedValue(mockConnection)

        const request = new NextRequest('http://localhost:3000/api/admin/giphy/status')
        const response = await GET(request)
        const data = await response.json()

        expect(data.data.environment.apiKeyMasked).toBe(testCase.expected)
      }
    })

    it('should include search terms and configuration details', async () => {
      process.env.GIPHY_API_KEY = 'test_api_key'
      
      const mockConfig = {
        isEnabled: true,
        scanInterval: 90,
        searchTerms: ['hotdog', 'hot dog', 'corn dog', 'chili dog'],
        maxGifsPerScan: 25,
        allowedRatings: ['g', 'pg', 'pg-13'],
        hourlyRequestCount: 5,
        dailyRequestCount: 125
      }

      const mockConnection = {
        success: true,
        message: 'Connected',
        details: { authenticated: true }
      }

      mockGiphyScanningService.getScanConfig.mockResolvedValue(mockConfig)
      mockGiphyScanningService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/giphy/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.configuration.searchTerms).toEqual(['hotdog', 'hot dog', 'corn dog', 'chili dog'])
      expect(data.data.configuration.searchTermsCount).toBe(4)
      expect(data.data.configuration.scanInterval).toBe(90)
      expect(data.data.configuration.maxGifsPerScan).toBe(25)
      expect(data.data.capabilities.rateLimiting).toBe('42 requests/hour, 1000/day')
    })

    it('should include timestamp and connection test time', async () => {
      process.env.GIPHY_API_KEY = 'test_key'
      
      const mockConfig = { isEnabled: true, searchTerms: ['test'] }
      const mockConnection = { success: true, message: 'test', details: {} }
      
      mockGiphyScanningService.getScanConfig.mockResolvedValue(mockConfig)
      mockGiphyScanningService.testConnection.mockResolvedValue(mockConnection)

      const beforeRequest = Date.now()
      const request = new NextRequest('http://localhost:3000/api/admin/giphy/status')
      const response = await GET(request)
      const afterRequest = Date.now()
      const data = await response.json()

      expect(response.status).toBe(200)
      
      const timestamp = new Date(data.data.timestamp).getTime()
      const lastTested = new Date(data.data.connection.lastTested).getTime()
      
      expect(timestamp).toBeGreaterThanOrEqual(beforeRequest)
      expect(timestamp).toBeLessThanOrEqual(afterRequest)
      expect(lastTested).toBeGreaterThanOrEqual(beforeRequest)
      expect(lastTested).toBeLessThanOrEqual(afterRequest)
    })
  })
})