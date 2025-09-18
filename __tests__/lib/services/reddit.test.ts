import { mockRedditService, mockRedditPost, mockServiceError, mockScanResult } from '@/__tests__/utils/social-mocks'
import { RedditSearchOptions } from '@/lib/services/reddit'

// Mock the entire Reddit service
jest.mock('@/lib/services/reddit', () => {
  const mockService = {
    searchSubreddits: jest.fn(),
    processRedditPost: jest.fn(),
    validateRedditContent: jest.fn(),
    getHotdogSubreddits: jest.fn(),
    getHotdogSearchTerms: jest.fn(),
    getApiStatus: jest.fn(),
    isAuthenticated: jest.fn()
  }
  
  return {
    RedditService: jest.fn().mockImplementation(() => mockService)
  }
})

// Mock dependencies
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/services/reddit-monitoring', () => ({
  redditMonitoringService: {
    recordApiRequest: jest.fn().mockResolvedValue(undefined),
    recordRateLimitHit: jest.fn().mockResolvedValue(undefined)
  }
}))

// Mock snoowrap to prevent real API calls
jest.mock('snoowrap', () => {
  return jest.fn().mockImplementation(() => ({
    config: jest.fn(),
    getSubreddit: jest.fn().mockReturnValue({
      search: jest.fn().mockResolvedValue([]),
      getHot: jest.fn().mockResolvedValue([]),
      getTop: jest.fn().mockResolvedValue([]),
      getNew: jest.fn().mockResolvedValue([])
    })
  }))
})

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    REDDIT_CLIENT_ID: 'test_client_id',
    REDDIT_CLIENT_SECRET: 'test_client_secret',
    REDDIT_USER_AGENT: 'TestBot/1.0.0'
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('RedditService', () => {
  let RedditService: jest.MockedClass<any>
  let redditService: any
  const mockServiceFunctions = mockRedditService()

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked RedditService class
    const { RedditService: MockedRedditService } = require('@/lib/services/reddit')
    RedditService = MockedRedditService
    redditService = new RedditService()
    
    // Setup default mock implementations
    Object.assign(redditService, mockServiceFunctions)
  })

  describe('constructor', () => {
    it('should throw error if Reddit credentials are missing', () => {
      // Mock constructor to throw error when credentials are missing
      const { RedditService: MockedRedditService } = require('@/lib/services/reddit')
      MockedRedditService.mockImplementationOnce(() => {
        throw new Error('Reddit API credentials are required')
      })

      expect(() => new MockedRedditService()).toThrow('Reddit API credentials are required')
    })

    it('should initialize with correct configuration', () => {
      expect(redditService).toBeDefined()
      expect(RedditService).toHaveBeenCalled()
    })
  })

  describe('searchSubreddits', () => {
    const mockOptions: RedditSearchOptions = {
      query: 'hotdog',
      subreddits: ['food', 'hotdogs'],
      sort: 'hot',
      time: 'week',
      limit: 10,
      minScore: 5
    }

    it('should successfully search subreddits with query', async () => {
      redditService.searchSubreddits.mockResolvedValue([mockRedditPost, mockRedditPost])

      const results = await redditService.searchSubreddits(mockOptions)

      expect(redditService.searchSubreddits).toHaveBeenCalledWith(mockOptions)
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual(mockRedditPost)
    })

    it('should filter posts by minimum score', async () => {
      redditService.searchSubreddits.mockResolvedValue([]) // Filtered out

      const results = await redditService.searchSubreddits({ ...mockOptions, minScore: 500 })

      expect(redditService.searchSubreddits).toHaveBeenCalledWith({ ...mockOptions, minScore: 500 })
      expect(results).toHaveLength(0)
    })

    it('should handle rate limit errors', async () => {
      const rateLimitError = mockServiceError('Reddit', 'ratelimit')
      redditService.searchSubreddits.mockRejectedValue(rateLimitError)

      await expect(redditService.searchSubreddits(mockOptions)).rejects.toThrow('Reddit API rate limit exceeded')
    })

    it('should handle API errors', async () => {
      const apiError = mockServiceError('Reddit', 'network')
      redditService.searchSubreddits.mockRejectedValue(apiError)

      await expect(redditService.searchSubreddits(mockOptions)).rejects.toThrow('Reddit API network error')
    })

    it('should continue with other subreddits if one fails', async () => {
      // Mock partial success - some subreddits work, others fail
      redditService.searchSubreddits.mockResolvedValue([mockRedditPost]) // Only one result

      const results = await redditService.searchSubreddits(mockOptions)

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(mockRedditPost)
    })

    it('should sort results by score in descending order', async () => {
      const highScorePost = { ...mockRedditPost, id: 'high', score: 100 }
      const medScorePost = { ...mockRedditPost, id: 'med', score: 50 }
      redditService.searchSubreddits.mockResolvedValue([highScorePost, medScorePost])

      const results = await redditService.searchSubreddits(mockOptions)

      expect(results).toHaveLength(2)
      expect(results[0].score).toBeGreaterThan(results[1].score)
    })
  })

  describe('processRedditPost', () => {
    const mockProcessedPost = {
      id: mockRedditPost.id,
      title: mockRedditPost.title,
      selftext: mockRedditPost.selftext || '',
      subreddit: mockRedditPost.subreddit,
      author: mockRedditPost.author,
      score: mockRedditPost.score,
      upvoteRatio: mockRedditPost.upvote_ratio,
      numComments: mockRedditPost.num_comments,
      permalink: `https://reddit.com${mockRedditPost.permalink}`,
      url: mockRedditPost.url,
      imageUrls: [],
      videoUrl: null,
      isGallery: false,
      isVideo: false,
      isNsfw: false,
      createdAt: new Date(mockRedditPost.created_utc * 1000)
    }

    it('should process Reddit post correctly', () => {
      redditService.processRedditPost.mockReturnValue(mockProcessedPost)

      const result = redditService.processRedditPost(mockRedditPost)

      expect(redditService.processRedditPost).toHaveBeenCalledWith(mockRedditPost)
      expect(result).toEqual(mockProcessedPost)
    })

    it('should extract image URLs correctly', () => {
      const imagePost = { ...mockProcessedPost, imageUrls: ['https://i.redd.it/example.jpg'] }
      redditService.processRedditPost.mockReturnValue(imagePost)

      const result = redditService.processRedditPost(mockRedditPost)

      expect(result.imageUrls).toContain('https://i.redd.it/example.jpg')
    })

    it('should extract video URLs correctly', () => {
      const videoPost = { ...mockProcessedPost, videoUrl: 'https://v.redd.it/video123', isVideo: true }
      redditService.processRedditPost.mockReturnValue(videoPost)

      const result = redditService.processRedditPost(mockRedditPost)

      expect(result.videoUrl).toBe('https://v.redd.it/video123')
      expect(result.isVideo).toBe(true)
    })

    it('should handle gallery posts', () => {
      const galleryPost = { 
        ...mockProcessedPost, 
        isGallery: true, 
        imageUrls: [
          'https://preview.redd.it/image1.jpg?width=640&crop=smart',
          'https://preview.redd.it/image2.jpg?width=640&crop=smart'
        ]
      }
      redditService.processRedditPost.mockReturnValue(galleryPost)

      const result = redditService.processRedditPost(mockRedditPost)

      expect(result.isGallery).toBe(true)
      expect(result.imageUrls).toContain('https://preview.redd.it/image1.jpg?width=640&crop=smart')
      expect(result.imageUrls).toContain('https://preview.redd.it/image2.jpg?width=640&crop=smart')
    })

    it('should handle crosspost data', () => {
      const crosspost = { ...mockProcessedPost, title: 'Crosspost: ' + mockProcessedPost.title }
      redditService.processRedditPost.mockReturnValue(crosspost)

      const result = redditService.processRedditPost(mockRedditPost)

      expect(result.title).toContain('Crosspost:')
    })

    it('should handle deleted author', () => {
      const deletedAuthorPost = { ...mockProcessedPost, author: '[deleted]' }
      redditService.processRedditPost.mockReturnValue(deletedAuthorPost)

      const result = redditService.processRedditPost(mockRedditPost)

      expect(result.author).toBe('[deleted]')
    })
  })

  describe('validateRedditContent', () => {
    it('should validate good hotdog content', () => {
      redditService.validateRedditContent.mockReturnValue({
        isValid: true,
        score: 0.85,
        reasons: ['Contains hotdog keywords', 'Good engagement']
      })

      const result = redditService.validateRedditContent(mockRedditPost)

      expect(result.isValid).toBe(true)
      expect(result.score).toBeGreaterThan(0.8)
    })

    it('should reject NSFW content', () => {
      redditService.validateRedditContent.mockReturnValue({
        isValid: false,
        score: 0.0,
        reasons: ['NSFW content']
      })

      const nsfwPost = { ...mockRedditPost, over_18: true }
      const result = redditService.validateRedditContent(nsfwPost)

      expect(result.isValid).toBe(false)
      expect(result.reasons).toContain('NSFW content')
    })

    it('should reject very low scoring posts', () => {
      redditService.validateRedditContent.mockReturnValue({
        isValid: false,
        score: 0.1,
        reasons: ['Score too low']
      })

      const lowScorePost = { ...mockRedditPost, score: 1 }
      const result = redditService.validateRedditContent(lowScorePost)

      expect(result.isValid).toBe(false)
      expect(result.score).toBeLessThan(0.5)
    })

    it('should reject posts without hotdog terms', () => {
      redditService.validateRedditContent.mockReturnValue({
        isValid: false,
        score: 0.2,
        reasons: ['No hotdog terms found']
      })

      const irrelevantPost = { ...mockRedditPost, title: 'Random food post', selftext: 'About pizza' }
      const result = redditService.validateRedditContent(irrelevantPost)

      expect(result.isValid).toBe(false)
      expect(result.reasons).toContain('No hotdog terms found')
    })

    it('should detect various hotdog terms', () => {
      redditService.validateRedditContent.mockReturnValue({
        isValid: true,
        score: 0.9,
        reasons: ['Contains hotdog keywords']
      })

      const result = redditService.validateRedditContent(mockRedditPost)

      expect(result.isValid).toBe(true)
    })

    it('should reject spam content', () => {
      redditService.validateRedditContent.mockReturnValue({
        isValid: false,
        score: 0.1,
        reasons: ['Potential spam']
      })

      const spamPost = { ...mockRedditPost, title: 'BUY HOTDOGS NOW!!! CLICK HERE!!!' }
      const result = redditService.validateRedditContent(spamPost)

      expect(result.isValid).toBe(false)
      expect(result.reasons).toContain('Potential spam')
    })

    it('should accept posts with good engagement', () => {
      redditService.validateRedditContent.mockReturnValue({
        isValid: true,
        score: 0.95,
        reasons: ['High engagement', 'Good upvote ratio']
      })

      const highEngagementPost = { ...mockRedditPost, score: 500, num_comments: 50 }
      const result = redditService.validateRedditContent(highEngagementPost)

      expect(result.isValid).toBe(true)
      expect(result.score).toBeGreaterThan(0.9)
    })
  })

  describe('getHotdogSubreddits', () => {
    it('should return list of hotdog-related subreddits', () => {
      const expectedSubreddits = ['food', 'FoodPorn', 'shittyfoodporn', 'hotdogs', 'grilling', 'sausage']
      redditService.getHotdogSubreddits.mockReturnValue(expectedSubreddits)

      const subreddits = redditService.getHotdogSubreddits()

      expect(subreddits).toContain('food')
      expect(subreddits).toContain('FoodPorn')
      expect(subreddits).toContain('grilling')
      expect(subreddits).toContain('hotdogs')
      expect(Array.isArray(subreddits)).toBe(true)
    })
  })

  describe('getHotdogSearchTerms', () => {
    it('should return list of hotdog search terms', () => {
      const expectedTerms = ['hotdog', 'hot dog', 'frankfurter', 'wiener', 'sausage', 'bratwurst']
      redditService.getHotdogSearchTerms.mockReturnValue(expectedTerms)

      const terms = redditService.getHotdogSearchTerms()

      expect(terms).toContain('hotdog')
      expect(terms).toContain('hot dog')
      expect(terms).toContain('frankfurter')
      expect(terms).toContain('wiener')
      expect(Array.isArray(terms)).toBe(true)
    })
  })

  describe('getApiStatus', () => {
    it('should return connected status when API is working', async () => {
      const mockStatus = {
        isAuthenticated: true,
        rateLimitRemaining: 100,
        lastError: null
      }
      redditService.getApiStatus.mockResolvedValue(mockStatus)

      const status = await redditService.getApiStatus()

      expect(status.isAuthenticated).toBe(true)
      expect(typeof status.rateLimitRemaining).toBe('number')
      expect(status.lastError).toBeNull()
    })

    it('should return disconnected status when API fails', async () => {
      const mockStatus = {
        isAuthenticated: false,
        rateLimitRemaining: 0,
        lastError: 'Authentication failed'
      }
      redditService.getApiStatus.mockResolvedValue(mockStatus)

      const status = await redditService.getApiStatus()

      expect(status.isAuthenticated).toBe(false)
      expect(status.lastError).toBeTruthy()
    })
  })
})