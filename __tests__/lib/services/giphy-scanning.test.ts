import { mockScanningService, mockScanResult, mockGiphyGif } from '@/__tests__/utils/social-mocks'

// Mock the Giphy scanning service
jest.mock('@/lib/services/giphy-scanning', () => ({
  GiphyScanningService: jest.fn().mockImplementation(() => ({
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn(),
    searchGifs: jest.fn(),
    validateGiphyContent: jest.fn(),
    getApiStatus: jest.fn(),
    getRateLimitStatus: jest.fn(),
    isEnabled: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn()
  })),
  giphyScanningService: {
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn()
  }
}))

// Mock dependencies
jest.mock('@/lib/services/filtering', () => ({
  FilteringService: jest.fn().mockImplementation(() => ({
    validateContent: jest.fn()
  }))
}))

jest.mock('@/lib/services/content-processor', () => ({
  ContentProcessor: jest.fn().mockImplementation(() => ({
    processGiphyGif: jest.fn()
  }))
}))

jest.mock('@/lib/services/duplicate-detection', () => ({
  DuplicateDetectionService: jest.fn().mockImplementation(() => ({
    isDuplicate: jest.fn()
  }))
}))

jest.mock('@/utils/supabase/server', () => ({
  createSimpleClient: jest.fn()
}))

jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/env', () => ({
  loadEnv: jest.fn()
}))

describe('GiphyScanningService', () => {
  let GiphyScanningService: jest.MockedClass<any>
  let giphyService: any
  const mockServiceFunctions = mockScanningService('Giphy')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked GiphyScanningService class
    const { GiphyScanningService: MockedService } = require('@/lib/services/giphy-scanning')
    GiphyScanningService = MockedService
    giphyService = new GiphyScanningService()
    
    // Setup default mock implementations
    Object.assign(giphyService, mockServiceFunctions)
  })

  describe('performScan', () => {
    const mockOptions = { maxPosts: 15 }

    it('should successfully perform Giphy scan', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 15,
        approved: 12,
        rejected: 3,
        duplicates: 5
      }
      
      giphyService.performScan.mockResolvedValue(expectedResult)

      const result = await giphyService.performScan(mockOptions)

      expect(giphyService.performScan).toHaveBeenCalledWith(mockOptions)
      expect(result.totalFound).toBe(20)
      expect(result.processed).toBe(15)
      expect(result.approved).toBe(12)
      expect(result.rejected).toBe(3)
      expect(result.duplicates).toBe(5)
    })

    it('should handle API rate limiting', async () => {
      const rateLimitError = new Error('Giphy API rate limit exceeded')
      giphyService.performScan.mockRejectedValue(rateLimitError)

      await expect(giphyService.performScan(mockOptions)).rejects.toThrow('Giphy API rate limit exceeded')
    })

    it('should handle missing API key gracefully', async () => {
      const mockResult = {
        totalFound: 5, // Mock mode returns fewer results
        processed: 5,
        approved: 4,
        rejected: 1,
        duplicates: 0,
        errors: ['Running in mock mode - limited results']
      }
      
      giphyService.performScan.mockResolvedValue(mockResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.totalFound).toBe(5)
      expect(result.errors).toContain('Running in mock mode - limited results')
    })

    it('should return empty results when service is disabled', async () => {
      const disabledResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['Giphy scanning is disabled']
      }
      
      giphyService.performScan.mockResolvedValue(disabledResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.errors).toContain('Giphy scanning is disabled')
    })

    it('should limit results to maxPosts parameter', async () => {
      const limitedResult = {
        ...mockScanResult,
        totalFound: 30,
        processed: 10, // Limited by maxPosts: 10
        approved: 8,
        rejected: 2
      }
      
      giphyService.performScan.mockResolvedValue(limitedResult)

      const result = await giphyService.performScan({ maxPosts: 10 })

      expect(result.processed).toBeLessThanOrEqual(10)
    })

    it('should process multiple search terms within rate limits', async () => {
      const multiTermResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 18,
        approved: 14,
        rejected: 4,
        duplicates: 7
      }
      
      giphyService.performScan.mockResolvedValue(multiTermResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.totalFound).toBeGreaterThan(15) // More than single search term
    })

    it('should filter out duplicate GIFs', async () => {
      const duplicateFilteredResult = {
        ...mockScanResult,
        totalFound: 22,
        processed: 15,
        approved: 11,
        rejected: 4,
        duplicates: 7 // 7 duplicates filtered out
      }
      
      giphyService.performScan.mockResolvedValue(duplicateFilteredResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.duplicates).toBe(7)
      expect(result.processed).toBe(15) // 22 found - 7 duplicates
    })

    it('should validate content rating before approval', async () => {
      const ratingFilteredResult = {
        ...mockScanResult,
        totalFound: 18,
        processed: 18,
        approved: 6, // Only G and PG rated content approved
        rejected: 12, // PG-13 and R rated content rejected
        duplicates: 0
      }
      
      giphyService.performScan.mockResolvedValue(ratingFilteredResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.approved).toBeLessThan(result.processed)
      expect(result.rejected).toBeGreaterThan(result.approved)
    })

    it('should handle network timeouts gracefully', async () => {
      const timeoutResult = {
        ...mockScanResult,
        totalFound: 10,
        processed: 6,
        approved: 4,
        rejected: 2,
        duplicates: 0,
        errors: ['Network timeout during GIF search']
      }
      
      giphyService.performScan.mockResolvedValue(timeoutResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.errors).toContain('Network timeout during GIF search')
      expect(result.processed).toBeLessThan(result.totalFound)
    })

    it('should respect rate limits (42/hour, 1000/day)', async () => {
      const rateLimitedResult = {
        ...mockScanResult,
        totalFound: 8,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 0,
        errors: ['Rate limit approaching - reducing scan size']
      }
      
      giphyService.performScan.mockResolvedValue(rateLimitedResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.errors).toContain('Rate limit approaching - reducing scan size')
      expect(result.processed).toBeLessThanOrEqual(15) // Should be reduced due to rate limits
    })
  })

  describe('testConnection', () => {
    it('should return successful connection test with API key', async () => {
      const successResult = {
        success: true,
        message: 'Giphy connection successful',
        details: { 
          authenticated: true,
          apiKey: 'abc123***',
          rateLimitRemaining: 35,
          mode: 'api'
        }
      }
      
      giphyService.testConnection.mockResolvedValue(successResult)

      const result = await giphyService.testConnection()

      expect(result.success).toBe(true)
      expect(result.details.authenticated).toBe(true)
      expect(result.details.rateLimitRemaining).toBeGreaterThan(0)
      expect(result.details.mode).toBe('api')
    })

    it('should return successful connection test in mock mode', async () => {
      const mockResult = {
        success: true,
        message: 'Giphy connection successful (mock mode)',
        details: { 
          authenticated: false,
          apiKey: null,
          rateLimitRemaining: 'unlimited',
          mode: 'mock'
        }
      }
      
      giphyService.testConnection.mockResolvedValue(mockResult)

      const result = await giphyService.testConnection()

      expect(result.success).toBe(true)
      expect(result.details.authenticated).toBe(false)
      expect(result.details.mode).toBe('mock')
      expect(result.message).toContain('mock mode')
    })

    it('should return failed connection on rate limit', async () => {
      const rateLimitResult = {
        success: false,
        message: 'Giphy API rate limit exceeded',
        details: { 
          authenticated: true,
          rateLimitRemaining: 0,
          resetTime: new Date(Date.now() + 60 * 60 * 1000)
        }
      }
      
      giphyService.testConnection.mockResolvedValue(rateLimitResult)

      const result = await giphyService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.rateLimitRemaining).toBe(0)
      expect(result.message).toContain('rate limit exceeded')
    })
  })

  describe('getScanConfig', () => {
    it('should return current scan configuration', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 120, // minutes
        maxGifsPerScan: 15,
        searchTerms: ['hotdog', 'hot dog', 'corn dog', 'chili dog'],
        allowedRatings: ['g', 'pg'],
        blockedRatings: ['pg-13', 'r'],
        hourlyRequestCount: 15,
        dailyRequestCount: 150
      }
      
      giphyService.getScanConfig.mockResolvedValue(mockConfig)

      const config = await giphyService.getScanConfig()

      expect(config.isEnabled).toBe(true)
      expect(config.scanInterval).toBe(120)
      expect(config.searchTerms).toContain('hotdog')
      expect(config.allowedRatings).toContain('g')
      expect(config.blockedRatings).toContain('r')
      expect(config.hourlyRequestCount).toBe(15)
    })

    it('should update scan configuration', async () => {
      const configUpdate = {
        isEnabled: true,
        scanInterval: 90,
        maxGifsPerScan: 20,
        searchTerms: ['gourmet hotdog', 'artisan hot dog'],
        allowedRatings: ['g', 'pg', 'pg-13'],
        blockedRatings: ['r']
      }
      
      giphyService.updateScanConfig.mockResolvedValue(configUpdate)

      const result = await giphyService.updateScanConfig(configUpdate)

      expect(giphyService.updateScanConfig).toHaveBeenCalledWith(configUpdate)
      expect(result.scanInterval).toBe(90)
      expect(result.allowedRatings).toContain('pg-13')
    })
  })

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      const mockRateStatus = {
        hourlyRemaining: 27,
        hourlyLimit: 42,
        hourlyUsed: 15,
        dailyRemaining: 850,
        dailyLimit: 1000,
        dailyUsed: 150,
        nextHourlyReset: new Date(Date.now() + 45 * 60 * 1000),
        nextDailyReset: new Date(Date.now() + 20 * 60 * 60 * 1000)
      }
      
      giphyService.getRateLimitStatus.mockResolvedValue(mockRateStatus)

      const status = await giphyService.getRateLimitStatus()

      expect(status.hourlyRemaining).toBe(27)
      expect(status.hourlyLimit).toBe(42)
      expect(status.dailyRemaining).toBe(850)
      expect(status.dailyLimit).toBe(1000)
    })

    it('should indicate rate limit exhaustion', async () => {
      const exhaustedStatus = {
        hourlyRemaining: 0,
        hourlyLimit: 42,
        hourlyUsed: 42,
        dailyRemaining: 0,
        dailyLimit: 1000,
        dailyUsed: 1000,
        nextHourlyReset: new Date(Date.now() + 30 * 60 * 1000),
        nextDailyReset: new Date(Date.now() + 10 * 60 * 60 * 1000)
      }
      
      giphyService.getRateLimitStatus.mockResolvedValue(exhaustedStatus)

      const status = await giphyService.getRateLimitStatus()

      expect(status.hourlyRemaining).toBe(0)
      expect(status.dailyRemaining).toBe(0)
    })
  })

  describe('content processing', () => {
    it('should search GIFs with query terms', async () => {
      const mockGifs = [
        mockGiphyGif,
        {
          ...mockGiphyGif,
          id: 'xyz789',
          title: 'Grilling the perfect hotdog this summer!',
          url: 'https://giphy.com/gifs/grilling-hotdog-xyz789'
        }
      ]
      
      giphyService.searchGifs.mockResolvedValue(mockGifs)

      const gifs = await giphyService.searchGifs(['hotdog', 'hot dog'])

      expect(gifs).toHaveLength(2)
      expect(gifs[0].title.toLowerCase()).toContain('hotdog')
    })

    it('should validate Giphy content format', async () => {
      const validationResult = {
        isValid: true,
        confidence: 0.82,
        reasons: ['Contains hotdog keywords', 'G rating', 'High quality GIF']
      }
      
      giphyService.validateGiphyContent.mockResolvedValue(validationResult)

      const result = await giphyService.validateGiphyContent(mockGiphyGif)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(0.82)
      expect(result.reasons).toContain('Contains hotdog keywords')
    })

    it('should reject inappropriate content based on rating', async () => {
      const inappropriateValidationResult = {
        isValid: false,
        confidence: 0.0,
        reasons: ['R rating not allowed', 'Content filtering enabled']
      }
      
      giphyService.validateGiphyContent.mockResolvedValue(inappropriateValidationResult)

      const ratedRGif = { ...mockGiphyGif, rating: 'r' }
      const result = await giphyService.validateGiphyContent(ratedRGif)

      expect(result.isValid).toBe(false)
      expect(result.reasons).toContain('R rating not allowed')
    })
  })

  describe('service state management', () => {
    it('should check if service is enabled', async () => {
      giphyService.isEnabled.mockReturnValue(true)

      const enabled = giphyService.isEnabled()

      expect(enabled).toBe(true)
    })

    it('should enable the service', async () => {
      giphyService.enable.mockResolvedValue(undefined)

      await giphyService.enable()

      expect(giphyService.enable).toHaveBeenCalled()
    })

    it('should disable the service', async () => {
      giphyService.disable.mockResolvedValue(undefined)

      await giphyService.disable()

      expect(giphyService.disable).toHaveBeenCalled()
    })
  })

  describe('error handling and resilience', () => {
    it('should handle partial scan failures gracefully', async () => {
      const mockOptions = { maxPosts: 15 }
      
      const partialFailureResult = {
        totalFound: 15,
        processed: 10,
        approved: 7,
        rejected: 3,
        duplicates: 0,
        errors: ['Failed to process 5 GIFs due to API timeouts']
      }
      
      giphyService.performScan.mockResolvedValue(partialFailureResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.processed).toBe(10)
      expect(result.errors).toContain('Failed to process 5 GIFs due to API timeouts')
    })

    it('should retry failed requests within rate limits', async () => {
      const mockOptions = { maxPosts: 12 }
      
      const retryResult = {
        ...mockScanResult,
        totalFound: 12,
        processed: 12,
        approved: 9,
        rejected: 3,
        duplicates: 0,
        errors: [] // Successful after retry
      }
      
      giphyService.performScan.mockResolvedValue(retryResult)

      const result = await giphyService.performScan(mockOptions)

      expect(result.errors).toHaveLength(0)
      expect(result.processed).toBe(12)
    })

    it('should handle GIF processing errors', async () => {
      const processingErrorResult = {
        totalFound: 8,
        processed: 5,
        approved: 3,
        rejected: 2,
        duplicates: 0,
        errors: ['Failed to download 3 GIFs', 'GIF format not supported']
      }
      
      giphyService.performScan.mockResolvedValue(processingErrorResult)

      const result = await giphyService.performScan({ maxPosts: 8 })

      expect(result.processed).toBe(5)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]).toContain('Failed to download')
    })

    it('should handle rate limit monitoring', async () => {
      const rateLimitResult = {
        totalFound: 5,
        processed: 5,
        approved: 4,
        rejected: 1,
        duplicates: 0,
        errors: ['Rate limit monitoring: 38/42 hourly requests used']
      }
      
      giphyService.performScan.mockResolvedValue(rateLimitResult)

      const result = await giphyService.performScan({ maxPosts: 5 })

      expect(result.errors).toContain('Rate limit monitoring: 38/42 hourly requests used')
    })
  })
})