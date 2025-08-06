import { PostingService } from '@/lib/services/posting'
import { db } from '@/lib/db'

// Mock the database and dependencies
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn(),
    getClient: jest.fn(),
  },
  logToDatabase: jest.fn(),
}))

jest.mock('@/lib/services/scheduling', () => ({
  schedulingService: {
    getScheduleConfig: jest.fn(),
    isPostingTime: jest.fn(),
    selectRandomContent: jest.fn(),
    pauseScheduling: jest.fn(),
  },
}))

const mockDb = db as jest.Mocked<typeof db>

describe('PostingService', () => {
  let postingService: PostingService
  let mockClient: any

  beforeEach(() => {
    postingService = new PostingService()
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    }
    jest.clearAllMocks()
    
    // Mock current date/time
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('postContent', () => {
    it('should successfully post approved content', async () => {
      const mockContent = {
        id: 1,
        content_text: 'Test hotdog content',
        content_type: 'text',
        is_approved: true,
        is_posted: false
      }

      mockDb.getClient.mockResolvedValue(mockClient)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockContent] }) // SELECT content
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // Today's post count
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [{ id: 1, post_order: 1 }] }) // INSERT posted_content
        .mockResolvedValueOnce({ rows: [] }) // COMMIT

      const result = await postingService.postContent(1, false)

      expect(result.success).toBe(true)
      expect(result.contentId).toBe(1)
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('should fail when content is not found or not approved', async () => {
      mockDb.getClient.mockResolvedValue(mockClient)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT content (not found)
        .mockResolvedValueOnce({ rows: [] }) // ROLLBACK

      const result = await postingService.postContent(999, false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Content not found or not available for posting')
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    })

    it('should handle database errors and rollback transaction', async () => {
      mockDb.getClient.mockResolvedValue(mockClient)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')) // SELECT content fails
        .mockResolvedValueOnce({ rows: [] }) // ROLLBACK

      const result = await postingService.postContent(1, false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    })
  })

  describe('getQueueStatus', () => {
    it('should return healthy queue status', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          total_approved: 10,
          total_pending: 5,
          total_posted: 20
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await postingService.getQueueStatus()

      expect(result).toEqual({
        totalApproved: 10,
        totalPending: 5,
        totalPosted: 20,
        isHealthy: true,
        alertLevel: 'none',
        message: 'Queue is healthy'
      })
    })

    it('should detect low queue status', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          total_approved: 3,
          total_pending: 2,
          total_posted: 15
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await postingService.getQueueStatus()

      expect(result.alertLevel).toBe('critical')
      expect(result.isHealthy).toBe(false)
      expect(result.message).toContain('Critical: Only 3 approved items remaining')
    })

    it('should detect empty queue', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          total_approved: 0,
          total_pending: 1,
          total_posted: 10
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await postingService.getQueueStatus()

      expect(result.alertLevel).toBe('critical')
      expect(result.isHealthy).toBe(false)
      expect(result.message).toBe('No approved content available for posting')
    })
  })

  describe('ensureContentAvailable', () => {
    it('should return true when content is available', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          total_approved: 10,
          total_pending: 5,
          total_posted: 20
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await postingService.ensureContentAvailable()

      expect(result).toBe(true)
    })

    it('should return false when no content available', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          total_approved: 0,
          total_pending: 1,
          total_posted: 10
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await postingService.ensureContentAvailable()

      expect(result).toBe(false)
    })
  })

  describe('getPostingHistory', () => {
    it('should return posting history', async () => {
      const mockHistory = [
        {
          id: 1,
          content_queue_id: 1,
          posted_at: new Date(),
          post_order: 1,
          content_type: 'text',
          source_platform: 'reddit'
        },
        {
          id: 2,
          content_queue_id: 2,
          posted_at: new Date(),
          post_order: 2,
          content_type: 'image',
          source_platform: 'flickr'
        }
      ]

      mockDb.query.mockResolvedValue({
        rows: mockHistory,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await postingService.getPostingHistory(10)

      expect(result).toEqual(mockHistory)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [10]
      )
    })

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'))

      const result = await postingService.getPostingHistory(10)

      expect(result).toEqual([])
    })
  })

  describe('getPostingStats', () => {
    it('should return posting statistics', async () => {
      const mockStats = {
        todays_posts: 3,
        this_weeks_posts: 21,
        this_months_posts: 90,
        total_posts: 500,
        avg_posts_per_day: 3.0
      }

      mockDb.query.mockResolvedValue({
        rows: [mockStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await postingService.getPostingStats()

      expect(result).toEqual({
        todaysPosts: 3,
        thisWeeksPosts: 21,
        thisMonthsPosts: 90,
        totalPosts: 500,
        avgPostsPerDay: 3.0
      })
    })

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'))

      const result = await postingService.getPostingStats()

      expect(result).toEqual({
        todaysPosts: 0,
        thisWeeksPosts: 0,
        thisMonthsPosts: 0,
        totalPosts: 0,
        avgPostsPerDay: 0
      })
    })
  })

  describe('processScheduledPost', () => {
    const { schedulingService } = require('@/lib/services/scheduling')

    it('should process scheduled post successfully', async () => {
      const mockContent = {
        id: 1,
        content_text: 'Test content',
        is_approved: true,
        is_posted: false
      }

      schedulingService.getScheduleConfig.mockResolvedValue({
        is_enabled: true
      })
      schedulingService.isPostingTime.mockResolvedValue(true)
      schedulingService.selectRandomContent.mockResolvedValue(mockContent)

      mockDb.query.mockResolvedValue({
        rows: [{
          total_approved: 10,
          total_pending: 5,
          total_posted: 20
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      mockDb.getClient.mockResolvedValue(mockClient)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockContent] }) // SELECT content
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // Today's post count
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [{ id: 1, post_order: 1 }] }) // INSERT posted_content
        .mockResolvedValueOnce({ rows: [] }) // COMMIT

      const result = await postingService.processScheduledPost()

      expect(result.success).toBe(true)
      expect(result.contentId).toBe(1)
    })

    it('should skip posting when scheduling is disabled', async () => {
      schedulingService.getScheduleConfig.mockResolvedValue({
        is_enabled: false
      })

      const result = await postingService.processScheduledPost()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Scheduling is disabled')
    })

    it('should skip posting when not posting time', async () => {
      schedulingService.getScheduleConfig.mockResolvedValue({
        is_enabled: true
      })
      schedulingService.isPostingTime.mockResolvedValue(false)

      const result = await postingService.processScheduledPost()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not posting time')
    })

    it('should handle empty queue', async () => {
      schedulingService.getScheduleConfig.mockResolvedValue({
        is_enabled: true
      })
      schedulingService.isPostingTime.mockResolvedValue(true)
      schedulingService.selectRandomContent.mockResolvedValue(null)

      mockDb.query.mockResolvedValue({
        rows: [{
          total_approved: 0,
          total_pending: 0,
          total_posted: 10
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await postingService.processScheduledPost()

      expect(result.success).toBe(false)
      expect(result.error).toBe('No content available for posting')
    })
  })

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.getClient.mockRejectedValue(new Error('Connection failed'))

      const result = await postingService.postContent(1, false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('should handle queue status errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Query failed'))

      const result = await postingService.getQueueStatus()

      expect(result.isHealthy).toBe(false)
      expect(result.alertLevel).toBe('critical')
      expect(result.message).toBe('Failed to check queue status')
    })
  })
})