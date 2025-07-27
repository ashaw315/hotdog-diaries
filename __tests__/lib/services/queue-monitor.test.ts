import { QueueMonitorService } from '@/lib/services/queue-monitor'
import { db } from '@/lib/db'

// Mock the database and dependencies
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn(),
  },
  logToDatabase: jest.fn(),
}))

jest.mock('@/lib/services/posting', () => ({
  postingService: {
    getQueueStatus: jest.fn(),
  },
}))

const mockDb = db as jest.Mocked<typeof db>

describe('QueueMonitorService', () => {
  let queueMonitorService: QueueMonitorService
  
  beforeEach(() => {
    queueMonitorService = new QueueMonitorService()
    jest.clearAllMocks()
    
    // Mock current date/time
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('checkQueueHealth', () => {
    const { postingService } = require('@/lib/services/posting')

    it('should return healthy status when queue is good', async () => {
      const mockQueueStatus = {
        totalApproved: 10,
        totalPending: 5,
        totalPosted: 20,
        isHealthy: true,
        alertLevel: 'none',
        message: 'Queue is healthy'
      }

      postingService.getQueueStatus.mockResolvedValue(mockQueueStatus)

      const result = await queueMonitorService.checkQueueHealth()

      expect(result.healthy).toBe(true)
      expect(result.alerts).toEqual([])
      expect(result.queueStatus).toEqual(mockQueueStatus)
    })

    it('should create critical alert for empty queue', async () => {
      const mockQueueStatus = {
        totalApproved: 0,
        totalPending: 5,
        totalPosted: 20,
        isHealthy: false,
        alertLevel: 'critical',
        message: 'No approved content available for posting'
      }

      const mockAlert = {
        id: 1,
        alert_type: 'empty_queue',
        message: 'No approved content available for posting',
        severity: 'critical',
        metadata: { queueStatus: mockQueueStatus },
        acknowledged: false,
        created_at: new Date()
      }

      postingService.getQueueStatus.mockResolvedValue(mockQueueStatus)
      
      // Mock existing alert check (no existing alert)
      mockDb.query
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        // Mock alert creation
        .mockResolvedValueOnce({
          rows: [mockAlert],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        })

      const result = await queueMonitorService.checkQueueHealth()

      expect(result.healthy).toBe(false)
      expect(result.alerts).toHaveLength(1)
      expect(result.alerts[0]).toEqual(mockAlert)
    })

    it('should create warning alert for low queue', async () => {
      const mockQueueStatus = {
        totalApproved: 3,
        totalPending: 2,
        totalPosted: 15,
        isHealthy: false,
        alertLevel: 'critical',
        message: 'Critical: Only 3 approved items remaining'
      }

      const mockAlert = {
        id: 1,
        alert_type: 'low_queue',
        message: 'Critical: Only 3 approved items remaining',
        severity: 'critical',
        metadata: { queueStatus: mockQueueStatus },
        acknowledged: false,
        created_at: new Date()
      }

      postingService.getQueueStatus.mockResolvedValue(mockQueueStatus)
      
      mockDb.query
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [mockAlert],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        })

      const result = await queueMonitorService.checkQueueHealth()

      expect(result.healthy).toBe(false)
      expect(result.alerts).toHaveLength(1)
      expect(result.alerts[0].alert_type).toBe('low_queue')
      expect(result.alerts[0].severity).toBe('critical')
    })

    it('should create alert for high pending count', async () => {
      const mockQueueStatus = {
        totalApproved: 10,
        totalPending: 60,
        totalPosted: 20,
        isHealthy: true,
        alertLevel: 'none',
        message: 'Queue is healthy'
      }

      const mockAlert = {
        id: 1,
        alert_type: 'high_pending',
        message: 'High number of pending items: 60',
        severity: 'low',
        metadata: { queueStatus: mockQueueStatus },
        acknowledged: false,
        created_at: new Date()
      }

      postingService.getQueueStatus.mockResolvedValue(mockQueueStatus)
      
      mockDb.query
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [mockAlert],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        })

      const result = await queueMonitorService.checkQueueHealth()

      expect(result.healthy).toBe(true) // Still healthy despite high pending
      expect(result.alerts).toHaveLength(1)
      expect(result.alerts[0].alert_type).toBe('high_pending')
    })

    it('should update existing alert instead of creating duplicate', async () => {
      const mockQueueStatus = {
        totalApproved: 0,
        totalPending: 5,
        totalPosted: 20,
        isHealthy: false,
        alertLevel: 'critical',
        message: 'No approved content available for posting'
      }

      const existingAlert = {
        id: 1,
        alert_type: 'empty_queue',
        message: 'No approved content available for posting',
        severity: 'critical',
        metadata: { queueStatus: mockQueueStatus },
        acknowledged: false,
        created_at: new Date()
      }

      postingService.getQueueStatus.mockResolvedValue(mockQueueStatus)
      
      // Mock existing alert found
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        // Mock alert update
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: []
        })
        // Mock alert retrieval after update
        .mockResolvedValueOnce({
          rows: [existingAlert],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })

      const result = await queueMonitorService.checkQueueHealth()

      expect(result.healthy).toBe(false)
      expect(result.alerts).toHaveLength(1)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE queue_alerts'),
        expect.any(Array)
      )
    })
  })

  describe('getActiveAlerts', () => {
    it('should return active alerts', async () => {
      const mockAlerts = [
        {
          id: 1,
          alert_type: 'low_queue',
          message: 'Low queue warning',
          severity: 'medium',
          acknowledged: false,
          created_at: new Date()
        },
        {
          id: 2,
          alert_type: 'high_pending',
          message: 'High pending count',
          severity: 'low',
          acknowledged: false,
          created_at: new Date()
        }
      ]

      mockDb.query.mockResolvedValue({
        rows: mockAlerts,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await queueMonitorService.getActiveAlerts()

      expect(result).toEqual(mockAlerts)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE acknowledged = false'),
        expect.any(Array)
      )
    })

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'))

      const result = await queueMonitorService.getActiveAlerts()

      expect(result).toEqual([])
    })
  })

  describe('acknowledgeAlert', () => {
    it('should acknowledge specific alert', async () => {
      mockDb.query.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      })

      await queueMonitorService.acknowledgeAlert(1)

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE queue_alerts'),
        [1]
      )
    })

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'))

      await expect(queueMonitorService.acknowledgeAlert(1)).rejects.toThrow('Database error')
    })
  })

  describe('acknowledgeAllAlerts', () => {
    it('should acknowledge all alerts', async () => {
      mockDb.query.mockResolvedValue({
        rows: [],
        rowCount: 3,
        command: 'UPDATE',
        oid: 0,
        fields: []
      })

      await queueMonitorService.acknowledgeAllAlerts()

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE queue_alerts'),
        expect.any(Array)
      )
    })
  })

  describe('getAlertHistory', () => {
    it('should return alert history', async () => {
      const mockHistory = [
        {
          id: 1,
          alert_type: 'low_queue',
          message: 'Low queue warning',
          severity: 'medium',
          acknowledged: true,
          created_at: new Date(),
          acknowledged_at: new Date()
        }
      ]

      mockDb.query.mockResolvedValue({
        rows: mockHistory,
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      })

      const result = await queueMonitorService.getAlertHistory(100)

      expect(result).toEqual(mockHistory)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [100]
      )
    })
  })

  describe('createPostingFailureAlert', () => {
    it('should create posting failure alert', async () => {
      const mockAlert = {
        id: 1,
        alert_type: 'posting_failure',
        message: 'Failed to post content ID 123: Network error',
        severity: 'high',
        metadata: { contentId: 123, error: 'Network error' },
        acknowledged: false,
        created_at: new Date()
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
          rows: [mockAlert],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        })

      const result = await queueMonitorService.createPostingFailureAlert(123, 'Network error')

      expect(result).toEqual(mockAlert)
      expect(result.alert_type).toBe('posting_failure')
      expect(result.severity).toBe('high')
    })
  })

  describe('error handling', () => {
    it('should handle errors in checkQueueHealth', async () => {
      const { postingService } = require('@/lib/services/posting')
      postingService.getQueueStatus.mockRejectedValue(new Error('Service error'))

      const result = await queueMonitorService.checkQueueHealth()

      expect(result.healthy).toBe(false)
      expect(result.alerts).toEqual([])
      expect(result.queueStatus).toBeNull()
    })

    it('should handle errors in alert creation', async () => {
      const { postingService } = require('@/lib/services/posting')
      postingService.getQueueStatus.mockResolvedValue({
        totalApproved: 0,
        totalPending: 5,
        totalPosted: 20,
        isHealthy: false,
        alertLevel: 'critical',
        message: 'No approved content available for posting'
      })

      mockDb.query.mockRejectedValue(new Error('Database error'))

      await expect(queueMonitorService.checkQueueHealth()).rejects.toThrow('Database error')
    })
  })
})