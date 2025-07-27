import { NextRequest } from 'next/server'
import { GET, PUT } from '@/app/api/admin/schedule/route'

// Mock the services
jest.mock('@/lib/services/scheduling', () => ({
  schedulingService: {
    getScheduleConfig: jest.fn(),
    getPostingSchedule: jest.fn(),
    updateScheduleConfig: jest.fn(),
  },
}))

jest.mock('@/lib/services/posting', () => ({
  postingService: {
    getQueueStatus: jest.fn(),
    getPostingStats: jest.fn(),
  },
}))

jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn(),
}))

describe('/api/admin/schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    const { schedulingService } = require('@/lib/services/scheduling')
    const { postingService } = require('@/lib/services/posting')

    it('should return complete schedule information', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

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

      const mockStats = {
        todaysPosts: 3,
        thisWeeksPosts: 21,
        thisMonthsPosts: 90,
        totalPosts: 500,
        avgPostsPerDay: 3.0
      }

      schedulingService.getScheduleConfig.mockResolvedValue(mockConfig)
      schedulingService.getPostingSchedule.mockResolvedValue(mockSchedule)
      postingService.getQueueStatus.mockResolvedValue(mockQueueStatus)
      postingService.getPostingStats.mockResolvedValue(mockStats)

      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.config).toEqual(mockConfig)
      expect(data.schedule).toEqual(mockSchedule)
      expect(data.queueStatus).toEqual(mockQueueStatus)
      expect(data.stats).toEqual(mockStats)
    })

    it('should handle service errors', async () => {
      schedulingService.getScheduleConfig.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Service error')
    })
  })

  describe('PUT', () => {
    const { schedulingService } = require('@/lib/services/scheduling')

    it('should update schedule configuration successfully', async () => {
      const updatedConfig = {
        id: 1,
        meal_times: ['09:00', '13:00', '19:00'],
        timezone: 'America/Los_Angeles',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      schedulingService.updateScheduleConfig.mockResolvedValue(updatedConfig)

      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          meal_times: ['09:00', '13:00', '19:00'],
          timezone: 'America/Los_Angeles',
          is_enabled: true
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.config).toEqual(updatedConfig)
      expect(schedulingService.updateScheduleConfig).toHaveBeenCalledWith({
        meal_times: ['09:00', '13:00', '19:00'],
        timezone: 'America/Los_Angeles',
        is_enabled: true
      })
    })

    it('should validate meal_times format', async () => {
      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          meal_times: ['25:00', '12:00'] // Invalid time format
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid time format')
    })

    it('should validate meal_times is array', async () => {
      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          meal_times: 'not-an-array'
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('meal_times must be an array')
    })

    it('should accept valid time formats', async () => {
      const validTimes = ['08:00', '12:30', '18:45', '23:59']
      const updatedConfig = {
        id: 1,
        meal_times: validTimes,
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      schedulingService.updateScheduleConfig.mockResolvedValue(updatedConfig)

      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          meal_times: validTimes
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle partial updates', async () => {
      const updatedConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: false,
        created_at: new Date(),
        updated_at: new Date()
      }

      schedulingService.updateScheduleConfig.mockResolvedValue(updatedConfig)

      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          is_enabled: false
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(schedulingService.updateScheduleConfig).toHaveBeenCalledWith({
        is_enabled: false
      })
    })

    it('should handle service errors', async () => {
      schedulingService.updateScheduleConfig.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          is_enabled: false
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Service error')
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: 'invalid json'
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should reject invalid time formats', async () => {
      const invalidTimes = [
        '24:00',  // Hour too high
        '12:60',  // Minute too high
        '1:30',   // Missing leading zero
        '12:5',   // Missing leading zero
        '12',     // Missing minutes
        '12:30:45' // Seconds not allowed
      ]

      for (const invalidTime of invalidTimes) {
        const request = new NextRequest('http://localhost/api/admin/schedule', {
          method: 'PUT',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            meal_times: [invalidTime]
          })
        })

        const response = await PUT(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toContain('Invalid time format')
      }
    })
  })
})