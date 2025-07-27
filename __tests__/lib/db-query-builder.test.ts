import { QueryBuilder, InsertBuilder, UpdateBuilder, DeleteBuilder, query, insert, update, deleteFrom } from '@/lib/db-query-builder'
import { Client } from 'pg'

// Mock the database connection
jest.mock('@/lib/db', () => ({
  getClient: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn()
  }))
}))

describe('QueryBuilder', () => {
  let mockClient: jest.Mocked<Client>

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    } as any
    
    const { getClient } = require('@/lib/db')
    getClient.mockReturnValue(mockClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('QueryBuilder', () => {
    it('should build basic SELECT query', () => {
      const builder = new QueryBuilder('content_queue')
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue')
      expect(sql.params).toEqual([])
    })

    it('should build SELECT query with specific columns', () => {
      const builder = new QueryBuilder('content_queue')
      builder.select(['id', 'content_text', 'is_posted'])
      const sql = builder.build()

      expect(sql.query).toBe('SELECT id, content_text, is_posted FROM content_queue')
    })

    it('should build query with WHERE conditions', () => {
      const builder = new QueryBuilder('content_queue')
      builder.where('is_posted', '=', false)
      builder.where('is_approved', '=', true)
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue WHERE is_posted = $1 AND is_approved = $2')
      expect(sql.params).toEqual([false, true])
    })

    it('should build query with OR conditions', () => {
      const builder = new QueryBuilder('content_queue')
      builder.where('content_type', '=', 'text')
      builder.orWhere('content_type', '=', 'image')
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue WHERE content_type = $1 OR content_type = $2')
      expect(sql.params).toEqual(['text', 'image'])
    })

    it('should build query with ORDER BY', () => {
      const builder = new QueryBuilder('content_queue')
      builder.orderBy('created_at', 'DESC')
      builder.orderBy('id', 'ASC')
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue ORDER BY created_at DESC, id ASC')
    })

    it('should build query with LIMIT and OFFSET', () => {
      const builder = new QueryBuilder('content_queue')
      builder.limit(10)
      builder.offset(20)
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue LIMIT $1 OFFSET $2')
      expect(sql.params).toEqual([10, 20])
    })

    it('should build complex query with all clauses', () => {
      const builder = new QueryBuilder('content_queue')
      builder.select(['id', 'content_text'])
      builder.where('is_posted', '=', false)
      builder.where('source_platform', '=', 'twitter')
      builder.orderBy('created_at', 'DESC')
      builder.limit(5)
      builder.offset(10)
      const sql = builder.build()

      expect(sql.query).toBe(
        'SELECT id, content_text FROM content_queue WHERE is_posted = $1 AND source_platform = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4'
      )
      expect(sql.params).toEqual([false, 'twitter', 5, 10])
    })

    it('should execute query and return results', async () => {
      const mockResults = { rows: [{ id: 1, content_text: 'test' }] }
      mockClient.query.mockResolvedValue(mockResults)

      const builder = new QueryBuilder('content_queue')
      builder.where('id', '=', 1)
      const result = await builder.execute()

      expect(result).toEqual(mockResults)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM content_queue WHERE id = $1',
        [1]
      )
    })

    it('should return first result', async () => {
      const mockResults = { rows: [{ id: 1, content_text: 'test' }] }
      mockClient.query.mockResolvedValue(mockResults)

      const builder = new QueryBuilder('content_queue')
      builder.where('id', '=', 1)
      const result = await builder.first()

      expect(result).toEqual({ id: 1, content_text: 'test' })
    })

    it('should return count', async () => {
      const mockResults = { rows: [{ count: '5' }] }
      mockClient.query.mockResolvedValue(mockResults)

      const builder = new QueryBuilder('content_queue')
      builder.where('is_posted', '=', false)
      const count = await builder.count()

      expect(count).toBe(5)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM content_queue WHERE is_posted = $1',
        [false]
      )
    })

    it('should handle LIKE operator', () => {
      const builder = new QueryBuilder('content_queue')
      builder.where('content_text', 'LIKE', '%hotdog%')
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue WHERE content_text LIKE $1')
      expect(sql.params).toEqual(['%hotdog%'])
    })

    it('should handle IN operator with array values', () => {
      const builder = new QueryBuilder('content_queue')
      builder.where('id', 'IN', [1, 2, 3])
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue WHERE id IN ($1, $2, $3)')
      expect(sql.params).toEqual([1, 2, 3])
    })
  })

  describe('InsertBuilder', () => {
    it('should build INSERT query', () => {
      const builder = new InsertBuilder('content_queue')
      builder.values({
        content_text: 'New hotdog content',
        content_type: 'text',
        is_posted: false
      })
      const sql = builder.build()

      expect(sql.query).toBe(
        'INSERT INTO content_queue (content_text, content_type, is_posted) VALUES ($1, $2, $3) RETURNING *'
      )
      expect(sql.params).toEqual(['New hotdog content', 'text', false])
    })

    it('should execute INSERT and return result', async () => {
      const mockResult = { rows: [{ id: 1, content_text: 'New hotdog content' }] }
      mockClient.query.mockResolvedValue(mockResult)

      const builder = new InsertBuilder('content_queue')
      builder.values({ content_text: 'New hotdog content' })
      const result = await builder.execute()

      expect(result).toEqual(mockResult)
    })

    it('should return first inserted row', async () => {
      const mockResult = { rows: [{ id: 1, content_text: 'New hotdog content' }] }
      mockClient.query.mockResolvedValue(mockResult)

      const builder = new InsertBuilder('content_queue')
      builder.values({ content_text: 'New hotdog content' })
      const result = await builder.first()

      expect(result).toEqual({ id: 1, content_text: 'New hotdog content' })
    })

    it('should handle multiple value sets', () => {
      const builder = new InsertBuilder('content_queue')
      builder.values([
        { content_text: 'First post', content_type: 'text' },
        { content_text: 'Second post', content_type: 'image' }
      ])
      const sql = builder.build()

      expect(sql.query).toBe(
        'INSERT INTO content_queue (content_text, content_type) VALUES ($1, $2), ($3, $4) RETURNING *'
      )
      expect(sql.params).toEqual(['First post', 'text', 'Second post', 'image'])
    })
  })

  describe('UpdateBuilder', () => {
    it('should build UPDATE query', () => {
      const builder = new UpdateBuilder('content_queue')
      builder.set({
        is_posted: true,
        posted_at: new Date('2024-01-01T12:00:00Z')
      })
      builder.where('id', '=', 1)
      const sql = builder.build()

      expect(sql.query).toBe(
        'UPDATE content_queue SET is_posted = $1, posted_at = $2 WHERE id = $3 RETURNING *'
      )
      expect(sql.params).toEqual([true, new Date('2024-01-01T12:00:00Z'), 1])
    })

    it('should execute UPDATE and return result', async () => {
      const mockResult = { rows: [{ id: 1, is_posted: true }] }
      mockClient.query.mockResolvedValue(mockResult)

      const builder = new UpdateBuilder('content_queue')
      builder.set({ is_posted: true })
      builder.where('id', '=', 1)
      const result = await builder.execute()

      expect(result).toEqual(mockResult)
    })

    it('should return first updated row', async () => {
      const mockResult = { rows: [{ id: 1, is_posted: true }] }
      mockClient.query.mockResolvedValue(mockResult)

      const builder = new UpdateBuilder('content_queue')
      builder.set({ is_posted: true })
      builder.where('id', '=', 1)
      const result = await builder.first()

      expect(result).toEqual({ id: 1, is_posted: true })
    })

    it('should require WHERE clause for safety', () => {
      const builder = new UpdateBuilder('content_queue')
      builder.set({ is_posted: true })

      expect(() => builder.build()).toThrow('UPDATE queries must include a WHERE clause for safety')
    })
  })

  describe('DeleteBuilder', () => {
    it('should build DELETE query', () => {
      const builder = new DeleteBuilder('content_queue')
      builder.where('id', '=', 1)
      const sql = builder.build()

      expect(sql.query).toBe('DELETE FROM content_queue WHERE id = $1 RETURNING *')
      expect(sql.params).toEqual([1])
    })

    it('should execute DELETE and return result', async () => {
      const mockResult = { rows: [{ id: 1, content_text: 'Deleted content' }] }
      mockClient.query.mockResolvedValue(mockResult)

      const builder = new DeleteBuilder('content_queue')
      builder.where('id', '=', 1)
      const result = await builder.execute()

      expect(result).toEqual(mockResult)
    })

    it('should return first deleted row', async () => {
      const mockResult = { rows: [{ id: 1, content_text: 'Deleted content' }] }
      mockClient.query.mockResolvedValue(mockResult)

      const builder = new DeleteBuilder('content_queue')
      builder.where('id', '=', 1)
      const result = await builder.first()

      expect(result).toEqual({ id: 1, content_text: 'Deleted content' })
    })

    it('should require WHERE clause for safety', () => {
      const builder = new DeleteBuilder('content_queue')

      expect(() => builder.build()).toThrow('DELETE queries must include a WHERE clause for safety')
    })
  })

  describe('Convenience functions', () => {
    it('should create QueryBuilder instance', () => {
      const builder = query('content_queue')
      expect(builder).toBeInstanceOf(QueryBuilder)
    })

    it('should create InsertBuilder instance', () => {
      const builder = insert('content_queue')
      expect(builder).toBeInstanceOf(InsertBuilder)
    })

    it('should create UpdateBuilder instance', () => {
      const builder = update('content_queue')
      expect(builder).toBeInstanceOf(UpdateBuilder)
    })

    it('should create DeleteBuilder instance', () => {
      const builder = deleteFrom('content_queue')
      expect(builder).toBeInstanceOf(DeleteBuilder)
    })
  })

  describe('Error handling', () => {
    it('should handle database errors in execute', async () => {
      mockClient.query.mockRejectedValue(new Error('Database connection failed'))

      const builder = new QueryBuilder('content_queue')
      
      await expect(builder.execute()).rejects.toThrow('Database connection failed')
    })

    it('should handle database errors in first', async () => {
      mockClient.query.mockRejectedValue(new Error('Database connection failed'))

      const builder = new QueryBuilder('content_queue')
      
      await expect(builder.first()).rejects.toThrow('Database connection failed')
    })

    it('should handle database errors in count', async () => {
      mockClient.query.mockRejectedValue(new Error('Database connection failed'))

      const builder = new QueryBuilder('content_queue')
      
      await expect(builder.count()).rejects.toThrow('Database connection failed')
    })
  })

  describe('Parameter binding', () => {
    it('should handle null values', () => {
      const builder = new QueryBuilder('content_queue')
      builder.where('admin_notes', '=', null)
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue WHERE admin_notes = $1')
      expect(sql.params).toEqual([null])
    })

    it('should handle undefined values by converting to null', () => {
      const builder = new QueryBuilder('content_queue')
      builder.where('admin_notes', '=', undefined)
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue WHERE admin_notes = $1')
      expect(sql.params).toEqual([null])
    })

    it('should handle date values', () => {
      const date = new Date('2024-01-01T12:00:00Z')
      const builder = new QueryBuilder('content_queue')
      builder.where('created_at', '>', date)
      const sql = builder.build()

      expect(sql.query).toBe('SELECT * FROM content_queue WHERE created_at > $1')
      expect(sql.params).toEqual([date])
    })
  })
})