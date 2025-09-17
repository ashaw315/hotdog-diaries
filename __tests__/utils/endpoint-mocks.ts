/**
 * Standardized endpoint response mocks for consolidated API
 * Ensures consistent test data across all test suites
 */

export const mockContentResponse = {
  id: 1,
  content_text: 'Test hotdog content',
  content_type: 'text',
  source_platform: 'reddit',
  original_url: 'https://reddit.com/test',
  original_author: 'testuser',
  content_image_url: 'https://example.com/image.jpg',
  content_video_url: null,
  scraped_at: '2024-01-01T10:00:00Z',
  is_posted: false,
  is_approved: true,
  posted_at: null,
  admin_notes: null,
  youtube_data: null,
  flickr_data: null,
  unsplash_data: null,
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:00:00Z'
}

export const mockBulkResponse = {
  success: true,
  message: 'Bulk operation completed successfully',
  affectedRows: 5
}

export const mockPlatformStatus = {
  platform: 'reddit',
  healthy: true,
  lastChecked: '2024-01-01T10:00:00Z',
  status: 'active',
  errorCount: 0,
  successRate: 0.95
}

export const mockDashboardStats = {
  totalContent: 150,
  pendingContent: 25,
  postedToday: 6,
  totalViews: 50000,
  lastPost: '2024-01-01T10:00:00Z',
  avgEngagement: 3.5,
  systemStatus: 'online'
}

export const mockContentList = {
  content: [mockContentResponse],
  pagination: {
    page: 1,
    limit: 50,
    total: 1,
    totalPages: 1,
    hasMore: false
  },
  filter: 'all'
}

export const mockAuthResponse = {
  user: { id: 1, username: 'admin' },
  tokens: {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token'
  }
}

export const mockAnalyticsData = {
  views: [
    { date: '2024-01-01', count: 1000 },
    { date: '2024-01-02', count: 1200 }
  ],
  engagement: {
    likes: 500,
    shares: 100,
    comments: 250
  },
  topContent: [mockContentResponse],
  platformBreakdown: {
    reddit: 40,
    youtube: 30,
    twitter: 20,
    other: 10
  }
}

// Helper to create mock database responses
export const mockDbResponses = {
  singleRow: (data: any) => ({ rows: [data], rowCount: 1 }),
  multipleRows: (data: any[]) => ({ rows: data, rowCount: data.length }),
  emptyResult: () => ({ rows: [], rowCount: 0 }),
  insertResult: (id: number) => ({ 
    rows: [{ id, ...mockContentResponse }], 
    rowCount: 1 
  }),
  updateResult: (affectedRows: number = 1) => ({ 
    rows: [], 
    rowCount: affectedRows 
  })
}

// Valid UUIDs for testing (bulk operations require UUID format)
export const mockUUIDs = [
  '123e4567-e89b-12d3-a456-426614174000',
  '123e4567-e89b-12d3-a456-426614174001', 
  '123e4567-e89b-12d3-a456-426614174002',
  '123e4567-e89b-12d3-a456-426614174003',
  '123e4567-e89b-12d3-a456-426614174004'
]

// Helper to create realistic error responses
export const mockErrorResponses = {
  unauthorized: { error: 'Authentication required', status: 401 },
  forbidden: { error: 'Insufficient permissions', status: 403 },
  notFound: { error: 'Resource not found', status: 404 },
  validationError: { error: 'Invalid request data', status: 400 },
  serverError: { error: 'Internal server error', status: 500 }
}