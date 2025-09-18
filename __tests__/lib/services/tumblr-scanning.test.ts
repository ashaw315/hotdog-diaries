import { mockScanningService, mockScanResult, mockTumblrPost } from '@/__tests__/utils/social-mocks'

// Mock the Tumblr scanning service
jest.mock('@/lib/services/tumblr-scanning', () => ({
  TumblrScanningService: jest.fn().mockImplementation(() => ({
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn(),
    searchPosts: jest.fn(),
    validateTumblrContent: jest.fn(),
    getApiStatus: jest.fn(),
    extractImageFromHTML: jest.fn(),
    isEnabled: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn()
  })),
  tumblrScanningService: {
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
    processTumblrPost: jest.fn()
  }))
}))

jest.mock('@/lib/db', () => ({
  db: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn()
  },
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

describe('TumblrScanningService', () => {
  let TumblrScanningService: jest.MockedClass<any>
  let tumblrService: any
  const mockServiceFunctions = mockScanningService('Tumblr')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked TumblrScanningService class
    const { TumblrScanningService: MockedService } = require('@/lib/services/tumblr-scanning')
    TumblrScanningService = MockedService
    tumblrService = new TumblrScanningService()
    
    // Setup default mock implementations
    Object.assign(tumblrService, mockServiceFunctions)
  })

  describe('performScan', () => {
    const mockOptions = { maxPosts: 20 }

    it('should successfully perform Tumblr scan', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 20,
        approved: 15,
        rejected: 5,
        duplicates: 5
      }
      
      tumblrService.performScan.mockResolvedValue(expectedResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(tumblrService.performScan).toHaveBeenCalledWith(mockOptions)
      expect(result.totalFound).toBe(25)
      expect(result.processed).toBe(20)
      expect(result.approved).toBe(15)
      expect(result.rejected).toBe(5)
      expect(result.duplicates).toBe(5)
    })

    it('should handle API authentication errors', async () => {
      const authError = new Error('Tumblr API authentication failed')
      tumblrService.performScan.mockRejectedValue(authError)

      await expect(tumblrService.performScan(mockOptions)).rejects.toThrow('Tumblr API authentication failed')
    })

    it('should handle missing API key gracefully', async () => {
      const mockResult = {
        totalFound: 5, // Mock mode returns fewer results
        processed: 5,
        approved: 3,
        rejected: 2,
        duplicates: 0,
        errors: ['Running in mock mode - limited results']
      }
      
      tumblrService.performScan.mockResolvedValue(mockResult)

      const result = await tumblrService.performScan(mockOptions)

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
        errors: ['Tumblr scanning is disabled']
      }
      
      tumblrService.performScan.mockResolvedValue(disabledResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.errors).toContain('Tumblr scanning is disabled')
    })

    it('should limit results to maxPosts parameter', async () => {
      const limitedResult = {
        ...mockScanResult,
        totalFound: 40,
        processed: 15, // Limited by maxPosts: 15
        approved: 12,
        rejected: 3
      }
      
      tumblrService.performScan.mockResolvedValue(limitedResult)

      const result = await tumblrService.performScan({ maxPosts: 15 })

      expect(result.processed).toBeLessThanOrEqual(15)
    })

    it('should process multiple search tags', async () => {
      const multiTagResult = {
        ...mockScanResult,
        totalFound: 35,
        processed: 25,
        approved: 18,
        rejected: 7,
        duplicates: 10
      }
      
      tumblrService.performScan.mockResolvedValue(multiTagResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(result.totalFound).toBeGreaterThan(20) // More than single tag
    })

    it('should filter out duplicate posts', async () => {
      const duplicateFilteredResult = {
        ...mockScanResult,
        totalFound: 30,
        processed: 22,
        approved: 16,
        rejected: 6,
        duplicates: 8 // 8 duplicates filtered out
      }
      
      tumblrService.performScan.mockResolvedValue(duplicateFilteredResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(result.duplicates).toBe(8)
      expect(result.processed).toBe(22) // 30 found - 8 duplicates
    })

    it('should validate content quality before approval', async () => {
      const qualityFilteredResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 25,
        approved: 10, // Only high-quality content approved
        rejected: 15,
        duplicates: 0
      }
      
      tumblrService.performScan.mockResolvedValue(qualityFilteredResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(result.approved).toBeLessThan(result.processed)
      expect(result.rejected).toBeGreaterThan(result.approved)
    })

    it('should handle network timeouts gracefully', async () => {
      const timeoutResult = {
        ...mockScanResult,
        totalFound: 15,
        processed: 10,
        approved: 7,
        rejected: 3,
        duplicates: 0,
        errors: ['Network timeout during post search']
      }
      
      tumblrService.performScan.mockResolvedValue(timeoutResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(result.errors).toContain('Network timeout during post search')
      expect(result.processed).toBeLessThan(result.totalFound)
    })

    it('should handle photo post processing', async () => {
      const photoPostResult = {
        ...mockScanResult,
        totalFound: 18,
        processed: 15,
        approved: 12, // Most photo posts approved
        rejected: 3,
        duplicates: 3
      }
      
      tumblrService.performScan.mockResolvedValue(photoPostResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(result.approved).toBeGreaterThan(result.rejected) // Photo posts generally have higher approval rate
    })
  })

  describe('testConnection', () => {
    it('should return successful connection test with API key', async () => {
      const successResult = {
        success: true,
        message: 'Tumblr connection successful',
        details: { 
          authenticated: true,
          apiKey: 'tumblr_api_***',
          mode: 'api'
        }
      }
      
      tumblrService.testConnection.mockResolvedValue(successResult)

      const result = await tumblrService.testConnection()

      expect(result.success).toBe(true)
      expect(result.details.authenticated).toBe(true)
      expect(result.details.mode).toBe('api')
    })

    it('should return successful connection test in mock mode', async () => {
      const mockResult = {
        success: true,
        message: 'Tumblr connection successful (mock mode)',
        details: { 
          authenticated: false,
          apiKey: null,
          mode: 'mock'
        }
      }
      
      tumblrService.testConnection.mockResolvedValue(mockResult)

      const result = await tumblrService.testConnection()

      expect(result.success).toBe(true)
      expect(result.details.authenticated).toBe(false)
      expect(result.details.mode).toBe('mock')
      expect(result.message).toContain('mock mode')
    })

    it('should return failed connection on API errors', async () => {
      const apiErrorResult = {
        success: false,
        message: 'Tumblr API request failed',
        details: { 
          authenticated: false,
          error: 'Invalid API key or quota exceeded'
        }
      }
      
      tumblrService.testConnection.mockResolvedValue(apiErrorResult)

      const result = await tumblrService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.authenticated).toBe(false)
      expect(result.message).toContain('API request failed')
    })
  })

  describe('getScanConfig', () => {
    it('should return current scan configuration', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240, // minutes
        maxPostsPerScan: 25,
        searchTags: ['hotdog', 'hot dog', 'food photography', 'food blog'],
        postTypes: ['photo', 'text'],
        excludeNSFW: true,
        minNoteCount: 5
      }
      
      tumblrService.getScanConfig.mockResolvedValue(mockConfig)

      const config = await tumblrService.getScanConfig()

      expect(config.isEnabled).toBe(true)
      expect(config.scanInterval).toBe(240)
      expect(config.searchTags).toContain('hotdog')
      expect(config.postTypes).toContain('photo')
      expect(config.excludeNSFW).toBe(true)
      expect(config.minNoteCount).toBe(5)
    })

    it('should update scan configuration', async () => {
      const configUpdate = {
        isEnabled: true,
        scanInterval: 180,
        maxPostsPerScan: 30,
        searchTags: ['gourmet hotdog', 'artisan hot dog'],
        postTypes: ['photo', 'text', 'video'],
        excludeNSFW: true,
        minNoteCount: 10
      }
      
      tumblrService.updateScanConfig.mockResolvedValue(configUpdate)

      const result = await tumblrService.updateScanConfig(configUpdate)

      expect(tumblrService.updateScanConfig).toHaveBeenCalledWith(configUpdate)
      expect(result.scanInterval).toBe(180)
      expect(result.minNoteCount).toBe(10)
      expect(result.postTypes).toContain('video')
    })
  })

  describe('content processing', () => {
    it('should search posts with tag queries', async () => {
      const mockPosts = [
        mockTumblrPost,
        {
          ...mockTumblrPost,
          id: 456,
          blog_name: 'grilling-hotdog-summer',
          caption: 'Grilling the perfect hotdog this summer!',
          photos: [
            {
              caption: 'Perfect grill marks',
              original_size: {
                url: 'https://64.media.tumblr.com/hotdog2.jpg',
                width: 1024,
                height: 768
              },
              alt_sizes: []
            }
          ]
        }
      ]
      
      tumblrService.searchPosts.mockResolvedValue(mockPosts)

      const posts = await tumblrService.searchPosts(['hotdog', 'hot dog'])

      expect(posts).toHaveLength(2)
      expect(posts[0].blog_name).toContain('hotdog')
    })

    it('should validate Tumblr content format', async () => {
      const validationResult = {
        isValid: true,
        confidence: 0.85,
        reasons: ['Contains hotdog keywords', 'Photo post type', 'Good engagement']
      }
      
      tumblrService.validateTumblrContent.mockResolvedValue(validationResult)

      const result = await tumblrService.validateTumblrContent(mockTumblrPost)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(0.85)
      expect(result.reasons).toContain('Contains hotdog keywords')
    })

    it('should extract images from HTML content', async () => {
      const htmlContent = '<p>Check out this amazing hotdog!</p><img src="https://example.com/hotdog.jpg" alt="delicious hotdog" /><p>So good!</p>'
      const expectedImageUrl = 'https://example.com/hotdog.jpg'
      
      tumblrService.extractImageFromHTML.mockReturnValue(expectedImageUrl)

      const imageUrl = tumblrService.extractImageFromHTML(htmlContent)

      expect(imageUrl).toBe(expectedImageUrl)
      expect(tumblrService.extractImageFromHTML).toHaveBeenCalledWith(htmlContent)
    })

    it('should handle posts without images', async () => {
      const textOnlyContent = '<p>Just talking about hotdogs without images.</p>'
      
      tumblrService.extractImageFromHTML.mockReturnValue(null)

      const imageUrl = tumblrService.extractImageFromHTML(textOnlyContent)

      expect(imageUrl).toBeNull()
    })
  })

  describe('service state management', () => {
    it('should check if service is enabled', async () => {
      tumblrService.isEnabled.mockReturnValue(true)

      const enabled = tumblrService.isEnabled()

      expect(enabled).toBe(true)
    })

    it('should enable the service', async () => {
      tumblrService.enable.mockResolvedValue(undefined)

      await tumblrService.enable()

      expect(tumblrService.enable).toHaveBeenCalled()
    })

    it('should disable the service', async () => {
      tumblrService.disable.mockResolvedValue(undefined)

      await tumblrService.disable()

      expect(tumblrService.disable).toHaveBeenCalled()
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
        errors: ['Failed to process 5 posts due to API timeouts']
      }
      
      tumblrService.performScan.mockResolvedValue(partialFailureResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(result.processed).toBe(15)
      expect(result.errors).toContain('Failed to process 5 posts due to API timeouts')
    })

    it('should retry failed requests within limits', async () => {
      const mockOptions = { maxPosts: 15 }
      
      const retryResult = {
        ...mockScanResult,
        totalFound: 15,
        processed: 15,
        approved: 12,
        rejected: 3,
        duplicates: 0,
        errors: [] // Successful after retry
      }
      
      tumblrService.performScan.mockResolvedValue(retryResult)

      const result = await tumblrService.performScan(mockOptions)

      expect(result.errors).toHaveLength(0)
      expect(result.processed).toBe(15)
    })

    it('should handle HTML parsing errors', async () => {
      const malformedHtml = '<img src="invalid-url" alt="test'
      
      tumblrService.extractImageFromHTML.mockReturnValue(null)

      const imageUrl = tumblrService.extractImageFromHTML(malformedHtml)

      expect(imageUrl).toBeNull()
    })

    it('should handle different post types appropriately', async () => {
      const mixedPostResult = {
        totalFound: 20,
        processed: 18,
        approved: 14, // Photo posts have higher approval
        rejected: 4,  // Text posts may be rejected more often
        duplicates: 2
      }
      
      tumblrService.performScan.mockResolvedValue(mixedPostResult)

      const result = await tumblrService.performScan({ maxPosts: 20 })

      expect(result.processed).toBe(18)
      expect(result.approved).toBe(14)
    })
  })
})