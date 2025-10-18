/**
 * Tests for Posting Source of Truth Health Endpoint
 * 
 * Validates posting system integrity and orphan detection.
 */

import { GET } from '../../../app/api/health/posting-source-of-truth/route'
import { NextRequest } from 'next/server'
import { db } from '../../../lib/db'
import { createSimpleClient } from '../../../utils/supabase/server'

// Mock dependencies
jest.mock('../../../lib/db')
jest.mock('../../../utils/supabase/server')

const mockDb = db as jest.Mocked<typeof db>
const mockCreateSimpleClient = createSimpleClient as jest.MockedFunction<typeof createSimpleClient>

describe('/api/health/posting-source-of-truth', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
    select: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    not: jest.fn(),
    is: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default environment setup
    process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = 'true'
    process.env.NODE_ENV = 'development'
    
    // Setup default mocks
    mockDb.connect.mockResolvedValue()
    mockDb.disconnect.mockResolvedValue()
    mockCreateSimpleClient.mockReturnValue(mockSupabaseClient as any)
  })

  const createRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3000/api/health/posting-source-of-truth')
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    
    return new NextRequest(url)
  }

  describe('healthy system scenarios', () => {
    it('should return healthy status when all posts are linked', async () => {
      // Mock SQLite queries for a healthy system
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // Total recent posts
        .mockResolvedValueOnce({ rows: [{ linked: 10 }] }) // All linked
        .mockResolvedValueOnce({ rows: [{ scheduled: 12 }] }) // Scheduled posts
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.feature_flag_active).toBe(true)
      expect(data.total_recent_posts).toBe(10)
      expect(data.linked_posts).toBe(10)
      expect(data.orphan_posts).toBe(0)
      expect(data.orphan_percentage).toBe(0)
      expect(data.posting_compliance_score).toBe(100)
      expect(data.issues).toHaveLength(0)
      expect(data.metadata.database_type).toBe('sqlite')
    })

    it('should return healthy status with minimal orphans', async () => {
      // Mock system with 1 orphan out of 20 posts (5% - acceptable)
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 20 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 19 }] })
        .mockResolvedValueOnce({ rows: [{ scheduled: 22 }] })
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.status).toBe('healthy')
      expect(data.orphan_posts).toBe(1)
      expect(data.orphan_percentage).toBe(5)
      expect(data.posting_compliance_score).toBe(95)
    })
  })

  describe('warning scenarios', () => {
    it('should return warning for moderate orphan percentage', async () => {
      // Mock system with 7% orphans (warning threshold)
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 100 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 93 }] })
        .mockResolvedValueOnce({ rows: [{ scheduled: 105 }] })
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.status).toBe('warning')
      expect(data.orphan_posts).toBe(7)
      expect(data.orphan_percentage).toBe(7)
      expect(data.posting_compliance_score).toBe(93)
      expect(data.issues).toContain(expect.stringContaining('7 orphan posts found'))
      expect(data.recommendations).toContain(expect.stringContaining('backfill job'))
    })

    it('should return warning when compliance score is low', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 50 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 46 }] }) // 92% compliance
        .mockResolvedValueOnce({ rows: [{ scheduled: 55 }] })
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.status).toBe('warning')
      expect(data.posting_compliance_score).toBe(92)
    })
  })

  describe('error scenarios', () => {
    it('should return error when feature flag is disabled', async () => {
      process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = 'false'
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 10 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 10 }] })
        .mockResolvedValueOnce({ rows: [{ scheduled: 10 }] })
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.status).toBe('error')
      expect(data.feature_flag_active).toBe(false)
      expect(data.posting_compliance_score).toBeLessThanOrEqual(75) // Capped when flag disabled
      expect(data.issues).toContain(expect.stringContaining('feature flag is not active'))
      expect(data.recommendations).toContain(expect.stringContaining('ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true'))
    })

    it('should return error for high orphan percentage', async () => {
      // Mock system with 25% orphans (error threshold)
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 40 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 30 }] })
        .mockResolvedValueOnce({ rows: [{ scheduled: 45 }] })
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.status).toBe('error')
      expect(data.orphan_percentage).toBe(25)
      expect(data.issues).toContain(expect.stringContaining('10 orphan posts found (25.0% of recent posts)'))
    })

    it('should return error when no scheduled posts exist', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 10 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 8 }] })
        .mockResolvedValueOnce({ rows: [{ scheduled: 0 }] }) // No scheduled posts!
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.status).toBe('error')
      expect(data.scheduled_posts_count).toBe(0)
      expect(data.issues).toContain('No scheduled_posts entries found for the check period')
      expect(data.recommendations).toContain(expect.stringContaining('daily schedule generation'))
    })

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'))
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.status).toBe('error')
      expect(data.issues).toContain('Health check failed: Database connection failed')
    })
  })

  describe('Supabase environment', () => {
    beforeEach(() => {
      // Mock Supabase environment
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
      process.env.NODE_ENV = 'production'
    })

    it('should work with Supabase client', async () => {
      // Setup Supabase client mocks
      const mockSupabaseResponse = {
        count: 15
      }
      
      mockSupabaseClient.from.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.select.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.gte.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.not.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.is.mockReturnValue(mockSupabaseClient)
      
      // Mock the chain for total posts
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ count: 20 })
        })
      } as any)
      
      // Mock the chain for linked posts  
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({ count: 18 })
          })
        })
      } as any)
      
      // Mock the chain for scheduled posts
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ count: 22 })
        })
      } as any)
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.metadata.database_type).toBe('supabase')
      expect(data.total_recent_posts).toBe(20)
      expect(data.linked_posts).toBe(18)
      expect(data.scheduled_posts_count).toBe(22)
    })
  })

  describe('configuration options', () => {
    it('should respect custom check period', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 5 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 5 }] })
        .mockResolvedValueOnce({ rows: [{ scheduled: 6 }] })
      
      const request = createRequest({ days: '3' }) // 3-day period
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.metadata.check_period_days).toBe(3)
      
      // Verify the query used 3-day cutoff (approximately)
      const queryCall = mockDb.query.mock.calls[0]
      expect(queryCall[0]).toContain('DATE(?)')
      expect(queryCall[1][0]).toMatch(/\d{4}-\d{2}-\d{2}/) // Date format
    })

    it('should handle edge case of zero posts', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 0 }] })
        .mockResolvedValueOnce({ rows: [{ scheduled: 0 }] })
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.total_recent_posts).toBe(0)
      expect(data.orphan_percentage).toBe(0)
      expect(data.posting_compliance_score).toBe(100) // No posts = 100% compliance
      expect(data.issues).toContain('No recent posts found in the check period')
    })

    it('should set proper cache headers', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ linked: 1 }] })
        .mockResolvedValueOnce({ rows: [{ scheduled: 1 }] })
      
      const request = createRequest()
      
      const response = await GET(request)
      
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
      expect(response.headers.get('Pragma')).toBe('no-cache')
    })
  })

  afterEach(() => {
    // Restore environment
    delete process.env.DATABASE_URL
    process.env.NODE_ENV = 'test'
  })
})