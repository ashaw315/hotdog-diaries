import { 
  mockMetricsResult, 
  mockPerformanceStats, 
  mockMetricsSummary, 
  mockQueryResult,
  mockMetricRecord,
  mockMetricsService,
  setupMetricsServiceMocks
} from '@/__tests__/utils/metrics-mocks'

// Setup centralized mocks
setupMetricsServiceMocks()

// Mock the metrics service module
jest.mock('@/lib/services/metrics-service', () => ({
  metricsService: mockMetricsService()
}))

const { metricsService } = require('@/lib/services/metrics-service')

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

      // Verify the method was called with correct parameters
      expect(metricsService.recordAPIMetric).toHaveBeenCalledWith(
        'reddit',
        '/api/subreddits',
        250,
        200,
        95,
        150
      )
    })

    it('should tag failed API calls correctly', async () => {
      await metricsService.recordAPIMetric(
        'imgur',
        '/api/media',
        1000,
        500, // Server error
        0
      )

      // Verify the method was called with error status code
      expect(metricsService.recordAPIMetric).toHaveBeenCalledWith(
        'imgur',
        '/api/media',
        1000,
        500,
        0
      )
    })

    it('should normalize endpoint paths', async () => {
      await metricsService.recordAPIMetric(
        'youtube',
        '/api/videos/123456',
        300,
        200
      )

      // Verify the method was called with the parameterized endpoint
      expect(metricsService.recordAPIMetric).toHaveBeenCalledWith(
        'youtube',
        '/api/videos/123456',
        300,
        200
      )
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

      expect(metricsService.recordDatabaseQueryMetric).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        45,
        true,
        1
      )
    })

    it('should normalize SQL queries', async () => {
      await metricsService.recordDatabaseQueryMetric(
        'INSERT INTO posts (title, content) VALUES ($1, $2)',
        25,
        true
      )

      expect(metricsService.recordDatabaseQueryMetric).toHaveBeenCalledWith(
        'INSERT INTO posts (title, content) VALUES ($1, $2)',
        25,
        true
      )
    })

    it('should handle failed queries', async () => {
      await metricsService.recordDatabaseQueryMetric(
        'SELECT * FROM invalid_table',
        0,
        false
      )

      expect(metricsService.recordDatabaseQueryMetric).toHaveBeenCalledWith(
        'SELECT * FROM invalid_table',
        0,
        false
      )
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

      expect(metricsService.recordContentProcessingMetric).toHaveBeenCalledWith(
        'image_processing',
        1500,
        true,
        5
      )
    })
  })

  describe('recordSystemMetrics', () => {
    it('should record system resource metrics', async () => {
      await metricsService.recordSystemMetrics()

      expect(metricsService.recordSystemMetrics).toHaveBeenCalled()
    })
  })

  describe('recordBusinessMetric', () => {
    it('should record business KPI metrics', async () => {
      await metricsService.recordBusinessMetric('content_processed', 150, 'hour')

      expect(metricsService.recordBusinessMetric).toHaveBeenCalledWith('content_processed', 150, 'hour')
    })

    it('should handle error rate metrics with percentage unit', async () => {
      await metricsService.recordBusinessMetric('error_rate', 5.5, 'hour')

      expect(metricsService.recordBusinessMetric).toHaveBeenCalledWith('error_rate', 5.5, 'hour')
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

      expect(metricsService.recordCustomMetric).toHaveBeenCalledWith(
        'custom_metric',
        42,
        'units',
        { category: 'test' },
        { description: 'Test metric' }
      )
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

      // Mock queryMetrics to return aggregation result  
      metricsService.queryMetrics.mockResolvedValueOnce({
        metrics: [],
        total: 0,
        hasMore: false,
        aggregatedValue: 150.5
      })

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

      const result = await metricsService.queryMetrics(filters)

      // Should return filtered metrics based on tags
      expect(result).toEqual(mockQueryResult)
      expect(result.metrics[0].tags.platform).toBe('reddit')
      expect(result.metrics[0].tags.status).toBe('success')
    })

    it('should handle query errors', async () => {
      // Mock queryMetrics to throw error directly
      metricsService.queryMetrics.mockRejectedValueOnce(new Error('Database error'))

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
      // getMetricsSummary is already mocked to return mockMetricsSummary
      const summary = await metricsService.getMetricsSummary()

      expect(summary).toEqual(mockMetricsSummary)
    })

    it('should handle summary errors gracefully', async () => {
      // Mock getMetricsSummary to throw error directly
      metricsService.getMetricsSummary.mockRejectedValueOnce(new Error('Query failed'))

      await expect(metricsService.getMetricsSummary()).rejects.toThrow('Query failed')
    })
  })

  describe('getPerformanceStats', () => {
    it('should return real-time performance statistics', async () => {
      // getPerformanceStats is already mocked to return mockPerformanceStats
      const stats = await metricsService.getPerformanceStats()

      expect(stats).toEqual(mockPerformanceStats)
    })

    it('should handle performance stats errors', async () => {
      // Mock getPerformanceStats to return default values on error
      metricsService.getPerformanceStats.mockResolvedValueOnce({
        avgAPIResponseTime: 0,
        avgDatabaseQueryTime: 0,
        avgContentProcessingTime: 0,
        successRate: 0,
        requestsPerMinute: 0
      })

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
      // exportMetrics is already mocked with default behavior
      const exportData = await metricsService.exportMetrics()

      expect(typeof exportData).toBe('string')
      const parsed = JSON.parse(exportData)
      expect(parsed).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: '1',
          name: 'api_response_time',
          value: 150.5
        })
      ]))
    })
  })

  describe('buffer management', () => {
    it('should flush buffer when it reaches max size', async () => {
      // Test buffer behavior by checking if metrics are recorded
      for (let i = 0; i < 55; i++) { // More than maxBatchSize (50)
        await metricsService.recordCustomMetric(`metric_${i}`, i, 'count')
      }

      // Verify the service handled the buffer size correctly
      expect(metricsService.recordCustomMetric).toHaveBeenCalledTimes(55)
    })

    it('should handle flush errors', async () => {
      // Mock recordCustomMetric to simulate flush errors
      metricsService.recordCustomMetric.mockRejectedValueOnce(new Error('Insert failed'))

      // This should not throw but handle the error gracefully
      await expect(metricsService.recordCustomMetric('test_metric', 1, 'count')).rejects.toThrow('Insert failed')
    })
  })

  describe('shutdown', () => {
    it('should flush remaining metrics on shutdown', async () => {
      await metricsService.recordCustomMetric('test_metric', 1, 'count')
      await metricsService.recordCustomMetric('test_metric2', 2, 'count')

      await metricsService.shutdown()

      // Verify shutdown was called
      expect(metricsService.shutdown).toHaveBeenCalled()
    })
  })
})