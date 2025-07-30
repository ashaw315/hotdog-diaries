import { InstagramService, InstagramSearchOptions, ProcessedInstagramMedia } from '@/lib/services/instagram'
import { instagramMonitoringService } from '@/lib/services/instagram-monitoring'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/services/instagram-monitoring', () => ({
  instagramMonitoringService: {
    recordApiRequest: jest.fn().mockResolvedValue(undefined),
    recordRateLimitHit: jest.fn().mockResolvedValue(undefined),
    recordTokenRefresh: jest.fn().mockResolvedValue(undefined)
  }
}))

// Mock fetch globally
global.fetch = jest.fn()

const mockInstagramMonitoringService = instagramMonitoringService as jest.Mocked<typeof instagramMonitoringService>

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    INSTAGRAM_CLIENT_ID: 'test_client_id',
    INSTAGRAM_CLIENT_SECRET: 'test_client_secret'
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('InstagramService', () => {
  let instagramService: InstagramService
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    instagramService = new InstagramService()
  })

  describe('constructor', () => {
    it('should initialize without errors', () => {
      expect(instagramService).toBeInstanceOf(InstagramService)
    })
  })

  describe('searchHashtags', () => {
    const mockOptions: InstagramSearchOptions = {
      hashtag: 'hotdog',
      limit: 10,
      minLikes: 5
    }

    const mockMediaResponse = {
      data: [
        {
          id: 'test123',
          caption: 'Delicious hotdog for lunch! #hotdog #food',
          media_type: 'IMAGE',
          media_url: 'https://instagram.com/test.jpg',
          permalink: 'https://instagram.com/p/test123',
          timestamp: '2023-01-01T12:00:00Z',
          username: 'foodlover',
          like_count: 25,
          comments_count: 5
        }
      ]
    }

    beforeEach(() => {
      // Set up mock access token
      ;(instagramService as any).accessToken = 'mock_token'
      ;(instagramService as any).tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    })

    it('should successfully search hashtags', async () => {
      // Mock getUserMedia to return media data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockMediaResponse.data[0]] })
      } as Response)

      const results = await instagramService.searchHashtags(mockOptions)

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: 'test123',
        caption: 'Delicious hotdog for lunch! #hotdog #food',
        mediaType: 'IMAGE',
        username: 'foodlover',
        likesCount: 25,
        commentsCount: 5
      })
      expect(mockInstagramMonitoringService.recordApiRequest).toHaveBeenCalledWith(true, expect.any(Number))
    })

    it('should throw error when not authenticated', async () => {
      ;(instagramService as any).accessToken = null

      await expect(instagramService.searchHashtags(mockOptions)).rejects.toThrow('Instagram access token not available')
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: { message: 'Invalid request' } })
      } as Response)

      await expect(instagramService.searchHashtags(mockOptions)).rejects.toThrow('Instagram hashtag search failed')
      expect(mockInstagramMonitoringService.recordApiRequest).toHaveBeenCalledWith(false, expect.any(Number), 'api_error')
    })

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Instagram API rate limit exceeded')
      mockFetch.mockRejectedValueOnce(rateLimitError)

      await expect(instagramService.searchHashtags(mockOptions)).rejects.toThrow('Instagram hashtag search failed')
      expect(mockInstagramMonitoringService.recordApiRequest).toHaveBeenCalledWith(false, expect.any(Number), 'rate_limit')
    })

    it('should filter posts by minimum likes', async () => {
      const mockLowLikesResponse = {
        data: [
          {
            id: 'low_likes',
            caption: 'Small hotdog post #hotdog',
            media_type: 'IMAGE',
            media_url: 'https://instagram.com/low.jpg',
            permalink: 'https://instagram.com/p/low_likes',
            timestamp: '2023-01-01T12:00:00Z',
            username: 'smallaccount',
            like_count: 2, // Below minLikes threshold
            comments_count: 0
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLowLikesResponse
      } as Response)

      const results = await instagramService.searchHashtags(mockOptions)
      expect(results).toHaveLength(0) // Filtered out due to low likes
    })
  })

  describe('processInstagramMedia', () => {
    const mockRawMedia = {
      id: 'test123',
      caption: 'Great hotdog with extra toppings! #hotdog #foodporn @restaurant',
      media_type: 'IMAGE',
      media_url: 'https://instagram.com/test.jpg',
      permalink: 'https://instagram.com/p/test123',
      timestamp: '2023-01-01T12:00:00Z',
      username: 'foodlover',
      like_count: 25,
      comments_count: 5
    }

    it('should process Instagram media correctly', async () => {
      const result = await instagramService.processInstagramMedia(mockRawMedia)

      expect(result).toEqual(expect.objectContaining({
        id: 'test123',
        caption: 'Great hotdog with extra toppings! #hotdog #foodporn @restaurant',
        mediaType: 'IMAGE',
        mediaUrl: 'https://instagram.com/test.jpg',
        username: 'foodlover',
        likesCount: 25,
        commentsCount: 5,
        hashtags: ['hotdog', 'foodporn'],
        mentions: ['restaurant'],
        isStory: false
      }))
    })

    it('should extract hashtags correctly', async () => {
      const mediaWithHashtags = {
        ...mockRawMedia,
        caption: 'Amazing #hotdog and #cheeseburger with #fries #yummy'
      }

      const result = await instagramService.processInstagramMedia(mediaWithHashtags)

      expect(result.hashtags).toEqual(['hotdog', 'cheeseburger', 'fries', 'yummy'])
    })

    it('should extract mentions correctly', async () => {
      const mediaWithMentions = {
        ...mockRawMedia,
        caption: 'Thanks @restaurant and @chef for the amazing hotdog!'
      }

      const result = await instagramService.processInstagramMedia(mediaWithMentions)

      expect(result.mentions).toEqual(['restaurant', 'chef'])
    })

    it('should handle carousel media', async () => {
      const carouselMedia = {
        ...mockRawMedia,
        media_type: 'CAROUSEL_ALBUM',
        children: { data: [] } // Add children property
      }

      // Mock carousel children API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'child1', media_type: 'IMAGE', media_url: 'https://instagram.com/child1.jpg' },
            { id: 'child2', media_type: 'VIDEO', media_url: 'https://instagram.com/child2.mp4' }
          ]
        })
      } as Response)

      const result = await instagramService.processInstagramMedia(carouselMedia)

      expect(result.mediaType).toBe('CAROUSEL_ALBUM')
      expect(result.carouselMedia).toHaveLength(2)
      expect(result.carouselMedia![0]).toEqual({
        id: 'child1',
        mediaType: 'IMAGE',
        mediaUrl: 'https://instagram.com/child1.jpg'
      })
    })

    it('should handle missing data gracefully', async () => {
      const minimalMedia = {
        id: 'minimal',
        media_type: 'IMAGE'
      }

      const result = await instagramService.processInstagramMedia(minimalMedia)

      expect(result).toEqual(expect.objectContaining({
        id: 'minimal',
        caption: '',
        mediaType: 'IMAGE',
        username: 'unknown',
        userId: 'unknown',
        likesCount: 0,
        commentsCount: 0,
        hashtags: [],
        mentions: []
      }))
    })
  })

  describe('validateInstagramContent', () => {
    const baseMedia: ProcessedInstagramMedia = {
      id: 'test123',
      caption: 'Delicious hotdog with mustard and ketchup',
      mediaType: 'IMAGE',
      mediaUrl: 'https://instagram.com/test.jpg',
      thumbnailUrl: undefined,
      permalink: 'https://instagram.com/p/test123',
      username: 'foodlover',
      userId: 'user123',
      timestamp: new Date(),
      likesCount: 15,
      commentsCount: 3,
      hashtags: ['hotdog', 'food'],
      mentions: [],
      isStory: false
    }

    it('should validate good hotdog content', async () => {
      const result = await instagramService.validateInstagramContent(baseMedia)
      expect(result).toBe(true)
    })

    it('should reject content without hotdog terms', async () => {
      const irrelevantMedia = {
        ...baseMedia,
        caption: 'Beautiful sunset at the beach',
        hashtags: ['sunset', 'beach']
      }

      const result = await instagramService.validateInstagramContent(irrelevantMedia)
      expect(result).toBe(false)
    })

    it('should detect various hotdog terms', async () => {
      const terms = ['hotdog', 'hot dog', 'frankfurter', 'bratwurst', 'wiener']
      
      for (const term of terms) {
        const media = {
          ...baseMedia,
          caption: `Great ${term} recipe`,
          hashtags: []
        }
        const result = await instagramService.validateInstagramContent(media)
        expect(result).toBe(true)
      }
    })

    it('should validate through hashtags', async () => {
      const mediaWithHashtag = {
        ...baseMedia,
        caption: 'Great lunch today',
        hashtags: ['hotdog', 'lunch']
      }

      const result = await instagramService.validateInstagramContent(mediaWithHashtag)
      expect(result).toBe(true)
    })

    it('should reject spam content', async () => {
      const spamMedia = {
        ...baseMedia,
        caption: 'Best hotdog deals! Buy now with promo code SPAM50 - link in bio!'
      }

      const result = await instagramService.validateInstagramContent(spamMedia)
      expect(result).toBe(false)
    })

    it('should accept content with good engagement', async () => {
      const engagedMedia = {
        ...baseMedia,
        caption: 'hotdog', // minimal text
        likesCount: 50,
        commentsCount: 15,
        mediaUrl: 'https://instagram.com/test.jpg'
      }

      const result = await instagramService.validateInstagramContent(engagedMedia)
      expect(result).toBe(true)
    })
  })

  describe('handleInstagramAuth', () => {
    const mockAuthCode = 'test_auth_code'
    const mockRedirectUri = 'https://example.com/callback'

    it('should handle authentication flow successfully', async () => {
      // Mock short-lived token exchange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'short_token',
            user_id: 'user123',
            scope: 'user_profile,user_media'
          })
        } as Response)
        // Mock long-lived token exchange
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'long_token',
            expires_in: 3600
          })
        } as Response)

      const result = await instagramService.handleInstagramAuth(mockAuthCode, mockRedirectUri)

      expect(result).toEqual(expect.objectContaining({
        accessToken: 'long_token',
        userId: 'user123',
        expiresAt: expect.any(Date)
      }))
    })

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error_message: 'Invalid auth code' })
      } as Response)

      await expect(instagramService.handleInstagramAuth(mockAuthCode, mockRedirectUri))
        .rejects.toThrow('Token exchange failed: Invalid auth code')
    })

    it('should throw error when credentials not configured', async () => {
      delete process.env.INSTAGRAM_CLIENT_ID

      await expect(instagramService.handleInstagramAuth(mockAuthCode, mockRedirectUri))
        .rejects.toThrow('Instagram client credentials not configured')

      process.env.INSTAGRAM_CLIENT_ID = 'test_client_id'
    })
  })

  describe('refreshAccessToken', () => {
    beforeEach(() => {
      ;(instagramService as any).accessToken = 'existing_token'
    })

    it('should refresh token successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_token',
          expires_in: 7200
        })
      } as Response)

      await instagramService.refreshAccessToken()

      expect(mockInstagramMonitoringService.recordTokenRefresh).toHaveBeenCalledWith(true, expect.any(Date))
    })

    it('should handle refresh errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Token expired' } })
      } as Response)

      await expect(instagramService.refreshAccessToken()).rejects.toThrow('Token refresh failed')
      expect(mockInstagramMonitoringService.recordTokenRefresh).toHaveBeenCalledWith(false)
    })

    it('should throw error when no token to refresh', async () => {
      ;(instagramService as any).accessToken = null

      await expect(instagramService.refreshAccessToken()).rejects.toThrow('No access token to refresh')
    })
  })

  describe('getApiStatus', () => {
    it('should return authenticated status when token is valid', async () => {
      ;(instagramService as any).accessToken = 'valid_token'
      ;(instagramService as any).tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'user123', username: 'testuser' })
      } as Response)

      const status = await instagramService.getApiStatus()

      expect(status.isAuthenticated).toBe(true)
      expect(status.rateLimits).toBeDefined()
      expect(status.tokenExpiresAt).toBeDefined()
    })

    it('should return unauthenticated status when token is invalid', async () => {
      ;(instagramService as any).accessToken = 'invalid_token'

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      } as Response)

      const status = await instagramService.getApiStatus()

      expect(status.isAuthenticated).toBe(false)
    })

    it('should handle API errors gracefully', async () => {
      ;(instagramService as any).accessToken = 'valid_token'
      ;(instagramService as any).tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const status = await instagramService.getApiStatus()

      expect(status.isAuthenticated).toBe(false)
      expect(status.lastError).toBe('Network error')
    })
  })

  describe('getHotdogHashtags', () => {
    it('should return list of hotdog-related hashtags', () => {
      const hashtags = instagramService.getHotdogHashtags()
      
      expect(hashtags).toContain('hotdog')
      expect(hashtags).toContain('hotdogs')
      expect(hashtags).toContain('frankfurter')
      expect(hashtags).toContain('foodporn')
      expect(Array.isArray(hashtags)).toBe(true)
      expect(hashtags.length).toBeGreaterThan(10)
    })
  })

  describe('rate limiting', () => {
    beforeEach(() => {
      ;(instagramService as any).accessToken = 'valid_token'
      ;(instagramService as any).tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    })

    it('should track rate limit usage', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
        status: 200
      } as Response)

      const initialUsed = (instagramService as any).rateLimitTracker.used

      await instagramService.searchHashtags({ hashtag: 'hotdog' })

      const finalUsed = (instagramService as any).rateLimitTracker.used
      expect(finalUsed).toBe(initialUsed + 1)
    })

    it('should throw error when rate limit exceeded', async () => {
      // Set rate limit to maximum
      ;(instagramService as any).rateLimitTracker = {
        used: 200,
        remaining: 0,
        resetTime: new Date(Date.now() + 60 * 60 * 1000)
      }

      await expect(instagramService.searchHashtags({ hashtag: 'hotdog' }))
        .rejects.toThrow('Instagram API rate limit exceeded')
    })
  })
})