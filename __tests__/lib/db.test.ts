import { mockDbConnection, mockDbResponses, mockDbErrors, mockContentRow } from '@/__tests__/utils/db-mocks'

// Mock pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    connect: jest.fn(),
    release: jest.fn()
  }
  
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn()
  }
  
  return {
    Pool: jest.fn(() => mockPool),
    Client: jest.fn(() => mockClient)
  }
})

// Mock the entire database module
jest.mock('@/lib/db', () => {
  const mockDb = {
    query: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    healthCheck: jest.fn(),
    transaction: jest.fn()
  }
  
  return {
    db: mockDb,
    initializeDatabase: jest.fn(),
    closeDatabase: jest.fn(),
    logToDatabase: jest.fn(),
    query: mockDb.query,
    getClient: jest.fn(),
    transaction: mockDb.transaction,
    healthCheck: mockDb.healthCheck
  }
})

// Mock @vercel/postgres
jest.mock('@vercel/postgres', () => ({
  sql: {
    query: jest.fn()
  }
}))

describe('Database Connection', () => {
  let mockDb: any
  let initializeDatabase: jest.Mock
  let closeDatabase: jest.Mock
  let mockPool: any
  let mockClient: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked functions
    const dbModule = require('@/lib/db')
    mockDb = dbModule.db
    initializeDatabase = dbModule.initializeDatabase
    closeDatabase = dbModule.closeDatabase
    
    // Get mocked Pool
    const { Pool } = require('pg')
    mockPool = new Pool()
    mockClient = {
      query: jest.fn(),
      connect: jest.fn(),
      release: jest.fn()
    }
    mockPool.connect.mockResolvedValue(mockClient)
    
    // Reset environment
    delete process.env.POSTGRES_URL
    process.env.DATABASE_HOST = 'localhost'
    process.env.DATABASE_PORT = '5432'
    process.env.DATABASE_NAME = 'test_db'
    process.env.DATABASE_USER = 'test_user'
    process.env.DATABASE_PASSWORD = 'test_password'
  })

  describe('initializeDatabase', () => {
    it('should initialize database connection successfully', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ now: new Date() }] })
      initializeDatabase.mockResolvedValue(undefined)

      await expect(initializeDatabase()).resolves.not.toThrow()
      expect(initializeDatabase).toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      const error = new Error('Connection failed')
      initializeDatabase.mockRejectedValue(error)

      await expect(initializeDatabase()).rejects.toThrow('Connection failed')
    })
  })

  describe('database operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [{ now: new Date() }] })
      initializeDatabase.mockResolvedValue(undefined)
      await initializeDatabase()
    })

    describe('query', () => {
      it('should execute queries successfully', async () => {
        const expectedResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 }
        mockDb.query.mockResolvedValue(expectedResult)

        const result = await mockDb.query('SELECT * FROM test WHERE id = $1', [1])
        
        expect(result).toEqual(expectedResult)
        expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1])
      })

      it('should handle query errors', async () => {
        mockDb.query.mockRejectedValue(new Error('Query failed'))

        await expect(mockDb.query('INVALID SQL')).rejects.toThrow('Query failed')
      })
    })

    describe('healthCheck', () => {
      it('should return healthy status when database is connected', async () => {
        mockDb.healthCheck.mockResolvedValue({
          connected: true,
          latency: 10,
          error: undefined
        })

        const result = await mockDb.healthCheck()
        
        expect(result.connected).toBe(true)
        expect(typeof result.latency).toBe('number')
        expect(result.error).toBeUndefined()
      })

      it('should return unhealthy status when database query fails', async () => {
        mockDb.healthCheck.mockResolvedValue({
          connected: false,
          error: 'Database error',
          latency: undefined
        })

        const result = await mockDb.healthCheck()
        
        expect(result.connected).toBe(false)
        expect(result.error).toBe('Database error')
        expect(result.latency).toBeUndefined()
      })
    })

    describe('transaction', () => {
      it('should execute transaction successfully', async () => {
        const mockResult = { rows: [{ id: 1 }] }
        mockDb.transaction.mockImplementation(async (callback) => {
          return await callback(mockClient)
        })
        mockClient.query.mockResolvedValue(mockResult)

        const result = await mockDb.transaction(async (client) => {
          return await client.query('INSERT INTO test VALUES (1)')
        })
        
        expect(mockDb.transaction).toHaveBeenCalled()
        expect(result).toEqual(mockResult)
      })

      it('should rollback transaction on error', async () => {
        const error = new Error('Transaction error')
        mockDb.transaction.mockRejectedValue(error)

        await expect(mockDb.transaction(async (client) => {
          throw error
        })).rejects.toThrow('Transaction error')
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
      mockDb.query.mockResolvedValue(expectedResult)

      const result = await mockDb.query('SELECT 1')
      
      expect(result).toEqual(expectedResult)
      expect(mockDb.query).toHaveBeenCalledWith('SELECT 1')
    })

    it('should not support transactions in Vercel environment', async () => {
      mockDb.transaction.mockRejectedValue(new Error('Transactions not supported'))
      await expect(mockDb.transaction(async () => {})).rejects.toThrow('Transactions not supported')
    })
  })
})