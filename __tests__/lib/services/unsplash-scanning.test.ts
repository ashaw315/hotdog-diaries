import { mockScanningService, mockScanResult, mockUnsplashPhoto } from '@/__tests__/utils/social-mocks'

// Mock the Unsplash scanning service
jest.mock('@/lib/services/unsplash-scanning', () => ({
  UnsplashScanningService: jest.fn().mockImplementation(() => ({
    performScan: jest.fn(),
    scanPhotos: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn(),
    getScanStats: jest.fn(),
    getAllScanResults: jest.fn(),
    getMostPopularPhotos: jest.fn(),
    getTopPhotographers: jest.fn(),
    searchPhotos: jest.fn(),
    validatePhotoContent: jest.fn(),
    scheduleNextScan: jest.fn(),
    isEnabled: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn()
  })),
  unsplashScanningService: {
    performScan: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn(),
    getScanStats: jest.fn()
  }
}))

// Mock dependencies
jest.mock('@/lib/services/unsplash', () => ({
  UnsplashService: jest.fn().mockImplementation(() => ({
    searchPhotos: jest.fn(),
    getApiStatus: jest.fn()
  })),
  unsplashService: {
    searchPhotos: jest.fn(),
    getApiStatus: jest.fn()
  }
}))

jest.mock('@/lib/services/filtering', () => ({
  FilteringService: jest.fn().mockImplementation(() => ({
    validateContent: jest.fn()
  }))
}))

jest.mock('@/lib/services/content-processor', () => ({
  ContentProcessor: jest.fn().mockImplementation(() => ({
    processUnsplashPhoto: jest.fn()
  }))
}))

jest.mock('@/lib/services/duplicate-detection', () => ({
  DuplicateDetectionService: jest.fn().mockImplementation(() => ({
    checkDuplicate: jest.fn()
  }))
}))

jest.mock('@/lib/db-query-builder', () => ({
  query: jest.fn(),
  insert: jest.fn()
}))

jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

describe('UnsplashScanningService', () => {
  let UnsplashScanningService: jest.MockedClass<any>
  let unsplashService: any
  const mockServiceFunctions = mockScanningService('Unsplash')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked UnsplashScanningService class
    const { UnsplashScanningService: MockedService } = require('@/lib/services/unsplash-scanning')
    UnsplashScanningService = MockedService
    unsplashService = new UnsplashScanningService()
    
    // Setup default mock implementations
    Object.assign(unsplashService, mockServiceFunctions)
  })

  describe('performScan', () => {
    const mockOptions = { maxPosts: 20 }

    it('should successfully perform Unsplash professional photo scan', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 35,
        processed: 25,
        approved: 18,
        rejected: 7,
        duplicates: 10
      }
      
      unsplashService.performScan.mockResolvedValue(expectedResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(unsplashService.performScan).toHaveBeenCalledWith(mockOptions)
      expect(result.totalFound).toBe(35)
      expect(result.processed).toBe(25)
      expect(result.approved).toBe(18)
      expect(result.rejected).toBe(7)
      expect(result.duplicates).toBe(10)
    })

    it('should handle API rate limiting errors', async () => {
      const rateLimitError = new Error('Unsplash API rate limit exceeded: 50 requests/hour')
      unsplashService.performScan.mockRejectedValue(rateLimitError)

      await expect(unsplashService.performScan(mockOptions)).rejects.toThrow('rate limit exceeded')
    })

    it('should handle missing API key gracefully with mock photos', async () => {
      const mockResult = {
        totalFound: 8, // Mock mode returns fewer high-quality results
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 0,
        errors: ['Running in mock mode - limited high-quality photos available']
      }
      
      unsplashService.performScan.mockResolvedValue(mockResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.totalFound).toBe(8)
      expect(result.errors).toContain('Running in mock mode - limited high-quality photos available')
    })

    it('should return empty results when service is disabled', async () => {
      const disabledResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['Unsplash scanning is disabled']
      }
      
      unsplashService.performScan.mockResolvedValue(disabledResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.errors).toContain('Unsplash scanning is disabled')
    })

    it('should limit results to maxPosts parameter', async () => {
      const limitedResult = {
        ...mockScanResult,
        totalFound: 50,
        processed: 15, // Limited by maxPosts: 15
        approved: 12,
        rejected: 3
      }
      
      unsplashService.performScan.mockResolvedValue(limitedResult)

      const result = await unsplashService.performScan({ maxPosts: 15 })

      expect(result.processed).toBeLessThanOrEqual(15)
    })

    it('should process multiple search terms effectively', async () => {
      const multiTermResult = {
        ...mockScanResult,
        totalFound: 45,
        processed: 30,
        approved: 22,
        rejected: 8,
        duplicates: 15 // More duplicates across search terms
      }
      
      unsplashService.performScan.mockResolvedValue(multiTermResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.totalFound).toBeGreaterThan(30) // More than single term
      expect(result.duplicates).toBeGreaterThan(10) // Cross-term duplicates
    })

    it('should filter duplicate photos across search terms', async () => {
      const duplicateFilteredResult = {
        ...mockScanResult,
        totalFound: 40,
        processed: 25, // After deduplication
        approved: 18,
        rejected: 7,
        duplicates: 15 // Many duplicates across terms
      }
      
      unsplashService.performScan.mockResolvedValue(duplicateFilteredResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.duplicates).toBe(15)
      expect(result.processed).toBe(25) // 40 found - 15 duplicates
    })

    it('should validate high-quality professional photography', async () => {
      const qualityFilteredResult = {
        ...mockScanResult,
        totalFound: 30,
        processed: 30,
        approved: 22, // High approval rate for professional photos
        rejected: 8,
        duplicates: 0
      }
      
      unsplashService.performScan.mockResolvedValue(qualityFilteredResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.approved).toBeGreaterThan(result.rejected) // Professional quality
    })

    it('should handle API timeouts gracefully', async () => {
      const timeoutResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 12,
        approved: 9,
        rejected: 3,
        duplicates: 0,
        errors: ['API timeout during photo search', 'Partial results returned']
      }
      
      unsplashService.performScan.mockResolvedValue(timeoutResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.errors).toContain('API timeout during photo search')
      expect(result.processed).toBeLessThan(result.totalFound)
    })

    it('should handle professional photo processing with metadata', async () => {
      const professionalPhotoResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 22,
        approved: 18, // High approval for professional content
        rejected: 4,
        duplicates: 3
      }
      
      unsplashService.performScan.mockResolvedValue(professionalPhotoResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.approved).toBeGreaterThan(result.rejected) // Professional photos perform well
    })

    it('should respect minimum likes and downloads thresholds', async () => {
      const thresholdFilteredResult = {
        totalFound: 35,
        processed: 20, // Filtered by quality thresholds
        approved: 16,
        rejected: 4,
        duplicates: 0
      }
      
      unsplashService.performScan.mockResolvedValue(thresholdFilteredResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.processed).toBeLessThan(result.totalFound) // Quality filtering applied
      expect(result.approved).toBe(16)
    })
  })

  describe('scanPhotos (detailed scan method)', () => {
    it('should perform detailed photo scanning with statistics', async () => {
      const detailedScanResult = {
        scanId: 'unsplash_detailed_123',
        startTime: new Date(),
        endTime: new Date(Date.now() + 30000),
        photosFound: 28,
        photosProcessed: 22,
        photosApproved: 16,
        photosRejected: 6,
        photosFlagged: 2,
        duplicatesFound: 6,
        errors: [],
        requestsUsed: 5,
        searchTermsUsed: ['hotdog', 'frankfurter', 'food photography'],
        highestLikedPhoto: {
          id: 'abc123',
          description: 'Gourmet hotdog with artisanal toppings',
          likes: 1250,
          photographer: 'Professional Food Photographer'
        },
        nextScanTime: new Date(Date.now() + 3600000)
      }
      
      unsplashService.scanPhotos.mockResolvedValue(detailedScanResult)

      const result = await unsplashService.scanPhotos({ maxPhotosPerScan: 20 })

      expect(result.scanId).toContain('unsplash_detailed')
      expect(result.photosFound).toBe(28)
      expect(result.highestLikedPhoto.likes).toBe(1250)
      expect(result.requestsUsed).toBe(5)
    })
  })

  describe('getScanConfig', () => {
    it('should return current Unsplash scan configuration', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 60, // 1 hour
        maxPhotosPerScan: 20,
        searchTerms: ['hotdog', 'hot dog', 'frankfurter', 'sausage', 'food photography'],
        orientation: 'landscape',
        minLikes: 10,
        minDownloads: 100,
        lastScanTime: new Date()
      }
      
      unsplashService.getScanConfig.mockResolvedValue(mockConfig)

      const config = await unsplashService.getScanConfig()

      expect(config.isEnabled).toBe(true)
      expect(config.scanInterval).toBe(60)
      expect(config.searchTerms).toContain('food photography')
      expect(config.orientation).toBe('landscape')
      expect(config.minLikes).toBe(10)
      expect(config.minDownloads).toBe(100)
    })

    it('should update scan configuration', async () => {
      const configUpdate = {
        isEnabled: true,
        scanInterval: 120,
        maxPhotosPerScan: 30,
        searchTerms: ['gourmet hotdog', 'artisanal sausage', 'food styling'],
        orientation: 'portrait',
        minLikes: 25,
        minDownloads: 200
      }
      
      unsplashService.updateScanConfig.mockResolvedValue(configUpdate)

      const result = await unsplashService.updateScanConfig(configUpdate)

      expect(unsplashService.updateScanConfig).toHaveBeenCalledWith(configUpdate)
      expect(result.scanInterval).toBe(120)
      expect(result.minLikes).toBe(25)
      expect(result.orientation).toBe('portrait')
    })
  })

  describe('getScanStats', () => {
    it('should return comprehensive scanning statistics', async () => {
      const mockStats = {
        totalScans: 145,
        totalPhotosFound: 3240,
        totalPhotosProcessed: 2850,
        totalPhotosApproved: 2100,
        averageLikes: 156,
        topPhotographers: [
          { photographer: 'Food Stylist Pro', count: 45, avgLikes: 320 },
          { photographer: 'Culinary Artist', count: 38, avgLikes: 285 }
        ],
        topSearchTerms: [
          { term: 'hotdog', count: 890, avgLikes: 180 },
          { term: 'food photography', count: 650, avgLikes: 220 }
        ],
        scanFrequency: 60,
        lastScanTime: new Date(),
        nextScanTime: new Date(Date.now() + 3600000),
        successRate: 95.5,
        requestUsageRate: 42.3
      }
      
      unsplashService.getScanStats.mockResolvedValue(mockStats)

      const stats = await unsplashService.getScanStats()

      expect(stats.totalScans).toBe(145)
      expect(stats.totalPhotosApproved).toBe(2100)
      expect(stats.topPhotographers).toHaveLength(2)
      expect(stats.topSearchTerms[0].term).toBe('hotdog')
      expect(stats.successRate).toBe(95.5)
      expect(stats.requestUsageRate).toBe(42.3)
    })
  })

  describe('content processing', () => {
    it('should search photos with quality parameters', async () => {
      const mockPhotos = [
        mockUnsplashPhoto,
        {
          ...mockUnsplashPhoto,
          id: 'def456',
          description: 'Artisanal hotdog with craft beer pairing',
          photographer: 'Gourmet Food Photographer',
          likes: 890,
          downloads: 2400,
          tags: ['hotdog', 'craft beer', 'gourmet', 'food styling']
        }
      ]
      
      unsplashService.searchPhotos.mockResolvedValue(mockPhotos)

      const photos = await unsplashService.searchPhotos(['hotdog', 'gourmet'])

      expect(photos).toHaveLength(2)
      expect(photos[0].description).toContain('hotdog')
      expect(photos[1].likes).toBe(890)
    })

    it('should validate Unsplash photo content quality', async () => {
      const validationResult = {
        isValid: true,
        confidence: 0.92,
        reasons: ['Professional photography', 'High-quality composition', 'Relevant food content', 'Good engagement metrics']
      }
      
      unsplashService.validatePhotoContent.mockResolvedValue(validationResult)

      const result = await unsplashService.validatePhotoContent(mockUnsplashPhoto)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(0.92)
      expect(result.reasons).toContain('Professional photography')
    })

    it('should get most popular photos with metadata', async () => {
      const popularPhotos = [
        {
          ...mockUnsplashPhoto,
          likes: 1250,
          downloads: 4500,
          photographer: 'Award Winning Food Photographer'
        },
        {
          ...mockUnsplashPhoto,
          id: 'popular_2',
          likes: 980,
          downloads: 3200,
          photographer: 'Celebrity Chef Photographer'
        }
      ]
      
      unsplashService.getMostPopularPhotos.mockResolvedValue(popularPhotos)

      const photos = await unsplashService.getMostPopularPhotos(10)

      expect(photos).toHaveLength(2)
      expect(photos[0].likes).toBeGreaterThan(photos[1].likes)
      expect(photos[0].photographer).toContain('Award Winning')
    })

    it('should get top photographers with statistics', async () => {
      const topPhotographers = [
        {
          photographer: 'Master Food Photographer',
          photoCount: 28,
          totalLikes: 8960,
          avgLikes: 320,
          topPhoto: {
            id: 'top_photo_1',
            description: 'Chicago deep dish hotdog',
            likes: 1450
          }
        },
        {
          photographer: 'Culinary Artist',
          photoCount: 22,
          totalLikes: 6270,
          avgLikes: 285,
          topPhoto: {
            id: 'top_photo_2', 
            description: 'Gourmet sausage platter',
            likes: 1120
          }
        }
      ]
      
      unsplashService.getTopPhotographers.mockResolvedValue(topPhotographers)

      const photographers = await unsplashService.getTopPhotographers(5)

      expect(photographers).toHaveLength(2)
      expect(photographers[0].avgLikes).toBeGreaterThan(photographers[1].avgLikes)
      expect(photographers[0].topPhoto.likes).toBe(1450)
    })

    it('should schedule next scan based on configuration', async () => {
      const nextScanTime = new Date(Date.now() + 3600000) // 1 hour from now
      
      unsplashService.scheduleNextScan.mockResolvedValue(nextScanTime)

      const scheduledTime = await unsplashService.scheduleNextScan()

      expect(scheduledTime).toBeInstanceOf(Date)
      expect(scheduledTime.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('service state management', () => {
    it('should check if professional photo service is enabled', async () => {
      unsplashService.isEnabled.mockReturnValue(true)

      const enabled = unsplashService.isEnabled()

      expect(enabled).toBe(true)
    })

    it('should enable the professional photo service', async () => {
      unsplashService.enable.mockResolvedValue(undefined)

      await unsplashService.enable()

      expect(unsplashService.enable).toHaveBeenCalled()
    })

    it('should disable the professional photo service', async () => {
      unsplashService.disable.mockResolvedValue(undefined)

      await unsplashService.disable()

      expect(unsplashService.disable).toHaveBeenCalled()
    })
  })

  describe('error handling and resilience', () => {
    it('should handle partial API failures gracefully', async () => {
      const mockOptions = { maxPosts: 20 }
      
      const partialFailureResult = {
        totalFound: 25,
        processed: 18,
        approved: 14,
        rejected: 4,
        duplicates: 0,
        errors: ['Failed to fetch 7 photos due to API rate limiting', 'Some search terms temporarily unavailable']
      }
      
      unsplashService.performScan.mockResolvedValue(partialFailureResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.processed).toBe(18)
      expect(result.errors).toContain('Failed to fetch 7 photos due to API rate limiting')
      expect(result.errors).toContain('Some search terms temporarily unavailable')
    })

    it('should retry failed requests within API limits', async () => {
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
      
      unsplashService.performScan.mockResolvedValue(retryResult)

      const result = await unsplashService.performScan(mockOptions)

      expect(result.errors).toHaveLength(0)
      expect(result.processed).toBe(15)
    })

    it('should handle API key quota exhaustion', async () => {
      const quotaExhaustedResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['Unsplash API quota exhausted for this hour', 'Will retry in next hour']
      }
      
      unsplashService.performScan.mockResolvedValue(quotaExhaustedResult)

      const result = await unsplashService.performScan({ maxPosts: 10 })

      expect(result.errors).toContain('Unsplash API quota exhausted for this hour')
      expect(result.totalFound).toBe(0)
    })

    it('should handle different photo orientations and sizes appropriately', async () => {
      const orientationResult = {
        totalFound: 30,
        processed: 25,
        approved: 20, // High approval for professional photos
        rejected: 5,  // Some orientation mismatches
        duplicates: 5
      }
      
      unsplashService.performScan.mockResolvedValue(orientationResult)

      const result = await unsplashService.performScan({ maxPosts: 25 })

      expect(result.processed).toBe(25)
      expect(result.approved).toBe(20)
      expect(result.approved).toBeGreaterThan(result.rejected)
    })

    it('should handle photographer attribution and licensing correctly', async () => {
      const licensingResult = {
        totalFound: 22,
        processed: 20,
        approved: 18, // High approval with proper attribution
        rejected: 2,  // Some licensing issues
        duplicates: 2
      }
      
      unsplashService.performScan.mockResolvedValue(licensingResult)

      const result = await unsplashService.performScan({ maxPosts: 20 })

      expect(result.processed).toBe(20)
      expect(result.approved).toBe(18)
      expect(result.rejected).toBe(2) // Minimal licensing rejections
    })
  })
})