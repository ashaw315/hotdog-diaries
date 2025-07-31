import { HealthService, HealthStatus } from '@/lib/services/health'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn(),
    getPoolStats: jest.fn(() => ({
      total: 10,
      idle: 6,
      active: 4
    }))
  }
}))

jest.mock('@/lib/db-query-builder', () => ({
  query: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([{ id: '1' }])
  }))
}))

jest.mock('@/lib/services/logging', () => ({
  loggingService: {
    logError: jest.fn(),
    logInfo: jest.fn()
  }
}))

jest.mock('@/lib/services/reddit', () => ({
  redditService: {
    getApiStatus: jest.fn().mockResolvedValue({
      isConnected: true,
      rateLimits: { remaining: 100, resetTime: new Date() },
      userAgent: 'test-agent',
      lastRequest: new Date()
    })
  }
}))

jest.mock('@/lib/services/instagram', () => ({
  instagramService: {
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      rateLimits: { remaining: 50, resetTime: new Date() },
      tokenExpiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      lastRequest: new Date()
    })
  }
}))

jest.mock('@/lib/services/tiktok', () => ({
  tiktokService: {
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      quota: {
        hourly: { used: 10, limit: 100 },
        daily: { used: 50, limit: 1000 }
      },
      tokenExpiresAt: new Date(Date.now() + 86400000)
    })
  }
}))

jest.mock('@/lib/services/reddit-scanning', () => ({
  redditScanningService: {
    getScanStats: jest.fn().mockResolvedValue({ active: true })
  }
}))

jest.mock('@/lib/services/instagram-scanning', () => ({
  instagramScanningService: {
    getScanStats: jest.fn().mockResolvedValue({ active: true })
  }
}))

jest.mock('@/lib/services/tiktok-scanning', () => ({
  tiktokScanningService: {
    getScanStats: jest.fn().mockResolvedValue({ active: true })
  }
}))

describe('HealthService', () => {
  let healthService: HealthService
  let mockDb: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockDb = require('@/lib/db').db
    healthService = new HealthService()
  })

  describe('checkDatabaseHealth', () => {
    it('should return healthy status for working database', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ health_check: 1 }] })

      const result = await healthService.checkDatabaseHealth()

      expect(result.status).toBe(HealthStatus.HEALTHY)
      expect(result.name).toBe('Database')
      expect(result.connectionPool).toEqual({
        total: 10,
        idle: 6,
        active: 4
      })
      expect(result.responseTime).toBeGreaterThan(0)
    })

    it('should return critical status for database connection failure', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await healthService.checkDatabaseHealth()

      expect(result.status).toBe(HealthStatus.CRITICAL)
      expect(result.message).toContain('Database connection failed')
      expect(result.connectionPool).toEqual({
        total: 0,
        idle: 0,
        active: 0
      })
    })

    it('should return warning status for high connection pool utilization', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ health_check: 1 }] })
      mockDb.getPoolStats.mockReturnValueOnce({
        total: 10,
        idle: 1,
        active: 9 // 90% utilization
      })

      const result = await healthService.checkDatabaseHealth()

      expect(result.status).toBe(HealthStatus.WARNING)
      expect(result.message).toContain('pool utilization is high')
    })

    it('should return critical status for nearly exhausted connection pool', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ health_check: 1 }] })
      mockDb.getPoolStats.mockReturnValueOnce({
        total: 10,
        idle: 0,
        active: 10 // 100% utilization
      })

      const result = await healthService.checkDatabaseHealth()

      expect(result.status).toBe(HealthStatus.CRITICAL)
      expect(result.message).toContain('nearly exhausted')
    })
  })

  describe('checkSocialMediaAPIs', () => {
    it('should check all social media APIs', async () => {
      const result = await healthService.checkSocialMediaAPIs()

      expect(result).toHaveProperty('reddit')
      expect(result).toHaveProperty('instagram')
      expect(result).toHaveProperty('tiktok')
      
      expect(result.reddit.status).toBe(HealthStatus.HEALTHY)
      expect(result.instagram.status).toBe(HealthStatus.HEALTHY)
      expect(result.tiktok.status).toBe(HealthStatus.HEALTHY)
    })

    it('should handle API failures gracefully', async () => {
      const redditService = require('@/lib/services/reddit').redditService
      redditService.getApiStatus.mockRejectedValueOnce(new Error('API Error'))

      const result = await healthService.checkSocialMediaAPIs()

      expect(result.reddit.status).toBe(HealthStatus.CRITICAL)
      expect(result.reddit.message).toContain('API Error')
    })
  })

  describe('checkContentQueue', () => {
    it('should return healthy status for normal queue', async () => {
      const { query } = require('@/lib/db-query-builder')
      query.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([
          { status: 'pending', count: '10' },
          { status: 'approved', count: '5' },
          { status: 'rejected', count: '2' }
        ])
      })

      const result = await healthService.checkContentQueue()

      expect(result.status).toBe(HealthStatus.HEALTHY)
      expect(result.name).toBe('Content Queue')
    })

    it('should return warning for low pending items', async () => {
      const { query } = require('@/lib/db-query-builder')
      query.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([
          { status: 'pending', count: '2' }, // Low pending count
          { status: 'approved', count: '50' }
        ])
      })

      const result = await healthService.checkContentQueue()

      expect(result.status).toBe(HealthStatus.WARNING)
      expect(result.message).toContain('running low')
    })

    it('should return warning for large backlog', async () => {
      const { query } = require('@/lib/db-query-builder')
      query.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([
          { status: 'pending', count: '1500' }, // Large backlog
          { status: 'approved', count: '100' }
        ])
      })

      const result = await healthService.checkContentQueue()

      expect(result.status).toBe(HealthStatus.WARNING)
      expect(result.message).toContain('large backlog')
    })
  })

  describe('checkScheduler', () => {
    it('should return healthy status for normal posting activity', async () => {
      const { query } = require('@/lib/db-query-builder')
      query.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '6' }) // Expected posts per day
      })

      const result = await healthService.checkScheduler()

      expect(result.status).toBe(HealthStatus.HEALTHY)
      expect(result.message).toContain('working normally')
    })

    it('should return critical status for no recent posts', async () => {
      const { query } = require('@/lib/db-query-builder')
      query.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' })
      })

      const result = await healthService.checkScheduler()

      expect(result.status).toBe(HealthStatus.CRITICAL)
      expect(result.message).toContain('No posts have been made')
    })

    it('should return warning for low posting activity', async () => {
      const { query } = require('@/lib/db-query-builder')
      query.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '3' }) // Below expected
      })

      const result = await healthService.checkScheduler()

      expect(result.status).toBe(HealthStatus.WARNING)
      expect(result.message).toContain('Only 3 posts made')
    })
  })

  describe('checkSystemResources', () => {
    it('should check system memory, disk, and CPU', async () => {
      const result = await healthService.checkSystemResources()

      expect(result).toHaveProperty('memory')
      expect(result).toHaveProperty('disk')
      expect(result).toHaveProperty('cpu')
      
      expect(result.memory.name).toBe('Memory')
      expect(result.disk.name).toBe('Disk')
      expect(result.cpu.name).toBe('CPU')
    })

    it('should return warning for high memory usage', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 1024 * 1024 * 1024, // 1GB
        heapTotal: 600 * 1024 * 1024, // 600MB
        heapUsed: 550 * 1024 * 1024, // 550MB (>512MB threshold)
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      })

      const result = await healthService.checkSystemResources()

      expect(result.memory.status).toBe(HealthStatus.WARNING)
      expect(result.memory.message).toContain('high')

      // Restore original function
      process.memoryUsage = originalMemoryUsage
    })

    it('should return critical for very high memory usage', async () => {
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 2048 * 1024 * 1024, // 2GB
        heapTotal: 1200 * 1024 * 1024, // 1200MB
        heapUsed: 1100 * 1024 * 1024, // 1100MB (>1024MB threshold)
        external: 100 * 1024 * 1024,
        arrayBuffers: 50 * 1024 * 1024
      })

      const result = await healthService.checkSystemResources()

      expect(result.memory.status).toBe(HealthStatus.CRITICAL)
      expect(result.memory.message).toContain('critical')

      process.memoryUsage = originalMemoryUsage
    })
  })

  describe('generateHealthReport', () => {
    it('should generate comprehensive health report', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ health_check: 1 }] })

      const report = await healthService.generateHealthReport()

      expect(report).toHaveProperty('overallStatus')
      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('uptime')
      expect(report).toHaveProperty('checks')
      expect(report).toHaveProperty('summary')

      expect(report.checks).toHaveProperty('database')
      expect(report.checks).toHaveProperty('apis')
      expect(report.checks).toHaveProperty('services')
      expect(report.checks).toHaveProperty('system')

      expect(report.summary).toHaveProperty('totalChecks')
      expect(report.summary).toHaveProperty('healthyChecks')
      expect(report.summary).toHaveProperty('warningChecks')
      expect(report.summary).toHaveProperty('criticalChecks')
      expect(report.summary).toHaveProperty('responseTime')
    })

    it('should set overall status to critical if any check is critical', async () => {
      mockDb.query.mockRejectedValue(new Error('Database down'))

      const report = await healthService.generateHealthReport()

      expect(report.overallStatus).toBe(HealthStatus.CRITICAL)
      expect(report.summary.criticalChecks).toBeGreaterThan(0)
    })

    it('should set overall status to warning if any check is warning', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ health_check: 1 }] })
      mockDb.getPoolStats.mockReturnValue({
        total: 10,
        idle: 1,
        active: 9 // High utilization - warning
      })

      const report = await healthService.generateHealthReport()

      expect(report.overallStatus).toBe(HealthStatus.WARNING)
      expect(report.summary.warningChecks).toBeGreaterThan(0)
    })

    it('should handle partial failures gracefully', async () => {
      // Make one service fail
      const redditService = require('@/lib/services/reddit').redditService
      redditService.getApiStatus.mockRejectedValue(new Error('Reddit API down'))

      const report = await healthService.generateHealthReport()

      expect(report.checks.apis.reddit.status).toBe(HealthStatus.CRITICAL)
      expect(report.checks.apis.instagram.status).toBe(HealthStatus.HEALTHY)
      expect(report.checks.apis.tiktok.status).toBe(HealthStatus.HEALTHY)
    })
  })

  describe('isHealthy', () => {
    it('should return true for healthy system', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ health_check: 1 }] })

      const isHealthy = await healthService.isHealthy()

      expect(isHealthy).toBe(true)
    })

    it('should return true for system with warnings', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ health_check: 1 }] })
      mockDb.getPoolStats.mockReturnValue({
        total: 10,
        idle: 1,
        active: 9 // Warning level
      })

      const isHealthy = await healthService.isHealthy()

      expect(isHealthy).toBe(true) // Warnings are still considered "healthy"
    })

    it('should return false for critical system', async () => {
      mockDb.query.mockRejectedValue(new Error('Database down'))

      const isHealthy = await healthService.isHealthy()

      expect(isHealthy).toBe(false)
    })

    it('should return false on health check failure', async () => {
      // Mock generateHealthReport to throw
      jest.spyOn(healthService, 'generateHealthReport').mockRejectedValue(new Error('Health check failed'))

      const isHealthy = await healthService.isHealthy()

      expect(isHealthy).toBe(false)
    })
  })

  describe('getUptime', () => {
    it('should return uptime in milliseconds', () => {
      const uptime = healthService.getUptime()

      expect(typeof uptime).toBe('number')
      expect(uptime).toBeGreaterThan(0)
    })
  })
})