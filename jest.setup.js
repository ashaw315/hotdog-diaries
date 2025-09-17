// Import our centralized test setup
import './__tests__/utils/setup'

// Mock NextJS modules that cause issues in Jest
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url, options = {}) => ({
    method: options.method || 'GET',
    url,
    headers: new Map(Object.entries(options.headers || {})),
    json: async () => options.body ? JSON.parse(options.body) : {}
  })),
  NextResponse: {
    json: jest.fn((data, options = {}) => ({
      json: async () => data,
      status: options.status || 200
    }))
  }
}))

// Mock Web APIs for Next.js route handlers
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

global.Request = class MockRequest {
  constructor(url, options = {}) {
    Object.defineProperty(this, 'url', { value: url, writable: false })
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this.body = options.body
  }

  async json() {
    return this.body ? JSON.parse(this.body) : {}
  }
}

global.Response = class MockResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.headers = new Map(Object.entries(options.headers || {}))
    this.ok = this.status >= 200 && this.status < 300
  }

  static json(data, options = {}) {
    return new MockResponse(JSON.stringify(data), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    })
  }

  async json() {
    return this.body ? JSON.parse(this.body) : {}
  }
}

// Mock fetch API for components
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: [] })
  })
)

// Mock database query builder with proper chainable methods
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  whereNotIn: jest.fn().mockReturnThis(),
  whereBetween: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  whereNotNull: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  having: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  rightJoin: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
  then: jest.fn().mockResolvedValue([]),
  catch: jest.fn().mockReturnThis()
}

// Mock the database query function to return the chainable builder
jest.mock('@/lib/db-query-builder', () => ({
  query: jest.fn(() => mockQueryBuilder)
}))

// Mock database connection
const mockDbClient = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  release: jest.fn()
}

jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
    getClient: jest.fn().mockResolvedValue(mockDbClient)
  },
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

// Mock MetricsService to prevent database initialization during module loading
jest.mock('@/lib/services/metrics', () => ({
  metricsService: {
    trackPerformance: jest.fn().mockResolvedValue(undefined),
    trackAPIMetric: jest.fn().mockResolvedValue(undefined),
    trackContentMetric: jest.fn().mockResolvedValue(undefined),
    trackScanMetric: jest.fn().mockResolvedValue(undefined),
    trackUserActivity: jest.fn().mockResolvedValue(undefined),
    recordMetric: jest.fn().mockResolvedValue(undefined),
    getMetrics: jest.fn().mockResolvedValue([]),
    flushBuffer: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined)
  },
  MetricsService: jest.fn().mockImplementation(() => ({
    trackPerformance: jest.fn().mockResolvedValue(undefined),
    trackAPIMetric: jest.fn().mockResolvedValue(undefined),
    trackContentMetric: jest.fn().mockResolvedValue(undefined),
    trackScanMetric: jest.fn().mockResolvedValue(undefined),
    trackUserActivity: jest.fn().mockResolvedValue(undefined),
    recordMetric: jest.fn().mockResolvedValue(undefined),
    getMetrics: jest.fn().mockResolvedValue([]),
    flushBuffer: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined)
  }))
}))

// Mock logging service 
jest.mock('@/lib/services/logging', () => ({
  loggingService: {
    log: jest.fn().mockResolvedValue(undefined),
    info: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined)
  }
}))

// Mock content hash utilities
jest.mock('@/lib/utils/content-hash', () => ({
  generateContentHash: jest.fn().mockReturnValue('mock-hash'),
  checkContentSimilarity: jest.fn().mockReturnValue(false),
  ContentHasher: {
    generateHash: jest.fn().mockReturnValue('mock-hash'),
    generateUrlHash: jest.fn().mockReturnValue('mock-url-hash'),
    areSimilar: jest.fn().mockReturnValue(false),
    generateMultipleHashes: jest.fn().mockReturnValue({
      contentHash: 'mock-content-hash',
      urlHash: 'mock-url-hash',
      textHash: 'mock-text-hash',
      mediaHash: 'mock-media-hash'
    })
  }
}))

// Mock auth services and middleware
jest.mock('@/lib/services/auth', () => ({
  AuthService: {
    authenticate: jest.fn().mockResolvedValue({ success: true, token: 'mock-token' }),
    validateToken: jest.fn().mockResolvedValue({ valid: true, user: { id: 1, username: 'admin' } }),
    refreshToken: jest.fn().mockResolvedValue({ success: true, token: 'new-mock-token' }),
    logout: jest.fn().mockResolvedValue({ success: true })
  }
}))

// Mock API middleware
jest.mock('@/lib/api-middleware', () => ({
  verifyAdminAuth: jest.fn().mockResolvedValue({
    success: true,
    user: { id: 1, username: 'admin' }
  }),
  createSuccessResponse: jest.fn((data, message) => 
    Response.json({ success: true, data, message })
  ),
  createApiError: jest.fn((message, status, code) => {
    const error = new Error(message)
    error.statusCode = status
    error.code = code
    return error
  }),
  handleApiError: jest.fn((error, request, endpoint) => {
    const status = error.statusCode || 500
    const message = error.message || 'Internal server error'
    return Response.json({ error: message }, { status })
  }),
  validateRequestMethod: jest.fn(),
  withErrorHandling: jest.fn((handler, endpoint) => {
    return async (request) => {
      try {
        return await handler(request)
      } catch (error) {
        const status = error.statusCode || 500
        const message = error.message || 'Internal server error'
        return Response.json({ error: message }, { status })
      }
    }
  }),
  validateJsonBody: jest.fn((schema) => (data) => data)
}))

// Mock legacy auth utils for routes that haven't been updated yet
jest.mock('@/lib/auth', () => ({
  NextAuthUtils: {
    verifyRequestAuth: jest.fn().mockResolvedValue({
      isValid: true,
      user: { id: 1, username: 'admin' }
    }),
    getAuthTokenFromRequest: jest.fn().mockReturnValue('mock-token'),
    generateJWT: jest.fn().mockReturnValue('mock-jwt-token'),
    verifyJWT: jest.fn().mockReturnValue({ userId: 1, username: 'admin' })
  }
}))

// Mock scheduling service
jest.mock('@/lib/services/scheduling', () => ({
  schedulingService: {
    getScheduleConfig: jest.fn().mockResolvedValue({ is_enabled: true }),
    isPostingTime: jest.fn().mockResolvedValue(true),
    selectRandomContent: jest.fn().mockResolvedValue({ id: 1, content_text: 'test' }),
    pauseScheduling: jest.fn().mockResolvedValue(undefined),
    updateSchedule: jest.fn().mockResolvedValue(undefined)
  }
}))

// Mock social media service
jest.mock('@/lib/services/social-media', () => ({
  socialMediaService: {
    getPlatformStatuses: jest.fn().mockResolvedValue([]),
    getUnifiedStats: jest.fn().mockResolvedValue({
      totalScans: 0, totalPostsFound: 0, totalPostsApproved: 0,
      platformBreakdown: [], contentDistribution: { posts: 0, images: 0, videos: 0 },
      averageSuccessRate: 0
    }),
    performCoordinatedScan: jest.fn().mockResolvedValue({ scanId: 'test', success: true }),
    getPerformanceMetrics: jest.fn().mockResolvedValue([])
  }
}))

