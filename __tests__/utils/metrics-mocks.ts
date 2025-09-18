/**
 * Centralized mocks for metrics and analytics tests
 * Used across service, API route, and component tests
 */

// Core metrics data structures matching the consolidated API
export const mockMetricsResult = {
  totalPosts: 120,
  approved: 90,
  rejected: 20,
  scheduled: 10,
  byPlatform: {
    reddit: 30,
    youtube: 25,
    bluesky: 15,
    imgur: 20,
    giphy: 10,
    tumblr: 5,
    lemmy: 5,
    unsplash: 5,
    pixabay: 5,
  },
  byDay: [
    { date: "2025-09-10", count: 25 },
    { date: "2025-09-11", count: 30 },
    { date: "2025-09-12", count: 20 },
  ],
}

// Analytics data matching consolidated API response format
export const mockAnalyticsResult = {
  overview: {
    totalContent: 150,
    approvedContent: 90,
    postedContent: 60,
    approvalRate: 0.6,
    avgConfidenceScore: 0.78,
    queueSize: 30,
    errorRate: 0.05
  },
  platformMetrics: [
    {
      platform: 'reddit',
      totalScanned: 45,
      totalApproved: 30,
      totalPosted: 25,
      approvalRate: 0.67,
      avgConfidenceScore: 0.75,
      lastScanDate: '2025-09-12T10:00:00Z'
    },
    {
      platform: 'youtube',
      totalScanned: 38,
      totalApproved: 25,
      totalPosted: 20,
      approvalRate: 0.66,
      avgConfidenceScore: 0.80,
      lastScanDate: '2025-09-12T09:30:00Z'
    }
  ],
  engagementMetrics: {
    totalViews: 50000,
    avgEngagementScore: 3.5,
    topPerformingContent: [
      { id: '1', title: 'Amazing hotdog recipe', views: 1200, score: 4.8 },
      { id: '2', title: 'Chicago style hotdog', views: 980, score: 4.6 }
    ]
  },
  filteringMetrics: {
    totalAnalyzed: 200,
    avgConfidenceScore: 0.72,
    flaggedCount: 15,
    flaggedPatterns: ['spam', 'low_quality', 'duplicate']
  },
  contentTrends: [
    {
      date: '2025-09-10',
      totalContent: 25,
      approvedContent: 18,
      postedContent: 12,
      approvalRate: 0.72,
      avgConfidence: 0.75
    },
    {
      date: '2025-09-11',
      totalContent: 30,
      approvedContent: 22,
      postedContent: 16,
      approvalRate: 0.73,
      avgConfidence: 0.78
    }
  ],
  platformTrends: {
    reddit: [
      { date: '2025-09-10', posts: 8, approved: 6 },
      { date: '2025-09-11', posts: 10, approved: 7 }
    ],
    youtube: [
      { date: '2025-09-10', posts: 6, approved: 5 },
      { date: '2025-09-11', posts: 8, approved: 6 }
    ]
  },
  queueHealth: {
    queueSize: 30,
    lastScanTime: '2025-09-12T10:00:00Z',
    lastPostTime: '2025-09-12T08:00:00Z',
    errorRate: 0.05,
    isHealthy: true
  }
}

// Dashboard metrics for component tests (matching AdminDashboard interface)
export const mockDashboardStats = {
  totalContent: 150,
  pendingContent: 25,
  postedToday: 6,
  totalViews: 50000,
  avgEngagement: 3.5,
  systemStatus: 'online' as const,
  lastPostTime: new Date('2025-09-12T08:00:00Z'),
  nextPostTime: new Date('2025-09-12T14:00:00Z'),
  platformStats: {
    reddit: { enabled: true, contentFound: 45, lastScan: '2025-09-12T10:00:00Z' },
    youtube: { enabled: true, contentFound: 38, lastScan: '2025-09-12T09:30:00Z' },
    flickr: { enabled: false, contentFound: 0 },
    unsplash: { enabled: true, contentFound: 12, lastScan: '2025-09-12T08:00:00Z' }
  },
  contentPipeline: {
    queuedForReview: 15,
    autoApproved: 90,
    flaggedForManualReview: 8,
    rejected: 12
  }
}

// Dashboard activity for component tests
export const mockDashboardActivity = [
  {
    id: '1',
    type: 'posted',
    description: 'Posted: Amazing hotdog content',
    timestamp: new Date('2025-09-12T08:00:00Z')
  },
  {
    id: '2',
    type: 'added',
    description: 'Added to queue: New hotdog discovery',
    timestamp: new Date('2025-09-12T07:00:00Z')
  }
]

// Performance stats for metrics service
export const mockPerformanceStats = {
  avgAPIResponseTime: 180,
  avgDatabaseQueryTime: 25,
  avgContentProcessingTime: 1200,
  successRate: 85,
  requestsPerMinute: 20
}

// Metrics summary for service tests
export const mockMetricsSummary = {
  totalMetrics: 1000,
  recentAPIResponseTimes: {
    reddit: 200,
    youtube: 150,
    bluesky: 100,
    imgur: 180,
    giphy: 90,
    tumblr: 200,
    lemmy: 220,
    pixabay: 120
  },
  systemResources: {
    memoryUsagePercent: 50,
    cpuUsagePercent: 45,
    diskUsagePercent: 30
  },
  businessKPIs: {
    contentProcessedLast24h: 500,
    postsCreatedLast24h: 30,
    errorRateLast1h: 2.5,
    queueSize: 25
  },
  topSlowOperations: [
    {
      operation: 'image_processing',
      avgResponseTime: 2500,
      count: 10
    }
  ]
}

// Individual metric record for service tests
export const mockMetricRecord = {
  id: '1',
  name: 'api_response_time',
  value: 150.5,
  unit: 'ms',
  timestamp: new Date(),
  tags: { platform: 'reddit', status: 'success' },
  metadata: { statusCode: 200 },
  environment: 'test'
}

// Query result structure for service tests
export const mockQueryResult = {
  metrics: [mockMetricRecord],
  total: 100,
  hasMore: true
}

// Mock service functions
export function mockMetricsService() {
  return {
    // Core recording methods
    recordAPIMetric: jest.fn().mockResolvedValue(undefined),
    recordDatabaseQueryMetric: jest.fn().mockResolvedValue(undefined),
    recordContentProcessingMetric: jest.fn().mockResolvedValue(undefined),
    recordSystemMetrics: jest.fn().mockResolvedValue(undefined),
    recordBusinessMetric: jest.fn().mockResolvedValue(undefined),
    recordCustomMetric: jest.fn().mockResolvedValue(undefined),

    // Query methods
    queryMetrics: jest.fn().mockResolvedValue(mockQueryResult),
    getMetricsSummary: jest.fn().mockResolvedValue(mockMetricsSummary),
    getPerformanceStats: jest.fn().mockResolvedValue(mockPerformanceStats),

    // Analytics methods (consolidated API)
    getTotals: jest.fn().mockResolvedValue(mockMetricsResult),
    getByPlatform: jest.fn().mockResolvedValue(mockMetricsResult.byPlatform),
    getByDay: jest.fn().mockResolvedValue(mockMetricsResult.byDay),
    getDashboardMetrics: jest.fn().mockResolvedValue({
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
    }),
    getPlatformPerformance: jest.fn().mockResolvedValue([
      { date: '2025-09-10', posts: 8, approved: 6 },
      { date: '2025-09-11', posts: 10, approved: 7 }
    ]),
    getContentTrends: jest.fn().mockResolvedValue(mockAnalyticsResult.contentTrends),

    // Management methods
    cleanupOldMetrics: jest.fn().mockResolvedValue(50),
    exportMetrics: jest.fn().mockResolvedValue(JSON.stringify([mockMetricRecord])),
    shutdown: jest.fn().mockResolvedValue(undefined),

    // Buffer access for tests
    metricBuffer: []
  }
}

// Mock database query builder for service tests
export function mockQueryBuilder() {
  return {
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
    execute: jest.fn().mockResolvedValue([mockMetricRecord]),
    clone: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(50)
  }
}

// Mock insert query builder
export function mockInsertBuilder() {
  return {
    values: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined)
  }
}

// Global mock setup function for service tests
export function setupMetricsServiceMocks() {
  // Mock db-query-builder
  jest.mock('@/lib/db-query-builder', () => ({
    query: jest.fn(() => mockQueryBuilder()),
    insert: jest.fn(() => mockInsertBuilder())
  }))

  // Mock database
  jest.mock('@/lib/db', () => ({
    db: {
      query: jest.fn().mockResolvedValue({ rows: [] })
    }
  }))

  // Mock logging service
  jest.mock('@/lib/services/logging', () => ({
    loggingService: {
      logError: jest.fn(),
      logInfo: jest.fn(),
      logWarning: jest.fn()
    }
  }))
}

// Mock fetch for component tests
export function mockFetchForDashboard() {
  const mockFetch = jest.fn()
  global.fetch = mockFetch

  return {
    mockStatsResponse: () => mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardStats
    }),
    mockActivityResponse: () => mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardActivity
    }),
    mockAnalyticsResponse: () => mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnalyticsResult
    }),
    mockErrorResponse: () => mockFetch.mockRejectedValue(new Error('API Error')),
    mockFetch
  }
}

// Mock AuthContext for component tests
export function mockAuthContext() {
  return {
    useAuth: () => ({
      user: { id: '1', username: 'admin', email: 'admin@test.com' },
      isLoading: false
    })
  }
}