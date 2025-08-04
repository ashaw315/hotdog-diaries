import { query, insert } from '@/lib/db-query-builder'
import { DatabaseConnection, db } from '@/lib/db'

export enum LogLevel {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  id?: string
  level: LogLevel
  component: string
  message: string
  metadata?: Record<string, any>
  timestamp: Date
  stackTrace?: string
  userId?: string
  sessionId?: string
  requestId?: string
  environment: string
}

export interface LogFilter {
  level?: LogLevel[]
  component?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  search?: string
  limit?: number
  offset?: number
  userId?: string
  requestId?: string
}

export interface LogQueryResult {
  logs: LogEntry[]
  total: number
  hasMore: boolean
}

export class LoggingService {
  private readonly maxBatchSize = 100
  private readonly flushInterval = 5000 // 5 seconds
  private logBuffer: LogEntry[] = []
  private flushTimer?: NodeJS.Timeout
  private readonly environment: string

  constructor() {
    this.environment = process.env.NODE_ENV || 'development'
    this.startPeriodicFlush()
  }

  /**
   * Log an error with context information
   */
  async logError(
    component: string, 
    message: string, 
    metadata?: Record<string, any>,
    error?: Error,
    context?: {
      userId?: string
      sessionId?: string
      requestId?: string
    }
  ): Promise<void> {
    const logEntry: LogEntry = {
      level: LogLevel.ERROR,
      component,
      message,
      metadata: {
        ...metadata,
        ...(error && {
          errorName: error.name,
          errorMessage: error.message,
          errorCode: (error as any).code
        })
      },
      timestamp: new Date(),
      stackTrace: error?.stack,
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
      environment: this.environment
    }

    await this.addToBuffer(logEntry)

    // For errors, also log to console immediately
    console.error(`[${component}] ${message}`, {
      metadata,
      stack: error?.stack,
      timestamp: logEntry.timestamp.toISOString()
    })
  }

  /**
   * Log informational events
   */
  async logInfo(
    component: string,
    message: string,
    metadata?: Record<string, any>,
    context?: {
      userId?: string
      sessionId?: string
      requestId?: string
    }
  ): Promise<void> {
    const logEntry: LogEntry = {
      level: LogLevel.INFO,
      component,
      message,
      metadata,
      timestamp: new Date(),
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
      environment: this.environment
    }

    await this.addToBuffer(logEntry)

    // Log to console in development
    if (this.environment === 'development') {
      console.log(`[${component}] ${message}`, metadata)
    }
  }

  /**
   * Log warning events
   */
  async logWarning(
    component: string,
    message: string,
    metadata?: Record<string, any>,
    context?: {
      userId?: string
      sessionId?: string
      requestId?: string
    }
  ): Promise<void> {
    const logEntry: LogEntry = {
      level: LogLevel.WARNING,
      component,
      message,
      metadata,
      timestamp: new Date(),
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
      environment: this.environment
    }

    await this.addToBuffer(logEntry)

    // Log warnings to console
    console.warn(`[${component}] ${message}`, metadata)
  }

  /**
   * Log debug information (only in development)
   */
  async logDebug(
    component: string,
    message: string,
    metadata?: Record<string, any>,
    context?: {
      userId?: string
      sessionId?: string
      requestId?: string
    }
  ): Promise<void> {
    if (this.environment !== 'development') {
      return
    }

    const logEntry: LogEntry = {
      level: LogLevel.DEBUG,
      component,
      message,
      metadata,
      timestamp: new Date(),
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
      environment: this.environment
    }

    await this.addToBuffer(logEntry)
    console.debug(`[${component}] ${message}`, metadata)
  }

  /**
   * Query logs with filtering options
   */
  async queryLogs(filters: LogFilter = {}): Promise<LogQueryResult> {
    try {
      const {
        level,
        component,
        dateRange,
        search,
        limit = 100,
        offset = 0,
        userId,
        requestId
      } = filters

      let queryBuilder = query('system_logs')
        .select([
          'id',
          'log_level as level',
          'component',
          'message',
          'metadata',
          'created_at as timestamp'
        ])
        .orderBy('created_at', 'DESC')

      // Apply filters
      if (level && level.length > 0) {
        queryBuilder = queryBuilder.whereIn('log_level', level)
      }

      if (component && component.length > 0) {
        queryBuilder = queryBuilder.whereIn('component', component)
      }

      if (dateRange) {
        queryBuilder = queryBuilder
          .where('created_at', '>=', dateRange.start)
          .where('created_at', '<=', dateRange.end)
      }

      if (search) {
        queryBuilder = queryBuilder.where('message', 'ILIKE', `%${search}%`)
      }

      if (userId) {
        queryBuilder = queryBuilder.where('metadata', 'LIKE', `%"userId":"${userId}"%`)
      }

      if (requestId) {
        queryBuilder = queryBuilder.where('metadata', 'LIKE', `%"requestId":"${requestId}"%`)
      }

      // Get total count
      const countQuery = queryBuilder.clone().count('*')
      const totalResult = await countQuery.first()
      const total = parseInt(totalResult?.count || '0')

      // Get paginated results
      const results = await queryBuilder
        .limit(limit)
        .offset(offset)
        .execute()

      const logs: LogEntry[] = results.map((row: any) => {
        const metadata = row.metadata || {}
        return {
          id: row.id,
          level: row.level, // Already aliased to log_level in SELECT
          component: row.component,
          message: row.message,
          metadata,
          timestamp: new Date(row.timestamp), // Already aliased to created_at in SELECT
          stackTrace: metadata.stackTrace,
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          requestId: metadata.requestId,
          environment: metadata.environment || 'development'
        }
      })

      return {
        logs,
        total,
        hasMore: offset + logs.length < total
      }

    } catch (error) {
      console.error('Failed to query logs:', error)
      throw new Error(`Log query failed: ${error.message}`)
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(dateRange?: { start: Date; end: Date }): Promise<{
    totalLogs: number
    errorCount: number
    warningCount: number
    infoCount: number
    debugCount: number
    topComponents: Array<{ component: string; count: number }>
    recentErrors: LogEntry[]
  }> {
    try {
      let baseQuery = query('system_logs')

      if (dateRange) {
        baseQuery = baseQuery
          .where('created_at', '>=', dateRange.start)
          .where('created_at', '<=', dateRange.end)
      }

      // Get counts by level
      const levelCounts = await baseQuery.clone()
        .select(['log_level'])
        .count('* as count')
        .groupBy('log_level')
        .execute()

      const stats = {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        debugCount: 0
      }

      levelCounts.forEach((row: any) => {
        const count = parseInt(row.count)
        stats.totalLogs += count
        
        switch (row.log_level) {
          case LogLevel.ERROR:
            stats.errorCount = count
            break
          case LogLevel.WARNING:
            stats.warningCount = count
            break
          case LogLevel.INFO:
            stats.infoCount = count
            break
          case LogLevel.DEBUG:
            stats.debugCount = count
            break
        }
      })

      // Get top components
      const topComponents = await baseQuery.clone()
        .select(['component'])
        .count('* as count')
        .groupBy('component')
        .orderBy('count', 'DESC')
        .limit(10)
        .execute()

      // Get recent errors
      const recentErrorsQuery = await this.queryLogs({
        level: [LogLevel.ERROR],
        limit: 10,
        ...(dateRange && { dateRange })
      })

      return {
        ...stats,
        topComponents: topComponents.map((row: any) => ({
          component: row.component,
          count: parseInt(row.count)
        })),
        recentErrors: recentErrorsQuery.logs
      }

    } catch (error) {
      console.error('Failed to get log statistics:', error)
      throw new Error(`Log statistics query failed: ${error.message}`)
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await query('system_logs')
        .where('created_at', '<', cutoffDate)
        .delete()

      await this.logInfo('LoggingService', `Cleaned up ${result} old log entries`, {
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      })

      return result

    } catch (error) {
      await this.logError('LoggingService', 'Failed to cleanup old logs', {
        retentionDays,
        error: error.message
      }, error)
      throw error
    }
  }

  /**
   * Export logs to JSON
   */
  async exportLogs(filters: LogFilter = {}): Promise<string> {
    try {
      const result = await this.queryLogs({
        ...filters,
        limit: 10000 // Large limit for export
      })

      return JSON.stringify(result.logs, null, 2)

    } catch (error) {
      await this.logError('LoggingService', 'Failed to export logs', { filters }, error)
      throw error
    }
  }

  /**
   * Add log entry to buffer for batch processing
   */
  private async addToBuffer(logEntry: LogEntry): Promise<void> {
    this.logBuffer.push(logEntry)

    // If buffer is full, flush immediately
    if (this.logBuffer.length >= this.maxBatchSize) {
      await this.flushBuffer()
    }
  }

  /**
   * Flush log buffer to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return
    }

    const logsToFlush = [...this.logBuffer]
    this.logBuffer = []

    try {
      // Ensure logs table exists (using legacy schema)
      await this.ensureLogsTable()

      // Insert logs in batch using actual schema columns only
      await insert('system_logs')
        .values(logsToFlush.map(log => ({
          log_level: log.level,
          component: log.component.substring(0, 100), // Truncate to fit VARCHAR(100)
          message: log.message,
          metadata: JSON.stringify({
            ...(log.metadata || {}),
            // Include additional fields in metadata since they don't have columns
            ...(log.stackTrace && { stackTrace: log.stackTrace }),
            ...(log.userId && { userId: log.userId }),
            ...(log.sessionId && { sessionId: log.sessionId }),
            ...(log.requestId && { requestId: log.requestId }),
            ...(log.environment && { environment: log.environment })
          })
          // created_at will be set by DEFAULT NOW()
        })))
        .execute()

    } catch (error) {
      console.error('Failed to flush log buffer:', error)
      // Re-add logs to buffer to retry later
      this.logBuffer.unshift(...logsToFlush)
    }
  }

  /**
   * Start periodic buffer flushing
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(async () => {
      await this.flushBuffer()
    }, this.flushInterval)
  }

  /**
   * Ensure logs table exists (do nothing - table created by migration)
   */
  private async ensureLogsTable(): Promise<void> {
    // Table is created by database migration, no need to create here
    // Just verify it exists and is accessible
    try {
      await db.query(`SELECT 1 FROM system_logs LIMIT 1`)
    } catch (error) {
      console.error('system_logs table not accessible:', error)
    }
  }

  /**
   * Graceful shutdown - flush remaining logs
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    
    await this.flushBuffer()
  }
}

// Export singleton instance
export const loggingService = new LoggingService()

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await loggingService.shutdown()
  })

  process.on('SIGINT', async () => {
    await loggingService.shutdown()
  })
}