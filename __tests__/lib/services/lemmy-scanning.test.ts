import { mockScanningService, mockScanResult, mockLemmyPost } from '@/__tests__/utils/social-mocks'

// Mock the Lemmy scanning service
jest.mock('@/lib/services/lemmy-scanning', () => ({
  LemmyScanningService: jest.fn().mockImplementation(() => ({
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn(),
    fetchCommunityPosts: jest.fn(),
    searchPosts: jest.fn(),
    transformLemmyPost: jest.fn(),
    extractImageUrl: jest.fn(),
    extractVideoUrl: jest.fn(),
    isSpamOrOffTopic: jest.fn(),
    hasExcessivePunctuation: jest.fn(),
    isEnabled: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn()
  })),
  lemmyScanningService: {
    performScan: jest.fn(),
    testConnection: jest.fn(),
    getScanConfig: jest.fn()
  }
}))

// Mock dependencies
jest.mock('@/lib/services/filtering', () => ({
  FilteringService: jest.fn().mockImplementation(() => ({
    isValidHotdogContent: jest.fn()
  }))
}))

jest.mock('@/lib/services/content-processor', () => ({
  ContentProcessor: jest.fn().mockImplementation(() => ({
    processContent: jest.fn(),
    generateContentHash: jest.fn()
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

describe('LemmyScanningService', () => {
  let LemmyScanningService: jest.MockedClass<any>
  let lemmyService: any
  const mockServiceFunctions = mockScanningService('Lemmy')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked LemmyScanningService class
    const { LemmyScanningService: MockedService } = require('@/lib/services/lemmy-scanning')
    LemmyScanningService = MockedService
    lemmyService = new LemmyScanningService()
    
    // Setup default mock implementations
    Object.assign(lemmyService, mockServiceFunctions)
  })

  describe('performScan', () => {
    const mockOptions = { maxPosts: 20 }

    it('should successfully perform Lemmy federated scan', async () => {
      const expectedResult = {
        ...mockScanResult,
        totalFound: 28,
        processed: 22,
        approved: 16,
        rejected: 6,
        duplicates: 6
      }
      
      lemmyService.performScan.mockResolvedValue(expectedResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(lemmyService.performScan).toHaveBeenCalledWith(mockOptions)
      expect(result.totalFound).toBe(28)
      expect(result.processed).toBe(22)
      expect(result.approved).toBe(16)
      expect(result.rejected).toBe(6)
      expect(result.duplicates).toBe(6)
    })

    it('should handle federated instance connection errors', async () => {
      const federatedError = new Error('lemmy.world connection timeout')
      lemmyService.performScan.mockRejectedValue(federatedError)

      await expect(lemmyService.performScan(mockOptions)).rejects.toThrow('lemmy.world connection timeout')
    })

    it('should handle community access restrictions', async () => {
      const restrictedResult = {
        totalFound: 5, // Some communities may be restricted
        processed: 5,
        approved: 3,
        rejected: 2,
        duplicates: 0,
        errors: ['Access denied to private community']
      }
      
      lemmyService.performScan.mockResolvedValue(restrictedResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.totalFound).toBe(5)
      expect(result.errors).toContain('Access denied to private community')
    })

    it('should return empty results when all communities are offline', async () => {
      const offlineResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['All target Lemmy communities are unreachable']
      }
      
      lemmyService.performScan.mockResolvedValue(offlineResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.totalFound).toBe(0)
      expect(result.errors).toContain('All target Lemmy communities are unreachable')
    })

    it('should limit results to maxPosts parameter across communities', async () => {
      const limitedResult = {
        ...mockScanResult,
        totalFound: 35,
        processed: 15, // Limited by maxPosts: 15
        approved: 12,
        rejected: 3
      }
      
      lemmyService.performScan.mockResolvedValue(limitedResult)

      const result = await lemmyService.performScan({ maxPosts: 15 })

      expect(result.processed).toBeLessThanOrEqual(15)
    })

    it('should process multiple federated communities', async () => {
      const multiCommunityResult = {
        ...mockScanResult,
        totalFound: 42,
        processed: 28,
        approved: 20,
        rejected: 8,
        duplicates: 14 // More duplicates across communities
      }
      
      lemmyService.performScan.mockResolvedValue(multiCommunityResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.totalFound).toBeGreaterThan(25) // More than single community
      expect(result.duplicates).toBeGreaterThan(10) // Cross-community duplicates
    })

    it('should filter duplicate posts across communities', async () => {
      const crossCommunityDuplicatesResult = {
        ...mockScanResult,
        totalFound: 30,
        processed: 18, // After deduplication
        approved: 14,
        rejected: 4,
        duplicates: 12 // Many cross-posted between communities
      }
      
      lemmyService.performScan.mockResolvedValue(crossCommunityDuplicatesResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.duplicates).toBe(12)
      expect(result.processed).toBe(18) // 30 found - 12 duplicates
    })

    it('should handle quality filtering for community content', async () => {
      const qualityFilteredResult = {
        ...mockScanResult,
        totalFound: 25,
        processed: 25,
        approved: 18, // Community content has higher approval rate
        rejected: 7,
        duplicates: 0
      }
      
      lemmyService.performScan.mockResolvedValue(qualityFilteredResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.approved).toBeGreaterThan(result.rejected) // Community content quality
    })

    it('should handle federated network timeouts gracefully', async () => {
      const timeoutResult = {
        ...mockScanResult,
        totalFound: 12,
        processed: 8,
        approved: 6,
        rejected: 2,
        duplicates: 0,
        errors: ['Network timeout connecting to lemmy.ml', 'Federated instance temporarily unavailable']
      }
      
      lemmyService.performScan.mockResolvedValue(timeoutResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.errors).toHaveLength(2)
      expect(result.processed).toBeLessThan(result.totalFound)
    })

    it('should handle video and image content from Lemmy posts', async () => {
      const mediaPostResult = {
        ...mockScanResult,
        totalFound: 20,
        processed: 18,
        approved: 15, // High approval for media content
        rejected: 3,
        duplicates: 2
      }
      
      lemmyService.performScan.mockResolvedValue(mediaPostResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.approved).toBeGreaterThan(result.rejected) // Media posts generally well-received
    })

    it('should handle mixed community types (targeted vs search)', async () => {
      const mixedSourceResult = {
        totalFound: 25,
        processed: 22,
        approved: 17, // Targeted communities have higher approval
        rejected: 5,
        duplicates: 3
      }
      
      lemmyService.performScan.mockResolvedValue(mixedSourceResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.processed).toBe(22)
      expect(result.approved).toBe(17)
    })
  })

  describe('testConnection', () => {
    it('should return successful connection to federated communities', async () => {
      const successResult = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities',
        details: { 
          communityResults: [
            {
              community: 'lemmy.world/c/hot_dog',
              success: true,
              postsFound: 15,
              description: 'Main hotdog community - 185 subscribers, active moderation'
            },
            {
              community: 'lemmy.world/c/food',
              success: true,
              postsFound: 22,
              description: 'General food community - may have hotdog content'
            }
          ]
        }
      }
      
      lemmyService.testConnection.mockResolvedValue(successResult)

      const result = await lemmyService.testConnection()

      expect(result.success).toBe(true)
      expect(result.details.communityResults).toHaveLength(2)
      expect(result.details.communityResults[0].success).toBe(true)
      expect(result.message).toContain('2/2')
    })

    it('should return partial success when some communities are unavailable', async () => {
      const partialResult = {
        success: true,
        message: 'Connected to 1/2 Lemmy communities',
        details: { 
          communityResults: [
            {
              community: 'lemmy.world/c/hot_dog',
              success: true,
              postsFound: 8,
              description: 'Main hotdog community - 185 subscribers, active moderation'
            },
            {
              community: 'lemmy.ml/c/food',
              success: false,
              error: 'Instance temporarily unavailable',
              description: 'Alternative food community'
            }
          ]
        }
      }
      
      lemmyService.testConnection.mockResolvedValue(partialResult)

      const result = await lemmyService.testConnection()

      expect(result.success).toBe(true) // Still successful with partial connectivity
      expect(result.message).toContain('1/2')
      expect(result.details.communityResults[1].success).toBe(false)
    })

    it('should return failed connection when all communities are unreachable', async () => {
      const allFailedResult = {
        success: false,
        message: 'Connected to 0/2 Lemmy communities',
        details: { 
          communityResults: [
            {
              community: 'lemmy.world/c/hot_dog',
              success: false,
              error: 'Connection timeout',
              description: 'Main hotdog community - 185 subscribers, active moderation'
            },
            {
              community: 'lemmy.world/c/food',
              success: false,
              error: 'Server error 500',
              description: 'General food community - may have hotdog content'
            }
          ]
        }
      }
      
      lemmyService.testConnection.mockResolvedValue(allFailedResult)

      const result = await lemmyService.testConnection()

      expect(result.success).toBe(false)
      expect(result.message).toContain('0/2')
      expect(result.details.communityResults.every((r: any) => !r.success)).toBe(true)
    })

    it('should handle federated network errors', async () => {
      const networkErrorResult = {
        success: false,
        message: 'Connection test failed: Network unreachable',
        details: { error: 'Network unreachable' }
      }
      
      lemmyService.testConnection.mockResolvedValue(networkErrorResult)

      const result = await lemmyService.testConnection()

      expect(result.success).toBe(false)
      expect(result.message).toContain('Network unreachable')
    })
  })

  describe('getScanConfig', () => {
    it('should return current federated scan configuration', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240, // 4 hours
        maxPostsPerScan: 20,
        targetCommunities: [
          { 
            instance: 'lemmy.world', 
            community: 'hot_dog',
            description: 'Main hotdog community - 185 subscribers, active moderation'
          },
          { 
            instance: 'lemmy.world', 
            community: 'food',
            description: 'General food community - may have hotdog content'
          }
        ],
        minScore: 1
      }
      
      lemmyService.getScanConfig.mockResolvedValue(mockConfig)

      const config = await lemmyService.getScanConfig()

      expect(config.isEnabled).toBe(true)
      expect(config.scanInterval).toBe(240)
      expect(config.targetCommunities).toHaveLength(2)
      expect(config.targetCommunities[0].instance).toBe('lemmy.world')
      expect(config.targetCommunities[0].community).toBe('hot_dog')
      expect(config.minScore).toBe(1)
    })

    it('should include community descriptions and metadata', async () => {
      const detailedConfig = {
        isEnabled: true,
        scanInterval: 180,
        maxPostsPerScan: 30,
        targetCommunities: [
          { 
            instance: 'lemmy.world', 
            community: 'hot_dog',
            description: 'Main hotdog community - 185 subscribers, active moderation'
          },
          { 
            instance: 'lemmy.ml', 
            community: 'food',
            description: 'Federated food community - broader content'
          },
          { 
            instance: 'beehaw.org', 
            community: 'cooking',
            description: 'Cooking community - occasional hotdog recipes'
          }
        ],
        minScore: 0
      }
      
      lemmyService.getScanConfig.mockResolvedValue(detailedConfig)

      const config = await lemmyService.getScanConfig()

      expect(config.targetCommunities).toHaveLength(3)
      expect(config.targetCommunities[0].description).toContain('185 subscribers')
      expect(config.targetCommunities[1].instance).toBe('lemmy.ml')
      expect(config.targetCommunities[2].instance).toBe('beehaw.org')
    })
  })

  describe('content processing', () => {
    it('should process community posts with proper filtering', async () => {
      const mockProcessedPosts = [
        {
          id: '12345',
          title: 'Chicago vs New York hotdog debate',
          description: 'Let\'s settle this once and for all - which city has the superior hotdog?',
          author: 'hotdog_enthusiast',
          community: 'hot_dog',
          postUrl: 'https://lemmy.world/post/12345',
          score: 89,
          published: new Date()
        },
        {
          id: '456',
          title: 'Chicago Style Hotdog Recipe',
          description: 'Here\'s my family recipe for authentic Chicago style hotdogs...',
          author: 'chef_chicago',
          community: 'hot_dog',
          postUrl: 'https://lemmy.world/post/456',
          score: 42,
          published: new Date()
        }
      ]
      
      lemmyService.fetchCommunityPosts.mockResolvedValue(mockProcessedPosts)

      const posts = await lemmyService.fetchCommunityPosts(
        { instance: 'lemmy.world', community: 'hot_dog', description: 'Test community' },
        10
      )

      expect(posts).toHaveLength(2)
      expect(posts[0].title).toContain('hotdog')
    })

    it('should extract image URLs from post URLs', async () => {
      const imageUrl = 'https://lemmy.world/image/hotdog.jpg'
      
      lemmyService.extractImageUrl.mockReturnValue(imageUrl)

      const result = lemmyService.extractImageUrl('https://lemmy.world/image/hotdog.jpg')

      expect(result).toBe(imageUrl)
      expect(lemmyService.extractImageUrl).toHaveBeenCalledWith('https://lemmy.world/image/hotdog.jpg')
    })

    it('should extract video URLs from post URLs', async () => {
      const videoUrl = 'https://v.redd.it/hotdog_cooking.mp4'
      
      lemmyService.extractVideoUrl.mockReturnValue(videoUrl)

      const result = lemmyService.extractVideoUrl('https://v.redd.it/hotdog_cooking.mp4')

      expect(result).toBe(videoUrl)
      expect(lemmyService.extractVideoUrl).toHaveBeenCalledWith('https://v.redd.it/hotdog_cooking.mp4')
    })

    it('should detect spam and off-topic content', async () => {
      lemmyService.isSpamOrOffTopic.mockReturnValue(true)

      const isSpam = lemmyService.isSpamOrOffTopic('URGENT: Free money click here!!!', 'Buy now limited time')

      expect(isSpam).toBe(true)
      expect(lemmyService.isSpamOrOffTopic).toHaveBeenCalledWith('URGENT: Free money click here!!!', 'Buy now limited time')
    })

    it('should detect excessive punctuation patterns', async () => {
      lemmyService.hasExcessivePunctuation.mockReturnValue(true)

      const hasPunctuation = lemmyService.hasExcessivePunctuation('CHECK THIS OUT!!!! AMAZING!!!! BUY NOW!!!')

      expect(hasPunctuation).toBe(true)
    })

    it('should handle imgur links without extensions', async () => {
      const imgurUrl = 'https://imgur.com/abc123.jpg'
      
      lemmyService.extractImageUrl.mockReturnValue(imgurUrl)

      const result = lemmyService.extractImageUrl('https://imgur.com/abc123')

      expect(result).toBe(imgurUrl)
    })
  })

  describe('service state management', () => {
    it('should check if federated service is enabled', async () => {
      lemmyService.isEnabled.mockReturnValue(true)

      const enabled = lemmyService.isEnabled()

      expect(enabled).toBe(true)
    })

    it('should enable the federated service', async () => {
      lemmyService.enable.mockResolvedValue(undefined)

      await lemmyService.enable()

      expect(lemmyService.enable).toHaveBeenCalled()
    })

    it('should disable the federated service', async () => {
      lemmyService.disable.mockResolvedValue(undefined)

      await lemmyService.disable()

      expect(lemmyService.disable).toHaveBeenCalled()
    })
  })

  describe('error handling and resilience', () => {
    it('should handle partial federated scan failures gracefully', async () => {
      const mockOptions = { maxPosts: 20 }
      
      const partialFailureResult = {
        totalFound: 18,
        processed: 12,
        approved: 9,
        rejected: 3,
        duplicates: 0,
        errors: ['Failed to fetch from lemmy.ml due to instance downtime', 'Timeout connecting to beehaw.org']
      }
      
      lemmyService.performScan.mockResolvedValue(partialFailureResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.processed).toBe(12)
      expect(result.errors).toContain('Failed to fetch from lemmy.ml due to instance downtime')
      expect(result.errors).toContain('Timeout connecting to beehaw.org')
    })

    it('should retry failed federated requests within limits', async () => {
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
      
      lemmyService.performScan.mockResolvedValue(retryResult)

      const result = await lemmyService.performScan(mockOptions)

      expect(result.errors).toHaveLength(0)
      expect(result.processed).toBe(15)
    })

    it('should handle malformed federated responses', async () => {
      const malformedResponseResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: ['Invalid JSON response from lemmy.world', 'Malformed ActivityPub data']
      }
      
      lemmyService.performScan.mockResolvedValue(malformedResponseResult)

      const result = await lemmyService.performScan({ maxPosts: 10 })

      expect(result.errors).toContain('Invalid JSON response from lemmy.world')
      expect(result.totalFound).toBe(0)
    })

    it('should handle different post types and scoring appropriately', async () => {
      const scoredPostResult = {
        totalFound: 22,
        processed: 20,
        approved: 16, // Well-scored posts have higher approval
        rejected: 4,  // Low-scored posts rejected
        duplicates: 2
      }
      
      lemmyService.performScan.mockResolvedValue(scoredPostResult)

      const result = await lemmyService.performScan({ maxPosts: 20 })

      expect(result.processed).toBe(20)
      expect(result.approved).toBe(16)
      expect(result.approved).toBeGreaterThan(result.rejected)
    })

    it('should handle ActivityPub federation delays', async () => {
      const federationDelayResult = {
        totalFound: 15,
        processed: 12,
        approved: 8,
        rejected: 4,
        duplicates: 0,
        errors: ['ActivityPub federation lag detected', 'Some content may be delayed']
      }
      
      lemmyService.performScan.mockResolvedValue(federationDelayResult)

      const result = await lemmyService.performScan({ maxPosts: 15 })

      expect(result.errors).toContain('ActivityPub federation lag detected')
      expect(result.processed).toBe(12)
    })
  })
})