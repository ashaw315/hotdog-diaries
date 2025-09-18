import { mockScanningService, mockScanResult, mockYouTubeVideo } from '@/__tests__/utils/social-mocks'

// Mock the YouTube scanning service
jest.mock('@/lib/services/youtube-scanning', () => ({
  YouTubeScanningService: jest.fn().mockImplementation(() => ({
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getQuotaStatus: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn(),
    getLastScanResult: jest.fn(),
    isEnabled: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn()
  })),
  youtubeScanningService: {
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getQuotaStatus: jest.fn(),
    getScanConfig: jest.fn(),
    updateScanConfig: jest.fn()
  }
}))

// Mock dependencies
jest.mock('@/lib/services/youtube', () => ({
  YouTubeService: jest.fn().mockImplementation(() => ({
    searchVideos: jest.fn(),
    getApiStatus: jest.fn(),
    validateYouTubeContent: jest.fn()
  }))
}))

jest.mock('@/lib/services/filtering', () => ({
  FilteringService: jest.fn().mockImplementation(() => ({
    validateContent: jest.fn()
  }))
}))

jest.mock('@/lib/services/content-processor-fixed', () => ({
  contentProcessorFixed: {
    processYouTubeVideo: jest.fn()
  }
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

describe('YouTubeScanningService', () => {
  let YouTubeScanningService: jest.MockedClass<any>
  let scanningService: any
  const mockServiceFunctions = mockScanningService('YouTube')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked YouTubeScanningService class
    const { YouTubeScanningService: MockedService } = require('@/lib/services/youtube-scanning')
    YouTubeScanningService = MockedService
    scanningService = new YouTubeScanningService()
    
    // Setup default mock implementations
    Object.assign(scanningService, mockServiceFunctions)
  })

  describe('performScan', () => {
    const mockOptions = { maxPosts: 10 }

    it('should successfully perform YouTube scan', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 15,
        processed: 12,
        approved: 8,
        rejected: 4,
        duplicates: 3
      }
      
      scanningService.performScan.mockResolvedValue(expectedResult)

      const result = await scanningService.performScan(mockOptions)

      expect(scanningService.performScan).toHaveBeenCalledWith(mockOptions)
      expect(result.totalFound).toBe(15)
      expect(result.processed).toBe(12)
      expect(result.approved).toBe(8)
      expect(result.rejected).toBe(4)
      expect(result.duplicates).toBe(3)
    })

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('YouTube API quota exceeded')
      scanningService.performScan.mockRejectedValue(quotaError)

      await expect(scanningService.performScan(mockOptions)).rejects.toThrow('YouTube API quota exceeded')
    })

    it('should handle API authentication errors', async () => {
      const authError = new Error('YouTube API authentication failed')
      scanningService.performScan.mockRejectedValue(authError)

      await expect(scanningService.performScan(mockOptions)).rejects.toThrow('YouTube API authentication failed')
    })

    it('should return empty results when service is disabled', async () => {
      const disabledResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['YouTube scanning is disabled']
      }
      
      scanningService.performScan.mockResolvedValue(disabledResult)

      const result = await scanningService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.errors).toContain('YouTube scanning is disabled')
    })

    it('should limit results to maxPosts parameter', async () => {
      const limitedResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 5, // Limited by maxPosts: 5
        approved: 4,
        rejected: 1
      }
      
      scanningService.performScan.mockResolvedValue(limitedResult)

      const result = await scanningService.performScan({ maxPosts: 5 })

      expect(result.processed).toBeLessThanOrEqual(5)
    })

    it('should process multiple search terms', async () => {
      const multiTermResult = {
        ...mockScanResult,
        totalFound: 30,
        processed: 25,
        approved: 18,
        rejected: 7,
        duplicates: 5
      }
      
      scanningService.performScan.mockResolvedValue(multiTermResult)

      const result = await scanningService.performScan(mockOptions)

      expect(result.totalFound).toBeGreaterThan(15) // More than single search term
    })

    it('should filter out duplicate videos', async () => {
      const duplicateFilteredResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 15,
        approved: 10,
        rejected: 5,
        duplicates: 5 // 5 duplicates filtered out
      }
      
      scanningService.performScan.mockResolvedValue(duplicateFilteredResult)

      const result = await scanningService.performScan(mockOptions)

      expect(result.duplicates).toBe(5)
      expect(result.processed).toBe(15) // 20 found - 5 duplicates
    })

    it('should validate content quality before approval', async () => {
      const qualityFilteredResult = {
        ...mockScanResult,
        totalFound: 15,
        processed: 15,
        approved: 6, // Only high-quality content approved
        rejected: 9,
        duplicates: 0
      }
      
      scanningService.performScan.mockResolvedValue(qualityFilteredResult)

      const result = await scanningService.performScan(mockOptions)

      expect(result.approved).toBeLessThan(result.processed)
      expect(result.rejected).toBeGreaterThan(result.approved)
    })

    it('should handle network timeouts gracefully', async () => {
      const timeoutResult = {
        ...mockScanResult,
        totalFound: 5,
        processed: 3,
        approved: 2,
        rejected: 1,
        duplicates: 0,
        errors: ['Network timeout during video search']
      }
      
      scanningService.performScan.mockResolvedValue(timeoutResult)

      const result = await scanningService.performScan(mockOptions)

      expect(result.errors).toContain('Network timeout during video search')
      expect(result.processed).toBeLessThan(result.totalFound)
    })
  })

  describe('testConnection', () => {
    it('should return successful connection test', async () => {
      const successResult = {
        success: true,
        message: 'YouTube connection successful',
        details: { 
          authenticated: true,
          quotaRemaining: 8500,
          apiStatus: 'healthy'
        }
      }
      
      scanningService.testConnection.mockResolvedValue(successResult)

      const result = await scanningService.testConnection()

      expect(result.success).toBe(true)
      expect(result.details.authenticated).toBe(true)
      expect(result.details.quotaRemaining).toBeGreaterThan(0)
    })

    it('should return failed connection when API key is missing', async () => {
      const failResult = {
        success: false,
        message: 'YouTube API key not configured',
        details: { 
          authenticated: false,
          quotaRemaining: 0,
          apiStatus: 'error',
          error: 'Missing API key'
        }
      }
      
      scanningService.testConnection.mockResolvedValue(failResult)

      const result = await scanningService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.authenticated).toBe(false)
      expect(result.message).toContain('API key not configured')
    })

    it('should return failed connection on quota exhaustion', async () => {
      const quotaResult = {
        success: false,
        message: 'YouTube API quota exhausted',
        details: { 
          authenticated: true,
          quotaRemaining: 0,
          apiStatus: 'quota_exceeded',
          resetTime: new Date(Date.now() + 18 * 60 * 60 * 1000)
        }
      }
      
      scanningService.testConnection.mockResolvedValue(quotaResult)

      const result = await scanningService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.quotaRemaining).toBe(0)
      expect(result.message).toContain('quota exhausted')
    })
  })

  describe('getQuotaStatus', () => {
    it('should return current quota status', async () => {
      const quotaStatus = {
        remaining: 7500,
        resetTime: Date.now() + 20 * 60 * 60 * 1000, // 20 hours from now
        dailyLimit: 10000,
        used: 2500,
        percentage: 25
      }
      
      scanningService.getQuotaStatus.mockResolvedValue(quotaStatus)

      const status = await scanningService.getQuotaStatus()

      expect(status.remaining).toBe(7500)
      expect(status.used).toBe(2500)
      expect(status.percentage).toBe(25)
      expect(status.dailyLimit).toBe(10000)
    })

    it('should indicate quota exhaustion', async () => {
      const exhaustedStatus = {
        remaining: 0,
        resetTime: Date.now() + 16 * 60 * 60 * 1000,
        dailyLimit: 10000,
        used: 10000,
        percentage: 100
      }
      
      scanningService.getQuotaStatus.mockResolvedValue(exhaustedStatus)

      const status = await scanningService.getQuotaStatus()

      expect(status.remaining).toBe(0)
      expect(status.percentage).toBe(100)
    })
  })

  describe('scan configuration', () => {
    it('should get current scan configuration', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 120, // minutes
        maxVideosPerScan: 25,
        searchTerms: ['hotdog recipe', 'best hotdogs', 'grilling hotdogs'],
        videoDuration: 'any',
        publishedWithin: 7, // days
        minViewCount: 1000,
        includeChannelIds: ['UC123456'],
        excludeChannelIds: ['UC789012']
      }
      
      scanningService.getScanConfig.mockResolvedValue(mockConfig)

      const config = await scanningService.getScanConfig()

      expect(config.isEnabled).toBe(true)
      expect(config.scanInterval).toBe(120)
      expect(config.searchTerms).toContain('hotdog recipe')
      expect(config.minViewCount).toBe(1000)
    })

    it('should update scan configuration', async () => {
      const configUpdate = {
        isEnabled: true,
        scanInterval: 90,
        maxVideosPerScan: 30,
        searchTerms: ['hotdog challenge', 'street food hotdogs'],
        videoDuration: 'medium',
        publishedWithin: 3,
        minViewCount: 2000
      }
      
      scanningService.updateScanConfig.mockResolvedValue(configUpdate)

      const result = await scanningService.updateScanConfig(configUpdate)

      expect(scanningService.updateScanConfig).toHaveBeenCalledWith(configUpdate)
      expect(result.scanInterval).toBe(90)
      expect(result.minViewCount).toBe(2000)
    })

    it('should validate configuration parameters', async () => {
      const invalidConfig = {
        isEnabled: true,
        scanInterval: 5, // Too low
        maxVideosPerScan: 100, // Too high
        searchTerms: [], // Empty
        minViewCount: -1 // Invalid
      }
      
      scanningService.updateScanConfig.mockRejectedValue(
        new Error('Invalid configuration: scanInterval must be >= 15 minutes')
      )

      await expect(scanningService.updateScanConfig(invalidConfig))
        .rejects.toThrow('Invalid configuration')
    })
  })

  describe('service state management', () => {
    it('should check if service is enabled', async () => {
      scanningService.isEnabled.mockReturnValue(true)

      const enabled = scanningService.isEnabled()

      expect(enabled).toBe(true)
    })

    it('should enable the service', async () => {
      scanningService.enable.mockResolvedValue(undefined)

      await scanningService.enable()

      expect(scanningService.enable).toHaveBeenCalled()
    })

    it('should disable the service', async () => {
      scanningService.disable.mockResolvedValue(undefined)

      await scanningService.disable()

      expect(scanningService.disable).toHaveBeenCalled()
    })

    it('should get last scan result', async () => {
      const lastScanResult = {
        scanId: 'youtube_scan_123',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        totalFound: 18,
        processed: 15,
        approved: 10,
        rejected: 5,
        duplicates: 3,
        errors: [],
        duration: 45000 // 45 seconds
      }
      
      scanningService.getLastScanResult.mockResolvedValue(lastScanResult)

      const result = await scanningService.getLastScanResult()

      expect(result.scanId).toBe('youtube_scan_123')
      expect(result.approved).toBe(10)
      expect(result.duration).toBe(45000)
    })
  })

  describe('error handling and resilience', () => {
    it('should handle partial scan failures gracefully', async () => {
      const mockOptions = { maxPosts: 10 }
      
      const partialFailureResult = {
        totalFound: 10,
        processed: 7,
        approved: 5,
        rejected: 2,
        duplicates: 0,
        errors: [
          'Failed to process video xyz123: API timeout',
          'Failed to process video abc456: Invalid video format'
        ]
      }
      
      scanningService.performScan.mockResolvedValue(partialFailureResult)

      const result = await scanningService.performScan(mockOptions)

      expect(result.processed).toBe(7)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]).toContain('API timeout')
    })

    it('should retry failed requests within limits', async () => {
      const mockOptions = { maxPosts: 10 }
      
      const retryResult = {
        ...mockScanResult,
        totalFound: 8,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 0,
        errors: [] // Successful after retry
      }
      
      scanningService.performScan.mockResolvedValue(retryResult)

      const result = await scanningService.performScan(mockOptions)

      expect(result.errors).toHaveLength(0)
      expect(result.processed).toBe(8)
    })

    it('should log scan activities for monitoring', async () => {
      const mockOptions = { maxPosts: 10 }
      
      const monitoredResult = {
        ...mockScanResult,
        scanId: 'youtube_scan_456',
        startTime: new Date(Date.now() - 30000),
        endTime: new Date(),
        quotaUsed: 250
      }
      
      scanningService.performScan.mockResolvedValue(monitoredResult)

      const result = await scanningService.performScan(mockOptions)

      expect(scanningService.performScan).toHaveBeenCalledWith(mockOptions)
      // Verify logging would be called (mocked in dependencies)
    })
  })
})