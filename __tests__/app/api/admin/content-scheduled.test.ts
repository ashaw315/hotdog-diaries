/**
 * Unit tests for the scheduled content filter in admin content API
 * Tests the fix for status=scheduled to include both status='scheduled' OR scheduled_for IS NOT NULL
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/admin/content/route'
import { db } from '@/lib/db'
import { EdgeAuthUtils } from '@/lib/auth-edge'

// Mock the dependencies
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn(),
    healthCheck: jest.fn()
  }
}))

jest.mock('@/lib/auth-edge', () => ({
  EdgeAuthUtils: {
    verifyJWT: jest.fn()
  }
}))

jest.mock('@/lib/db-schema-utils', () => ({
  verifyTableColumns: jest.fn(),
  buildSafeSelectClause: jest.fn()
}))

jest.mock('@/lib/env', () => ({
  USE_MOCK_DATA: false
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(() => ({ value: 'valid-token' }))
  }))
}))

const mockDb = db as jest.Mocked<typeof db>
const mockEdgeAuthUtils = EdgeAuthUtils as jest.Mocked<typeof EdgeAuthUtils>

// Mock imports for db-schema-utils
const mockVerifyTableColumns = require('@/lib/db-schema-utils').verifyTableColumns as jest.Mock
const mockBuildSafeSelectClause = require('@/lib/db-schema-utils').buildSafeSelectClause as jest.Mock

describe('Admin Content API - Scheduled Filter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mocks
    mockDb.healthCheck.mockResolvedValue({ status: 'healthy' })
    mockEdgeAuthUtils.verifyJWT.mockResolvedValue({ userId: 1, username: 'admin' })
    
    // Mock schema detection to return all columns exist
    mockVerifyTableColumns.mockResolvedValue([
      'id', 'content_text', 'content_type', 'source_platform', 'original_url',
      'original_author', 'content_image_url', 'content_video_url', 'scraped_at',
      'is_posted', 'is_approved', 'admin_notes', 'created_at', 'updated_at',
      'confidence_score', 'content_hash', 'is_rejected', 'status', 'scheduled_for'
    ])
    
    mockBuildSafeSelectClause.mockResolvedValue(`
      cq.id, cq.content_text, cq.content_type, cq.source_platform, cq.original_url,
      cq.original_author, cq.content_image_url, cq.content_video_url, cq.scraped_at,
      cq.is_posted, cq.is_approved, cq.admin_notes, cq.created_at, cq.updated_at,
      cq.confidence_score, cq.content_hash, cq.is_rejected, cq.status, cq.scheduled_for
    `.trim())
  })

  describe('Scheduled Content Filter', () => {
    it('should use correct WHERE clause for scheduled status when both columns exist', async () => {
      // Mock query results
      mockDb.query
        .mockResolvedValueOnce({ // Content query
          rows: [
            {
              id: 1,
              content_text: 'Test scheduled content',
              status: 'scheduled',
              scheduled_for: '2025-10-09 10:30:00',
              source_platform: 'reddit',
              created_at: '2025-10-08 12:00:00'
            }
          ]
        })
        .mockResolvedValueOnce({ // Count query
          rows: [{ total: 1 }]
        })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)
      const data = await response.json()

      // Verify the correct WHERE clause was used
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE (cq.status = \'scheduled\' OR (cq.scheduled_for IS NOT NULL AND cq.status = \'approved\'))'),
        expect.any(Array)
      )

      // Verify response structure
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toHaveLength(1)
      expect(data.data.content[0].status).toBe('scheduled')
      expect(data.data.content[0].scheduled_for).toBe('2025-10-09 10:30:00')
    })

    it('should include items with status=scheduled', async () => {
      const scheduledContent = {
        id: 15,
        content_text: 'Pixabay scheduled content',
        status: 'scheduled',
        scheduled_for: '2025-10-09 10:30:00',
        source_platform: 'pixabay'
      }

      mockDb.query
        .mockResolvedValueOnce({ rows: [scheduledContent] })
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.content[0]).toMatchObject({
        id: 15,
        status: 'scheduled',
        scheduled_for: '2025-10-09 10:30:00'
      })
    })

    it('should include items with scheduled_for set and status=approved', async () => {
      const approvedButScheduledContent = {
        id: 20,
        content_text: 'Approved content with scheduled time',
        status: 'approved',
        scheduled_for: '2025-10-09 12:00:00',
        source_platform: 'tumblr'
      }

      mockDb.query
        .mockResolvedValueOnce({ rows: [approvedButScheduledContent] })
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.content[0]).toMatchObject({
        id: 20,
        status: 'approved',
        scheduled_for: '2025-10-09 12:00:00'
      })
    })

    it('should return multiple scheduled items from both conditions', async () => {
      const mixedScheduledContent = [
        {
          id: 15,
          content_text: 'Scheduled status content',
          status: 'scheduled',
          scheduled_for: '2025-10-09 10:30:00',
          source_platform: 'pixabay'
        },
        {
          id: 20,
          content_text: 'Approved with schedule time',
          status: 'approved',
          scheduled_for: '2025-10-09 12:00:00',
          source_platform: 'tumblr'
        }
      ]

      mockDb.query
        .mockResolvedValueOnce({ rows: mixedScheduledContent })
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.content).toHaveLength(2)
      expect(data.data.content[0].status).toBe('scheduled')
      expect(data.data.content[1].status).toBe('approved')
      expect(data.data.content.every(item => item.scheduled_for)).toBe(true)
    })

    it('should fallback correctly when status column missing', async () => {
      // Mock schema detection to exclude status column
      mockVerifyTableColumns.mockResolvedValue([
        'id', 'content_text', 'scheduled_for', 'is_approved'
      ])

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)

      // Should use only scheduled_for column when status column doesn't exist
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE cq.scheduled_for IS NOT NULL'),
        expect.any(Array)
      )
    })

    it('should fallback correctly when scheduled_for column missing', async () => {
      // Mock schema detection to exclude scheduled_for column
      mockVerifyTableColumns.mockResolvedValue([
        'id', 'content_text', 'status', 'is_approved'
      ])

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)

      // Should use only status column when scheduled_for column doesn't exist
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE cq.status = \'scheduled\''),
        expect.any(Array)
      )
    })

    it('should handle development mode bypass correctly', async () => {
      // Set NODE_ENV to development and mock empty column detection
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      mockVerifyTableColumns.mockResolvedValue([]) // Empty array to trigger bypass

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)

      // Should use development mode bypass with both conditions
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('(cq.status = \'scheduled\' OR (cq.scheduled_for IS NOT NULL AND cq.status = \'approved\'))'),
        expect.any(Array)
      )

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv
    })

    it('should log diagnostic information correctly', async () => {
      const consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation()
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation()

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'scheduled' }] })
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      await GET(request)

      // Verify diagnostic logging occurred
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🧩 [ContentAPI] Scheduled filter - hasStatus:'),
        expect.any(Boolean),
        expect.stringContaining('hasScheduledFor:'),
        expect.any(Boolean)
      )

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🧩 [ContentAPI] Final WHERE Clause:',
        expect.stringContaining('scheduled')
      )

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🧩 [ContentAPI] Row Count Returned:',
        expect.any(Number)
      )

      expect(consoleGroupSpy).toHaveBeenCalledWith('🧩 [Diagnostics] Scheduled Query Result')

      // Cleanup
      consoleGroupSpy.mockRestore()
      consoleLogSpy.mockRestore()
      consoleGroupEndSpy.mockRestore()
    })
  })

  describe('Response Structure', () => {
    it('should return proper response structure for scheduled content', async () => {
      const scheduledItem = {
        id: 15,
        content_text: 'Test scheduled content',
        content_type: 'text',
        source_platform: 'pixabay',
        status: 'scheduled',
        scheduled_for: '2025-10-09 10:30:00',
        is_approved: true,
        is_posted: false,
        created_at: '2025-10-08 12:00:00',
        updated_at: '2025-10-08 15:00:00'
      }

      mockDb.query
        .mockResolvedValueOnce({ rows: [scheduledItem] })
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)
      const data = await response.json()

      expect(data).toEqual({
        success: true,
        data: {
          content: expect.arrayContaining([
            expect.objectContaining({
              id: 15,
              content_text: 'Test scheduled content',
              status: 'scheduled',
              scheduled_for: '2025-10-09 10:30:00'
            })
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasMore: false
          }),
          filter: 'scheduled'
        },
        message: 'Retrieved 1 content items'
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)
      
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle authentication errors', async () => {
      mockEdgeAuthUtils.verifyJWT.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/admin/content?status=scheduled')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Invalid token')
    })
  })
})