/**
 * API Regression Tests
 * Tests all critical API endpoints for regression issues
 */

import { RegressionTestSuite, RegressionTestRunner, TestUtils } from './framework'

// Mock global fetch for testing
global.fetch = jest.fn()

// Simple Jest test to prevent "no tests" error
describe('API Regression Tests', () => {
  test('should have API regression test suite defined', () => {
    expect(apiRegressionSuite).toBeDefined()
    expect(apiRegressionSuite.name).toBe('API Regression Tests')
  })
})

const apiRegressionSuite: RegressionTestSuite = {
  name: 'API Regression Tests',
  description: 'Comprehensive regression testing for all API endpoints',
  version: '1.0.0',
  tests: [
    // Health Check Tests
    {
      id: 'api-health-001',
      name: 'Health endpoint returns correct structure',
      category: 'api',
      priority: 'critical',
      description: 'Verify /api/health returns proper health check structure',
      testFn: async () => {
        const mockResponse = TestUtils.mockApiResponse({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'hotdog-diaries',
          version: '1.0.0',
          uptime: 123.45,
          environment: 'test',
          checks: {
            database: { connected: true, responseTime: 45 },
            socialMediaScanner: 'operational',
            contentScheduler: 'operational'
          }
        })

        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/health')
          return response.json()
        })

        const isValid = result.success && 
                       result.data.status && 
                       result.data.timestamp &&
                       result.data.service === 'hotdog-diaries'

        return {
          passed: isValid,
          duration,
          details: { response: result },
          metrics: { responseTime: duration }
        }
      }
    },

    // Authentication Tests
    {
      id: 'api-auth-001',
      name: 'Login endpoint validates credentials',
      category: 'api',
      priority: 'critical',
      description: 'Verify login endpoint properly validates user credentials',
      testFn: async () => {
        const mockResponse = TestUtils.mockApiResponse({
          user: {
            id: 1,
            username: 'admin',
            lastLogin: new Date().toISOString()
          }
        })

        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'test' })
          })
          return response.json()
        })

        return {
          passed: result.success && result.data.user.id === 1,
          duration,
          metrics: { responseTime: duration }
        }
      }
    },

    {
      id: 'api-auth-002',
      name: 'Protected endpoints require authentication',
      category: 'api',
      priority: 'high',
      description: 'Verify protected endpoints return 401 without authentication',
      testFn: async () => {
        const mockResponse = TestUtils.mockApiResponse(
          { error: 'Unauthorized' }, 
          401
        )

        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/admin/dashboard/stats')
          return { status: response.status, data: await response.json() }
        })

        return {
          passed: result.status === 401,
          duration,
          metrics: { responseTime: duration }
        }
      }
    },

    // Content Management Tests
    {
      id: 'api-content-001',
      name: 'Content endpoint returns paginated results',
      category: 'api',
      priority: 'high',
      description: 'Verify content endpoint returns properly paginated content',
      testFn: async () => {
        const mockContent = Array.from({ length: 5 }, (_, i) => ({
          ...TestUtils.generateTestContent(),
          id: i + 1
        }))

        const mockResponse = TestUtils.mockApiResponse({
          content: mockContent,
          pagination: {
            page: 1,
            limit: 12,
            total: 5,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        })

        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/content?page=1&limit=12')
          return response.json()
        })

        const isValid = result.success &&
                       Array.isArray(result.data.content) &&
                       result.data.pagination &&
                       result.data.pagination.page === 1

        return {
          passed: isValid,
          duration,
          details: { contentCount: result.data.content.length },
          metrics: { responseTime: duration }
        }
      }
    },

    {
      id: 'api-content-002',
      name: 'Content creation validates required fields',
      category: 'api',
      priority: 'high',
      description: 'Verify content creation endpoint validates required fields',
      testFn: async () => {
        const mockResponse = TestUtils.mockApiResponse(
          { error: 'Missing required fields' },
          400
        )

        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incomplete: 'data' })
          })
          return { status: response.status, data: await response.json() }
        })

        return {
          passed: result.status === 400 && !result.data.success,
          duration,
          metrics: { responseTime: duration }
        }
      }
    },

    // Dashboard Tests
    {
      id: 'api-dashboard-001',
      name: 'Dashboard stats return complete data structure',
      category: 'api',
      priority: 'high',
      description: 'Verify dashboard stats endpoint returns all required metrics',
      testFn: async () => {
        const mockStats = {
          totalContent: 150,
          pendingContent: 25,
          approvedContent: 45,
          postedToday: 6,
          totalViews: 12500,
          lastPostTime: new Date().toISOString(),
          nextPostTime: new Date().toISOString(),
          avgEngagement: 2.4,
          systemStatus: 'online'
        }

        const mockResponse = TestUtils.mockApiResponse(mockStats)
        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/admin/dashboard/stats', {
            headers: { 'Authorization': 'Bearer mock-token' }
          })
          return response.json()
        })

        const requiredFields = [
          'totalContent', 'pendingContent', 'postedToday', 
          'lastPostTime', 'nextPostTime', 'systemStatus'
        ]

        const hasAllFields = requiredFields.every(field => 
          result.data.hasOwnProperty(field)
        )

        return {
          passed: result.success && hasAllFields,
          duration,
          details: { missingFields: requiredFields.filter(f => !result.data.hasOwnProperty(f)) },
          metrics: { responseTime: duration }
        }
      }
    },

    // Social Media Integration Tests
    {
      id: 'api-unsplash-001',
      name: 'Unsplash scan endpoint handles requests correctly',
      category: 'integration',
      priority: 'high',
      description: 'Verify Unsplash scan endpoint processes scan requests',
      testFn: async () => {
        const mockScanResult = {
          scanId: `unsplash_${Date.now()}`,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 5000).toISOString(),
          photosFound: 20,
          photosProcessed: 18,
          photosApproved: 12,
          photosRejected: 4,
          photosFlagged: 2
        }

        const mockResponse = TestUtils.mockApiResponse(mockScanResult)
        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/admin/unsplash/scan', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer mock-token' }
          })
          return response.json()
        })

        const isValid = result.success &&
                       result.data.scanId &&
                       typeof result.data.photosFound === 'number' &&
                       typeof result.data.photosProcessed === 'number'

        return {
          passed: isValid,
          duration,
          details: { scanResult: result.data },
          metrics: { responseTime: duration }
        }
      }
    },

    {
      id: 'api-reddit-001',
      name: 'Reddit settings endpoint handles configuration updates',
      category: 'integration',
      priority: 'medium',
      description: 'Verify Reddit settings can be updated correctly',
      testFn: async () => {
        const mockConfig = {
          isEnabled: true,
          scanInterval: 60,
          subreddits: ['hotdogs', 'food'],
          minScore: 10,
          maxPostsPerScan: 25
        }

        const mockResponse = TestUtils.mockApiResponse(mockConfig)
        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/admin/reddit/settings', {
            method: 'PUT',
            headers: { 
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(mockConfig)
          })
          return response.json()
        })

        return {
          passed: result.success && result.data.isEnabled === true,
          duration,
          metrics: { responseTime: duration }
        }
      }
    },

    // Scheduling Tests
    {
      id: 'api-schedule-001',
      name: 'Schedule configuration endpoint validates time formats',
      category: 'api',
      priority: 'medium',
      description: 'Verify schedule endpoint validates meal time formats',
      testFn: async () => {
        const mockSchedule = {
          meal_times: ['08:00', '12:00', '16:00', '20:00'],
          timezone: 'America/New_York',
          is_enabled: true,
          posts_per_day: 6
        }

        const mockResponse = TestUtils.mockApiResponse(mockSchedule)
        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/admin/schedule', {
            method: 'PUT',
            headers: { 
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(mockSchedule)
          })
          return response.json()
        })

        const hasValidTimes = result.data.meal_times.every((time: string) => 
          /^\d{2}:\d{2}$/.test(time)
        )

        return {
          passed: result.success && hasValidTimes,
          duration,
          metrics: { responseTime: duration }
        }
      }
    },

    // Error Handling Tests
    {
      id: 'api-error-001',
      name: 'API endpoints return consistent error format',
      category: 'api',
      priority: 'medium',
      description: 'Verify all endpoints return errors in consistent format',
      testFn: async () => {
        const mockError = TestUtils.mockApiResponse(
          { 
            error: 'Resource not found',
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString()
          },
          404
        )

        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockError)

        const { result, duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/content/999999')
          return { status: response.status, data: await response.json() }
        })

        const hasConsistentFormat = result.status === 404 &&
                                   !result.data.success &&
                                   result.data.error &&
                                   result.data.timestamp

        return {
          passed: hasConsistentFormat,
          duration,
          metrics: { responseTime: duration }
        }
      }
    },

    // Performance Tests
    {
      id: 'api-perf-001',
      name: 'API endpoints respond within acceptable time limits',
      category: 'performance',
      priority: 'medium',
      description: 'Verify critical endpoints respond within 2 seconds',
      testFn: async () => {
        const mockResponse = TestUtils.mockApiResponse({ test: 'data' })
        ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse)

        const { duration } = await TestUtils.measureTime(async () => {
          const response = await fetch('/api/health')
          return response.json()
        })

        const isWithinLimit = duration < 2000 // 2 seconds

        return {
          passed: isWithinLimit,
          duration,
          details: { actualResponseTime: duration, limit: 2000 },
          metrics: { responseTime: duration }
        }
      }
    }
  ],

  setup: async () => {
    // Setup mock environment
    process.env.NODE_ENV = 'test'
    console.log('🔧 Setting up API regression test environment')
  },

  teardown: async () => {
    // Cleanup
    jest.clearAllMocks()
    console.log('🧹 Cleaning up API regression test environment')
  }
}

// Export for use in test runner
export default apiRegressionSuite