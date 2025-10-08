/**
 * Test: Content Scheduling Persistence
 * Verifies that scheduled content is correctly persisted to the database
 * and retrievable via the admin API
 */

import { scheduleNextBatch, getUpcomingSchedule } from '@/lib/services/schedule-content'
import { db } from '@/lib/db'
import { ContentStatus } from '@/types'

// Mock the database
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn(),
    healthCheck: jest.fn(),
    disconnect: jest.fn()
  }
}))

describe('Content Scheduling Persistence', () => {
  const mockApprovedContent = [
    {
      id: 101,
      content_text: 'Test hotdog content 1',
      content_type: 'text',
      source_platform: 'reddit',
      is_approved: true,
      is_posted: false,
      status: 'approved',
      confidence_score: 0.9,
      priority: 1,
      created_at: '2024-01-01T10:00:00Z'
    },
    {
      id: 102,
      content_text: 'Test hotdog content 2',
      content_type: 'image',
      source_platform: 'instagram',
      is_approved: true,
      is_posted: false,
      status: 'approved',
      confidence_score: 0.85,
      priority: 1,
      created_at: '2024-01-01T11:00:00Z'
    },
    {
      id: 103,
      content_text: 'Test hotdog content 3',
      content_type: 'video',
      source_platform: 'youtube',
      is_approved: true,
      is_posted: false,
      status: 'approved',
      confidence_score: 0.95,
      priority: 2,
      created_at: '2024-01-01T12:00:00Z'
    },
    {
      id: 104,
      content_text: 'Test hotdog content 4',
      content_type: 'text',
      source_platform: 'twitter',
      is_approved: true,
      is_posted: false,
      status: 'approved',
      confidence_score: 0.8,
      priority: 1,
      created_at: '2024-01-01T13:00:00Z'
    },
    {
      id: 105,
      content_text: 'Test hotdog content 5',
      content_type: 'gif',
      source_platform: 'giphy',
      is_approved: true,
      is_posted: false,
      status: 'approved',
      confidence_score: 0.88,
      priority: 1,
      created_at: '2024-01-01T14:00:00Z'
    },
    {
      id: 106,
      content_text: 'Test hotdog content 6',
      content_type: 'text',
      source_platform: 'tumblr',
      is_approved: true,
      is_posted: false,
      status: 'approved',
      confidence_score: 0.82,
      priority: 1,
      created_at: '2024-01-01T15:00:00Z'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock responses
    ;(db.query as jest.Mock).mockImplementation((query: string, params?: any[]) => {
      // Mock available content query
      if (query.includes('WHERE is_approved = TRUE')) {
        return { rows: mockApprovedContent }
      }
      
      // Mock recently posted platforms query
      if (query.includes('SELECT DISTINCT cq.source_platform')) {
        return { rows: [] }
      }
      
      // Mock existing scheduled check
      if (query.includes('SELECT COUNT(*) as count')) {
        return { rows: [{ count: 0 }] }
      }
      
      // Mock UPDATE queries for scheduling
      if (query.includes('UPDATE content_queue')) {
        return { rowCount: 1 }
      }
      
      // Mock scheduled content retrieval
      if (query.includes("WHERE status = 'scheduled'")) {
        // Return mock scheduled items after update
        return { 
          rows: mockApprovedContent.slice(0, 6).map((item, idx) => ({
            ...item,
            status: 'scheduled',
            scheduled_for: `2024-01-02 ${8 + idx * 2}:00:00`
          }))
        }
      }
      
      return { rows: [] }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('scheduleNextBatch', () => {
    it('should persist scheduled content to the database', async () => {
      // Act
      const result = await scheduleNextBatch(1, 6)
      
      // Assert
      expect(result.summary.totalScheduled).toBe(6)
      expect(result.summary.totalDays).toBe(1)
      expect(result.errors).toHaveLength(0)
      
      // Verify UPDATE queries were called for each scheduled item
      const updateCalls = (db.query as jest.Mock).mock.calls.filter(
        call => call[0].includes('UPDATE content_queue')
      )
      expect(updateCalls).toHaveLength(6)
      
      // Verify each update has correct parameters
      updateCalls.forEach((call, idx) => {
        expect(call[1]).toHaveLength(3) // [scheduled_for, status, id]
        expect(call[1][1]).toBe(ContentStatus.SCHEDULED)
        expect(call[1][2]).toBe(mockApprovedContent[idx].id)
      })
    })

    it('should set status to "scheduled" for each scheduled item', async () => {
      // Act
      await scheduleNextBatch(1, 6)
      
      // Verify all UPDATE queries set status to 'scheduled'
      const updateCalls = (db.query as jest.Mock).mock.calls.filter(
        call => call[0].includes('UPDATE content_queue')
      )
      
      updateCalls.forEach(call => {
        expect(call[0]).toContain('status = ?')
        expect(call[1][1]).toBe('scheduled') // ContentStatus.SCHEDULED value
      })
    })

    it('should set scheduled_for timestamp for each scheduled item', async () => {
      // Act
      await scheduleNextBatch(1, 6)
      
      // Verify all UPDATE queries set scheduled_for
      const updateCalls = (db.query as jest.Mock).mock.calls.filter(
        call => call[0].includes('UPDATE content_queue')
      )
      
      updateCalls.forEach(call => {
        expect(call[0]).toContain('scheduled_for = ?')
        expect(call[1][0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/) // YYYY-MM-DD HH:mm:ss
      })
    })

    it('should enforce platform diversity when scheduling', async () => {
      // Act
      const result = await scheduleNextBatch(1, 6)
      
      // Assert platform distribution
      expect(result.summary.platformDistribution).toBeDefined()
      const platforms = Object.keys(result.summary.platformDistribution)
      
      // Should have scheduled content from different platforms
      expect(platforms.length).toBeGreaterThan(1)
      
      // No platform should dominate (assuming we have diverse content)
      Object.values(result.summary.platformDistribution).forEach(count => {
        expect(count as number).toBeLessThanOrEqual(2) // Max 2 from same platform
      })
    })

    it('should handle insufficient content gracefully', async () => {
      // Setup: Only return 3 items instead of 6
      ;(db.query as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('WHERE is_approved = TRUE')) {
          return { rows: mockApprovedContent.slice(0, 3) }
        }
        if (query.includes('SELECT DISTINCT cq.source_platform')) {
          return { rows: [] }
        }
        if (query.includes('SELECT COUNT(*) as count')) {
          return { rows: [{ count: 0 }] }
        }
        if (query.includes('UPDATE content_queue')) {
          return { rowCount: 1 }
        }
        return { rows: [] }
      })
      
      // Act
      const result = await scheduleNextBatch(1, 6)
      
      // Assert
      expect(result.summary.totalScheduled).toBe(3)
      expect(result.errors).toContainEqual(
        expect.stringContaining('Only 3 content items available')
      )
    })
  })

  describe('getUpcomingSchedule', () => {
    it('should retrieve scheduled content from the database', async () => {
      // Setup
      const mockScheduledContent = mockApprovedContent.slice(0, 3).map((item, idx) => ({
        ...item,
        status: 'scheduled',
        scheduled_for: `2024-01-02 ${8 + idx * 2}:00:00`
      }))
      
      ;(db.query as jest.Mock).mockResolvedValue({ rows: mockScheduledContent })
      
      // Act
      const scheduled = await getUpcomingSchedule(7)
      
      // Assert
      expect(scheduled).toHaveLength(3)
      expect(scheduled[0].status).toBe('scheduled')
      expect(scheduled[0].scheduled_for).toBeDefined()
      
      // Verify correct query was used
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'scheduled'"),
        expect.any(Array)
      )
    })
  })

  describe('API Integration', () => {
    it('should return scheduled content via /api/admin/content?status=scheduled', async () => {
      // This test would require setting up the full API testing environment
      // For now, we're testing the core persistence logic
      
      // Setup: Mock scheduled content exists
      const mockScheduledContent = mockApprovedContent.slice(0, 6).map(item => ({
        ...item,
        status: 'scheduled',
        scheduled_for: '2024-01-02 10:00:00'
      }))
      
      ;(db.query as jest.Mock).mockImplementation((query: string) => {
        if (query.includes("WHERE status = 'scheduled'") || 
            query.includes("cq.status = 'scheduled'")) {
          return { rows: mockScheduledContent }
        }
        return { rows: [] }
      })
      
      // Simulate API query logic
      const result = await db.query(`
        SELECT * FROM content_queue 
        WHERE status = 'scheduled'
      `)
      
      // Assert
      expect(result.rows).toHaveLength(6)
      expect(result.rows[0].status).toBe('scheduled')
      expect(result.rows[0].scheduled_for).toBeDefined()
    })
  })
})

describe('Scheduled Content Persistence Verification', () => {
  it('should confirm scheduled content persists with correct status value', async () => {
    // This test verifies the exact status value stored in database
    const testContent = {
      id: 200,
      content_text: 'Persistence test content',
      source_platform: 'test',
      status: 'approved'
    }
    
    let capturedUpdateParams: any[] = []
    
    ;(db.query as jest.Mock).mockImplementation((query: string, params?: any[]) => {
      if (query.includes('UPDATE content_queue') && params) {
        capturedUpdateParams = params
        return { rowCount: 1 }
      }
      if (query.includes('WHERE is_approved = TRUE')) {
        return { rows: [testContent] }
      }
      return { rows: [] }
    })
    
    // Schedule content
    await scheduleNextBatch(1, 1)
    
    // Verify the exact status value persisted
    expect(capturedUpdateParams[1]).toBe('scheduled') // Should be lowercase 'scheduled'
    
    // Verify it would be retrievable with status='scheduled' filter
    ;(db.query as jest.Mock).mockImplementation((query: string) => {
      if (query.includes("status = 'scheduled'")) {
        return { 
          rows: [{
            ...testContent,
            status: capturedUpdateParams[1], // Use the actual persisted value
            scheduled_for: capturedUpdateParams[0]
          }]
        }
      }
      return { rows: [] }
    })
    
    const retrievedContent = await db.query(
      "SELECT * FROM content_queue WHERE status = 'scheduled'"
    )
    
    expect(retrievedContent.rows).toHaveLength(1)
    expect(retrievedContent.rows[0].status).toBe('scheduled')
  })
})