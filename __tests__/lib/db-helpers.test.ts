import { 
  ContentQueueHelper, 
  PostedContentHelper, 
  AdminUserHelper, 
  SystemLogHelper,
  getSystemStats 
} from '@/lib/db-helpers'
import { ContentType, SourcePlatform, LogLevel } from '@/types'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Mock the database
jest.mock('@/lib/db')
const mockDb = db as jest.Mocked<typeof db>

// Mock bcrypt
jest.mock('bcryptjs')
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

describe('Database Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('ContentQueueHelper', () => {
    describe('create', () => {
      it('should create content queue item successfully', async () => {
        const mockContent = {
          id: 1,
          content_text: 'Test hotdog content',
          content_type: ContentType.TEXT,
          source_platform: SourcePlatform.TWITTER,
          original_url: 'https://twitter.com/test',
          original_author: 'testuser',
          scraped_at: new Date(),
          content_hash: 'mock-hash',
          is_posted: false,
          is_approved: false,
          created_at: new Date(),
          updated_at: new Date()
        }

        mockDb.query.mockResolvedValue({ rows: [mockContent] } as any)

        const result = await ContentQueueHelper.create({
          content_text: 'Test hotdog content',
          content_type: ContentType.TEXT,
          source_platform: SourcePlatform.TWITTER,
          original_url: 'https://twitter.com/test',
          original_author: 'testuser'
        })

        expect(result).toEqual(mockContent)
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO content_queue'),
          expect.arrayContaining(['Test hotdog content', ContentType.TEXT])
        )
      })
    })

    describe('findUnposted', () => {
      it('should find unposted approved content', async () => {
        const mockContent = [{
          id: 1,
          content_text: 'Test content',
          is_posted: false,
          is_approved: true
        }]

        mockDb.query.mockResolvedValue({ rows: mockContent } as any)

        const result = await ContentQueueHelper.findUnposted(5)

        expect(result).toEqual(mockContent)
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE is_posted = FALSE AND is_approved = TRUE'),
          [5]
        )
      })
    })

    describe('markAsPosted', () => {
      it('should mark content as posted', async () => {
        const mockContent = {
          id: 1,
          is_posted: true,
          posted_at: new Date()
        }

        mockDb.query.mockResolvedValue({ rows: [mockContent] } as any)

        const result = await ContentQueueHelper.markAsPosted(1)

        expect(result).toEqual(mockContent)
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE content_queue'),
          [1]
        )
      })

      it('should throw error if content not found', async () => {
        mockDb.query.mockResolvedValue({ rows: [] } as any)

        await expect(ContentQueueHelper.markAsPosted(999))
          .rejects.toThrow('Content queue item with id 999 not found')
      })
    })

    describe('generateContentHash', () => {
      it('should generate consistent hash for same content', () => {
        const hash1 = ContentQueueHelper.generateContentHash(
          'test content',
          'image.jpg',
          undefined,
          'https://example.com'
        )
        const hash2 = ContentQueueHelper.generateContentHash(
          'test content',
          'image.jpg',
          undefined,
          'https://example.com'
        )

        expect(hash1).toBe(hash2)
        expect(typeof hash1).toBe('string')
        expect(hash1.length).toBe(64) // SHA-256 produces 64 character hex string
      })

      it('should generate different hash for different content', () => {
        const hash1 = ContentQueueHelper.generateContentHash('content1')
        const hash2 = ContentQueueHelper.generateContentHash('content2')

        expect(hash1).not.toBe(hash2)
      })
    })

    describe('isDuplicate', () => {
      it('should return true for duplicate content', async () => {
        const mockContent = { id: 1, content_hash: 'existing-hash' }
        mockDb.query.mockResolvedValue({ rows: [mockContent] } as any)

        const result = await ContentQueueHelper.isDuplicate('test content')

        expect(result).toBe(true)
      })

      it('should return false for unique content', async () => {
        mockDb.query.mockResolvedValue({ rows: [] } as any)

        const result = await ContentQueueHelper.isDuplicate('unique content')

        expect(result).toBe(false)
      })
    })
  })

  describe('PostedContentHelper', () => {
    describe('create', () => {
      it('should create posted content entry', async () => {
        const mockPostedContent = {
          id: 1,
          content_queue_id: 1,
          posted_at: new Date(),
          post_order: 1,
          created_at: new Date(),
          updated_at: new Date()
        }

        mockDb.query.mockResolvedValue({ rows: [mockPostedContent] } as any)

        const result = await PostedContentHelper.create({
          content_queue_id: 1,
          post_order: 1
        })

        expect(result).toEqual(mockPostedContent)
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO posted_content'),
          [1, undefined, 1]
        )
      })
    })

    describe('getNextPostOrder', () => {
      it('should return next post order for today', async () => {
        mockDb.query.mockResolvedValue({ rows: [{ next_order: 4 }] } as any)

        const result = await PostedContentHelper.getNextPostOrder()

        expect(result).toBe(4)
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('MAX(post_order)')
        )
      })

      it('should return 1 for first post of the day', async () => {
        mockDb.query.mockResolvedValue({ rows: [{}] } as any)

        const result = await PostedContentHelper.getNextPostOrder()

        expect(result).toBe(1)
      })
    })
  })

  describe('AdminUserHelper', () => {
    describe('create', () => {
      it('should create admin user with hashed password', async () => {
        const mockUser = {
          id: 1,
          username: 'admin',
          password_hash: 'hashed-password',
          created_at: new Date(),
          updated_at: new Date()
        }

        mockDb.query
          .mockResolvedValueOnce({ rows: [] } as any) // findByUsername returns empty
          .mockResolvedValueOnce({ rows: [mockUser] } as any) // create returns user

        mockBcrypt.hash.mockResolvedValue('hashed-password' as never)

        const result = await AdminUserHelper.create('admin', 'password123')

        expect(result).toEqual(mockUser)
        expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10)
      })

      it('should throw error if username already exists', async () => {
        const existingUser = { id: 1, username: 'admin' }
        mockDb.query.mockResolvedValue({ rows: [existingUser] } as any)

        await expect(AdminUserHelper.create('admin', 'password'))
          .rejects.toThrow('Username already exists')
      })
    })

    describe('validatePassword', () => {
      it('should return user for valid credentials', async () => {
        const mockUser = {
          id: 1,
          username: 'admin',
          password_hash: 'hashed-password'
        }

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockUser] } as any) // findByUsername
          .mockResolvedValueOnce({ rows: [] } as any) // update last_login

        mockBcrypt.compare.mockResolvedValue(true as never)

        const result = await AdminUserHelper.validatePassword('admin', 'password123')

        expect(result).toEqual(mockUser)
        expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password')
      })

      it('should return null for invalid password', async () => {
        const mockUser = {
          id: 1,
          username: 'admin',
          password_hash: 'hashed-password'
        }

        mockDb.query.mockResolvedValue({ rows: [mockUser] } as any)
        mockBcrypt.compare.mockResolvedValue(false as never)

        const result = await AdminUserHelper.validatePassword('admin', 'wrongpassword')

        expect(result).toBeNull()
      })

      it('should return null for non-existent user', async () => {
        mockDb.query.mockResolvedValue({ rows: [] } as any)

        const result = await AdminUserHelper.validatePassword('nonexistent', 'password')

        expect(result).toBeNull()
      })
    })
  })

  describe('SystemLogHelper', () => {
    describe('create', () => {
      it('should create system log entry', async () => {
        const mockLog = {
          id: 1,
          log_level: LogLevel.INFO,
          message: 'Test log message',
          component: 'test-component',
          metadata: { key: 'value' },
          created_at: new Date()
        }

        mockDb.query.mockResolvedValue({ rows: [mockLog] } as any)

        const result = await SystemLogHelper.create(
          LogLevel.INFO,
          'Test log message',
          'test-component',
          { key: 'value' }
        )

        expect(result).toEqual(mockLog)
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO system_logs'),
          [LogLevel.INFO, 'Test log message', 'test-component', '{"key":"value"}']
        )
      })
    })

    describe('cleanup', () => {
      it('should delete old log entries', async () => {
        mockDb.query.mockResolvedValue({ rowCount: 10 } as any)

        const result = await SystemLogHelper.cleanup(30)

        expect(result).toBe(10)
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM system_logs')
        )
      })
    })
  })

  describe('getSystemStats', () => {
    it('should return comprehensive system statistics', async () => {
      const mockResults = [
        { rows: [{ count: '100' }] }, // totalContent
        { rows: [{ count: '80' }] },  // approvedContent
        { rows: [{ count: '60' }] },  // postedContent
        { rows: [{ count: '6' }] },   // todaysPosts
        { rows: [{ count: '20' }] }   // pendingApproval
      ]

      mockDb.query
        .mockResolvedValueOnce(mockResults[0] as any)
        .mockResolvedValueOnce(mockResults[1] as any)
        .mockResolvedValueOnce(mockResults[2] as any)
        .mockResolvedValueOnce(mockResults[3] as any)
        .mockResolvedValueOnce(mockResults[4] as any)

      const result = await getSystemStats()

      expect(result).toEqual({
        totalContent: 100,
        approvedContent: 80,
        postedContent: 60,
        todaysPosts: 6,
        pendingApproval: 20
      })
    })
  })
})