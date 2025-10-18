/**
 * Tests for Legacy Posting Service
 * 
 * Verifies backward compatibility and proper delegation to new service.
 */

import { postContent, postNextContent } from '../../lib/services/posting/legacy-poster'
import { postFromSchedule } from '../../lib/services/posting/schedule-only-poster'
import { ContentItem } from '../../types'

// Mock the new schedule-only poster
jest.mock('../../lib/services/posting/schedule-only-poster')
const mockPostFromSchedule = postFromSchedule as jest.MockedFunction<typeof postFromSchedule>

// Mock the legacy posting service
jest.mock('../../lib/services/posting-service', () => ({
  postContent: jest.fn(),
  postNextContent: jest.fn()
}))

const originalEnv = process.env

describe('Legacy Posting Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('when ENFORCE_SCHEDULE_SOURCE_OF_TRUTH is true', () => {
    beforeEach(() => {
      process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = 'true'
    })

    it('should delegate postContent to postFromSchedule', async () => {
      const mockContent: ContentItem = {
        id: 100,
        content_text: 'Test hotdog content',
        source_platform: 'reddit',
        content_type: 'text',
        is_approved: true,
        is_posted: false,
        confidence_score: 0.8,
        created_at: '2025-01-01T00:00:00Z'
      }

      mockPostFromSchedule.mockResolvedValue({
        success: true,
        type: 'POSTED',
        scheduledSlotId: 1,
        contentId: 100,
        platform: 'reddit',
        postedAt: '2025-01-01T12:00:00Z',
        metadata: {
          contentPreview: 'Test hotdog content preview'
        }
      })

      const result = await postContent(mockContent, true)

      expect(mockPostFromSchedule).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.contentId).toBe(100)
      expect(result.platform).toBe('reddit')
      expect(result.contentText).toBe('Test hotdog content preview')
    })

    it('should delegate postNextContent to postFromSchedule', async () => {
      mockPostFromSchedule.mockResolvedValue({
        success: true,
        type: 'NO_SCHEDULED_CONTENT'
      })

      const result = await postNextContent()

      expect(mockPostFromSchedule).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.error).toBe('No content posted: NO_SCHEDULED_CONTENT')
    })

    it('should handle errors from postFromSchedule', async () => {
      mockPostFromSchedule.mockResolvedValue({
        success: false,
        type: 'ERROR',
        error: 'Database connection failed'
      })

      const mockContent: ContentItem = {
        id: 101,
        content_text: 'Another test',
        source_platform: 'youtube',
        content_type: 'video',
        is_approved: true,
        is_posted: false,
        confidence_score: 0.7,
        created_at: '2025-01-01T00:00:00Z'
      }

      const result = await postContent(mockContent)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should log deprecation warnings', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      mockPostFromSchedule.mockResolvedValue({
        success: true,
        type: 'POSTED',
        contentId: 100,
        platform: 'reddit'
      })

      const mockContent: ContentItem = {
        id: 100,
        content_text: 'Test',
        source_platform: 'reddit',
        content_type: 'text',
        is_approved: true,
        is_posted: false,
        confidence_score: 0.8,
        created_at: '2025-01-01T00:00:00Z'
      }

      await postContent(mockContent)
      await postNextContent()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('postContent() is deprecated')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('postNextContent() is deprecated')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('when ENFORCE_SCHEDULE_SOURCE_OF_TRUTH is false', () => {
    beforeEach(() => {
      process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = 'false'
    })

    it('should use legacy postContent implementation', async () => {
      const { postContent: legacyPostContent } = await import('../../lib/services/posting-service')
      const mockLegacyPostContent = legacyPostContent as jest.MockedFunction<typeof legacyPostContent>
      
      mockLegacyPostContent.mockResolvedValue({
        success: true,
        contentId: 100,
        contentText: 'Legacy posted content',
        platform: 'reddit',
        postedAt: '2025-01-01T12:00:00Z'
      })

      const mockContent: ContentItem = {
        id: 100,
        content_text: 'Test content',
        source_platform: 'reddit',
        content_type: 'text',
        is_approved: true,
        is_posted: false,
        confidence_score: 0.8,
        created_at: '2025-01-01T00:00:00Z'
      }

      const result = await postContent(mockContent, false)

      expect(mockLegacyPostContent).toHaveBeenCalledWith(mockContent, false)
      expect(mockPostFromSchedule).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.contentText).toBe('Legacy posted content')
    })

    it('should use legacy postNextContent implementation', async () => {
      const { postNextContent: legacyPostNextContent } = await import('../../lib/services/posting-service')
      const mockLegacyPostNextContent = legacyPostNextContent as jest.MockedFunction<typeof legacyPostNextContent>
      
      mockLegacyPostNextContent.mockResolvedValue({
        success: true,
        contentId: 101,
        contentText: 'Legacy next content',
        platform: 'youtube',
        postedAt: '2025-01-01T12:30:00Z'
      })

      const result = await postNextContent()

      expect(mockLegacyPostNextContent).toHaveBeenCalledTimes(1)
      expect(mockPostFromSchedule).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.contentText).toBe('Legacy next content')
    })
  })
})