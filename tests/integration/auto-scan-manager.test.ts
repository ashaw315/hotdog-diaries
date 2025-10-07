import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { autoScanManager } from '@/lib/services/auto-scan-manager'
import { queueManager } from '@/lib/services/queue-manager'
import { db } from '@/lib/db'

// Mock external dependencies
vi.mock('@/lib/services/logging', () => ({
  loggingService: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn()
  }
}))

// Mock fetch for GitHub API and direct API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AutoScanManager Integration Tests', () => {
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()
    mockFetch.mockClear()

    // Setup test database
    await db.connect()
    
    // Clean up test data
    await db.query('DELETE FROM posted_content WHERE 1=1')
    await db.query('DELETE FROM content_queue WHERE 1=1')
    
    // Reset environment variables
    delete process.env.GITHUB_TOKEN
    delete process.env.AUTH_TOKEN
    delete process.env.SITE_URL
  })

  afterEach(async () => {
    await db.disconnect()
  })

  describe('getScanStatus', () => {
    it('should return current scan status and recommendations', async () => {
      // Setup test data - create a low content scenario
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES 
        ('Test content 1', 'text', 'reddit', 'http://test1.com', 'hash1', datetime('now'), 1, 0.8),
        ('Test content 2', 'image', 'pixabay', 'http://test2.com', 'hash2', datetime('now'), 1, 0.7)
      `)

      const status = await autoScanManager.getScanStatus()

      expect(status).toMatchObject({
        queueHealth: {
          totalApproved: 2,
          daysOfContent: expect.any(Number),
          platformBalance: expect.any(Object),
          isHealthy: expect.any(Boolean),
          issues: expect.any(Array)
        },
        recommendations: expect.any(Array),
        nextScanTime: expect.any(String)
      })

      // Should have recommendations for platforms with no content
      const highPriorityRecs = status.recommendations.filter(rec => rec.priority === 'high')
      expect(highPriorityRecs.length).toBeGreaterThan(0)
    })

    it('should calculate next scan time correctly', async () => {
      const status = await autoScanManager.getScanStatus()
      const nextScanTime = new Date(status.nextScanTime)
      const now = new Date()
      
      expect(nextScanTime.getTime()).toBeGreaterThan(now.getTime())
      expect(nextScanTime.getUTCMinutes()).toBe(0)
      expect(nextScanTime.getUTCSeconds()).toBe(0)
    })
  })

  describe('performAutoScan', () => {
    it('should skip scans when queue is healthy', async () => {
      // Setup healthy queue (lots of content)
      const insertPromises = []
      for (let i = 0; i < 50; i++) {
        insertPromises.push(
          db.query(`
            INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
            VALUES (?, 'text', 'reddit', ?, ?, datetime('now'), 1, 0.8)
          `, [`Test content ${i}`, `http://test${i}.com`, `hash${i}`])
        )
      }
      await Promise.all(insertPromises)

      const result = await autoScanManager.performAutoScan()

      expect(result.success).toBe(true)
      expect(result.triggeredScans).toHaveLength(0)
      expect(result.skippedScans.length).toBeGreaterThan(0)
      expect(result.queueHealth.isHealthy).toBe(true)
    })

    it('should trigger scans when queue is low', async () => {
      // Setup low queue (minimal content)
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES ('Single test content', 'text', 'reddit', 'http://test.com', 'hash1', datetime('now'), 1, 0.8)
      `)

      // Mock successful API response
      process.env.AUTH_TOKEN = 'test-token'
      process.env.SITE_URL = 'https://test.vercel.app'
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalFound: 5, processed: 3 })
      })

      const result = await autoScanManager.performAutoScan()

      expect(result.success).toBe(true)
      expect(result.triggeredScans.length).toBeGreaterThan(0)
      expect(result.queueHealth.totalApproved).toBe(1)
      expect(result.queueHealth.isHealthy).toBe(false)
    })

    it('should handle platform-specific scan failures gracefully', async () => {
      // Setup minimal content to trigger scans
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES ('Test content', 'text', 'reddit', 'http://test.com', 'hash1', datetime('now'), 1, 0.8)
      `)

      process.env.AUTH_TOKEN = 'test-token'
      process.env.SITE_URL = 'https://test.vercel.app'
      
      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      })

      const result = await autoScanManager.performAutoScan()

      expect(result.success).toBe(false) // Should fail if no scans succeed
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('API error: 500')
    })

    it('should prioritize high-priority platforms', async () => {
      // Setup empty queue to trigger high-priority scans
      const result = await autoScanManager.performAutoScan()

      // All platforms should be high priority when queue is empty
      const highPriorityRecs = result.recommendations.filter(rec => rec.priority === 'high')
      expect(highPriorityRecs.length).toBeGreaterThan(0)
    })
  })

  describe('emergencyReplenishment', () => {
    it('should trigger all available platforms except quota-limited ones', async () => {
      process.env.AUTH_TOKEN = 'test-token'
      process.env.SITE_URL = 'https://test.vercel.app'
      
      // Mock multiple successful responses
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: async () => ({ totalFound: 5, processed: 3 })
      }))

      const result = await autoScanManager.emergencyReplenishment()

      expect(result.success).toBe(true)
      expect(result.triggeredScans.length).toBeGreaterThan(0)
      
      // Should skip YouTube due to quota limits
      const youtubeTriggered = result.triggeredScans.some(scan => scan.includes('youtube'))
      expect(youtubeTriggered).toBe(false)
      
      // Should trigger other platforms
      const redditTriggered = result.triggeredScans.some(scan => scan.includes('reddit'))
      expect(redditTriggered).toBe(true)
    })

    it('should handle partial failures in emergency mode', async () => {
      process.env.AUTH_TOKEN = 'test-token'
      process.env.SITE_URL = 'https://test.vercel.app'
      
      // Mock mixed success/failure responses
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ totalFound: 5, processed: 3 }) })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Error' })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ totalFound: 2, processed: 1 }) })

      const result = await autoScanManager.emergencyReplenishment()

      expect(result.triggeredScans.length).toBeGreaterThan(0)
      expect(result.errors.length).toBeGreaterThan(0)
      // Should still be successful if at least one scan succeeded
      expect(result.success).toBe(true)
    })
  })

  describe('GitHub Actions integration', () => {
    it('should attempt GitHub workflow before direct API', async () => {
      process.env.GITHUB_TOKEN = 'github-token'
      process.env.AUTH_TOKEN = 'auth-token'
      process.env.SITE_URL = 'https://test.vercel.app'
      
      // Mock GitHub API success
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Setup minimal content to trigger a scan
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES ('Test content', 'text', 'reddit', 'http://test.com', 'hash1', datetime('now'), 1, 0.8)
      `)

      const result = await autoScanManager.performAutoScan()

      // Should call GitHub API
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.github.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer github-token'
          })
        })
      )
    })

    it('should fallback to direct API when GitHub workflow fails', async () => {
      process.env.GITHUB_TOKEN = 'github-token'
      process.env.AUTH_TOKEN = 'auth-token'
      process.env.SITE_URL = 'https://test.vercel.app'
      
      // Mock GitHub API failure, then direct API success
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ totalFound: 5, processed: 3 }) })

      // Setup minimal content to trigger a scan
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES ('Test content', 'text', 'reddit', 'http://test.com', 'hash1', datetime('now'), 1, 0.8)
      `)

      const result = await autoScanManager.performAutoScan()

      expect(result.triggeredScans.length).toBeGreaterThan(0)
      expect(result.triggeredScans[0]).toContain('Direct API call')
    })
  })

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      process.env.AUTH_TOKEN = 'test-token'
      process.env.SITE_URL = 'https://test.vercel.app'
      
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'))

      // Setup minimal content to trigger a scan
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES ('Test content', 'text', 'reddit', 'http://test.com', 'hash1', datetime('now'), 1, 0.8)
      `)

      const result = await autoScanManager.performAutoScan()

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Network error')
    })

    it('should handle missing environment variables', async () => {
      // Don't set any environment variables
      
      // Setup minimal content to trigger a scan
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES ('Test content', 'text', 'reddit', 'http://test.com', 'hash1', datetime('now'), 1, 0.8)
      `)

      const result = await autoScanManager.performAutoScan()

      expect(result.success).toBe(false)
      expect(result.errors.some(error => error.includes('No SITE_URL'))).toBe(true)
    })
  })
})