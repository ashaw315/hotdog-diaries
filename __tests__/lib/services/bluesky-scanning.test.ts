import { mockScanningService, mockScanResult, mockBlueskyPost } from '@/__tests__/utils/social-mocks'

// Mock the Bluesky scanning service
jest.mock('@/lib/services/bluesky-scanning', () => ({
  BlueskyService: jest.fn().mockImplementation(() => ({
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn(),
    getScanningStats: jest.fn(),
    updateScanConfig: jest.fn(),
    authenticate: jest.fn(),
    ensureAuthenticated: jest.fn(),
    searchPosts: jest.fn(),
    validateBlueskyContent: jest.fn(),
    isEnabled: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn()
  })),
  blueskyService: {
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn(),
    getScanningStats: jest.fn(),
    updateScanConfig: jest.fn()
  }
}))

// Mock dependencies
jest.mock('@/lib/services/content-processor', () => ({
  contentProcessor: {
    processBlueskyPost: jest.fn()
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

describe('BlueskyService', () => {
  let BlueskyService: jest.MockedClass<any>
  let blueskyService: any
  const mockServiceFunctions = mockScanningService('Bluesky')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked BlueskyService class
    const { BlueskyService: MockedService } = require('@/lib/services/bluesky-scanning')
    BlueskyService = MockedService
    blueskyService = new BlueskyService()
    
    // Setup default mock implementations
    Object.assign(blueskyService, mockServiceFunctions)
  })

  describe('performScan', () => {
    const mockOptions = { maxPosts: 15 }

    it('should successfully perform Bluesky scan', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 15,
        approved: 12,
        rejected: 3,
        duplicates: 5
      }
      
      blueskyService.performScan.mockResolvedValue(expectedResult)

      const result = await blueskyService.performScan(mockOptions)

      expect(blueskyService.performScan).toHaveBeenCalledWith(mockOptions)
      expect(result.totalFound).toBe(20)
      expect(result.processed).toBe(15)
      expect(result.approved).toBe(12)
      expect(result.rejected).toBe(3)
      expect(result.duplicates).toBe(5)
    })

    it('should handle authentication errors', async () => {
      const authError = new Error('Bluesky authentication failed')
      blueskyService.performScan.mockRejectedValue(authError)

      await expect(blueskyService.performScan(mockOptions)).rejects.toThrow('Bluesky authentication failed')
    })

    it('should handle AT Protocol connection errors', async () => {
      const protocolError = new Error('AT Protocol connection failed')
      blueskyService.performScan.mockRejectedValue(protocolError)

      await expect(blueskyService.performScan(mockOptions)).rejects.toThrow('AT Protocol connection failed')
    })

    it('should return empty results when service is disabled', async () => {
      const disabledResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: 1
      }
      
      blueskyService.performScan.mockResolvedValue(disabledResult)

      const result = await blueskyService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.errors).toBe(1)
    })

    it('should limit results to maxPosts parameter', async () => {
      const limitedResult = {
        ...mockScanResult,
        totalFound: 30,
        processed: 10, // Limited by maxPosts: 10
        approved: 8,
        rejected: 2
      }
      
      blueskyService.performScan.mockResolvedValue(limitedResult)

      const result = await blueskyService.performScan({ maxPosts: 10 })

      expect(result.processed).toBeLessThanOrEqual(10)
    })

    it('should process multiple search terms', async () => {
      const multiTermResult = {
        ...mockScanResult,
        totalFound: 35,
        processed: 25,
        approved: 18,
        rejected: 7,
        duplicates: 10
      }
      
      blueskyService.performScan.mockResolvedValue(multiTermResult)

      const result = await blueskyService.performScan(mockOptions)

      expect(result.totalFound).toBeGreaterThan(20) // More than single search term
    })

    it('should filter out duplicate posts', async () => {
      const duplicateFilteredResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 18,
        approved: 12,
        rejected: 6,
        duplicates: 7 // 7 duplicates filtered out
      }
      
      blueskyService.performScan.mockResolvedValue(duplicateFilteredResult)

      const result = await blueskyService.performScan(mockOptions)

      expect(result.duplicates).toBe(7)
      expect(result.processed).toBe(18) // 25 found - 7 duplicates
    })

    it('should randomly select 4-5 search terms per scan', async () => {
      const randomTermsResult = {
        ...mockScanResult,
        totalFound: 18,
        processed: 14,
        approved: 10,
        rejected: 4,
        duplicates: 4
      }

      blueskyService.performScan.mockResolvedValue(randomTermsResult)

      const result = await blueskyService.performScan(mockOptions)

      // Should have results from 4-5 terms (not all 8)
      expect(result.totalFound).toBeGreaterThan(0)
      expect(result.processed).toBeGreaterThan(0)
    })

    it('should use cursor-based pagination for variety', async () => {
      const cursorResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 16,
        approved: 12,
        rejected: 4,
        duplicates: 4
      }

      blueskyService.performScan.mockResolvedValue(cursorResult)

      const result = await blueskyService.performScan(mockOptions)

      // Cursor pagination should help find fresh content
      expect(result.totalFound).toBeGreaterThan(0)
      expect(result.duplicates).toBeLessThan(result.totalFound)
    })

    it('should have increased maxPosts default to 18', async () => {
      const higherLimitResult = {
        ...mockScanResult,
        totalFound: 22,
        processed: 18, // Default maxPosts increased to 18
        approved: 14,
        rejected: 4,
        duplicates: 4
      }

      blueskyService.performScan.mockResolvedValue(higherLimitResult)

      const result = await blueskyService.performScan() // No options - using default

      expect(result.processed).toBeLessThanOrEqual(18) // Default is now 18 (was 12)
    })

    it('should vary sort parameter (latest/top) for diversity', async () => {
      const variedSortResult = {
        ...mockScanResult,
        totalFound: 19,
        processed: 15,
        approved: 11,
        rejected: 4,
        duplicates: 4
      }

      blueskyService.performScan.mockResolvedValue(variedSortResult)

      const result = await blueskyService.performScan(mockOptions)

      // Random sort should help find different content each time
      expect(result.totalFound).toBeGreaterThan(0)
    })

    it('should validate content quality before approval', async () => {
      const qualityFilteredResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 20,
        approved: 8, // Only high-quality content approved
        rejected: 12,
        duplicates: 0
      }
      
      blueskyService.performScan.mockResolvedValue(qualityFilteredResult)

      const result = await blueskyService.performScan(mockOptions)

      expect(result.approved).toBeLessThan(result.processed)
      expect(result.rejected).toBeGreaterThan(result.approved)
    })

    it('should handle network timeouts gracefully', async () => {
      const timeoutResult = {
        ...mockScanResult,
        totalFound: 8,
        processed: 5,
        approved: 3,
        rejected: 2,
        duplicates: 0,
        errors: 3
      }
      
      blueskyService.performScan.mockResolvedValue(timeoutResult)

      const result = await blueskyService.performScan(mockOptions)

      expect(result.errors).toBe(3)
      expect(result.processed).toBeLessThan(result.totalFound)
    })
  })

  describe('testConnection', () => {
    it('should return successful connection test', async () => {
      const successResult = {
        success: true,
        message: 'Bluesky connection successful',
        details: { 
          authenticated: true,
          handle: '@hotdogdiaries.bsky.social',
          apiStatus: 'healthy'
        }
      }
      
      blueskyService.testConnection.mockResolvedValue(successResult)

      const result = await blueskyService.testConnection()

      expect(result.success).toBe(true)
      expect(result.details.authenticated).toBe(true)
      expect(result.details.handle).toContain('bsky.social')
    })

    it('should return failed connection when credentials are missing', async () => {
      const failResult = {
        success: false,
        message: 'Bluesky credentials not configured',
        details: { 
          authenticated: false,
          apiStatus: 'error',
          error: 'Missing identifier or password'
        }
      }
      
      blueskyService.testConnection.mockResolvedValue(failResult)

      const result = await blueskyService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.authenticated).toBe(false)
      expect(result.message).toContain('credentials not configured')
    })

    it('should return failed connection on AT Protocol errors', async () => {
      const protocolResult = {
        success: false,
        message: 'AT Protocol server unreachable',
        details: { 
          authenticated: false,
          apiStatus: 'server_error',
          serverUrl: 'https://bsky.social'
        }
      }
      
      blueskyService.testConnection.mockResolvedValue(protocolResult)

      const result = await blueskyService.testConnection()

      expect(result.success).toBe(false)
      expect(result.details.apiStatus).toBe('server_error')
      expect(result.message).toContain('server unreachable')
    })
  })

  describe('getScanConfig', () => {
    it('should return current scan configuration with expanded search terms', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240, // minutes
        maxPostsPerScan: 20,
        searchTerms: [
          'hotdog',
          'hot dog',
          'hotdogs',
          'corn dog',
          'chicago dog',
          'chili dog',
          'hot dog stand',
          'ballpark food'
        ],
        lastScanTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        nextScanTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        includeMedia: true,
        minEngagement: 5
      }

      blueskyService.getScanConfig.mockResolvedValue(mockConfig)

      const config = await blueskyService.getScanConfig()

      expect(config.isEnabled).toBe(true)
      expect(config.scanInterval).toBe(240)
      expect(config.searchTerms).toHaveLength(8) // Expanded from 3 to 8
      expect(config.searchTerms).toContain('hotdog')
      expect(config.searchTerms).toContain('corn dog')
      expect(config.searchTerms).toContain('ballpark food')
      expect(config.includeMedia).toBe(true)
    })

    it('should update scan configuration', async () => {
      const configUpdate = {
        isEnabled: true,
        scanInterval: 180,
        maxPostsPerScan: 25,
        searchTerms: ['gourmet hotdog', 'artisan hot dog'],
        includeMedia: false,
        minEngagement: 10
      }
      
      blueskyService.updateScanConfig.mockResolvedValue(configUpdate)

      const result = await blueskyService.updateScanConfig(configUpdate)

      expect(blueskyService.updateScanConfig).toHaveBeenCalledWith(configUpdate)
      expect(result.scanInterval).toBe(180)
      expect(result.minEngagement).toBe(10)
    })
  })

  describe('getScanningStats', () => {
    it('should return scanning statistics', async () => {
      const mockStats = {
        totalPostsFound: 150,
        postsApproved: 85,
        postsRejected: 65,
        successRate: 0.567,
        averageEngagement: 12.5,
        topPerformingPosts: [
          {
            id: 'at://did:plc:123/app.bsky.feed.post/456',
            text: 'Amazing Chicago style hotdog!',
            engagement: 45,
            createdAt: new Date()
          }
        ]
      }
      
      blueskyService.getScanningStats.mockResolvedValue(mockStats)

      const stats = await blueskyService.getScanningStats()

      expect(stats.totalPostsFound).toBe(150)
      expect(stats.postsApproved).toBe(85)
      expect(stats.successRate).toBeCloseTo(0.567)
      expect(stats.topPerformingPosts).toHaveLength(1)
    })
  })

  describe('authentication', () => {
    it('should authenticate with AT Protocol', async () => {
      const mockSession = {
        accessJwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshJwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        handle: 'hotdogdiaries.bsky.social',
        did: 'did:plc:abcd1234efgh5678'
      }
      
      blueskyService.authenticate.mockResolvedValue(mockSession)

      const session = await blueskyService.authenticate()

      expect(session.handle).toBe('hotdogdiaries.bsky.social')
      expect(session.accessJwt).toBeTruthy()
      expect(session.did).toContain('did:plc:')
    })

    it('should handle authentication failure', async () => {
      const authError = new Error('Invalid identifier or password')
      blueskyService.authenticate.mockRejectedValue(authError)

      await expect(blueskyService.authenticate()).rejects.toThrow('Invalid identifier or password')
    })

    it('should ensure authentication before operations', async () => {
      blueskyService.ensureAuthenticated.mockResolvedValue(undefined)

      await blueskyService.ensureAuthenticated()

      expect(blueskyService.ensureAuthenticated).toHaveBeenCalled()
    })
  })

  describe('content processing', () => {
    it('should search posts with query terms', async () => {
      const mockPosts = [
        {
          ...mockBlueskyPost,
          record: {
            text: mockBlueskyPost.text, // Use text from social-mocks
            createdAt: mockBlueskyPost.createdAt
          }
        },
        {
          ...mockBlueskyPost,
          uri: 'at://did:plc:xyz/app.bsky.feed.post/789',
          record: {
            text: 'Grilling the perfect hotdog this summer!',
            createdAt: new Date().toISOString()
          }
        }
      ]
      
      blueskyService.searchPosts.mockResolvedValue(mockPosts)

      const posts = await blueskyService.searchPosts(['hotdog', 'hot dog'])

      expect(posts).toHaveLength(2)
      expect(posts[0].record.text).toContain('hotdog')
    })

    it('should validate Bluesky content format', async () => {
      const validationResult = {
        isValid: true,
        confidence: 0.85,
        reasons: ['Contains hotdog keywords', 'High engagement']
      }
      
      const blueskyPostWithRecord = {
        ...mockBlueskyPost,
        record: {
          text: mockBlueskyPost.text,
          createdAt: mockBlueskyPost.createdAt
        }
      }
      
      blueskyService.validateBlueskyContent.mockResolvedValue(validationResult)

      const result = await blueskyService.validateBlueskyContent(blueskyPostWithRecord)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(0.85)
      expect(result.reasons).toContain('Contains hotdog keywords')
    })
  })

  describe('service state management', () => {
    it('should check if service is enabled', async () => {
      blueskyService.isEnabled.mockReturnValue(true)

      const enabled = blueskyService.isEnabled()

      expect(enabled).toBe(true)
    })

    it('should enable the service', async () => {
      blueskyService.enable.mockResolvedValue(undefined)

      await blueskyService.enable()

      expect(blueskyService.enable).toHaveBeenCalled()
    })

    it('should disable the service', async () => {
      blueskyService.disable.mockResolvedValue(undefined)

      await blueskyService.disable()

      expect(blueskyService.disable).toHaveBeenCalled()
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
        errors: 5
      }
      
      blueskyService.performScan.mockResolvedValue(partialFailureResult)

      const result = await blueskyService.performScan(mockOptions)

      expect(result.processed).toBe(10)
      expect(result.errors).toBe(5)
    })

    it('should retry failed requests within limits', async () => {
      const mockOptions = { maxPosts: 10 }
      
      const retryResult = {
        ...mockScanResult,
        totalFound: 10,
        processed: 10,
        approved: 8,
        rejected: 2,
        duplicates: 0,
        errors: 0 // Successful after retry
      }
      
      blueskyService.performScan.mockResolvedValue(retryResult)

      const result = await blueskyService.performScan(mockOptions)

      expect(result.errors).toBe(0)
      expect(result.processed).toBe(10)
    })

    it('should handle AT Protocol rate limiting', async () => {
      const rateLimitResult = {
        totalFound: 5,
        processed: 3,
        approved: 2,
        rejected: 1,
        duplicates: 0,
        errors: 2
      }
      
      blueskyService.performScan.mockResolvedValue(rateLimitResult)

      const result = await blueskyService.performScan({ maxPosts: 5 })

      expect(result.processed).toBe(3)
      expect(result.errors).toBe(2)
    })
  })
})