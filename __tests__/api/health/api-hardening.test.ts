// @ts-nocheck - Test file for API hardening
import { GET as healthGet } from '@/app/api/health/posting-source-of-truth/route'
import { GET as diversityGet } from '@/app/api/admin/metrics/diversity/route'
import { GET as diversitySummaryGet } from '@/app/api/admin/diversity-summary/route'

// Mock the server utilities
jest.mock('@/app/lib/server/env', () => ({
  featureFlagSourceOfTruth: () => true,
  hasAllCoreEnv: () => ({ ok: true, missing: [] })
}))

jest.mock('@/app/lib/server/supabase', () => ({
  supabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        gte: () => ({
          lte: () => ({
            order: () => Promise.resolve({ data: [], error: null })
          })
        })
      })
    })
  })
}))

describe('API Hardening Tests', () => {
  
  describe('/api/health/posting-source-of-truth', () => {
    it('should never return 500 for expected states', async () => {
      const request = new Request('http://localhost:3000/api/health/posting-source-of-truth')
      const response = await healthGet()
      
      expect(response.status).not.toBe(500)
      expect([200, 503]).toContain(response.status)
      
      const data = await response.json()
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('issues')
      expect(data).toHaveProperty('recommendations')
      expect(data).toHaveProperty('metadata')
    })

    it('should return structured JSON for all states', async () => {
      const request = new Request('http://localhost:3000/api/health/posting-source-of-truth')
      const response = await healthGet()
      
      const data = await response.json()
      expect(data.status).toMatch(/^(ok|error)$/)
      expect(Array.isArray(data.issues)).toBe(true)
      expect(Array.isArray(data.recommendations)).toBe(true)
      expect(data.metadata).toHaveProperty('check_timestamp')
    })
  })

  describe('/api/admin/metrics/diversity', () => {
    it('should handle missing date parameter gracefully', async () => {
      const request = new Request('http://localhost:3000/api/admin/metrics/diversity')
      const response = await diversityGet(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('error')
      expect(data.issues).toContain('Missing or invalid ?date=YYYY-MM-DD')
    })

    it('should handle invalid date format gracefully', async () => {
      const request = new Request('http://localhost:3000/api/admin/metrics/diversity?date=invalid')
      const response = await diversityGet(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('error')
      expect(data.issues).toContain('Missing or invalid ?date=YYYY-MM-DD')
    })

    it('should handle valid date with no data gracefully', async () => {
      const request = new Request('http://localhost:3000/api/admin/metrics/diversity?date=2025-01-01')
      const response = await diversityGet(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      if (data.status === 'error') {
        expect(data.issues).toContain('No scheduled posts for the requested date')
        expect(data.recommendations).toContain('Trigger scheduler refill for the target date')
      }
    })

    it('should never return 500 for expected states', async () => {
      const request = new Request('http://localhost:3000/api/admin/metrics/diversity?date=2025-01-01')
      const response = await diversityGet(request)
      
      expect(response.status).not.toBe(500)
      expect([200, 503]).toContain(response.status)
    })
  })

  describe('/api/admin/diversity-summary', () => {
    it('should handle missing date parameter with default', async () => {
      const request = new Request('http://localhost:3000/api/admin/diversity-summary')
      const response = await diversitySummaryGet(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('date')
      expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return structured summary format', async () => {
      const request = new Request('http://localhost:3000/api/admin/diversity-summary?date=2025-01-01')
      const response = await diversitySummaryGet(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('issues')
      expect(data).toHaveProperty('recommendations')
      
      if (data.status === 'error') {
        expect(data.summary).toHaveProperty('total_slots')
        expect(data.summary).toHaveProperty('filled_slots')
        expect(data.summary).toHaveProperty('platforms')
        expect(data.summary).toHaveProperty('content_types')
      }
    })

    it('should calculate diversity score correctly', async () => {
      const request = new Request('http://localhost:3000/api/admin/diversity-summary?date=2025-01-01')
      const response = await diversitySummaryGet(request)
      
      const data = await response.json()
      if (data.summary?.diversity_score !== undefined) {
        expect(typeof data.summary.diversity_score).toBe('number')
        expect(data.summary.diversity_score).toBeGreaterThanOrEqual(0)
        expect(data.summary.diversity_score).toBeLessThanOrEqual(100)
      }
    })

    it('should never return 500 for expected states', async () => {
      const request = new Request('http://localhost:3000/api/admin/diversity-summary?date=2025-01-01')
      const response = await diversitySummaryGet(request)
      
      expect(response.status).not.toBe(500)
      expect([200, 503]).toContain(response.status)
    })
  })

  describe('Error Response Structure', () => {
    it('should have consistent error response format across endpoints', async () => {
      const endpoints = [
        { fn: healthGet, url: 'http://localhost:3000/api/health/posting-source-of-truth' },
        { fn: diversityGet, url: 'http://localhost:3000/api/admin/metrics/diversity?date=invalid' },
        { fn: diversitySummaryGet, url: 'http://localhost:3000/api/admin/diversity-summary?date=invalid' }
      ]

      for (const endpoint of endpoints) {
        const request = new Request(endpoint.url)
        const response = await endpoint.fn(request)
        const data = await response.json()

        // All error responses should have these fields
        expect(data).toHaveProperty('status')
        expect(data).toHaveProperty('issues')
        expect(data).toHaveProperty('recommendations')
        expect(data).toHaveProperty('metadata')

        if (data.status === 'error') {
          expect(Array.isArray(data.issues)).toBe(true)
          expect(Array.isArray(data.recommendations)).toBe(true)
        }
      }
    })
  })
})