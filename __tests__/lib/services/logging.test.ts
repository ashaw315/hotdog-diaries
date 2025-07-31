import { LoggingService, LogLevel } from '@/lib/services/logging'

// Mock dependencies
jest.mock('@/lib/db-query-builder', () => ({
  query: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue({ count: '10' }),
    execute: jest.fn().mockResolvedValue([
      {
        id: '1',
        level: 'error',
        component: 'TestComponent',
        message: 'Test error',
        metadata: '{"test": true}',
        timestamp: new Date(),
        stack_trace: 'Error stack',
        user_id: 'user1',
        session_id: 'session1',
        request_id: 'req1',
        environment: 'test'
      }
    ]),
    clone: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(5)
  })),
  insert: jest.fn(() => ({
    values: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined)
  }))
}))

jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn().mockResolvedValue({ rows: [] })
  }
}))

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  log: jest.spyOn(console, 'log').mockImplementation(),
  debug: jest.spyOn(console, 'debug').mockImplementation()
}

describe('LoggingService', () => {
  let loggingService: LoggingService
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Create new instance for each test
    loggingService = new LoggingService()
  })

  afterEach(() => {
    // Clean up any timers
    if (loggingService) {
      loggingService.shutdown()
    }
  })

  describe('logError', () => {
    it('should log error with metadata and context', async () => {
      const error = new Error('Test error')
      const metadata = { userId: 'user123' }
      const context = { userId: 'user123', requestId: 'req456' }

      await loggingService.logError('TestComponent', 'Test error message', metadata, error, context)

      // Should log to console immediately
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[TestComponent] Test error message',
        expect.objectContaining({
          metadata,
          stack: error.stack
        })
      )
    })

    it('should handle error without stack trace', async () => {
      await loggingService.logError('TestComponent', 'Test error message')

      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[TestComponent] Test error message',
        expect.objectContaining({
          metadata: expect.objectContaining({
            errorName: undefined,
            errorMessage: undefined
          })
        })
      )
    })
  })

  describe('logInfo', () => {
    it('should log info message', async () => {
      const metadata = { action: 'test' }
      const context = { userId: 'user123' }

      await loggingService.logInfo('TestComponent', 'Test info message', metadata, context)

      // In test environment, should not log to console
      expect(consoleSpy.log).not.toHaveBeenCalled()
    })

    it('should log to console in development environment', async () => {
      // Temporarily change environment
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const devLoggingService = new LoggingService()
      await devLoggingService.logInfo('TestComponent', 'Test info message')

      expect(consoleSpy.log).toHaveBeenCalledWith('[TestComponent] Test info message', undefined)

      // Restore environment
      process.env.NODE_ENV = originalEnv
      devLoggingService.shutdown()
    })
  })

  describe('logWarning', () => {
    it('should log warning message', async () => {
      const metadata = { warning: 'test' }

      await loggingService.logWarning('TestComponent', 'Test warning message', metadata)

      expect(consoleSpy.warn).toHaveBeenCalledWith('[TestComponent] Test warning message', metadata)
    })
  })

  describe('logDebug', () => {
    it('should skip debug logging in non-development environment', async () => {
      await loggingService.logDebug('TestComponent', 'Test debug message')

      expect(consoleSpy.debug).not.toHaveBeenCalled()
    })

    it('should log debug in development environment', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const devLoggingService = new LoggingService()
      await devLoggingService.logDebug('TestComponent', 'Test debug message', { debug: true })

      expect(consoleSpy.debug).toHaveBeenCalledWith('[TestComponent] Test debug message', { debug: true })

      process.env.NODE_ENV = originalEnv
      devLoggingService.shutdown()
    })
  })

  describe('queryLogs', () => {
    it('should query logs with filters', async () => {
      const filters = {
        level: [LogLevel.ERROR],
        component: ['TestComponent'],
        limit: 50,
        offset: 10
      }

      const result = await loggingService.queryLogs(filters)

      expect(result).toEqual({
        logs: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            level: 'error',
            component: 'TestComponent',
            message: 'Test error'
          })
        ]),
        total: 10,
        hasMore: false
      })
    })

    it('should handle query logs without filters', async () => {
      const result = await loggingService.queryLogs()

      expect(result).toEqual({
        logs: expect.any(Array),
        total: 10,
        hasMore: false
      })
    })

    it('should handle search filter', async () => {
      const filters = {
        search: 'test query',
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31')
        }
      }

      await loggingService.queryLogs(filters)

      // Verify the query builder was called with search parameters
      const { query } = require('@/lib/db-query-builder')
      expect(query).toHaveBeenCalledWith('system_logs')
    })
  })

  describe('getLogStatistics', () => {
    it('should return log statistics', async () => {
      const dateRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31')
      }

      const stats = await loggingService.getLogStatistics(dateRange)

      expect(stats).toEqual({
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        debugCount: 0,
        topComponents: expect.any(Array),
        recentErrors: expect.any(Array)
      })
    })

    it('should handle statistics without date range', async () => {
      const stats = await loggingService.getLogStatistics()

      expect(stats).toEqual(expect.objectContaining({
        totalLogs: expect.any(Number),
        errorCount: expect.any(Number),
        warningCount: expect.any(Number),
        infoCount: expect.any(Number),
        debugCount: expect.any(Number)
      }))
    })
  })

  describe('cleanupOldLogs', () => {
    it('should cleanup old logs with default retention', async () => {
      const deletedCount = await loggingService.cleanupOldLogs()

      expect(deletedCount).toBe(5)
    })

    it('should cleanup old logs with custom retention', async () => {
      const deletedCount = await loggingService.cleanupOldLogs(7)

      expect(deletedCount).toBe(5)
    })

    it('should handle cleanup errors', async () => {
      const { query } = require('@/lib/db-query-builder')
      query.mockImplementationOnce(() => ({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockRejectedValue(new Error('Database error'))
      }))

      await expect(loggingService.cleanupOldLogs()).rejects.toThrow('Database error')
    })
  })

  describe('exportLogs', () => {
    it('should export logs as JSON', async () => {
      const filters = { level: [LogLevel.ERROR] }
      const exportData = await loggingService.exportLogs(filters)

      expect(typeof exportData).toBe('string')
      expect(() => JSON.parse(exportData)).not.toThrow()
    })

    it('should handle export errors', async () => {
      // Mock queryLogs to throw error
      jest.spyOn(loggingService, 'queryLogs').mockRejectedValueOnce(new Error('Query failed'))

      await expect(loggingService.exportLogs()).rejects.toThrow('Query failed')
    })
  })

  describe('buffer management', () => {
    it('should flush buffer automatically when full', async () => {
      const { insert } = require('@/lib/db-query-builder')
      
      // Add many log entries to trigger flush
      const promises = []
      for (let i = 0; i < 105; i++) { // More than maxBatchSize (100)
        promises.push(loggingService.logInfo('TestComponent', `Message ${i}`))
      }
      
      await Promise.all(promises)

      // Should have called insert at least once due to buffer overflow
      expect(insert).toHaveBeenCalled()
    })

    it('should handle flush errors gracefully', async () => {
      const { insert } = require('@/lib/db-query-builder')
      insert.mockImplementationOnce(() => ({
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Insert failed'))
      }))

      // Fill buffer to trigger flush
      const promises = []
      for (let i = 0; i < 105; i++) {
        promises.push(loggingService.logInfo('TestComponent', `Message ${i}`))
      }
      
      await Promise.all(promises)

      // Should not throw error even if flush fails
      expect(insert).toHaveBeenCalled()
    })
  })

  describe('shutdown', () => {
    it('should flush remaining logs on shutdown', async () => {
      // Add some logs to buffer
      await loggingService.logInfo('TestComponent', 'Message 1')
      await loggingService.logInfo('TestComponent', 'Message 2')

      await loggingService.shutdown()

      const { insert } = require('@/lib/db-query-builder')
      expect(insert).toHaveBeenCalled()
    })
  })
})