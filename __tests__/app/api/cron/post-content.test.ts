import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/cron/post-content/route'

// Mock the services
jest.mock('@/lib/services/posting', () => ({
  postingService: {
    processScheduledPost: jest.fn(),
  },
}))

jest.mock('@/lib/services/scheduling', () => ({
  schedulingService: {
    getPostingSchedule: jest.fn(),
  },
}))

jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn(),
}))

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    CRON_SECRET: 'test-secret'
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('/api/cron/post-content', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    const { postingService } = require('@/lib/services/posting')

    it('should process scheduled post with valid authorization', async () => {
      const mockResult = {
        success: true,
        contentId: 123,
        postOrder: 1
      }

      postingService.processScheduledPost.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.contentId).toBe(123)
      expect(data.postOrder).toBe(1)
    })

    it('should reject request with invalid authorization', async () => {
      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid-secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should reject request with missing authorization', async () => {
      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle posting failure gracefully', async () => {
      const mockResult = {
        success: false,
        error: 'No content available'
      }

      postingService.processScheduledPost.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.message).toBe('No content available')
    })

    it('should handle service errors', async () => {
      postingService.processScheduledPost.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Service error')
    })

    it('should handle manual trigger flag', async () => {
      const mockResult = {
        success: true,
        contentId: 456,
        postOrder: 2
      }

      postingService.processScheduledPost.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ manual: true })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(postingService.processScheduledPost).toHaveBeenCalledWith()
    })

    it('should handle invalid JSON body', async () => {
      const mockResult = {
        success: true,
        contentId: 123,
        postOrder: 1
      }

      postingService.processScheduledPost.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret',
          'content-type': 'application/json'
        },
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('GET', () => {
    const { schedulingService } = require('@/lib/services/scheduling')
    const { postingService } = require('@/lib/services/posting')

    it('should return schedule and queue status with valid authorization', async () => {
      const mockSchedule = {
        nextPostTime: new Date(),
        nextMealTime: '12:00',
        timeUntilNext: 3600000,
        isPostingTime: false,
        todaysSchedule: []
      }

      const mockQueueStatus = {
        totalApproved: 10,
        totalPending: 5,
        totalPosted: 20,
        isHealthy: true,
        alertLevel: 'none',
        message: 'Queue is healthy'
      }

      schedulingService.getPostingSchedule.mockResolvedValue(mockSchedule)
      postingService.getQueueStatus.mockResolvedValue(mockQueueStatus)

      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-secret'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.schedule).toEqual(mockSchedule)
      expect(data.queueStatus).toEqual(mockQueueStatus)
      expect(data.timestamp).toBeDefined()
    })

    it('should reject GET request with invalid authorization', async () => {
      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer invalid-secret'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle service errors in GET request', async () => {
      schedulingService.getPostingSchedule.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-secret'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Service error')
    })
  })

  describe('Environment variable handling', () => {
    it('should reject requests when CRON_SECRET is not set', async () => {
      const originalSecret = process.env.CRON_SECRET
      delete process.env.CRON_SECRET

      const request = new NextRequest('http://localhost/api/cron/post-content', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')

      process.env.CRON_SECRET = originalSecret
    })
  })
})