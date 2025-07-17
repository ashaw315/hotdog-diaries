import { db, initializeDatabase, closeDatabase } from '@/lib/db'

// Mock @vercel/postgres
jest.mock('@vercel/postgres', () => ({
  sql: {
    query: jest.fn()
  }
}))

// Mock pg
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    connect: jest.fn(),
    release: jest.fn(),
    end: jest.fn()
  }

  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(),
    on: jest.fn()
  }

  return {
    Pool: jest.fn(() => mockPool),
    Client: jest.fn(() => mockClient)
  }
})

describe('Database Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment
    delete process.env.POSTGRES_URL
    process.env.DATABASE_HOST = 'localhost'
    process.env.DATABASE_PORT = '5432'
    process.env.DATABASE_NAME = 'test_db'
    process.env.DATABASE_USER = 'test_user'
    process.env.DATABASE_PASSWORD = 'test_password'
  })

  afterEach(async () => {
    try {
      await closeDatabase()
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  })

  describe('initializeDatabase', () => {
    it('should initialize database connection successfully', async () => {
      const { Pool } = require('pg')
      const mockPool = new Pool()
      
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      })

      await expect(initializeDatabase()).resolves.not.toThrow()
      expect(mockPool.connect).toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      const { Pool } = require('pg')
      const mockPool = new Pool()
      
      mockPool.connect.mockRejectedValue(new Error('Connection failed'))

      await expect(initializeDatabase()).rejects.toThrow('Connection failed')
    })
  })

  describe('database operations', () => {
    beforeEach(async () => {
      const { Pool } = require('pg')
      const mockPool = new Pool()
      
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      })
      
      await initializeDatabase()
    })

    describe('query', () => {
      it('should execute queries successfully', async () => {
        const { Pool } = require('pg')
        const mockPool = new Pool()
        const expectedResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 }
        
        mockPool.query.mockResolvedValue(expectedResult)

        const result = await db.query('SELECT * FROM test WHERE id = $1', [1])
        
        expect(result).toEqual(expectedResult)
        expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1])
      })

      it('should handle query errors', async () => {
        const { Pool } = require('pg')
        const mockPool = new Pool()
        
        mockPool.query.mockRejectedValue(new Error('Query failed'))

        await expect(db.query('INVALID SQL')).rejects.toThrow('Query failed')
      })
    })

    describe('healthCheck', () => {
      it('should return healthy status when database is connected', async () => {
        const { Pool } = require('pg')
        const mockPool = new Pool()
        
        mockPool.query.mockResolvedValue({ rows: [{ health_check: 1 }] })

        const result = await db.healthCheck()
        
        expect(result.connected).toBe(true)
        expect(typeof result.latency).toBe('number')
        expect(result.error).toBeUndefined()
      })

      it('should return unhealthy status when database query fails', async () => {
        const { Pool } = require('pg')
        const mockPool = new Pool()
        
        mockPool.query.mockRejectedValue(new Error('Database error'))

        const result = await db.healthCheck()
        
        expect(result.connected).toBe(false)
        expect(result.error).toBe('Database error')
        expect(result.latency).toBeUndefined()
      })
    })

    describe('transaction', () => {
      it('should execute transaction successfully', async () => {
        const { Pool } = require('pg')
        const mockPool = new Pool()
        const mockClient = {
          query: jest.fn(),
          release: jest.fn()
        }
        
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User query
          .mockResolvedValueOnce({ rows: [] }) // COMMIT
        
        mockPool.connect.mockResolvedValue(mockClient)

        const result = await db.transaction(async (client) => {
          return await client.query('INSERT INTO test VALUES (1)')
        })
        
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
        expect(mockClient.release).toHaveBeenCalled()
      })

      it('should rollback transaction on error', async () => {
        const { Pool } = require('pg')
        const mockPool = new Pool()
        const mockClient = {
          query: jest.fn(),
          release: jest.fn()
        }
        
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Transaction error')) // User query fails
          .mockResolvedValueOnce({ rows: [] }) // ROLLBACK
        
        mockPool.connect.mockResolvedValue(mockClient)

        await expect(db.transaction(async (client) => {
          throw new Error('Transaction error')
        })).rejects.toThrow('Transaction error')
        
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
        expect(mockClient.release).toHaveBeenCalled()
      })
    })
  })

  describe('Vercel environment', () => {
    beforeEach(() => {
      process.env.POSTGRES_URL = 'postgresql://vercel-test'
      process.env.POSTGRES_HOST = 'vercel-host'
      process.env.POSTGRES_DATABASE = 'vercel-db'
      process.env.POSTGRES_USER = 'vercel-user'
      process.env.POSTGRES_PASSWORD = 'vercel-password'
    })

    it('should use @vercel/postgres in Vercel environment', async () => {
      const { sql } = require('@vercel/postgres')
      const expectedResult = { rows: [{ id: 1 }] }
      
      sql.query.mockResolvedValue(expectedResult)

      const result = await db.query('SELECT 1')
      
      expect(result).toEqual(expectedResult)
      expect(sql.query).toHaveBeenCalledWith('SELECT 1', [])
    })

    it('should not support transactions in Vercel environment', async () => {
      await expect(db.transaction(async () => {})).rejects.toThrow('Transactions not supported')
    })
  })
})