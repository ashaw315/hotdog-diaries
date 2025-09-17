import { metricsService } from '@/lib/services/metrics-service'

// Mock dependencies
jest.mock('@/lib/db-query-builder', () => ({
  query: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue({ count: '100', aggregated_value: '150.5' }),
    execute: jest.fn().mockResolvedValue([
      {
        id: '1',
        name: 'api_response_time',
        value: 150.5,
        unit: 'ms',
        timestamp: new Date(),
        tags: '{"platform": "reddit", "status": "success"}',
        metadata: '{"statusCode": 200}',
        environment: 'test'
      }
    ]),
    clone: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(50)
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

jest.mock('@/lib/services/logging', () => ({
  loggingService: {
    logError: jest.fn(),
    logInfo: jest.fn(),
    logWarning: jest.fn()
  }
}))

describe('MetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear the metric buffer for each test
    if (metricsService && metricsService['metricBuffer']) {
      metricsService['metricBuffer'] = []
    }
  })

  afterEach(async () => {
    if (metricsService && metricsService.shutdown) {
      await metricsService.shutdown()
    }
  })

  describe('recordAPIMetric', () => {
    it('should record API response time metric', async () => {
      await metricsService.recordAPIMetric(
        'reddit',
        '/api/subreddits',
        250,
        200,
        95,
        150
      )

      // Metric should be added to buffer
      expect(metricsService['metricBuffer']).toHaveLength(1)
      expect(metricsService['metricBuffer'][0]).toMatchObject({
        name: 'api_response_time',
        value: 250,
        unit: 'ms',
        tags: {
          platform: 'reddit',
          endpoint: '/api/subreddits',
          status: 'success'
        }
      })
    })

    it('should tag failed API calls correctly', async () => {
      await metricsService.recordAPIMetric(
        'imgur',
        '/api/media',
        1000,
        500, // Server error
        0
      )

      expect(metricsService['metricBuffer'][0].tags?.status).toBe('error')
    })

    it('should normalize endpoint paths', async () => {
      await metricsService.recordAPIMetric(
        'youtube',
        '/api/videos/123456',
        300,
        200
      )

      expect(metricsService['metricBuffer'][0].tags?.endpoint).toBe('/api/videos/:id')
    })
  })

  describe('recordDatabaseQueryMetric', () => {
    it('should record database query performance', async () => {
      await metricsService.recordDatabaseQueryMetric(
        'SELECT * FROM users WHERE id = $1',
        45,
        true,
        1
      )

      expect(metricsService['metricBuffer']).toHaveLength(1)
      expect(metricsService['metricBuffer'][0]).toMatchObject({
        name: 'database_query_time',
        value: 45,
        unit: 'ms',
        tags: {
          operation: 'select',
          status: 'success'
        }
      })
    })

    it('should normalize SQL queries', async () => {
      await metricsService.recordDatabaseQueryMetric(
        'INSERT INTO posts (title, content) VALUES ($1, $2)',
        25,
        true
      )

      expect(metricsService['metricBuffer'][0].tags?.operation).toBe('insert')
    })

    it('should handle failed queries', async () => {
      await metricsService.recordDatabaseQueryMetric(
        'SELECT * FROM invalid_table',
        0,
        false
      )

      expect(metricsService['metricBuffer'][0].tags?.status).toBe('error')
    })
  })

  describe('recordContentProcessingMetric', () => {
    it('should record content processing performance', async () => {
      await metricsService.recordContentProcessingMetric(
        'image_processing',
        1500,
        true,
        5
      )

      // Should record both processing time and throughput metrics
      expect(metricsService['metricBuffer']).toHaveLength(2)
      
      const processingMetric = metricsService['metricBuffer'][0]
      const throughputMetric = metricsService['metricBuffer'][1]

      expect(processingMetric).toMatchObject({
        name: 'content_processing_time',
        value: 1500,
        unit: 'ms'
      })

      expect(throughputMetric).toMatchObject({
        name: 'content_processing_throughput',
        value: 5 / 1.5, // items per second
        unit: 'items/sec'
      })
    })
  })

  describe('recordSystemMetrics', () => {
    it('should record system resource metrics', async () => {
      const originalMemoryUsage = process.memoryUsage
      const originalCpuUsage = process.cpuUsage
      const originalUptime = process.uptime

      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024
      })

      process.cpuUsage = jest.fn().mockReturnValue({
        user: 1000000, // 1 second in microseconds
        system: 500000 // 0.5 seconds
      })

      process.uptime = jest.fn().mockReturnValue(3600) // 1 hour

      await metricsService.recordSystemMetrics()

      expect(metricsService['metricBuffer'].length).toBeGreaterThan(0)
      
      const memoryMetric = metricsService['metricBuffer'].find(m => m.name === 'system_memory_usage')
      const cpuMetric = metricsService['metricBuffer'].find(m => m.name === 'system_cpu_usage')
      const uptimeMetric = metricsService['metricBuffer'].find(m => m.name === 'process_uptime')

      expect(memoryMetric).toBeDefined()
      expect(cpuMetric).toBeDefined()
      expect(uptimeMetric).toBeDefined()

      // Restore original functions
      process.memoryUsage = originalMemoryUsage
      process.cpuUsage = originalCpuUsage
      process.uptime = originalUptime
    })
  })

  describe('recordBusinessMetric', () => {
    it('should record business KPI metrics', async () => {
      await metricsService.recordBusinessMetric('content_processed', 150, 'hour')

      expect(metricsService['metricBuffer']).toHaveLength(1)
      expect(metricsService['metricBuffer'][0]).toMatchObject({
        name: 'business_content_processed',
        value: 150,
        unit: 'count',
        tags: {
          metric: 'content_processed',
          period: 'hour'
        }
      })
    })

    it('should handle error rate metrics with percentage unit', async () => {
      await metricsService.recordBusinessMetric('error_rate', 5.5, 'hour')

      expect(metricsService['metricBuffer'][0]).toMatchObject({
        name: 'business_error_rate',
        value: 5.5,
        unit: 'percent'
      })
    })
  })

  describe('recordCustomMetric', () => {
    it('should record custom metrics', async () => {
      await metricsService.recordCustomMetric(
        'custom_metric',
        42,
        'units',
        { category: 'test' },
        { description: 'Test metric' }
      )

      expect(metricsService['metricBuffer']).toHaveLength(1)
      expect(metricsService['metricBuffer'][0]).toMatchObject({
        name: 'custom_metric',
        value: 42,
        unit: 'units',
        tags: { category: 'test' },
        metadata: { description: 'Test metric' }
      })
    })
  })

  describe('queryMetrics', () => {
    it('should query metrics with filters', async () => {
      const filters = {
        name: ['api_response_time'],
        limit: 50,
        offset: 10,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31')
        }
      }

      const result = await metricsService.queryMetrics(filters)

      expect(result).toEqual({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            name: 'api_response_time',
            value: 150.5,
            unit: 'ms'
          })
        ]),
        total: 100,
        hasMore: true
      })
    })

    it('should handle aggregation queries', async () => {
      const filters = {
        name: ['api_response_time'],
        aggregation: 'avg' as const
      }

      const result = await metricsService.queryMetrics(filters)

      expect(result).toEqual({
        metrics: [],
        total: 0,
        hasMore: false,
        aggregatedValue: 150.5
      })
    })

    it('should handle tag filtering', async () => {
      const filters = {
        tags: { platform: 'reddit', status: 'success' }
      }

      await metricsService.queryMetrics(filters)

      const { query } = require('@/lib/db-query-builder')
      expect(query).toHaveBeenCalledWith('system_metrics')
    })

    it('should handle query errors', async () => {
      const { query } = require('@/lib/db-query-builder')
      query.mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      await expect(metricsService.queryMetrics()).rejects.toThrow('Database error')
    })
  })

  describe('getMetricsSummary', () => {
    beforeEach(() => {
      // Mock query responses for different metrics
      const { query } = require('@/lib/db-query-builder')
      query
        .mockReturnValueOnce({ // Total metrics count
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ count: '1000' })
        })
        .mockReturnValueOnce({ // Queue size
          where: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ count: '25' })
        })
        .mockReturnValueOnce({ // Slow operations
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([
            { tags: '{"operation": "image_processing"}', avg_time: '2500', count: '10' }
          ])
        })
    })

    it('should return comprehensive metrics summary', async () => {
      // Mock queryMetrics calls
      jest.spyOn(metricsService, 'queryMetrics')
        .mockResolvedValueOnce({ // API metrics
          metrics: [
            { name: 'api_response_time', value: 200, tags: { platform: 'reddit' } },
            { name: 'api_response_time', value: 150, tags: { platform: 'youtube' } }
          ],
          total: 2,
          hasMore: false
        })
        .mockResolvedValueOnce({ // System metrics
          metrics: [
            { name: 'system_memory_usage', value: 256, metadata: { heapTotal: 512 } },
            { name: 'system_cpu_usage', value: 45 }
          ],
          total: 2,
          hasMore: false
        })
        .mockResolvedValueOnce({ // Content processed
          metrics: [],
          total: 0,
          hasMore: false,
          aggregatedValue: 500
        })
        .mockResolvedValueOnce({ // Posts created
          metrics: [],
          total: 0,
          hasMore: false,
          aggregatedValue: 30
        })
        .mockResolvedValueOnce({ // Error rate
          metrics: [],
          total: 0,
          hasMore: false,
          aggregatedValue: 2.5
        })

      const summary = await metricsService.getMetricsSummary()

      expect(summary).toEqual(expect.objectContaining({
        totalMetrics: 1000,
        recentAPIResponseTimes: expect.objectContaining({
          reddit: expect.any(Number),
          youtube: expect.any(Number),
          bluesky: expect.any(Number),
          imgur: expect.any(Number),
          pixabay: expect.any(Number)
        }),
        systemResources: expect.objectContaining({
          memoryUsagePercent: expect.any(Number),
          cpuUsagePercent: expect.any(Number),
          diskUsagePercent: expect.any(Number)
        }),
        businessKPIs: expect.objectContaining({
          contentProcessedLast24h: 500,
          postsCreatedLast24h: 30,
          errorRateLast1h: 2.5,
          queueSize: 25
        }),
        topSlowOperations: expect.arrayContaining([
          expect.objectContaining({
            operation: 'image_processing',
            avgResponseTime: 2500,
            count: 10
          })
        ])
      }))
    })

    it('should handle summary errors gracefully', async () => {
      jest.spyOn(metricsService, 'queryMetrics').mockRejectedValue(new Error('Query failed'))

      await expect(metricsService.getMetricsSummary()).rejects.toThrow('Query failed')
    })
  })

  describe('getPerformanceStats', () => {
    it('should return real-time performance statistics', async () => {
      jest.spyOn(metricsService, 'queryMetrics')
        .mockResolvedValueOnce({ // API response times
          metrics: [],
          total: 0,
          hasMore: false,
          aggregatedValue: 180
        })
        .mockResolvedValueOnce({ // Database query times
          metrics: [],
          total: 0,
          hasMore: false,
          aggregatedValue: 25
        })
        .mockResolvedValueOnce({ // Content processing times
          metrics: [],
          total: 0,
          hasMore: false,
          aggregatedValue: 1200
        })
        .mockResolvedValueOnce({ // Success metrics
          metrics: [],
          total: 85,
          hasMore: false
        })
        .mockResolvedValueOnce({ // Total metrics
          metrics: [],
          total: 100,
          hasMore: false
        })

      const stats = await metricsService.getPerformanceStats()

      expect(stats).toEqual({
        avgAPIResponseTime: 180,
        avgDatabaseQueryTime: 25,
        avgContentProcessingTime: 1200,
        successRate: 85,
        requestsPerMinute: 20 // 100 total / 5 minutes
      })
    })

    it('should handle performance stats errors', async () => {
      jest.spyOn(metricsService, 'queryMetrics').mockRejectedValue(new Error('Metrics unavailable'))

      const stats = await metricsService.getPerformanceStats()

      expect(stats).toEqual({
        avgAPIResponseTime: 0,
        avgDatabaseQueryTime: 0,
        avgContentProcessingTime: 0,
        successRate: 0,
        requestsPerMinute: 0
      })
    })
  })

  describe('cleanupOldMetrics', () => {
    it('should cleanup old metrics with default retention', async () => {
      const deletedCount = await metricsService.cleanupOldMetrics()

      expect(deletedCount).toBe(50)
    })

    it('should cleanup old metrics with custom retention', async () => {
      const deletedCount = await metricsService.cleanupOldMetrics(14)

      expect(deletedCount).toBe(50)
    })
  })

  describe('exportMetrics', () => {
    it('should export metrics as JSON', async () => {
      jest.spyOn(metricsService, 'queryMetrics').mockResolvedValue({
        metrics: [
          {
            id: '1',
            name: 'test_metric',
            value: 100,
            unit: 'count',
            timestamp: new Date(),
            tags: { test: 'true' }
          }
        ],
        total: 1,
        hasMore: false
      })

      const exportData = await metricsService.exportMetrics()

      expect(typeof exportData).toBe('string')
      const parsed = JSON.parse(exportData)
      expect(parsed).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: '1',
          name: 'test_metric',
          value: 100
        })
      ]))
    })
  })

  describe('buffer management', () => {
    it('should flush buffer when it reaches max size', async () => {
      const { insert } = require('@/lib/db-query-builder')
      
      // Add more metrics than buffer size
      for (let i = 0; i < 55; i++) { // More than maxBatchSize (50)
        await metricsService.recordCustomMetric(`metric_${i}`, i, 'count')
      }

      expect(insert).toHaveBeenCalled()
    })

    it('should handle flush errors', async () => {
      const { insert } = require('@/lib/db-query-builder')
      insert.mockImplementationOnce(() => ({
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Insert failed'))
      }))

      // Fill buffer to trigger flush
      for (let i = 0; i < 55; i++) {
        await metricsService.recordCustomMetric(`metric_${i}`, i, 'count')
      }

      expect(insert).toHaveBeenCalled()
    })
  })

  describe('shutdown', () => {
    it('should flush remaining metrics on shutdown', async () => {
      await metricsService.recordCustomMetric('test_metric', 1, 'count')
      await metricsService.recordCustomMetric('test_metric2', 2, 'count')

      await metricsService.shutdown()

      const { insert } = require('@/lib/db-query-builder')
      expect(insert).toHaveBeenCalled()
    })
  })
})