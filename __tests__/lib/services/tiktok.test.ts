import { TikTokService } from '@/lib/services/tiktok'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

// Mock dependencies
jest.mock('@/lib/db-query-builder')
jest.mock('@/lib/db')

const mockQuery = query as jest.MockedFunction<typeof query>
const mockLogToDatabase = logToDatabase as jest.MockedFunction<typeof logToDatabase>

// Mock fetch globally
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('TikTokService', () => {
  let tikTokService: TikTokService
  let mockSelect: jest.Mock
  let mockFirst: jest.Mock
  let mockUpsert: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup query builder mocks
    mockSelect = jest.fn().mockReturnThis()
    mockFirst = jest.fn()
    mockUpsert = jest.fn()
    
    mockQuery.mockImplementation(() => ({
      select: mockSelect,
      first: mockFirst,
      upsert: mockUpsert,
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis()
    }) as any)

    tikTokService = new TikTokService()
  })

  describe('Authentication', () => {
    test('should authenticate with TikTok OAuth2', async () => {
      const mockAuthData = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        open_id: 'test-open-id',
        expires_at: new Date(Date.now() + 3600000),
        scope: ['user.info.basic', 'video.list']
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: mockAuthData.access_token,
          refresh_token: mockAuthData.refresh_token,
          open_id: mockAuthData.open_id,
          expires_in: 3600,
          scope: 'user.info.basic,video.list'
        })
      } as Response)

      const result = await tikTokService.authenticate('test-auth-code', 'https://example.com/callback')

      expect(mockFetch).toHaveBeenCalledWith('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        },
        body: expect.stringContaining('grant_type=authorization_code')
      })

      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        access_token: mockAuthData.access_token,
        refresh_token: mockAuthData.refresh_token,
        open_id: mockAuthData.open_id
      }))

      expect(result.success).toBe(true)
      expect(result.openId).toBe(mockAuthData.open_id)
    })

    test('should handle authentication failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        })
      } as Response)

      const result = await tikTokService.authenticate('invalid-code', 'https://example.com/callback')

      expect(result.success).toBe(false)
      expect(result.error).toContain('invalid_grant')
      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'TIKTOK_AUTH_ERROR',
        expect.any(String),
        expect.any(Object)
      )
    })

    test('should refresh expired tokens', async () => {
      const expiredToken = {
        id: 1,
        access_token: 'expired-token',
        refresh_token: 'valid-refresh-token',
        open_id: 'test-open-id',
        expires_at: new Date(Date.now() - 1000), // Expired
        is_active: true
      }

      mockFirst.mockResolvedValueOnce(expiredToken)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600
        })
      } as Response)

      const validToken = await tikTokService.getValidAccessToken()

      expect(mockFetch).toHaveBeenCalledWith('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        },
        body: expect.stringContaining('grant_type=refresh_token')
      })

      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      }))

      expect(validToken).toBe('new-access-token')
    })
  })

  describe('Video Search', () => {
    beforeEach(() => {
      // Mock valid token
      mockFirst.mockResolvedValue({
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000),
        is_active: true
      })
    })

    test('should search videos by keywords', async () => {
      const mockVideos = {
        data: {
          videos: [
            {
              id: 'video1',
              title: 'Amazing hotdog recipe!',
              video_description: 'Check out this delicious hotdog',
              duration: 30,
              cover_image_url: 'https://example.com/cover1.jpg',
              play_url: 'https://example.com/video1.mp4',
              create_time: 1640995200,
              view_count: 1000,
              like_count: 50,
              comment_count: 10,
              share_count: 5
            }
          ],
          cursor: 'next-cursor',
          has_more: false
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos
      } as Response)

      const result = await tikTokService.searchVideos({
        keywords: ['hotdog', 'recipe'],
        maxResults: 10
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://open.tiktokapis.com/v2/research/video/query/'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('"query":{"and":[{"keyword":{"keyword_name":"hotdog"}},{"keyword":{"keyword_name":"recipe"}}]}')
        })
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'video1',
        title: 'Amazing hotdog recipe!',
        description: 'Check out this delicious hotdog',
        duration: 30,
        coverImageUrl: 'https://example.com/cover1.jpg',
        videoUrl: 'https://example.com/video1.mp4',
        metrics: {
          views: 1000,
          likes: 50,
          comments: 10,
          shares: 5
        }
      })
    })

    test('should search videos by hashtags', async () => {
      const mockVideos = {
        data: {
          videos: [
            {
              id: 'video2',
              title: 'Grilling time! #foodtok',
              video_description: 'Perfect hotdog grilling tips',
              duration: 45,
              cover_image_url: 'https://example.com/cover2.jpg',
              play_url: 'https://example.com/video2.mp4',
              create_time: 1640995200,
              view_count: 2000,
              like_count: 100,
              comment_count: 20,
              share_count: 15
            }
          ],
          cursor: null,
          has_more: false
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos
      } as Response)

      const result = await tikTokService.searchVideos({
        hashtags: ['foodtok', 'grilling'],
        maxResults: 10,
        sortBy: 'view_count'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://open.tiktokapis.com/v2/research/video/query/'),
        expect.objectContaining({
          body: expect.stringContaining('"query":{"and":[{"hashtag_name":"foodtok"},{"hashtag_name":"grilling"}]}')
        })
      )

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('video2')
      expect(result[0].metrics.views).toBe(2000)
    })

    test('should handle API rate limits', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['X-RateLimit-Reset', '1640995800']])
      } as any)

      await expect(tikTokService.searchVideos({
        keywords: ['hotdog'],
        maxResults: 10
      })).rejects.toThrow('Rate limit exceeded')

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.WARNING,
        'TIKTOK_RATE_LIMIT_HIT',
        expect.any(String),
        expect.objectContaining({
          resetTime: expect.any(String)
        })
      )
    })

    test('should filter videos by duration and view count', async () => {
      const mockVideos = {
        data: {
          videos: [
            {
              id: 'video1',
              title: 'Short hotdog video',
              video_description: 'Quick hotdog tip',
              duration: 15, // Too short
              view_count: 50, // Too few views
              create_time: 1640995200,
              like_count: 1,
              comment_count: 0,
              share_count: 0
            },
            {
              id: 'video2',
              title: 'Perfect hotdog video',
              video_description: 'Great hotdog content',
              duration: 60, // Good duration
              view_count: 500, // Good view count
              create_time: 1640995200,
              like_count: 25,
              comment_count: 5,
              share_count: 2
            }
          ]
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos
      } as Response)

      const result = await tikTokService.searchVideos({
        keywords: ['hotdog'],
        maxResults: 10,
        minViews: 100,
        maxDuration: 180
      })

      // Should only return video2 after filtering
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('video2')
    })
  })

  describe('Content Processing', () => {
    test('should process video content correctly', async () => {
      const rawVideo = {
        id: 'test-video',
        title: 'Amazing hotdog recipe!',
        video_description: 'Check out this delicious hotdog with mustard and ketchup',
        duration: 30,
        cover_image_url: 'https://example.com/cover.jpg',
        play_url: 'https://example.com/video.mp4',
        create_time: 1640995200,
        view_count: 1000,
        like_count: 50,
        comment_count: 10,
        share_count: 5
      }

      const processed = tikTokService.processVideoContent(rawVideo)

      expect(processed).toMatchObject({
        id: 'test-video',
        title: 'Amazing hotdog recipe!',
        description: 'Check out this delicious hotdog with mustard and ketchup',
        duration: 30,
        coverImageUrl: 'https://example.com/cover.jpg',
        videoUrl: 'https://example.com/video.mp4',
        createdAt: new Date(1640995200 * 1000),
        metrics: {
          views: 1000,
          likes: 50,
          comments: 10,
          shares: 5
        },
        keywords: ['hotdog', 'delicious', 'mustard', 'ketchup'],
        qualityScore: expect.any(Number)
      })

      expect(processed.qualityScore).toBeGreaterThan(0)
    })

    test('should calculate quality scores correctly', async () => {
      const highQualityVideo = {
        id: 'high-quality',
        title: 'Premium hotdog cooking masterclass',
        video_description: 'Professional hotdog preparation techniques with detailed ingredients',
        duration: 90,
        view_count: 10000,
        like_count: 500,
        comment_count: 100,
        share_count: 50,
        create_time: 1640995200
      }

      const lowQualityVideo = {
        id: 'low-quality',
        title: 'hotdog',
        video_description: 'food',
        duration: 10,
        view_count: 10,
        like_count: 0,
        comment_count: 0,
        share_count: 0,
        create_time: 1640995200
      }

      const highQuality = tikTokService.processVideoContent(highQualityVideo)
      const lowQuality = tikTokService.processVideoContent(lowQualityVideo)

      expect(highQuality.qualityScore).toBeGreaterThan(lowQuality.qualityScore)
      expect(highQuality.qualityScore).toBeGreaterThan(50)
      expect(lowQuality.qualityScore).toBeLessThan(30)
    })

    test('should extract keywords from title and description', async () => {
      const video = {
        id: 'keyword-test',
        title: 'Ultimate Chicago-style hotdog with relish and pickles',
        video_description: 'Learn to make authentic Chicago hotdogs with mustard, onions, tomatoes, and sport peppers',
        duration: 60,
        view_count: 1000,
        like_count: 50,
        comment_count: 10,
        share_count: 5,
        create_time: 1640995200
      }

      const processed = tikTokService.processVideoContent(video)

      expect(processed.keywords).toEqual(expect.arrayContaining([
        'ultimate', 'chicago-style', 'hotdog', 'relish', 'pickles',
        'authentic', 'chicago', 'hotdogs', 'mustard', 'onions',
        'tomatoes', 'sport', 'peppers'
      ]))
    })
  })

  describe('Connection Testing', () => {
    test('should test connection successfully with valid token', async () => {
      mockFirst.mockResolvedValueOnce({
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000),
        is_active: true
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            open_id: 'test-open-id',
            union_id: 'test-union-id',
            avatar_url: 'https://example.com/avatar.jpg'
          }
        })
      } as Response)

      const result = await tikTokService.testConnection()

      expect(result.success).toBe(true)
      expect(result.userInfo).toMatchObject({
        openId: 'test-open-id',
        unionId: 'test-union-id',
        avatarUrl: 'https://example.com/avatar.jpg'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/user/info/',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token'
          })
        })
      )
    })

    test('should fail connection test with invalid token', async () => {
      mockFirst.mockResolvedValueOnce(null) // No valid token

      const result = await tikTokService.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('No valid authentication')
    })

    test('should handle API errors during connection test', async () => {
      mockFirst.mockResolvedValueOnce({
        access_token: 'invalid-token',
        expires_at: new Date(Date.now() + 3600000),
        is_active: true
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'invalid_token',
            message: 'Invalid access token'
          }
        })
      } as Response)

      const result = await tikTokService.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('invalid_token')
    })
  })

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      mockFirst.mockResolvedValueOnce({
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000),
        is_active: true
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(tikTokService.searchVideos({
        keywords: ['hotdog'],
        maxResults: 10
      })).rejects.toThrow('Network error')

      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'TIKTOK_SEARCH_ERROR',
        expect.any(String),
        expect.objectContaining({
          error: 'Network error'
        })
      )
    })

    test('should handle malformed API responses', async () => {
      mockFirst.mockResolvedValueOnce({
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000),
        is_active: true
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      } as Response)

      const result = await tikTokService.searchVideos({
        keywords: ['hotdog'],
        maxResults: 10
      })

      expect(result).toEqual([])
      expect(mockLogToDatabase).toHaveBeenCalledWith(
        LogLevel.WARNING,
        'TIKTOK_UNEXPECTED_RESPONSE',
        expect.any(String),
        expect.any(Object)
      )
    })
  })
})