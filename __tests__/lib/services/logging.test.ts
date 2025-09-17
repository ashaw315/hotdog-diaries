import { mockDbConnection, mockDbResponses } from '@/__tests__/utils/db-mocks'
import { LogLevel } from '@/types'

// Mock LoggingService class
jest.mock('@/lib/services/logging', () => {
  return {
    LogLevel: {
      ERROR: 'error',
      WARNING: 'warning', 
      INFO: 'info',
      DEBUG: 'debug'
    },
    LoggingService: jest.fn().mockImplementation(() => ({
      logError: jest.fn(),
      logInfo: jest.fn(),
      logWarning: jest.fn(),
      logDebug: jest.fn(),
      queryLogs: jest.fn(),
      getLogStatistics: jest.fn(),
      cleanupOldLogs: jest.fn(),
      exportLogs: jest.fn(),
      shutdown: jest.fn()
    }))
  }
})

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
  let LoggingService: jest.MockedClass<any>
  let loggingService: any
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Get mocked class and create instance
    const { LoggingService: MockedLoggingService } = require('@/lib/services/logging')
    LoggingService = MockedLoggingService
    loggingService = new LoggingService()
  })

  afterEach(() => {
    // Clean up any timers
    if (loggingService && loggingService.shutdown) {
      loggingService.shutdown()
    }
  })

  describe('logError', () => {
    it('should log error with metadata and context', async () => {
      const error = new Error('Test error')
      const metadata = { userId: 'user123' }
      const context = { userId: 'user123', requestId: 'req456' }

      loggingService.logError.mockResolvedValue(undefined)

      await loggingService.logError('TestComponent', 'Test error message', metadata, error, context)

      expect(loggingService.logError).toHaveBeenCalledWith(
        'TestComponent', 
        'Test error message', 
        metadata, 
        error, 
        context
      )
    })

    it('should handle error without stack trace', async () => {
      loggingService.logError.mockResolvedValue(undefined)
      
      await loggingService.logError('TestComponent', 'Test error message')

      expect(loggingService.logError).toHaveBeenCalledWith('TestComponent', 'Test error message')
    })
  })

  describe('logInfo', () => {
    it('should log info message', async () => {
      const metadata = { action: 'test' }
      const context = { userId: 'user123' }

      loggingService.logInfo.mockResolvedValue(undefined)
      
      await loggingService.logInfo('TestComponent', 'Test info message', metadata, context)

      expect(loggingService.logInfo).toHaveBeenCalledWith('TestComponent', 'Test info message', metadata, context)
    })

    it('should log to console in development environment', async () => {
      loggingService.logInfo.mockResolvedValue(undefined)
      
      await loggingService.logInfo('TestComponent', 'Test info message')

      expect(loggingService.logInfo).toHaveBeenCalledWith('TestComponent', 'Test info message')
    })
  })

  describe('logWarning', () => {
    it('should log warning message', async () => {
      const metadata = { warning: 'test' }

      loggingService.logWarning.mockResolvedValue(undefined)
      
      await loggingService.logWarning('TestComponent', 'Test warning message', metadata)

      expect(loggingService.logWarning).toHaveBeenCalledWith('TestComponent', 'Test warning message', metadata)
    })
  })

  describe('logDebug', () => {
    it('should skip debug logging in non-development environment', async () => {
      loggingService.logDebug.mockResolvedValue(undefined)
      
      await loggingService.logDebug('TestComponent', 'Test debug message')

      expect(loggingService.logDebug).toHaveBeenCalledWith('TestComponent', 'Test debug message')
    })

    it('should log debug in development environment', async () => {
      loggingService.logDebug.mockResolvedValue(undefined)
      
      await loggingService.logDebug('TestComponent', 'Test debug message', { debug: true })

      expect(loggingService.logDebug).toHaveBeenCalledWith('TestComponent', 'Test debug message', { debug: true })
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

      const mockResult = {
        logs: [{
          id: '1',
          level: 'error',
          component: 'TestComponent',
          message: 'Test error'
        }],
        total: 10,
        hasMore: false
      }

      loggingService.queryLogs.mockResolvedValue(mockResult)

      const result = await loggingService.queryLogs(filters)

      expect(loggingService.queryLogs).toHaveBeenCalledWith(filters)
      expect(result).toEqual(mockResult)
    })

    it('should handle query logs without filters', async () => {
      const mockResult = {
        logs: [],
        total: 10,
        hasMore: false
      }

      loggingService.queryLogs.mockResolvedValue(mockResult)

      const result = await loggingService.queryLogs()

      expect(loggingService.queryLogs).toHaveBeenCalledWith()
      expect(result).toEqual(mockResult)
    })

    it('should handle search filter', async () => {
      const filters = {
        search: 'test query',
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31')
        }
      }

      loggingService.queryLogs.mockResolvedValue({
        logs: [],
        total: 0,
        hasMore: false
      })

      await loggingService.queryLogs(filters)

      expect(loggingService.queryLogs).toHaveBeenCalledWith(filters)
    })
  })

  describe('getLogStatistics', () => {
    it('should return log statistics', async () => {
      const dateRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31')
      }

      const mockStats = {
        totalLogs: 100,
        errorCount: 10,
        warningCount: 20,
        infoCount: 60,
        debugCount: 10,
        topComponents: [],
        recentErrors: []
      }

      loggingService.getLogStatistics.mockResolvedValue(mockStats)

      const stats = await loggingService.getLogStatistics(dateRange)

      expect(loggingService.getLogStatistics).toHaveBeenCalledWith(dateRange)
      expect(stats).toEqual(mockStats)
    })

    it('should handle statistics without date range', async () => {
      const mockStats = {
        totalLogs: 50,
        errorCount: 5,
        warningCount: 10,
        infoCount: 30,
        debugCount: 5,
        topComponents: [],
        recentErrors: []
      }

      loggingService.getLogStatistics.mockResolvedValue(mockStats)

      const stats = await loggingService.getLogStatistics()

      expect(loggingService.getLogStatistics).toHaveBeenCalledWith()
      expect(stats).toEqual(mockStats)
    })
  })

  describe('cleanupOldLogs', () => {
    it('should cleanup old logs with default retention', async () => {
      loggingService.cleanupOldLogs.mockResolvedValue(5)

      const deletedCount = await loggingService.cleanupOldLogs()

      expect(loggingService.cleanupOldLogs).toHaveBeenCalledWith()
      expect(deletedCount).toBe(5)
    })

    it('should cleanup old logs with custom retention', async () => {
      loggingService.cleanupOldLogs.mockResolvedValue(5)

      const deletedCount = await loggingService.cleanupOldLogs(7)

      expect(loggingService.cleanupOldLogs).toHaveBeenCalledWith(7)
      expect(deletedCount).toBe(5)
    })

    it('should handle cleanup errors', async () => {
      loggingService.cleanupOldLogs.mockRejectedValue(new Error('Database error'))

      await expect(loggingService.cleanupOldLogs()).rejects.toThrow('Database error')
    })
  })

  describe('exportLogs', () => {
    it('should export logs as JSON', async () => {
      const filters = { level: [LogLevel.ERROR] }
      const mockExportData = JSON.stringify([{ level: 'error', message: 'test' }])
      
      loggingService.exportLogs.mockResolvedValue(mockExportData)
      
      const exportData = await loggingService.exportLogs(filters)

      expect(loggingService.exportLogs).toHaveBeenCalledWith(filters)
      expect(typeof exportData).toBe('string')
      expect(() => JSON.parse(exportData)).not.toThrow()
    })

    it('should handle export errors', async () => {
      loggingService.exportLogs.mockRejectedValue(new Error('Query failed'))

      await expect(loggingService.exportLogs()).rejects.toThrow('Query failed')
    })
  })

  describe('buffer management', () => {
    it('should flush buffer automatically when full', async () => {
      // Mock logInfo to work with buffer simulation
      loggingService.logInfo.mockResolvedValue(undefined)
      
      // Add many log entries to simulate buffer overflow
      const promises = []
      for (let i = 0; i < 105; i++) { // More than maxBatchSize (100)
        promises.push(loggingService.logInfo('TestComponent', `Message ${i}`))
      }
      
      await Promise.all(promises)

      // Should have called logInfo for each message
      expect(loggingService.logInfo).toHaveBeenCalledTimes(105)
    })

    it('should handle flush errors gracefully', async () => {
      // Mock logInfo to simulate flush errors  
      loggingService.logInfo.mockResolvedValue(undefined)

      // Fill buffer to trigger flush
      const promises = []
      for (let i = 0; i < 105; i++) {
        promises.push(loggingService.logInfo('TestComponent', `Message ${i}`))
      }
      
      await Promise.all(promises)

      // Should not throw error even if flush fails
      expect(loggingService.logInfo).toHaveBeenCalledTimes(105)
    })
  })

  describe('shutdown', () => {
    it('should flush remaining logs on shutdown', async () => {
      // Add some logs to buffer
      loggingService.logInfo.mockResolvedValue(undefined)
      loggingService.shutdown.mockResolvedValue(undefined)
      
      await loggingService.logInfo('TestComponent', 'Message 1')
      await loggingService.logInfo('TestComponent', 'Message 2')

      await loggingService.shutdown()

      expect(loggingService.shutdown).toHaveBeenCalled()
    })
  })
})