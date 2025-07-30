import { RedditService, RedditSearchOptions, ProcessedRedditPost } from '@/lib/services/reddit'
import { redditMonitoringService } from '@/lib/services/reddit-monitoring'

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

jest.mock('snoowrap', () => {
  return jest.fn().mockImplementation(() => ({
    config: jest.fn(),
    getSubreddit: jest.fn().mockReturnValue({
      search: jest.fn(),
      getHot: jest.fn(),
      getTop: jest.fn(),
      getNew: jest.fn()
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
  let redditService: RedditService
  let mockSubreddit: any

  beforeEach(() => {
    jest.clearAllMocks()
    redditService = new RedditService()
    mockSubreddit = {
      search: jest.fn(),
      getHot: jest.fn(),
      getTop: jest.fn(),
      getNew: jest.fn()
    }
    
    // Mock the getSubreddit method
    ;(redditService as any).client.getSubreddit = jest.fn().mockReturnValue(mockSubreddit)
  })

  describe('constructor', () => {
    it('should throw error if Reddit credentials are missing', () => {
      const originalClientId = process.env.REDDIT_CLIENT_ID
      delete process.env.REDDIT_CLIENT_ID

      expect(() => new RedditService()).toThrow('Reddit API credentials are required')

      process.env.REDDIT_CLIENT_ID = originalClientId
    })

    it('should initialize with correct configuration', () => {
      expect(redditService).toBeInstanceOf(RedditService)
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

    const mockRedditPost = {
      id: 'test123',
      title: 'Delicious hotdog',
      selftext: 'Check out this amazing hotdog!',
      subreddit: { display_name: 'food' },
      author: { name: 'foodlover' },
      created_utc: 1640995200, // 2022-01-01
      score: 25,
      upvote_ratio: 0.95,
      num_comments: 5,
      permalink: '/r/food/comments/test123/delicious_hotdog',
      url: 'https://i.redd.it/example.jpg',
      over_18: false,
      spoiler: false,
      stickied: false,
      is_gallery: false,
      crosspost_parent_list: []
    }

    beforeEach(() => {
      mockSubreddit.search.mockResolvedValue([mockRedditPost])
      mockSubreddit.getHot.mockResolvedValue([mockRedditPost])
    })

    it('should successfully search subreddits with query', async () => {
      const results = await redditService.searchSubreddits(mockOptions)

      expect(results).toHaveLength(2) // One post from each subreddit
      expect(mockSubreddit.search).toHaveBeenCalledTimes(2)
      expect(redditMonitoringService.recordApiRequest).toHaveBeenCalledWith(true, expect.any(Number))
    })

    it('should filter posts by minimum score', async () => {
      const lowScorePost = { ...mockRedditPost, score: 3 }
      mockSubreddit.search.mockResolvedValue([lowScorePost])

      const results = await redditService.searchSubreddits(mockOptions)

      expect(results).toHaveLength(0) // Post filtered out due to low score
    })

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('rate limit exceeded')
      mockSubreddit.search.mockRejectedValue(rateLimitError)

      await expect(redditService.searchSubreddits(mockOptions)).rejects.toThrow('Reddit API rate limit exceeded')
      expect(redditMonitoringService.recordApiRequest).toHaveBeenCalledWith(false, expect.any(Number), 'rate_limit')
      expect(redditMonitoringService.recordRateLimitHit).toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const apiError = new Error('API connection failed')
      mockSubreddit.search.mockRejectedValue(apiError)

      await expect(redditService.searchSubreddits(mockOptions)).rejects.toThrow('Reddit search failed')
      expect(redditMonitoringService.recordApiRequest).toHaveBeenCalledWith(false, expect.any(Number), 'api_error')
    })

    it('should continue with other subreddits if one fails', async () => {
      mockSubreddit.search
        .mockRejectedValueOnce(new Error('Subreddit not found'))
        .mockResolvedValueOnce([mockRedditPost])

      const results = await redditService.searchSubreddits(mockOptions)

      expect(results).toHaveLength(1) // Only successful subreddit
      expect(mockSubreddit.search).toHaveBeenCalledTimes(2)
    })

    it('should sort results by score in descending order', async () => {
      const highScorePost = { ...mockRedditPost, id: 'high', score: 100 }
      const medScorePost = { ...mockRedditPost, id: 'med', score: 50 }
      const lowScorePost = { ...mockRedditPost, id: 'low', score: 10 }

      mockSubreddit.search
        .mockResolvedValueOnce([lowScorePost, highScorePost])
        .mockResolvedValueOnce([medScorePost])

      const results = await redditService.searchSubreddits(mockOptions)

      expect(results[0].score).toBe(100)
      expect(results[1].score).toBe(50)
      expect(results[2].score).toBe(10)
    })
  })

  describe('processRedditPost', () => {
    const mockRawPost = {
      id: 'test123',
      title: 'Test Hotdog Post',
      selftext: 'This is a test post about hotdogs',
      subreddit: { display_name: 'food' },
      author: { name: 'testuser' },
      created_utc: 1640995200,
      score: 25,
      upvote_ratio: 0.95,
      num_comments: 5,
      permalink: '/r/food/comments/test123/test_hotdog_post',
      url: 'https://i.redd.it/example.jpg',
      over_18: false,
      spoiler: false,
      stickied: false,
      is_gallery: false,
      crosspost_parent_list: []
    }

    it('should process Reddit post correctly', () => {
      const result = redditService.processRedditPost(mockRawPost)

      expect(result).toEqual(expect.objectContaining({
        id: 'test123',
        title: 'Test Hotdog Post',
        selftext: 'This is a test post about hotdogs',
        subreddit: 'food',
        author: 'testuser',
        score: 25,
        upvoteRatio: 0.95,
        numComments: 5,
        permalink: 'https://reddit.com/r/food/comments/test123/test_hotdog_post',
        isNSFW: false,
        isSpoiler: false,
        isStickied: false,
        isGallery: false,
        isCrosspost: false
      }))
    })

    it('should extract image URLs correctly', () => {
      const postWithImage = {
        ...mockRawPost,
        url: 'https://i.redd.it/example.jpg'
      }

      const result = redditService.processRedditPost(postWithImage)

      expect(result.imageUrls).toContain('https://i.redd.it/example.jpg')
      expect(result.mediaUrls).toContain('https://i.redd.it/example.jpg')
    })

    it('should extract video URLs correctly', () => {
      const postWithVideo = {
        ...mockRawPost,
        url: 'https://v.redd.it/example'
      }

      const result = redditService.processRedditPost(postWithVideo)

      expect(result.videoUrls).toContain('https://v.redd.it/example')
      expect(result.mediaUrls).toContain('https://v.redd.it/example')
    })

    it('should handle gallery posts', () => {
      const galleryPost = {
        ...mockRawPost,
        is_gallery: true,
        media_metadata: {
          'image1': {
            s: { u: 'https://preview.redd.it/image1.jpg?width=640&amp;crop=smart' }
          },
          'image2': {
            s: { u: 'https://preview.redd.it/image2.jpg?width=640&amp;crop=smart' }
          }
        }
      }

      const result = redditService.processRedditPost(galleryPost)

      expect(result.isGallery).toBe(true)
      expect(result.imageUrls).toContain('https://preview.redd.it/image1.jpg?width=640&crop=smart')
      expect(result.imageUrls).toContain('https://preview.redd.it/image2.jpg?width=640&crop=smart')
    })

    it('should handle crosspost data', () => {
      const crosspost = {
        ...mockRawPost,
        crosspost_parent_list: [{
          subreddit: 'originalSub',
          author: 'originalAuthor',
          title: 'Original Title'
        }]
      }

      const result = redditService.processRedditPost(crosspost)

      expect(result.isCrosspost).toBe(true)
      expect(result.crosspostOrigin).toEqual({
        subreddit: 'originalSub',
        author: 'originalAuthor',
        title: 'Original Title'
      })
    })

    it('should handle deleted author', () => {
      const deletedPost = {
        ...mockRawPost,
        author: null
      }

      const result = redditService.processRedditPost(deletedPost)

      expect(result.author).toBe('[deleted]')
    })
  })

  describe('validateRedditContent', () => {
    const basePost: ProcessedRedditPost = {
      id: 'test123',
      title: 'Delicious hotdog recipe',
      selftext: 'Here is how to make the best hotdog',
      subreddit: 'food',
      author: 'chef123',
      createdAt: new Date(),
      score: 15,
      upvoteRatio: 0.9,
      numComments: 5,
      permalink: 'https://reddit.com/r/food/comments/test123',
      url: 'https://example.com',
      imageUrls: ['https://i.redd.it/example.jpg'],
      videoUrls: [],
      mediaUrls: ['https://i.redd.it/example.jpg'],
      isNSFW: false,
      isSpoiler: false,
      isStickied: false,
      flair: undefined,
      isGallery: false,
      isCrosspost: false
    }

    it('should validate good hotdog content', async () => {
      const result = await redditService.validateRedditContent(basePost)
      expect(result).toBe(true)
    })

    it('should reject NSFW content', async () => {
      const nsfwPost = { ...basePost, isNSFW: true }
      const result = await redditService.validateRedditContent(nsfwPost)
      expect(result).toBe(false)
    })

    it('should reject very low scoring posts', async () => {
      const lowScorePost = { ...basePost, score: 0 }
      const result = await redditService.validateRedditContent(lowScorePost)
      expect(result).toBe(false)
    })

    it('should reject posts without hotdog terms', async () => {
      const irrelevantPost = {
        ...basePost,
        title: 'Beautiful sunset',
        selftext: 'Just a nice sunset photo'
      }
      const result = await redditService.validateRedditContent(irrelevantPost)
      expect(result).toBe(false)
    })

    it('should detect various hotdog terms', async () => {
      const terms = ['hotdog', 'hot dog', 'frankfurter', 'bratwurst', 'wiener']
      
      for (const term of terms) {
        const post = {
          ...basePost,
          title: `Great ${term} recipe`,
          selftext: ''
        }
        const result = await redditService.validateRedditContent(post)
        expect(result).toBe(true)
      }
    })

    it('should reject spam content', async () => {
      const spamPost = {
        ...basePost,
        title: 'Best hotdog deals - click here now!',
        selftext: 'Buy now with promo code SPAM50'
      }
      const result = await redditService.validateRedditContent(spamPost)
      expect(result).toBe(false)
    })

    it('should accept posts with good engagement', async () => {
      const engagedPost = {
        ...basePost,
        score: 50,
        numComments: 25,
        mediaUrls: [] // No media but good engagement
      }
      const result = await redditService.validateRedditContent(engagedPost)
      expect(result).toBe(true)
    })
  })

  describe('getHotdogSubreddits', () => {
    it('should return list of hotdog-related subreddits', () => {
      const subreddits = redditService.getHotdogSubreddits()
      
      expect(subreddits).toContain('hotdogs')
      expect(subreddits).toContain('food')
      expect(subreddits).toContain('FoodPorn')
      expect(subreddits).toContain('grilling')
      expect(Array.isArray(subreddits)).toBe(true)
      expect(subreddits.length).toBeGreaterThan(5)
    })
  })

  describe('getHotdogSearchTerms', () => {
    it('should return list of hotdog search terms', () => {
      const terms = redditService.getHotdogSearchTerms()
      
      expect(terms).toContain('hotdog')
      expect(terms).toContain('hot dog')
      expect(terms).toContain('frankfurter')
      expect(terms).toContain('bratwurst')
      expect(Array.isArray(terms)).toBe(true)
      expect(terms.length).toBeGreaterThan(5)
    })
  })

  describe('getApiStatus', () => {
    it('should return connected status when API is working', async () => {
      mockSubreddit.getHot.mockResolvedValue([])

      const status = await redditService.getApiStatus()

      expect(status.isConnected).toBe(true)
      expect(status.rateLimits).toBeDefined()
      expect(status.userAgent).toBeDefined()
    })

    it('should return disconnected status when API fails', async () => {
      mockSubreddit.getHot.mockRejectedValue(new Error('Connection failed'))

      const status = await redditService.getApiStatus()

      expect(status.isConnected).toBe(false)
      expect(status.lastError).toBe('Connection failed')
    })
  })
})