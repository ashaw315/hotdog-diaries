/**
 * Tests for ContentService - core content management functionality
 * Updated to use centralized test utilities and new mocking patterns
 */

import { mockDbConnection, mockDbResponses, mockContentRow, testDataSets } from '@/__tests__/utils/db-mocks'
import { ContentService } from '@/lib/services/content'
import { ContentType, SourcePlatform } from '@/types'

// Mock the database query builder with execute method
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  first: jest.fn(),
  execute: jest.fn(), // Add missing execute method
  then: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  count: jest.fn().mockResolvedValue(0),
  set: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis()
}

jest.mock('@/lib/db-query-builder', () => ({
  query: jest.fn(() => mockQueryBuilder),
  insert: jest.fn(() => mockQueryBuilder),
  update: jest.fn(() => mockQueryBuilder),
  deleteFrom: jest.fn(() => mockQueryBuilder)
}))

// Mock the database connection
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    healthCheck: jest.fn(),
    transaction: jest.fn()
  },
  logToDatabase: jest.fn()
}))

// Mock content hash generator
jest.mock('@/lib/utils/content-hash', () => ({
  generateContentHash: jest.fn().mockReturnValue('mock-hash'),
  checkContentSimilarity: jest.fn().mockReturnValue(false)
}))

// Mock validation
jest.mock('@/lib/validation/content', () => ({
  validateContent: jest.fn().mockReturnValue({ isValid: true, errors: [] })
}))

// Mock db-helpers
jest.mock('@/lib/db-helpers', () => ({
  PostedContentHelper: {
    getNextPostOrder: jest.fn().mockResolvedValue(1),
    createPostedContentRecord: jest.fn().mockResolvedValue({
      id: 1,
      content_queue_id: 1,
      posted_at: new Date(),
      post_order: 1
    })
  }
}))

describe('ContentService', () => {
  let mockDb: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up database mock
    mockDb = mockDbConnection()
    const { db } = require('@/lib/db')
    Object.assign(db, mockDb)
    
    // Reset query builder methods
    Object.values(mockQueryBuilder).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockReturnThis()
      }
    })
    
    // Reset specific methods that need to return promises
    mockQueryBuilder.execute.mockResolvedValue(mockDbResponses.empty())
    mockQueryBuilder.first.mockResolvedValue(null)
    mockQueryBuilder.count.mockResolvedValue(0)
  })

  describe('createContent', () => {
    it('should create content successfully', async () => {
      const contentData = {
        content_text: 'Amazing hotdog!',
        content_type: 'text' as ContentType,
        source_platform: 'reddit' as SourcePlatform,
        original_url: 'https://reddit.com/r/hotdogs/test',
        original_author: 'testuser'
      }

      const mockCreatedContent = {
        ...mockContentRow,
        id: 1,
        content_text: contentData.content_text,
        content_type: contentData.content_type,
        source_platform: contentData.source_platform,
        original_url: contentData.original_url,
        original_author: contentData.original_author,
        content_hash: 'mock-hash'
      }

      // Mock that no duplicate exists (first call for duplicate check)
      mockQueryBuilder.first.mockResolvedValueOnce(null)
      // Mock the insert operation result (second call for insert)
      mockQueryBuilder.first.mockResolvedValueOnce(mockCreatedContent)

      const result = await ContentService.createContent(contentData)

      expect(result).toEqual(mockCreatedContent)
      
      // Get the mocked functions and check they were called
      const { insert } = require('@/lib/db-query-builder')
      expect(insert).toHaveBeenCalledWith('content_queue')
    })

    it('should throw error for duplicate content', async () => {
      const contentData = {
        content_text: 'Duplicate content',
        content_type: 'text' as ContentType,
        source_platform: 'reddit' as SourcePlatform,
        original_url: 'https://reddit.com/r/hotdogs/duplicate'
      }

      // Mock that duplicate content exists
      mockQueryBuilder.first.mockResolvedValueOnce({ id: 1 }) // Duplicate check returns existing content

      await expect(ContentService.createContent(contentData))
        .rejects.toThrow('Duplicate content detected')
    })

    it('should throw validation error for invalid data', async () => {
      const invalidData = {
        content_type: 'invalid',
        source_platform: 'invalid'
      }

      // Mock validation to fail
      const { validateContent } = require('@/lib/validation/content')
      validateContent.mockReturnValue({
        isValid: false,
        errors: [{ field: 'content_type', message: 'Invalid content type' }]
      })

      await expect(ContentService.createContent(invalidData as any))
        .rejects.toThrow('Validation failed')
    })
  })

  describe('getQueuedContent', () => {
    it('should return paginated queued content', async () => {
      const mockContent = [
        {
          ...mockContentRow,
          id: 1,
          content_text: 'Test content',
          content_type: 'text',
          source_platform: 'reddit',
          is_posted: false
        }
      ]

      // Mock count for pagination
      mockQueryBuilder.count.mockResolvedValue(1)
      // Mock the execute method to return rows
      mockQueryBuilder.execute.mockResolvedValue({ rows: mockContent })

      const result = await ContentService.getQueuedContent({ page: 1, limit: 10 })

      expect(result.items).toEqual(mockContent)
      expect(result.pagination.total).toBe(1)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_posted', '=', false)
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10)
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0)
    })

    it('should apply filters correctly', async () => {
      const filters = {
        content_type: ContentType.IMAGE,
        source_platform: SourcePlatform.REDDIT,
        is_approved: true,
        author: 'testuser'  // Use 'author' not 'original_author'
      }

      mockQueryBuilder.count.mockResolvedValue(0)
      mockQueryBuilder.then.mockResolvedValue([])

      await ContentService.getQueuedContent({ page: 1, limit: 10 }, filters)

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_posted', '=', false)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('content_type', '=', ContentType.IMAGE)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('source_platform', '=', SourcePlatform.REDDIT)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_approved', '=', true)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('original_author', 'ILIKE', '%testuser%')
    })
  })

  describe('markAsPosted', () => {
    it('should mark content as posted successfully', async () => {
      const contentId = 1
      const mockUnpostedContent = {
        ...mockContentRow,
        id: contentId,
        content_text: 'Test content',
        is_posted: false
      }
      const mockUpdatedContent = {
        ...mockUnpostedContent,
        is_posted: true,
        posted_at: new Date()
      }
      const mockPostedContent = {
        id: 1,
        content_queue_id: contentId,
        posted_at: new Date(),
        post_order: 1
      }

      // Mock findById to return unposted content  
      mockQueryBuilder.first.mockResolvedValueOnce(mockUnpostedContent)
      // Mock the update operation result
      mockQueryBuilder.first.mockResolvedValueOnce(mockUpdatedContent)
      // Mock the insert operation for posted_content
      mockQueryBuilder.first.mockResolvedValueOnce(mockPostedContent)

      const result = await ContentService.markAsPosted(contentId)

      expect(result.contentQueue).toEqual(mockUpdatedContent)
      expect(result.postedContent).toEqual(mockPostedContent)
      
      // Get the mocked functions and check they were called
      const { update, insert } = require('@/lib/db-query-builder')
      expect(update).toHaveBeenCalledWith('content_queue')
      expect(insert).toHaveBeenCalledWith('posted_content')
    })

    it('should throw error if content not found', async () => {
      const contentId = 999

      mockQueryBuilder.first.mockResolvedValue(null)

      await expect(ContentService.markAsPosted(contentId))
        .rejects.toThrow('Content with ID 999 not found')
    })

    it('should throw error if content already posted', async () => {
      const contentId = 1

      // Mock content that's already posted
      mockQueryBuilder.first.mockResolvedValue({
        id: contentId,
        is_posted: true
      })

      await expect(ContentService.markAsPosted(contentId))
        .rejects.toThrow('Content with ID 1 is already posted')
    })
  })

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      const contentId = 1
      const mockContent = {
        id: contentId,
        content_text: 'Test content',
        is_posted: false
      }

      // Mock findById to return content
      mockQueryBuilder.first.mockResolvedValueOnce(mockContent)
      // Mock the delete operation result - it calls .first() and returns the deleted content
      mockQueryBuilder.first.mockResolvedValueOnce(mockContent)

      const result = await ContentService.deleteContent(contentId)

      expect(result).toEqual(mockContent)
      
      // Get the mocked functions and check they were called
      const { deleteFrom } = require('@/lib/db-query-builder')
      expect(deleteFrom).toHaveBeenCalledWith('content_queue')
    })

    it('should throw error if trying to delete posted content', async () => {
      const contentId = 1

      mockQueryBuilder.first.mockResolvedValue({
        id: contentId,
        is_posted: true
      })

      await expect(ContentService.deleteContent(contentId))
        .rejects.toThrow('Cannot delete posted content')
    })
  })

  describe('updateContent', () => {
    it('should update content successfully', async () => {
      const contentId = 1
      const updates = {
        content_text: 'Updated content',
        is_approved: true
      }

      const mockUpdatedContent = {
        id: contentId,
        ...updates,
        updated_at: new Date()
      }

      mockQueryBuilder.first.mockResolvedValue(mockUpdatedContent)

      const result = await ContentService.updateContent(contentId, updates)

      expect(result).toEqual(mockUpdatedContent)
      
      // Get the mocked functions and check they were called
      const { update } = require('@/lib/db-query-builder')
      expect(update).toHaveBeenCalledWith('content_queue')
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Mock count queries for different stats in the correct order
      mockQueryBuilder.count
        .mockResolvedValueOnce(100)  // totalContent (total)
        .mockResolvedValueOnce(65)   // queuedContent (queued)
        .mockResolvedValueOnce(25)   // approvedContent (approved)
        .mockResolvedValueOnce(10)   // postedContent (posted)
        .mockResolvedValueOnce(3)    // todaysPosts (today)

      const result = await ContentService.getStats()

      expect(result).toEqual({
        totalContent: 100,
        approvedContent: 25,
        postedContent: 10,
        queuedContent: 65,
        todaysPosts: 3
      })
      
      // Get the mocked functions and check they were called
      const { query } = require('@/lib/db-query-builder')
      expect(query).toHaveBeenCalled()
    })
  })
})