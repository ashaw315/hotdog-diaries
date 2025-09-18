import { GET } from '@/app/api/admin/analytics/route'
import { NextRequest } from 'next/server'
import { 
  mockAnalyticsResult
} from '@/__tests__/utils/metrics-mocks'

// Mock the metrics service
jest.mock('@/lib/services/metrics-service', () => ({
  metricsService: {
    getDashboardMetrics: jest.fn(),
    getPlatformPerformance: jest.fn(),
    getContentTrends: jest.fn()
  }
}))

const { metricsService } = require('@/lib/services/metrics-service')

describe('/api/admin/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return comprehensive analytics data', async () => {
      // Mock the specific service methods that the analytics route calls
      metricsService.getDashboardMetrics.mockResolvedValue({
        contentMetrics: {
          totalContent: 150,
          approvedContent: 90,
          postedContent: 60,
          approvalRate: 0.6,
          avgConfidenceScore: 0.78
        },
        platformMetrics: mockAnalyticsResult.platformMetrics,
        engagementMetrics: mockAnalyticsResult.engagementMetrics,
        filteringMetrics: mockAnalyticsResult.filteringMetrics,
        systemHealth: {
          queueSize: 30,
          lastScanTime: '2025-09-12T10:00:00Z',
          lastPostTime: '2025-09-12T08:00:00Z',
          errorRate: 0.05
        }
      })

      metricsService.getPlatformPerformance.mockResolvedValue([
        { date: '2025-09-10', posts: 8, approved: 6 },
        { date: '2025-09-11', posts: 10, approved: 7 }
      ])

      metricsService.getContentTrends.mockResolvedValue(mockAnalyticsResult.contentTrends)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        overview: {
          totalContent: 150,
          approvedContent: 90,
          postedContent: 60,
          approvalRate: 0.6,
          avgConfidenceScore: 0.78,
          queueSize: 30,
          errorRate: 0.05
        },
        platformMetrics: expect.arrayContaining([
          expect.objectContaining({
            platform: 'reddit',
            totalScanned: expect.any(Number),
            totalApproved: expect.any(Number),
            totalPosted: expect.any(Number),
            approvalRate: expect.any(Number),
            avgConfidenceScore: expect.any(Number)
          })
        ]),
        engagementMetrics: expect.objectContaining({
          totalViews: expect.any(Number),
          avgEngagementScore: expect.any(Number),
          topPerformingContent: expect.any(Array)
        }),
        filteringMetrics: expect.objectContaining({
          totalAnalyzed: expect.any(Number),
          avgConfidenceScore: expect.any(Number),
          flaggedCount: expect.any(Number),
          flaggedPatterns: expect.any(Array)
        }),
        contentTrends: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(String),
            totalContent: expect.any(Number),
            approvedContent: expect.any(Number),
            postedContent: expect.any(Number),
            approvalRate: expect.any(Number),
            avgConfidence: expect.any(Number)
          })
        ]),
        platformTrends: expect.objectContaining({
          reddit: expect.any(Array),
          youtube: expect.any(Array)
        }),
        queueHealth: expect.objectContaining({
          queueSize: 30,
          lastScanTime: '2025-09-12T10:00:00Z',
          lastPostTime: '2025-09-12T08:00:00Z',
          errorRate: 0.05,
          isHealthy: expect.any(Boolean)
        })
      })

      // Verify that caching headers are set  
      const headers = response.headers
      if (headers && typeof headers.get === 'function') {
        expect(headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
        expect(headers.get('Pragma')).toBe('no-cache')
        expect(headers.get('Expires')).toBe('0')
      }
    })

    it('should return analytics with minimal data when services return empty results', async () => {
      // Mock empty results
      metricsService.getDashboardMetrics.mockResolvedValue({
        contentMetrics: {
          totalContent: 0,
          approvedContent: 0,
          postedContent: 0,
          approvalRate: 0,
          avgConfidenceScore: 0
        },
        platformMetrics: [],
        engagementMetrics: {
          totalViews: 0,
          avgEngagementScore: 0,
          topPerformingContent: []
        },
        filteringMetrics: {
          totalAnalyzed: 0,
          avgConfidenceScore: 0,
          flaggedCount: 0,
          flaggedPatterns: []
        },
        systemHealth: {
          queueSize: 0,
          lastScanTime: null,
          lastPostTime: null,
          errorRate: 0
        }
      })

      metricsService.getPlatformPerformance.mockResolvedValue([])
      metricsService.getContentTrends.mockResolvedValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.overview.totalContent).toBe(0)
      expect(data.platformMetrics).toEqual([])
      expect(data.contentTrends).toEqual([])
      expect(data.queueHealth.isHealthy).toBe(true) // Empty queue is healthy
    })

    it('should handle platform performance errors gracefully', async () => {
      // Mock dashboard metrics success
      metricsService.getDashboardMetrics.mockResolvedValue({
        contentMetrics: {
          totalContent: 100,
          approvedContent: 75,
          postedContent: 50,
          approvalRate: 0.75,
          avgConfidenceScore: 0.80
        },
        platformMetrics: mockAnalyticsResult.platformMetrics,
        engagementMetrics: mockAnalyticsResult.engagementMetrics,
        filteringMetrics: mockAnalyticsResult.filteringMetrics,
        systemHealth: {
          queueSize: 25,
          lastScanTime: '2025-09-12T10:00:00Z',
          lastPostTime: '2025-09-12T08:00:00Z',
          errorRate: 0.02
        }
      })

      // Mock platform performance errors for some platforms
      metricsService.getPlatformPerformance
        .mockResolvedValueOnce([{ date: '2025-09-10', posts: 5 }]) // reddit success
        .mockRejectedValueOnce(new Error('YouTube API error')) // youtube error
        .mockResolvedValueOnce([]) // bluesky success but empty
        .mockRejectedValueOnce(new Error('Platform unavailable')) // others error

      metricsService.getContentTrends.mockResolvedValue(mockAnalyticsResult.contentTrends)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.overview.totalContent).toBe(100)
      expect(data.platformTrends).toEqual(expect.objectContaining({
        reddit: [{ date: '2025-09-10', posts: 5 }],
        youtube: [],
        bluesky: []
      }))
    })

    it('should return 500 error when dashboard metrics fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      metricsService.getDashboardMetrics.mockRejectedValue(new Error('Database connection failed'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        error: 'Failed to fetch analytics data'
      })

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching analytics:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('should return 500 error when content trends fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      // Mock dashboard metrics success
      metricsService.getDashboardMetrics.mockResolvedValue({
        contentMetrics: {
          totalContent: 50,
          approvedContent: 40,
          postedContent: 30,
          approvalRate: 0.8,
          avgConfidenceScore: 0.75
        },
        platformMetrics: [],
        engagementMetrics: { totalViews: 1000, avgEngagementScore: 2.5, topPerformingContent: [] },
        filteringMetrics: { totalAnalyzed: 100, avgConfidenceScore: 0.7, flaggedCount: 5, flaggedPatterns: [] },
        systemHealth: { queueSize: 15, lastScanTime: null, lastPostTime: null, errorRate: 0.1 }
      })

      metricsService.getPlatformPerformance.mockResolvedValue([])
      metricsService.getContentTrends.mockRejectedValue(new Error('Trends calculation failed'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        error: 'Failed to fetch analytics data'
      })

      consoleSpy.mockRestore()
    })

    it('should validate response structure matches frontend expectations', async () => {
      // Mock complete successful response
      metricsService.getDashboardMetrics.mockResolvedValue({
        contentMetrics: {
          totalContent: 200,
          approvedContent: 150,
          postedContent: 100,
          approvalRate: 0.75,
          avgConfidenceScore: 0.82
        },
        platformMetrics: [
          {
            platform: 'reddit',
            totalScanned: 50,
            totalApproved: 40,
            totalPosted: 35,
            approvalRate: 0.8,
            avgConfidenceScore: 0.85,
            lastScanDate: '2025-09-12T10:00:00Z'
          }
        ],
        engagementMetrics: {
          totalViews: 75000,
          avgEngagementScore: 4.2,
          topPerformingContent: [
            { id: '1', title: 'Best hotdog ever', views: 5000, score: 4.9 }
          ]
        },
        filteringMetrics: {
          totalAnalyzed: 300,
          avgConfidenceScore: 0.78,
          flaggedCount: 25,
          flaggedPatterns: ['spam', 'duplicate']
        },
        systemHealth: {
          queueSize: 45,
          lastScanTime: '2025-09-12T10:00:00Z',
          lastPostTime: '2025-09-12T08:00:00Z',
          errorRate: 0.03
        }
      })

      metricsService.getPlatformPerformance.mockResolvedValue([
        { date: '2025-09-10', posts: 12, approved: 10 }
      ])

      metricsService.getContentTrends.mockResolvedValue([
        {
          date: '2025-09-10',
          totalContent: 45,
          approvedContent: 35,
          postedContent: 25,
          approvalRate: 0.78,
          avgConfidence: 0.80
        }
      ])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)

      // Validate all required fields are present and correctly typed
      expect(data).toHaveProperty('overview')
      expect(data).toHaveProperty('platformMetrics')
      expect(data).toHaveProperty('engagementMetrics')
      expect(data).toHaveProperty('filteringMetrics')
      expect(data).toHaveProperty('contentTrends')
      expect(data).toHaveProperty('platformTrends')
      expect(data).toHaveProperty('queueHealth')

      // Validate overview structure
      expect(data.overview).toMatchObject({
        totalContent: expect.any(Number),
        approvedContent: expect.any(Number),
        postedContent: expect.any(Number),
        approvalRate: expect.any(Number),
        avgConfidenceScore: expect.any(Number),
        queueSize: expect.any(Number),
        errorRate: expect.any(Number)
      })

      // Validate platform metrics structure
      expect(Array.isArray(data.platformMetrics)).toBe(true)
      if (data.platformMetrics.length > 0) {
        expect(data.platformMetrics[0]).toMatchObject({
          platform: expect.any(String),
          totalScanned: expect.any(Number),
          totalApproved: expect.any(Number),
          totalPosted: expect.any(Number),
          approvalRate: expect.any(Number),
          avgConfidenceScore: expect.any(Number),
          lastScanDate: expect.any(String)
        })
      }

      // Validate queue health calculation
      expect(data.queueHealth.isHealthy).toBe(true) // 45 < 100 && 0.03 < 0.1
    })

    it('should correctly calculate queue health status', async () => {
      // Test unhealthy queue (high size and error rate)
      metricsService.getDashboardMetrics.mockResolvedValue({
        contentMetrics: {
          totalContent: 500,
          approvedContent: 300,
          postedContent: 200,
          approvalRate: 0.6,
          avgConfidenceScore: 0.65
        },
        platformMetrics: [],
        engagementMetrics: { totalViews: 0, avgEngagementScore: 0, topPerformingContent: [] },
        filteringMetrics: { totalAnalyzed: 0, avgConfidenceScore: 0, flaggedCount: 0, flaggedPatterns: [] },
        systemHealth: {
          queueSize: 150, // > 100 (unhealthy)
          lastScanTime: '2025-09-12T10:00:00Z',
          lastPostTime: '2025-09-12T08:00:00Z',
          errorRate: 0.15 // > 0.1 (unhealthy)
        }
      })

      metricsService.getPlatformPerformance.mockResolvedValue([])
      metricsService.getContentTrends.mockResolvedValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.queueHealth.isHealthy).toBe(false) // Should be unhealthy
      expect(data.queueHealth.queueSize).toBe(150)
      expect(data.queueHealth.errorRate).toBe(0.15)
    })
  })
})