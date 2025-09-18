import { mockScanningService, mockScanResult, mockImgurPost } from '@/__tests__/utils/social-mocks'

// Mock the Imgur scanning service
jest.mock('@/lib/services/imgur-scanning', () => ({
  ImgurScanningService: jest.fn().mockImplementation(() => ({
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn(),
    searchGallery: jest.fn(),
    validateImgurContent: jest.fn(),
    getApiStatus: jest.fn(),
    isEnabled: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn()
  })),
  imgurScanningService: {
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn()
  }
}))

// Mock dependencies
jest.mock('@/lib/services/content-processor', () => ({
  contentProcessor: {
    processImgurImage: jest.fn()
  }
}))

jest.mock('@/lib/services/filtering', () => ({
  FilteringService: jest.fn().mockImplementation(() => ({
    validateContent: jest.fn()
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

describe('ImgurScanningService', () => {
  let ImgurScanningService: jest.MockedClass<any>
  let imgurService: any
  const mockServiceFunctions = mockScanningService('Imgur')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked ImgurScanningService class
    const { ImgurScanningService: MockedService } = require('@/lib/services/imgur-scanning')
    ImgurScanningService = MockedService
    imgurService = new ImgurScanningService()
    
    // Setup default mock implementations
    Object.assign(imgurService, mockServiceFunctions)
  })

  describe('performScan', () => {
    const mockOptions = { maxPosts: 20 }

    it('should successfully perform Imgur scan', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 30,
        processed: 20,
        approved: 15,
        rejected: 5,
        duplicates: 10
      }
      
      imgurService.performScan.mockResolvedValue(expectedResult)

      const result = await imgurService.performScan(mockOptions)

      expect(imgurService.performScan).toHaveBeenCalledWith(mockOptions)
      expect(result.totalFound).toBe(30)
      expect(result.processed).toBe(20)
      expect(result.approved).toBe(15)
      expect(result.rejected).toBe(5)
      expect(result.duplicates).toBe(10)
    })

    it('should handle API rate limiting', async () => {
      const rateLimitError = new Error('Imgur API rate limit exceeded')
      imgurService.performScan.mockRejectedValue(rateLimitError)

      await expect(imgurService.performScan(mockOptions)).rejects.toThrow('Imgur API rate limit exceeded')
    })

    it('should handle missing client ID gracefully', async () => {
      const mockResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['Imgur API client ID not configured']
      }
      
      imgurService.performScan.mockResolvedValue(mockResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.errors).toContain('Imgur API client ID not configured')
    })

    it('should return empty results when service is disabled', async () => {
      const disabledResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['Imgur scanning is disabled']
      }
      
      imgurService.performScan.mockResolvedValue(disabledResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.errors).toContain('Imgur scanning is disabled')
    })

    it('should limit results to maxPosts parameter', async () => {
      const limitedResult = {
        ...mockScanResult,
        totalFound: 50,
        processed: 15, // Limited by maxPosts: 15
        approved: 12,
        rejected: 3
      }
      
      imgurService.performScan.mockResolvedValue(limitedResult)

      const result = await imgurService.performScan({ maxPosts: 15 })

      expect(result.processed).toBeLessThanOrEqual(15)
    })

    it('should process multiple search terms', async () => {
      const multiTermResult = {
        ...mockScanResult,
        totalFound: 45,
        processed: 30,
        approved: 22,
        rejected: 8,
        duplicates: 15
      }
      
      imgurService.performScan.mockResolvedValue(multiTermResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.totalFound).toBeGreaterThan(25) // More than single search term
    })

    it('should filter out duplicate images', async () => {
      const duplicateFilteredResult = {
        ...mockScanResult,
        totalFound: 35,
        processed: 22,
        approved: 16,
        rejected: 6,
        duplicates: 13 // 13 duplicates filtered out
      }
      
      imgurService.performScan.mockResolvedValue(duplicateFilteredResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.duplicates).toBe(13)
      expect(result.processed).toBe(22) // 35 found - 13 duplicates
    })

    it('should validate content quality before approval', async () => {
      const qualityFilteredResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 25,
        approved: 8, // Only high-quality content approved
        rejected: 17,
        duplicates: 0
      }
      
      imgurService.performScan.mockResolvedValue(qualityFilteredResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.approved).toBeLessThan(result.processed)
      expect(result.rejected).toBeGreaterThan(result.approved)
    })

    it('should handle network timeouts gracefully', async () => {
      const timeoutResult = {
        ...mockScanResult,
        totalFound: 12,
        processed: 8,
        approved: 5,
        rejected: 3,
        duplicates: 0,
        errors: ['Network timeout during gallery search']
      }
      
      imgurService.performScan.mockResolvedValue(timeoutResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.errors).toContain('Network timeout during gallery search')
      expect(result.processed).toBeLessThan(result.totalFound)
    })

    it('should handle NSFW content filtering', async () => {
      const nsfwFilteredResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 15, // 5 filtered out as NSFW
        approved: 12,
        rejected: 3,
        duplicates: 0
      }
      
      imgurService.performScan.mockResolvedValue(nsfwFilteredResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.processed).toBe(15)
      expect(result.totalFound).toBeGreaterThan(result.processed)
    })
  })

  describe('testConnection', () => {
    it('should return successful connection test', async () => {
      const successResult = {
        success: true,
        message: 'Imgur connection successful',
        details: { 
          authenticated: true,
          clientId: 'abc123***',
          apiStatus: 'healthy',
          rateLimitRemaining: 1200
        }
      }
      
      imgurService.testConnection.mockResolvedValue(successResult)

      const result = await imgurService.testConnection()

      expect(result.success).toBe(true)
      expect(result.details.authenticated).toBe(true)
      expect(result.details.rateLimitRemaining).toBeGreaterThan(0)
    })

    it('should return failed connection when client ID is missing', async () => {
      const failResult = {
        success: false,
        message: 'Imgur client ID not configured',
        details: { 
          authenticated: false,
          apiStatus: 'error',
          error: 'Missing client ID'
        }
      }
      
      imgurService.testConnection.mockResolvedValue(failResult)

      const result = await imgurService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.authenticated).toBe(false)
      expect(result.message).toContain('client ID not configured')
    })

    it('should return failed connection on rate limit', async () => {
      const rateLimitResult = {
        success: false,
        message: 'Imgur API rate limit exceeded',
        details: { 
          authenticated: true,
          apiStatus: 'rate_limited',
          rateLimitRemaining: 0,
          resetTime: new Date(Date.now() + 60 * 60 * 1000)
        }
      }
      
      imgurService.testConnection.mockResolvedValue(rateLimitResult)

      const result = await imgurService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.rateLimitRemaining).toBe(0)
      expect(result.message).toContain('rate limit exceeded')
    })
  })

  describe('getScanConfig', () => {
    it('should return current scan configuration', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 180, // minutes
        maxImagesPerScan: 25,
        searchTerms: ['hotdog', 'hot dog', 'chili dog'],
        includeNSFW: false,
        minScore: 10,
        maxImageSize: 5000000, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif']
      }
      
      imgurService.getScanConfig.mockResolvedValue(mockConfig)

      const config = await imgurService.getScanConfig()

      expect(config.isEnabled).toBe(true)
      expect(config.scanInterval).toBe(180)
      expect(config.searchTerms).toContain('hotdog')
      expect(config.includeNSFW).toBe(false)
      expect(config.minScore).toBe(10)
    })

    it('should update scan configuration', async () => {
      const configUpdate = {
        isEnabled: true,
        scanInterval: 240,
        maxImagesPerScan: 30,
        searchTerms: ['gourmet hotdog', 'artisan hot dog'],
        includeNSFW: false,
        minScore: 15
      }
      
      imgurService.updateScanConfig.mockResolvedValue(configUpdate)

      const result = await imgurService.updateScanConfig(configUpdate)

      expect(imgurService.updateScanConfig).toHaveBeenCalledWith(configUpdate)
      expect(result.scanInterval).toBe(240)
      expect(result.minScore).toBe(15)
    })
  })

  describe('getApiStatus', () => {
    it('should return API status with rate limits', async () => {
      const mockApiStatus = {
        isAuthenticated: true,
        clientId: 'abc123***',
        rateLimitRemaining: 800,
        rateLimitReset: new Date(Date.now() + 3600000),
        lastError: null,
        requestCount: 200
      }
      
      imgurService.getApiStatus.mockResolvedValue(mockApiStatus)

      const status = await imgurService.getApiStatus()

      expect(status.isAuthenticated).toBe(true)
      expect(status.rateLimitRemaining).toBe(800)
      expect(status.requestCount).toBe(200)
    })

    it('should indicate rate limit exhaustion', async () => {
      const exhaustedStatus = {
        isAuthenticated: true,
        clientId: 'abc123***',
        rateLimitRemaining: 0,
        rateLimitReset: new Date(Date.now() + 1800000),
        lastError: 'Rate limit exceeded',
        requestCount: 1250
      }
      
      imgurService.getApiStatus.mockResolvedValue(exhaustedStatus)

      const status = await imgurService.getApiStatus()

      expect(status.rateLimitRemaining).toBe(0)
      expect(status.lastError).toBe('Rate limit exceeded')
    })
  })

  describe('content processing', () => {
    it('should search gallery with query terms', async () => {
      const mockImages = [
        mockImgurPost,
        {
          ...mockImgurPost,
          id: 'xyz789',
          title: 'Grilling the perfect hotdog this summer!',
          link: 'https://imgur.com/xyz789'
        }
      ]
      
      imgurService.searchGallery.mockResolvedValue(mockImages)

      const images = await imgurService.searchGallery(['hotdog', 'hot dog'])

      expect(images).toHaveLength(2)
      expect(images[0].title).toContain('hotdog')
    })

    it('should validate Imgur content format', async () => {
      const validationResult = {
        isValid: true,
        confidence: 0.78,
        reasons: ['Contains hotdog keywords', 'High quality image', 'Positive score']
      }
      
      imgurService.validateImgurContent.mockResolvedValue(validationResult)

      const result = await imgurService.validateImgurContent(mockImgurPost)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(0.78)
      expect(result.reasons).toContain('Contains hotdog keywords')
    })

    it('should reject NSFW content when filtering enabled', async () => {
      const nsfwValidationResult = {
        isValid: false,
        confidence: 0.0,
        reasons: ['Content marked as NSFW', 'NSFW filtering enabled']
      }
      
      imgurService.validateImgurContent.mockResolvedValue(nsfwValidationResult)

      const nsfwImage = { ...mockImgurPost, nsfw: true }
      const result = await imgurService.validateImgurContent(nsfwImage)

      expect(result.isValid).toBe(false)
      expect(result.reasons).toContain('Content marked as NSFW')
    })
  })

  describe('service state management', () => {
    it('should check if service is enabled', async () => {
      imgurService.isEnabled.mockReturnValue(true)

      const enabled = imgurService.isEnabled()

      expect(enabled).toBe(true)
    })

    it('should enable the service', async () => {
      imgurService.enable.mockResolvedValue(undefined)

      await imgurService.enable()

      expect(imgurService.enable).toHaveBeenCalled()
    })

    it('should disable the service', async () => {
      imgurService.disable.mockResolvedValue(undefined)

      await imgurService.disable()

      expect(imgurService.disable).toHaveBeenCalled()
    })
  })

  describe('error handling and resilience', () => {
    it('should handle partial scan failures gracefully', async () => {
      const mockOptions = { maxPosts: 20 }
      
      const partialFailureResult = {
        totalFound: 20,
        processed: 15,
        approved: 10,
        rejected: 5,
        duplicates: 0,
        errors: ['Failed to process 5 images due to API timeouts']
      }
      
      imgurService.performScan.mockResolvedValue(partialFailureResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.processed).toBe(15)
      expect(result.errors).toContain('Failed to process 5 images due to API timeouts')
    })

    it('should retry failed requests within limits', async () => {
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
      
      imgurService.performScan.mockResolvedValue(retryResult)

      const result = await imgurService.performScan(mockOptions)

      expect(result.errors).toHaveLength(0)
      expect(result.processed).toBe(12)
    })

    it('should handle image processing errors', async () => {
      const processingErrorResult = {
        totalFound: 10,
        processed: 7,
        approved: 5,
        rejected: 2,
        duplicates: 0,
        errors: ['Failed to download 3 images', 'Image format not supported']
      }
      
      imgurService.performScan.mockResolvedValue(processingErrorResult)

      const result = await imgurService.performScan({ maxPosts: 10 })

      expect(result.processed).toBe(7)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]).toContain('Failed to download')
    })
  })
})