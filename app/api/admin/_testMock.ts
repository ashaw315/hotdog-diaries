/**
 * Test Mock Data for Admin APIs
 * 
 * Provides consistent, deterministic mock data for CI/test environments to eliminate
 * external API dependencies and ensure stable E2E test execution. This file is only
 * active when NODE_ENV=test, CI=true, or GITHUB_ACTIONS=true.
 */

// Mock metrics data
export const mockMetrics = {
  totalContent: 156,
  approvedContent: 89,
  readyToPost: 23,
  postedToday: 6,
  platformStats: {
    reddit: { total: 45, approved: 32, posted: 15 },
    youtube: { total: 28, approved: 19, posted: 8 },
    giphy: { total: 22, approved: 15, posted: 6 },
    pixabay: { total: 31, approved: 12, posted: 4 },
    imgur: { total: 18, approved: 8, posted: 3 },
    bluesky: { total: 8, approved: 3, posted: 1 },
    tumblr: { total: 4, approved: 0, posted: 0 }
  },
  daysOfContent: 3.8,
  avgConfidenceScore: 0.72,
  lastUpdated: new Date().toISOString()
}

// Mock content queue data
export const mockContentQueue = [
  {
    id: 1,
    content_text: "Chicago-style hotdog with all the fixings - test content",
    content_type: "image",
    source_platform: "reddit",
    original_url: "https://reddit.com/r/hotdogs/test1",
    original_author: "TestUser1",
    content_image_url: "https://i.imgur.com/test1.jpg",
    content_video_url: null,
    scraped_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    is_approved: true,
    is_posted: false,
    confidence_score: 0.85,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: 2,
    content_text: "Epic hotdog eating contest compilation",
    content_type: "video",
    source_platform: "youtube",
    original_url: "https://youtube.com/watch?v=test123",
    original_author: "TestChannel",
    content_image_url: null,
    content_video_url: "https://youtube.com/watch?v=test123",
    scraped_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    is_approved: true,
    is_posted: false,
    confidence_score: 0.92,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 3,
    content_text: "Funny hotdog dancing GIF",
    content_type: "gif",
    source_platform: "giphy",
    original_url: "https://giphy.com/gifs/test-hotdog",
    original_author: "GiphyUser",
    content_image_url: "https://media.giphy.com/media/test/giphy.gif",
    content_video_url: null,
    scraped_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    is_approved: false,
    is_posted: false,
    confidence_score: 0.65,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 4,
    content_text: "Beautiful hotdog photography from Pixabay",
    content_type: "image",
    source_platform: "pixabay",
    original_url: "https://pixabay.com/photos/test-hotdog-456789",
    original_author: "PixabayUser",
    content_image_url: "https://cdn.pixabay.com/photo/test-hotdog.jpg",
    content_video_url: null,
    scraped_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    is_approved: true,
    is_posted: false,
    confidence_score: 0.81,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 5,
    content_text: "Gourmet hotdog from upscale restaurant",
    content_type: "image",
    source_platform: "imgur",
    original_url: "https://imgur.com/test-gourmet",
    original_author: "ImgurUser",
    content_image_url: "https://i.imgur.com/test-gourmet.jpg",
    content_video_url: null,
    scraped_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    is_approved: false,
    is_posted: false,
    confidence_score: 0.58,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  }
]

// Mock diagnostics data
export const mockDiagnostics = {
  systemHealth: {
    database: { status: "healthy", latency: "12ms", connection: "active" },
    apis: {
      reddit: { status: "healthy", lastCheck: new Date().toISOString(), quotaUsage: "45%" },
      youtube: { status: "healthy", lastCheck: new Date().toISOString(), quotaUsage: "23%" },
      giphy: { status: "healthy", lastCheck: new Date().toISOString(), quotaUsage: "12%" },
      pixabay: { status: "healthy", lastCheck: new Date().toISOString(), quotaUsage: "8%" },
      imgur: { status: "healthy", lastCheck: new Date().toISOString(), quotaUsage: "15%" },
      bluesky: { status: "healthy", lastCheck: new Date().toISOString(), quotaUsage: "5%" },
      tumblr: { status: "warning", lastCheck: new Date().toISOString(), quotaUsage: "0%" }
    }
  },
  lastScanResults: {
    reddit: { timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), found: 8, approved: 5 },
    youtube: { timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), found: 3, approved: 2 },
    giphy: { timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), found: 12, approved: 7 }
  },
  errorLogs: [
    {
      level: "warning",
      message: "Tumblr API rate limit approaching",
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      service: "tumblr"
    },
    {
      level: "info", 
      message: "Reddit scan completed successfully",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      service: "reddit"
    },
    {
      level: "error",
      message: "Pixabay API temporary timeout (resolved)",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      service: "pixabay"
    }
  ]
}

// Mock dashboard data
export const mockDashboard = {
  stats: mockMetrics,
  recentContent: mockContentQueue.slice(0, 3),
  recentPosts: [
    {
      id: 101,
      content_text: "Posted test hotdog content #1",
      source_platform: "reddit",
      posted_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 102,
      content_text: "Posted test hotdog content #2", 
      source_platform: "youtube",
      posted_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 103,
      content_text: "Posted test hotdog content #3",
      source_platform: "giphy", 
      posted_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    }
  ],
  systemStatus: {
    overallHealth: "healthy",
    autoScanning: true,
    autoPosting: true,
    nextPostTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // In 2 hours
    contentBuffer: "3.8 days",
    lastScanTime: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  }
}

// Helper function to get mock data by type
export function mockAdminDataIfCI(type: 'metrics' | 'queue' | 'diagnostics' | 'dashboard') {
  // Only return mock data in CI/test environments
  const isCIOrTest = process.env.CI === 'true' || process.env.NODE_ENV === 'test' || process.env.GITHUB_ACTIONS === 'true'
  
  if (!isCIOrTest) {
    return null // Let real data flow through in non-test environments
  }
  
  switch (type) {
    case 'metrics':
      return mockMetrics
    case 'queue':
      return mockContentQueue
    case 'diagnostics':
      return mockDiagnostics
    case 'dashboard':
      return mockDashboard
    default:
      return null
  }
}

