import { SchedulingService } from '@/lib/services/scheduling'
import { db } from '@/lib/db'

// Mock the database
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn(),
  },
  logToDatabase: jest.fn(),
}))

const mockDb = db as jest.Mocked<typeof db>

describe('SchedulingService', () => {
  let schedulingService: SchedulingService
  
  beforeEach(() => {
    schedulingService = new SchedulingService()
    jest.clearAllMocks()
    
    // Mock current date/time
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T10:30:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('getScheduleConfig', () => {
    it('should return existing config when available', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDb.query.mockResolvedValue({
        rows: [mockConfig],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await schedulingService.getScheduleConfig()
      
      expect(result).toEqual(mockConfig)
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM schedule_config ORDER BY created_at DESC LIMIT 1'
      )
    })

    it('should create default config when none exists', async () => {
      const mockDefaultConfig = {
        id: 1,
        meal_times: ['08:00', '10:00', '12:00', '15:00', '18:00', '20:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDb.query
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [mockDefaultConfig],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        })

      const result = await schedulingService.getScheduleConfig()
      
      expect(result).toEqual(mockDefaultConfig)
      expect(mockDb.query).toHaveBeenCalledTimes(2)
    })
  })

  describe('updateScheduleConfig', () => {
    it('should update existing config with new values', async () => {
      const currentConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      const updatedConfig = {
        ...currentConfig,
        meal_times: ['09:00', '13:00', '19:00'],
        timezone: 'America/Los_Angeles'
      }

      mockDb.query
        .mockResolvedValueOnce({
          rows: [currentConfig],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [updatedConfig],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: []
        })

      const result = await schedulingService.updateScheduleConfig({
        meal_times: ['09:00', '13:00', '19:00'],
        timezone: 'America/Los_Angeles'
      })

      expect(result).toEqual(updatedConfig)
    })
  })

  describe('getNextScheduledTime', () => {
    it('should return next meal time today if available', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDb.query
        .mockResolvedValueOnce({
          rows: [mockConfig],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValue({
          rows: [{ count: 0 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })

      // Mock current time: 10:30 AM
      jest.setSystemTime(new Date('2024-01-15T15:30:00Z')) // 10:30 AM EST

      const result = await schedulingService.getNextScheduledTime()
      
      expect(result).toBeDefined()
      expect(result?.getHours()).toBe(12) // Next meal time is 12:00 PM
    })

    it('should return first meal time tomorrow if no more today', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDb.query
        .mockResolvedValueOnce({
          rows: [mockConfig],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValue({
          rows: [{ count: 0 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })

      // Mock current time: 8:00 PM (after last meal)
      jest.setSystemTime(new Date('2024-01-15T01:00:00Z')) // 8:00 PM EST

      const result = await schedulingService.getNextScheduledTime()
      
      expect(result).toBeDefined()
      expect(result?.getHours()).toBe(8) // 8:00 AM tomorrow
    })
  })

  describe('isPostingTime', () => {
    it('should return true when current time matches meal time', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDb.query
        .mockResolvedValueOnce({
          rows: [mockConfig],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValue({
          rows: [{ count: 0 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })

      // Mock current time: 12:00 PM (exact meal time)
      jest.setSystemTime(new Date('2024-01-15T17:00:00Z')) // 12:00 PM EST

      const result = await schedulingService.isPostingTime()
      
      expect(result).toBe(true)
    })

    it('should return false when current time does not match meal time', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDb.query.mockResolvedValueOnce({
        rows: [mockConfig],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      // Mock current time: 10:30 AM (not a meal time)
      jest.setSystemTime(new Date('2024-01-15T15:30:00Z')) // 10:30 AM EST

      const result = await schedulingService.isPostingTime()
      
      expect(result).toBe(false)
    })

    it('should return false when scheduling is disabled', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: false,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDb.query.mockResolvedValueOnce({
        rows: [mockConfig],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await schedulingService.isPostingTime()
      
      expect(result).toBe(false)
    })
  })

  describe('selectRandomContent', () => {
    it('should return random approved content', async () => {
      const mockContent = {
        id: 1,
        content_text: 'Test hotdog content',
        content_type: 'text',
        is_approved: true,
        is_posted: false
      }

      mockDb.query.mockResolvedValue({
        rows: [mockContent],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await schedulingService.selectRandomContent()
      
      expect(result).toEqual(mockContent)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM content_queue'),
        expect.any(Array)
      )
    })

    it('should return null when no approved content available', async () => {
      mockDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await schedulingService.selectRandomContent()
      
      expect(result).toBeNull()
    })
  })

  describe('getPostingSchedule', () => {
    it('should return complete posting schedule information', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDb.query
        .mockResolvedValueOnce({
          rows: [mockConfig],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValue({
          rows: [{ count: 0 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })

      jest.setSystemTime(new Date('2024-01-15T15:30:00Z')) // 10:30 AM EST

      const result = await schedulingService.getPostingSchedule()
      
      expect(result).toHaveProperty('nextPostTime')
      expect(result).toHaveProperty('nextMealTime')
      expect(result).toHaveProperty('timeUntilNext')
      expect(result).toHaveProperty('isPostingTime')
      expect(result).toHaveProperty('todaysSchedule')
      expect(result.todaysSchedule).toHaveLength(3)
    })
  })

  describe('pauseScheduling', () => {
    it('should disable scheduling', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }

      const updatedConfig = { ...mockConfig, is_enabled: false }

      mockDb.query
        .mockResolvedValueOnce({
          rows: [mockConfig],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [updatedConfig],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: []
        })

      await schedulingService.pauseScheduling()
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE schedule_config'),
        expect.arrayContaining([false])
      )
    })
  })

  describe('resumeScheduling', () => {
    it('should enable scheduling', async () => {
      const mockConfig = {
        id: 1,
        meal_times: ['08:00', '12:00', '18:00'],
        timezone: 'America/New_York',
        is_enabled: false,
        created_at: new Date(),
        updated_at: new Date()
      }

      const updatedConfig = { ...mockConfig, is_enabled: true }

      mockDb.query
        .mockResolvedValueOnce({
          rows: [mockConfig],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [updatedConfig],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: []
        })

      await schedulingService.resumeScheduling()
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE schedule_config'),
        expect.arrayContaining([true])
      )
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'))

      await expect(schedulingService.getScheduleConfig()).rejects.toThrow('Database connection failed')
    })

    it('should return null on error in getNextScheduledTime', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'))

      const result = await schedulingService.getNextScheduledTime()
      
      expect(result).toBeNull()
    })

    it('should return false on error in isPostingTime', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'))

      const result = await schedulingService.isPostingTime()
      
      expect(result).toBe(false)
    })
  })
})