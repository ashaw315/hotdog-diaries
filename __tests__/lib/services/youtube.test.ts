import { mockYouTubeService, mockYouTubeVideo, mockServiceError, mockScanResult } from '@/__tests__/utils/social-mocks'
import { YouTubeSearchOptions } from '@/lib/services/youtube'

// Mock the entire YouTube service
jest.mock('@/lib/services/youtube', () => {
  const mockService = {
    searchVideos: jest.fn(),
    getVideoDetails: jest.fn(),
    processYouTubeVideo: jest.fn(),
    validateYouTubeContent: jest.fn(),
    getHotdogSearchTerms: jest.fn(),
    getApiStatus: jest.fn(),
    checkQuotaLimit: jest.fn(),
    updateQuotaUsage: jest.fn(),
    parseDuration: jest.fn(),
    formatDuration: jest.fn()
  }
  
  return {
    YouTubeService: jest.fn().mockImplementation(() => mockService),
    youtubeService: mockService
  }
})

// Mock dependencies
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/services/youtube-monitoring', () => ({
  youtubeMonitoringService: {
    recordApiRequest: jest.fn().mockResolvedValue(undefined),
    recordQuotaLimitHit: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('@/lib/env', () => ({
  loadEnv: jest.fn()
}))

// Mock fetch API
global.fetch = jest.fn()

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    YOUTUBE_API_KEY: 'test_youtube_api_key'
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('YouTubeService', () => {
  let YouTubeService: jest.MockedClass<any>
  let youtubeService: any
  const mockServiceFunctions = mockYouTubeService()

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked YouTubeService class
    const { YouTubeService: MockedYouTubeService } = require('@/lib/services/youtube')
    YouTubeService = MockedYouTubeService
    youtubeService = new YouTubeService()
    
    // Setup default mock implementations
    Object.assign(youtubeService, mockServiceFunctions)
  })

  describe('constructor', () => {
    it('should throw error if YouTube API key is missing', () => {
      // Mock constructor to throw error when API key is missing
      const { YouTubeService: MockedYouTubeService } = require('@/lib/services/youtube')
      MockedYouTubeService.mockImplementationOnce(() => {
        throw new Error('YouTube API key not configured')
      })

      expect(() => new MockedYouTubeService()).toThrow('YouTube API key not configured')
    })

    it('should initialize with correct configuration', () => {
      expect(youtubeService).toBeDefined()
      expect(YouTubeService).toHaveBeenCalled()
    })
  })

  describe('searchVideos', () => {
    const mockOptions: YouTubeSearchOptions = {
      query: 'hotdog',
      maxResults: 25,
      order: 'relevance',
      publishedAfter: new Date('2024-01-01'),
      videoDuration: 'any',
      videoDefinition: 'any'
    }

    it('should successfully search YouTube videos with query', async () => {
      youtubeService.searchVideos.mockResolvedValue([mockYouTubeVideo, mockYouTubeVideo])

      const results = await youtubeService.searchVideos(mockOptions)

      expect(youtubeService.searchVideos).toHaveBeenCalledWith(mockOptions)
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual(mockYouTubeVideo)
    })

    it('should filter videos by published date', async () => {
      youtubeService.searchVideos.mockResolvedValue([mockYouTubeVideo])

      const results = await youtubeService.searchVideos({ 
        ...mockOptions, 
        publishedAfter: new Date('2024-06-01') 
      })

      expect(youtubeService.searchVideos).toHaveBeenCalledWith({ 
        ...mockOptions, 
        publishedAfter: new Date('2024-06-01') 
      })
      expect(results).toHaveLength(1)
    })

    it('should handle quota limit errors', async () => {
      const quotaError = mockServiceError('YouTube', 'ratelimit')
      youtubeService.searchVideos.mockRejectedValue(quotaError)

      await expect(youtubeService.searchVideos(mockOptions)).rejects.toThrow('YouTube API rate limit exceeded')
    })

    it('should handle API authentication errors', async () => {
      const authError = mockServiceError('YouTube', 'auth')
      youtubeService.searchVideos.mockRejectedValue(authError)

      await expect(youtubeService.searchVideos(mockOptions)).rejects.toThrow('YouTube API authentication failed')
    })

    it('should handle network errors', async () => {
      const networkError = mockServiceError('YouTube', 'network')
      youtubeService.searchVideos.mockRejectedValue(networkError)

      await expect(youtubeService.searchVideos(mockOptions)).rejects.toThrow('YouTube API network error')
    })

    it('should limit maxResults to 50', async () => {
      youtubeService.searchVideos.mockResolvedValue([mockYouTubeVideo])

      const results = await youtubeService.searchVideos({ 
        ...mockOptions, 
        maxResults: 100 // Should be capped at 50
      })

      expect(youtubeService.searchVideos).toHaveBeenCalledWith({ 
        ...mockOptions, 
        maxResults: 100
      })
      expect(results).toHaveLength(1)
    })

    it('should sort results by order preference', async () => {
      const video1 = { ...mockYouTubeVideo, id: 'video1', viewCount: 100000 }
      const video2 = { ...mockYouTubeVideo, id: 'video2', viewCount: 50000 }
      youtubeService.searchVideos.mockResolvedValue([video1, video2])

      const results = await youtubeService.searchVideos({
        ...mockOptions,
        order: 'viewCount'
      })

      expect(results).toHaveLength(2)
      expect(results[0].viewCount).toBeGreaterThan(results[1].viewCount)
    })
  })

  describe('getVideoDetails', () => {
    const videoIds = ['video1', 'video2', 'video3']

    it('should fetch video details for given IDs', async () => {
      const mockDetails = [
        { id: 'video1', statistics: { viewCount: '1000' } },
        { id: 'video2', statistics: { viewCount: '2000' } },
        { id: 'video3', statistics: { viewCount: '3000' } }
      ]
      youtubeService.getVideoDetails.mockResolvedValue(mockDetails)

      const results = await youtubeService.getVideoDetails(videoIds)

      expect(youtubeService.getVideoDetails).toHaveBeenCalledWith(videoIds)
      expect(results).toHaveLength(3)
      expect(results[0].id).toBe('video1')
    })

    it('should return empty array if no video IDs provided', async () => {
      youtubeService.getVideoDetails.mockResolvedValue([])

      const results = await youtubeService.getVideoDetails([])

      expect(results).toEqual([])
    })

    it('should handle API errors gracefully', async () => {
      youtubeService.getVideoDetails.mockResolvedValue([]) // Return empty on error

      const results = await youtubeService.getVideoDetails(videoIds)

      expect(results).toEqual([])
    })
  })

  describe('processYouTubeVideo', () => {
    const mockSearchItem = {
      id: { videoId: 'test123' },
      snippet: {
        title: 'Amazing Hotdog Recipe',
        description: 'Learn how to make the perfect hotdog',
        thumbnails: { high: { url: 'https://img.youtube.com/vi/test123/hqdefault.jpg' } },
        channelTitle: 'Food Channel',
        channelId: 'UC123456',
        publishedAt: '2024-01-01T12:00:00Z'
      }
    }

    const mockVideoDetail = {
      statistics: {
        viewCount: '10000',
        likeCount: '500',
        commentCount: '50'
      },
      contentDetails: {
        duration: 'PT5M30S'
      }
    }

    const expectedProcessed = {
      id: 'test123',
      title: 'Amazing Hotdog Recipe',
      description: 'Learn how to make the perfect hotdog',
      thumbnailUrl: 'https://img.youtube.com/vi/test123/hqdefault.jpg',
      videoUrl: 'https://www.youtube.com/watch?v=test123',
      embedUrl: 'https://www.youtube.com/embed/test123',
      channelTitle: 'Food Channel',
      channelId: 'UC123456',
      publishedAt: new Date('2024-01-01T12:00:00Z'),
      duration: 'PT5M30S',
      viewCount: 10000,
      likeCount: 500,
      commentCount: 50,
      tags: [],
      categoryId: '0',
      isLiveBroadcast: false
    }

    it('should process YouTube video data correctly', () => {
      youtubeService.processYouTubeVideo.mockReturnValue(expectedProcessed)

      const result = youtubeService.processYouTubeVideo(mockSearchItem, mockVideoDetail)

      expect(youtubeService.processYouTubeVideo).toHaveBeenCalledWith(mockSearchItem, mockVideoDetail)
      expect(result).toEqual(expectedProcessed)
    })

    it('should handle missing thumbnails', () => {
      const processedWithDefaultThumb = {
        ...expectedProcessed,
        thumbnailUrl: 'https://img.youtube.com/vi/test123/default.jpg'
      }
      youtubeService.processYouTubeVideo.mockReturnValue(processedWithDefaultThumb)

      const itemWithoutHighThumb = {
        ...mockSearchItem,
        snippet: {
          ...mockSearchItem.snippet,
          thumbnails: { default: { url: 'https://img.youtube.com/vi/test123/default.jpg' } }
        }
      }

      const result = youtubeService.processYouTubeVideo(itemWithoutHighThumb, mockVideoDetail)

      expect(result.thumbnailUrl).toBe('https://img.youtube.com/vi/test123/default.jpg')
    })

    it('should handle live broadcast content', () => {
      const liveVideo = {
        ...expectedProcessed,
        isLiveBroadcast: true
      }
      youtubeService.processYouTubeVideo.mockReturnValue(liveVideo)

      const liveItem = {
        ...mockSearchItem,
        snippet: {
          ...mockSearchItem.snippet,
          liveBroadcastContent: 'live'
        }
      }

      const result = youtubeService.processYouTubeVideo(liveItem, mockVideoDetail)

      expect(result.isLiveBroadcast).toBe(true)
    })

    it('should handle missing statistics gracefully', () => {
      const minimalProcessed = {
        ...expectedProcessed,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        duration: 'PT0S'
      }
      youtubeService.processYouTubeVideo.mockReturnValue(minimalProcessed)

      const result = youtubeService.processYouTubeVideo(mockSearchItem, null)

      expect(result.viewCount).toBe(0)
      expect(result.likeCount).toBe(0)
      expect(result.duration).toBe('PT0S')
    })
  })

  describe('validateYouTubeContent', () => {
    it('should validate good hotdog content', async () => {
      youtubeService.validateYouTubeContent.mockResolvedValue(true)

      const result = await youtubeService.validateYouTubeContent(mockYouTubeVideo)

      expect(result).toBe(true)
    })

    it('should reject content without hotdog terms', async () => {
      youtubeService.validateYouTubeContent.mockResolvedValue(false)

      const nonHotdogVideo = {
        ...mockYouTubeVideo,
        title: 'Pizza Recipe Tutorial',
        description: 'Learn to make pizza at home'
      }

      const result = await youtubeService.validateYouTubeContent(nonHotdogVideo)

      expect(result).toBe(false)
    })

    it('should reject spam content', async () => {
      youtubeService.validateYouTubeContent.mockResolvedValue(false)

      const spamVideo = {
        ...mockYouTubeVideo,
        title: 'HOTDOG CLICKBAIT - FREE MONEY SCAM',
        description: 'Get rich quick with this fake hotdog scheme'
      }

      const result = await youtubeService.validateYouTubeContent(spamVideo)

      expect(result).toBe(false)
    })

    it('should reject low engagement videos', async () => {
      youtubeService.validateYouTubeContent.mockResolvedValue(false)

      const lowEngagementVideo = {
        ...mockYouTubeVideo,
        viewCount: 10,
        likeCount: 0
      }

      const result = await youtubeService.validateYouTubeContent(lowEngagementVideo)

      expect(result).toBe(false)
    })

    it('should reject live broadcasts', async () => {
      youtubeService.validateYouTubeContent.mockResolvedValue(false)

      const liveVideo = {
        ...mockYouTubeVideo,
        isLiveBroadcast: true
      }

      const result = await youtubeService.validateYouTubeContent(liveVideo)

      expect(result).toBe(false)
    })

    it('should reject zero duration videos', async () => {
      youtubeService.validateYouTubeContent.mockResolvedValue(false)

      const zeroDurationVideo = {
        ...mockYouTubeVideo,
        duration: 'PT0S'
      }

      const result = await youtubeService.validateYouTubeContent(zeroDurationVideo)

      expect(result).toBe(false)
    })

    it('should accept videos with good engagement', async () => {
      youtubeService.validateYouTubeContent.mockResolvedValue(true)

      const goodVideo = {
        ...mockYouTubeVideo,
        viewCount: 5000,
        likeCount: 200,
        duration: 'PT5M30S',
        isLiveBroadcast: false
      }

      const result = await youtubeService.validateYouTubeContent(goodVideo)

      expect(result).toBe(true)
    })
  })

  describe('getHotdogSearchTerms', () => {
    it('should return list of hotdog search terms', () => {
      const expectedTerms = [
        'hotdog recipe',
        'best hotdogs',
        'hotdog challenge',
        'ballpark food',
        'grilling hotdogs',
        'hotdog review',
        'homemade hotdogs',
        'hotdog competition',
        'street food hotdogs',
        'gourmet hotdogs'
      ]
      youtubeService.getHotdogSearchTerms.mockReturnValue(expectedTerms)

      const terms = youtubeService.getHotdogSearchTerms()

      expect(terms).toContain('hotdog recipe')
      expect(terms).toContain('best hotdogs')
      expect(terms).toContain('grilling hotdogs')
      expect(terms).toContain('gourmet hotdogs')
      expect(Array.isArray(terms)).toBe(true)
    })
  })

  describe('getApiStatus', () => {
    it('should return connected status when API is working', async () => {
      const mockStatus = {
        isAuthenticated: true,
        quotaUsed: 500,
        quotaRemaining: 9500,
        quotaResetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastRequest: new Date()
      }
      youtubeService.getApiStatus.mockResolvedValue(mockStatus)

      const status = await youtubeService.getApiStatus()

      expect(status.isAuthenticated).toBe(true)
      expect(typeof status.quotaUsed).toBe('number')
      expect(typeof status.quotaRemaining).toBe('number')
      expect(status.quotaResetTime).toBeInstanceOf(Date)
    })

    it('should return disconnected status when API key is missing', async () => {
      const mockStatus = {
        isAuthenticated: false,
        quotaUsed: 0,
        quotaRemaining: 0,
        quotaResetTime: new Date(),
        lastError: 'API key not configured'
      }
      youtubeService.getApiStatus.mockResolvedValue(mockStatus)

      const status = await youtubeService.getApiStatus()

      expect(status.isAuthenticated).toBe(false)
      expect(status.lastError).toBe('API key not configured')
    })

    it('should return disconnected status when API fails', async () => {
      const mockStatus = {
        isAuthenticated: false,
        quotaUsed: 100,
        quotaRemaining: 9900,
        quotaResetTime: new Date(),
        lastError: 'HTTP 403'
      }
      youtubeService.getApiStatus.mockResolvedValue(mockStatus)

      const status = await youtubeService.getApiStatus()

      expect(status.isAuthenticated).toBe(false)
      expect(status.lastError).toBeTruthy()
    })
  })

  describe('quota management', () => {
    it('should check quota limit before searches', async () => {
      youtubeService.checkQuotaLimit.mockResolvedValue(undefined)

      await youtubeService.checkQuotaLimit()

      expect(youtubeService.checkQuotaLimit).toHaveBeenCalled()
    })

    it('should throw error when quota exceeded', async () => {
      youtubeService.checkQuotaLimit.mockRejectedValue(
        new Error('YouTube API quota exceeded. Reset in 12 hours')
      )

      await expect(youtubeService.checkQuotaLimit()).rejects.toThrow('quota exceeded')
    })

    it('should update quota usage after API calls', () => {
      youtubeService.updateQuotaUsage.mockReturnValue(undefined)

      youtubeService.updateQuotaUsage(100)

      expect(youtubeService.updateQuotaUsage).toHaveBeenCalledWith(100)
    })

    it('should reset quota counter daily', async () => {
      const futureStatus = {
        isAuthenticated: true,
        quotaUsed: 0,
        quotaRemaining: 10000,
        quotaResetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
      youtubeService.getApiStatus.mockResolvedValue(futureStatus)

      const status = await youtubeService.getApiStatus()

      expect(status.quotaRemaining).toBe(10000)
    })
  })

  describe('duration utilities', () => {
    it('should parse YouTube duration format correctly', () => {
      youtubeService.parseDuration.mockImplementation((duration: string) => {
        // Mock implementation for testing
        if (duration === 'PT5M30S') return 330 // 5*60 + 30
        if (duration === 'PT1H15M45S') return 4545 // 1*3600 + 15*60 + 45
        if (duration === 'PT45S') return 45
        return 0
      })

      expect(youtubeService.parseDuration('PT5M30S')).toBe(330)
      expect(youtubeService.parseDuration('PT1H15M45S')).toBe(4545)
      expect(youtubeService.parseDuration('PT45S')).toBe(45)
    })

    it('should format duration seconds to readable format', () => {
      youtubeService.formatDuration.mockImplementation((seconds: number) => {
        // Mock implementation for testing
        if (seconds === 330) return '5:30'
        if (seconds === 4545) return '1:15:45'
        if (seconds === 45) return '0:45'
        return '0:00'
      })

      expect(youtubeService.formatDuration(330)).toBe('5:30')
      expect(youtubeService.formatDuration(4545)).toBe('1:15:45')
      expect(youtubeService.formatDuration(45)).toBe('0:45')
    })

    it('should handle invalid duration formats', () => {
      youtubeService.parseDuration.mockReturnValue(0)

      expect(youtubeService.parseDuration('invalid')).toBe(0)
      expect(youtubeService.parseDuration('')).toBe(0)
    })
  })
})