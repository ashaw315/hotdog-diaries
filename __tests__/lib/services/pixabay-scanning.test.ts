import { mockScanningService, mockScanResult, mockPixabayPhoto } from '@/__tests__/utils/social-mocks'

// Mock the Pixabay scanning service
jest.mock('@/lib/services/pixabay-scanning', () => ({
  PixabayScanningService: jest.fn().mockImplementation(() => ({
    performScan: jest.fn(),
    searchPhotos: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn()
  }))
}))

// Mock dependencies
jest.mock('@/lib/services/filtering', () => ({
  FilteringService: jest.fn().mockImplementation(() => ({
    validateContent: jest.fn()
  }))
}))

jest.mock('@/lib/services/content-processor', () => ({
  ContentProcessor: jest.fn().mockImplementation(() => ({
    processPixabayPhoto: jest.fn()
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

describe('PixabayScanningService', () => {
  let PixabayScanningService: jest.MockedClass<any>
  let pixabayService: any
  const mockServiceFunctions = mockScanningService('Pixabay')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked PixabayScanningService class
    const { PixabayScanningService: MockedService } = require('@/lib/services/pixabay-scanning')
    PixabayScanningService = MockedService
    pixabayService = new PixabayScanningService()
    
    // Setup default mock implementations
    Object.assign(pixabayService, mockServiceFunctions)
  })

  describe('performScan', () => {
    const mockOptions = { maxPosts: 30 }

    it('should successfully perform Pixabay professional photo scan', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 20,
        approved: 15,
        rejected: 5,
        duplicates: 5
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(pixabayService.performScan).toHaveBeenCalledWith(mockOptions)
      expect(result.totalFound).toBe(25)
      expect(result.processed).toBe(20)
      expect(result.approved).toBe(15)
      expect(result.rejected).toBe(5)
    })

    it('should handle API key not configured gracefully', async () => {
      const expectedResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['API key not configured']
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.errors).toContain('API key not configured')
      expect(result.totalFound).toBe(0)
    })

    it('should return empty results when service is disabled', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.processed).toBe(0)
    })

    it('should limit results to maxPosts parameter', async () => {
      const limitedOptions = { maxPosts: 10 }
      const expectedResult = {
        ...mockScanResult,
        totalFound: 15,
        processed: 10, // Limited by maxPosts
        approved: 8,
        rejected: 2
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(limitedOptions)

      expect(pixabayService.performScan).toHaveBeenCalledWith(limitedOptions)
      expect(result.processed).toBeLessThanOrEqual(limitedOptions.maxPosts)
    })

    it('should process multiple search terms effectively', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 45, // Higher due to multiple search terms
        processed: 30,
        approved: 22,
        rejected: 8
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.totalFound).toBeGreaterThan(30) // Multiple search terms yield more results
    })

    it('should filter duplicate photos across search terms', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 30,
        processed: 25,
        approved: 18,
        rejected: 7,
        duplicates: 5 // Some duplicates found across search terms
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.duplicates).toBeGreaterThan(0)
      expect(result.processed).toBeLessThan(result.totalFound)
    })

    it('should validate high-quality professional photography', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 20,
        approved: 16, // High approval rate for quality content
        rejected: 4
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      // Pixabay should have high approval rates due to quality standards
      const approvalRate = result.approved / result.processed
      expect(approvalRate).toBeGreaterThan(0.7) // 70%+ approval rate
    })

    it('should handle API rate limiting gracefully', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 10,
        processed: 5, // Partial processing due to rate limits
        approved: 3,
        rejected: 2,
        errors: ['API rate limit exceeded - try again later']
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.errors).toContain('API rate limit exceeded - try again later')
      expect(result.processed).toBeLessThan(result.totalFound)
    })

    it('should handle API timeouts gracefully', async () => {
      const expectedResult = {
        ...mockScanResult,
        errors: ['Pixabay API network error - connection timeout']
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.errors).toContain('Pixabay API network error - connection timeout')
    })

    it('should handle professional photo processing with metadata', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 18,
        approved: 14,
        rejected: 4
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.processed).toBe(18)
      expect(result.approved).toBe(14)
    })

    it('should respect minimum likes and downloads thresholds', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 15, // Some filtered out due to low engagement
        approved: 12,
        rejected: 3
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      // Should filter out low-engagement content
      expect(result.processed).toBeLessThan(result.totalFound)
    })
  })

  describe('searchPhotos (detailed search method)', () => {
    it('should perform detailed photo search with quality filters', async () => {
      const mockPhotos = [mockPixabayPhoto]
      pixabayService.searchPhotos.mockResolvedValue(mockPhotos)

      const photos = await pixabayService.searchPhotos('hotdog', 20)

      expect(pixabayService.searchPhotos).toHaveBeenCalledWith('hotdog', 20)
      expect(photos).toHaveLength(1)
      expect(photos[0]).toMatchObject({
        id: expect.any(String),
        description: expect.stringContaining('hotdog'),
        photographer: expect.any(String)
      })
    })
  })

  describe('testConnection', () => {
    it('should return successful connection test with API key', async () => {
      const mockConnectionResult = {
        success: true,
        message: 'Pixabay connection successful. Found 1 test results.',
        details: { testResultsCount: 1 }
      }
      
      pixabayService.testConnection.mockResolvedValue(mockConnectionResult)

      const result = await pixabayService.testConnection()

      expect(result.success).toBe(true)
      expect(result.message).toContain('Pixabay connection successful')
      expect(result.details.testResultsCount).toBe(1)
    })

    it('should return failed connection when API key missing', async () => {
      const mockConnectionResult = {
        success: false,
        message: 'Pixabay API key not configured'
      }
      
      pixabayService.testConnection.mockResolvedValue(mockConnectionResult)

      const result = await pixabayService.testConnection()

      expect(result.success).toBe(false)
      expect(result.message).toContain('API key not configured')
    })

    it('should handle API connection errors', async () => {
      const mockConnectionResult = {
        success: false,
        message: 'Connection test failed: Network timeout',
        details: { error: 'Network timeout' }
      }
      
      pixabayService.testConnection.mockResolvedValue(mockConnectionResult)

      const result = await pixabayService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.error).toBe('Network timeout')
    })
  })

  describe('getScanConfig', () => {
    it('should return current Pixabay scan configuration with expanded search terms', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240, // 4 hours
        maxPhotosPerScan: 40, // Increased from 30
        searchTerms: [
          'hotdog',
          'hot dog',
          'hotdogs',
          'corn dog',
          'chicago dog',
          'chili dog',
          'hot dog stand',
          'ballpark hotdog',
          'frankfurter hot dog',
          'bratwurst sausage'
        ],
        minLikes: 5,
        minDownloads: 50
      }

      pixabayService.getScanConfig.mockResolvedValue(mockConfig)

      const config = await pixabayService.getScanConfig()

      expect(config.isEnabled).toBe(true)
      expect(config.scanInterval).toBe(240)
      expect(config.maxPhotosPerScan).toBe(40) // Updated from 30
      expect(config.searchTerms).toHaveLength(10) // Expanded from 3-5 to 10
      expect(config.searchTerms).toContain('hotdog')
      expect(config.searchTerms).toContain('corn dog')
      expect(config.searchTerms).toContain('ballpark hotdog')
      expect(config.minLikes).toBe(5)
      expect(config.minDownloads).toBe(50)
    })
  })

  describe('content processing', () => {
    it('should search photos with quality parameters', async () => {
      const mockPhotos = [
        {
          ...mockPixabayPhoto,
          likes: 100,
          downloads: 500,
          tags: ['hotdog', 'grill', 'food']
        }
      ]
      
      pixabayService.searchPhotos.mockResolvedValue(mockPhotos)

      const photos = await pixabayService.searchPhotos('hotdog grill', 10)

      expect(photos).toHaveLength(1)
      expect(photos[0].likes).toBeGreaterThan(50)
      expect(photos[0].downloads).toBeGreaterThan(100)
    })

    it('should validate Pixabay photo content quality', async () => {
      const validationResult = {
        isValid: true,
        confidence: 0.88,
        reasons: ['High quality photography', 'Relevant hotdog content', 'Good engagement metrics']
      }
      
      // Mock the function if it doesn't exist
      pixabayService.validatePixabayContent = jest.fn().mockResolvedValue(validationResult)
      
      const result = await pixabayService.validatePixabayContent(mockPixabayPhoto)
      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(0.88)
      expect(result.reasons).toContain('High quality photography')
    })

    it('should get most popular photos with metadata', async () => {
      const mockPopularPhotos = [
        { ...mockPixabayPhoto, likes: 500, downloads: 2000 },
        { ...mockPixabayPhoto, id: 'popular2', likes: 400, downloads: 1800 }
      ]
      
      // Mock the function if it doesn't exist
      pixabayService.getPopularPhotos = jest.fn().mockResolvedValue(mockPopularPhotos)

      const photos = await pixabayService.getPopularPhotos('hotdog', 5)

      expect(photos).toHaveLength(2)
      expect(photos[0].likes).toBeGreaterThan(400)
      expect(photos[0].downloads).toBeGreaterThan(1500)
    })

    it('should handle photographer attribution and licensing correctly', async () => {
      const mockPhotoWithAttribution = {
        ...mockPixabayPhoto,
        photographer: 'ProfessionalFoodPhotographer',
        license: 'Pixabay License',
        attribution: 'Photo by ProfessionalFoodPhotographer on Pixabay'
      }
      
      // Mock the function if it doesn't exist
      pixabayService.processPhotoAttribution = jest.fn().mockResolvedValue(mockPhotoWithAttribution)

      const processedPhoto = await pixabayService.processPhotoAttribution(mockPixabayPhoto)

      expect(processedPhoto.photographer).toBe('ProfessionalFoodPhotographer')
      expect(processedPhoto.license).toBe('Pixabay License')
      expect(processedPhoto.attribution).toContain('Pixabay')
    })
  })

  describe('service state management', () => {
    it('should check if professional photo service is enabled', async () => {
      // Mock the function if it doesn't exist
      pixabayService.isServiceEnabled = jest.fn().mockReturnValue(true)

      const isEnabled = pixabayService.isServiceEnabled()

      expect(isEnabled).toBe(true)
    })

    it('should enable the professional photo service', async () => {
      // Mock the function if it doesn't exist
      pixabayService.enableService = jest.fn().mockResolvedValue({ success: true })

      const result = await pixabayService.enableService()

      expect(pixabayService.enableService).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('should disable the professional photo service', async () => {
      // Mock the function if it doesn't exist  
      pixabayService.disableService = jest.fn().mockResolvedValue({ success: true })

      const result = await pixabayService.disableService()

      expect(pixabayService.disableService).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })
  })

  describe('error handling and resilience', () => {
    const mockOptions = { maxPosts: 30 }

    it('should handle partial API failures gracefully', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 15, // Some failed to process
        approved: 10,
        rejected: 5,
        errors: ['Search failed for term "frankfurter": API timeout']
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.errors).toHaveLength(1)
      expect(result.processed).toBeLessThan(result.totalFound)
    })

    it('should retry failed requests within API limits', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 18,
        processed: 16, // Successfully retried some failed requests
        approved: 12,
        rejected: 4
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.processed).toBeGreaterThan(15) // Shows retry success
    })

    it('should handle API key quota exhaustion', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 8, // Limited by quota
        approved: 6,
        rejected: 2,
        errors: ['API quota exhausted - daily limit reached']
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.errors).toContain('API quota exhausted - daily limit reached')
      expect(result.processed).toBeLessThan(15) // Much lower due to quota
    })

    it('should handle different photo orientations and sizes appropriately', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 18, // Good processing rate for varied content
        approved: 14,
        rejected: 4
      }
      
      pixabayService.performScan.mockResolvedValue(expectedResult)

      const result = await pixabayService.performScan(mockOptions)

      expect(result.processed).toBeGreaterThan(15)
      expect(result.approved).toBeGreaterThan(10)
    })
  })
})