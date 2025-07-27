import { ContentService } from '@/lib/services/content'
import { ContentType, SourcePlatform } from '@/types'
import { query, insert, update, deleteFrom } from '@/lib/db-query-builder'
import { generateContentHash } from '@/lib/utils/content-hash'

// Mock the database query builder
jest.mock('@/lib/db-query-builder')
const mockQuery = query as jest.MockedFunction<typeof query>
const mockInsert = insert as jest.MockedFunction<typeof insert>
const mockUpdate = update as jest.MockedFunction<typeof update>
const mockDelete = deleteFrom as jest.MockedFunction<typeof deleteFrom>

// Mock content hash generator
jest.mock('@/lib/utils/content-hash')
const mockGenerateContentHash = generateContentHash as jest.MockedFunction<typeof generateContentHash>

// Mock database logger
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn()
}))

describe('ContentService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createContent', () => {
    it('should create content successfully', async () => {
      const contentData = {
        content_text: 'Amazing hotdog!',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.TWITTER,
        original_url: 'https://twitter.com/test/1',
        original_author: 'testuser'
      }

      const mockHash = 'mock-content-hash'
      const mockCreatedContent = {
        id: 1,
        ...contentData,
        content_hash: mockHash,
        is_posted: false,
        is_approved: false,
        scraped_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }

      mockGenerateContentHash.mockReturnValue(mockHash)
      
      // Mock finding no existing content with same hash
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      // Mock successful insert
      const mockInsertBuilder = {
        values: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockCreatedContent)
      }
      mockInsert.mockReturnValue(mockInsertBuilder as any)

      const result = await ContentService.createContent(contentData)

      expect(result).toEqual(mockCreatedContent)
      expect(mockGenerateContentHash).toHaveBeenCalledWith({
        content_text: contentData.content_text,
        content_image_url: undefined,
        content_video_url: undefined,
        original_url: contentData.original_url
      })
    })

    it('should throw error for duplicate content', async () => {
      const contentData = {
        content_text: 'Duplicate hotdog!',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.TWITTER,
        original_url: 'https://twitter.com/test/1'
      }

      const mockHash = 'duplicate-hash'
      const existingContent = { id: 1, content_hash: mockHash }

      mockGenerateContentHash.mockReturnValue(mockHash)
      
      // Mock finding existing content with same hash
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingContent)
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      await expect(ContentService.createContent(contentData))
        .rejects.toThrow('Duplicate content detected. Existing content ID: 1')
    })

    it('should throw validation error for invalid data', async () => {
      const invalidData = {
        content_type: 'invalid' as ContentType,
        source_platform: SourcePlatform.TWITTER,
        original_url: 'invalid-url'
      }

      await expect(ContentService.createContent(invalidData))
        .rejects.toThrow('Validation failed')
    })
  })

  describe('getQueuedContent', () => {
    it('should return paginated queued content', async () => {
      const pagination = { page: 1, limit: 10 }
      const mockContent = [
        {
          id: 1,
          content_text: 'Queued hotdog',
          content_type: ContentType.TEXT,
          is_posted: false,
          is_approved: true
        }
      ]

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue(1),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ rows: mockContent })
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      const result = await ContentService.getQueuedContent(pagination)

      expect(result.items).toEqual(mockContent)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
    })

    it('should apply filters correctly', async () => {
      const pagination = { page: 1, limit: 10 }
      const filters = {
        content_type: ContentType.IMAGE,
        source_platform: SourcePlatform.INSTAGRAM,
        is_approved: true,
        author: 'testuser'
      }

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue(0),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ rows: [] })
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      await ContentService.getQueuedContent(pagination, filters)

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_posted', '=', false)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('content_type', '=', ContentType.IMAGE)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('source_platform', '=', SourcePlatform.INSTAGRAM)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_approved', '=', true)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('original_author', 'ILIKE', '%testuser%')
    })
  })

  describe('markAsPosted', () => {
    it('should mark content as posted successfully', async () => {
      const contentId = 1
      const mockContent = {
        id: contentId,
        is_posted: false,
        content_text: 'Test content'
      }
      const mockUpdatedContent = { ...mockContent, is_posted: true, posted_at: new Date() }
      const mockPostedContent = {
        id: 1,
        content_queue_id: contentId,
        posted_at: new Date(),
        post_order: 1
      }

      // Mock findById
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockContent)
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      // Mock PostedContentHelper.getNextPostOrder
      jest.doMock('@/lib/db-helpers', () => ({
        PostedContentHelper: {
          getNextPostOrder: jest.fn().mockResolvedValue(1)
        }
      }))

      // Mock update
      const mockUpdateBuilder = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUpdatedContent)
      }
      mockUpdate.mockReturnValue(mockUpdateBuilder as any)

      // Mock insert for posted_content
      const mockInsertBuilder = {
        values: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockPostedContent)
      }
      mockInsert.mockReturnValue(mockInsertBuilder as any)

      const result = await ContentService.markAsPosted(contentId)

      expect(result.contentQueue).toEqual(mockUpdatedContent)
      expect(result.postedContent).toEqual(mockPostedContent)
    })

    it('should throw error if content not found', async () => {
      const contentId = 999

      // Mock findById returning null
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      await expect(ContentService.markAsPosted(contentId))
        .rejects.toThrow('Content with ID 999 not found')
    })

    it('should throw error if content already posted', async () => {
      const contentId = 1
      const mockContent = {
        id: contentId,
        is_posted: true,
        content_text: 'Already posted content'
      }

      // Mock findById
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockContent)
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      await expect(ContentService.markAsPosted(contentId))
        .rejects.toThrow('Content with ID 1 is already posted')
    })
  })

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      const contentId = 1
      const mockContent = {
        id: contentId,
        is_posted: false,
        content_text: 'Content to delete'
      }

      // Mock findById
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockContent)
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      // Mock delete
      const mockDeleteBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockContent)
      }
      mockDelete.mockReturnValue(mockDeleteBuilder as any)

      const result = await ContentService.deleteContent(contentId)

      expect(result).toEqual(mockContent)
    })

    it('should throw error if trying to delete posted content', async () => {
      const contentId = 1
      const mockContent = {
        id: contentId,
        is_posted: true,
        content_text: 'Posted content'
      }

      // Mock findById
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockContent)
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      await expect(ContentService.deleteContent(contentId))
        .rejects.toThrow('Cannot delete posted content with ID 1')
    })
  })

  describe('updateContent', () => {
    it('should update content successfully', async () => {
      const contentId = 1
      const updates = {
        content_text: 'Updated content',
        admin_notes: 'Updated by admin'
      }
      const mockContent = {
        id: contentId,
        is_posted: false,
        content_text: 'Original content',
        content_image_url: undefined,
        content_video_url: undefined,
        original_url: 'https://example.com'
      }
      const mockUpdatedContent = { ...mockContent, ...updates }

      // Mock findById
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockContent)
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      // Mock content hash generation and duplicate check
      mockGenerateContentHash.mockReturnValue('new-hash')
      const mockHashQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null) // No duplicate found
      }
      mockQuery.mockReturnValue(mockHashQueryBuilder as any)

      // Mock update
      const mockUpdateBuilder = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUpdatedContent)
      }
      mockUpdate.mockReturnValue(mockUpdateBuilder as any)

      const result = await ContentService.updateContent(contentId, updates)

      expect(result).toEqual(mockUpdatedContent)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const mockCountResults = [5, 3, 4, 2, 1] // total, queued, approved, posted, today

      let callIndex = 0
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockImplementation(() => Promise.resolve(mockCountResults[callIndex++]))
      }
      mockQuery.mockReturnValue(mockQueryBuilder as any)

      const result = await ContentService.getStats()

      expect(result).toEqual({
        totalContent: 5,
        queuedContent: 3,
        approvedContent: 4,
        postedContent: 2,
        todaysPosts: 1
      })
    })
  })
})