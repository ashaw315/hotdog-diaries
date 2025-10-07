import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/admin/queue-health/route'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

// Mock dependencies
vi.mock('@/lib/services/logging', () => ({
  loggingService: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn()
  }
}))

vi.mock('@/lib/services/auto-scan-manager', () => ({
  autoScanManager: {
    getScanStatus: vi.fn(),
    performAutoScan: vi.fn(),
    emergencyReplenishment: vi.fn()
  }
}))

describe('Queue Health API', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup test environment
    process.env.AUTH_TOKEN = 'test-auth-token'
    
    // Setup test database
    await db.connect()
    await db.query('DELETE FROM posted_content WHERE 1=1')
    await db.query('DELETE FROM content_queue WHERE 1=1')
  })

  afterEach(async () => {
    await db.disconnect()
    delete process.env.AUTH_TOKEN
  })

  describe('GET /api/admin/queue-health', () => {
    it('should return unauthorized without auth token', async () => {
      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return queue health with correct auth token', async () => {
      // Setup test data
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES 
        ('Content 1', 'text', 'reddit', 'http://test1.com', 'hash1', datetime('now'), 1, 0.8),
        ('Content 2', 'image', 'pixabay', 'http://test2.com', 'hash2', datetime('now'), 1, 0.7),
        ('Content 3', 'video', 'youtube', 'http://test3.com', 'hash3', datetime('now'), 1, 0.9)
      `)

      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-auth-token'
        }
      })

      // Mock auto-scan manager response
      const { autoScanManager } = await import('@/lib/services/auto-scan-manager')
      vi.mocked(autoScanManager.getScanStatus).mockResolvedValue({
        queueHealth: {
          totalApproved: 3,
          daysOfContent: 0.5,
          platformBalance: { reddit: 0.33, pixabay: 0.33, youtube: 0.33 },
          isHealthy: false,
          issues: ['Queue too small']
        },
        recommendations: [
          { platform: 'giphy', priority: 'high', reason: 'No content available', contentType: 'gif' }
        ],
        nextScanTime: '2023-01-01T12:00:00.000Z'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.health).toMatchObject({
        status: expect.stringMatching(/healthy|warning|critical|emergency/),
        color: expect.any(String),
        message: expect.any(String),
        score: expect.any(Number),
        isHealthy: expect.any(Boolean)
      })
      expect(data.queue).toMatchObject({
        totalApproved: 3,
        totalPending: expect.any(Number),
        daysOfContent: expect.any(Number),
        optimalDays: 7,
        needsScanning: expect.any(Boolean)
      })
      expect(data.diversity).toMatchObject({
        platformCount: expect.any(Number),
        totalPlatforms: 8,
        diversityScore: expect.any(Number),
        contentTypeBalanceScore: expect.any(Number),
        topPlatforms: expect.any(Array),
        contentTypes: expect.any(Array)
      })
    })

    it('should detect emergency status when queue is empty', async () => {
      // No content in database
      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-auth-token'
        }
      })

      // Mock auto-scan manager response
      const { autoScanManager } = await import('@/lib/services/auto-scan-manager')
      vi.mocked(autoScanManager.getScanStatus).mockResolvedValue({
        queueHealth: {
          totalApproved: 0,
          daysOfContent: 0,
          platformBalance: {},
          isHealthy: false,
          issues: ['No content available']
        },
        recommendations: [],
        nextScanTime: '2023-01-01T12:00:00.000Z'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.health.status).toBe('emergency')
      expect(data.health.message).toContain('EMERGENCY')
      expect(data.queue.totalApproved).toBe(0)
    })

    it('should detect critical status when queue is very low', async () => {
      // Setup minimal content (less than 2 days)
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES ('Content 1', 'text', 'reddit', 'http://test1.com', 'hash1', datetime('now'), 1, 0.8)
      `)

      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-auth-token'
        }
      })

      // Mock auto-scan manager response
      const { autoScanManager } = await import('@/lib/services/auto-scan-manager')
      vi.mocked(autoScanManager.getScanStatus).mockResolvedValue({
        queueHealth: {
          totalApproved: 1,
          daysOfContent: 0.17,
          platformBalance: { reddit: 1.0 },
          isHealthy: false,
          issues: ['Queue too small']
        },
        recommendations: [],
        nextScanTime: '2023-01-01T12:00:00.000Z'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.health.status).toBe('critical')
      expect(data.health.message).toContain('CRITICAL')
    })

    it('should provide recommended actions based on queue state', async () => {
      // Setup low content scenario
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES ('Content 1', 'text', 'reddit', 'http://test1.com', 'hash1', datetime('now'), 1, 0.8)
      `)

      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-auth-token'
        }
      })

      // Mock auto-scan manager response
      const { autoScanManager } = await import('@/lib/services/auto-scan-manager')
      vi.mocked(autoScanManager.getScanStatus).mockResolvedValue({
        queueHealth: {
          totalApproved: 1,
          daysOfContent: 0.17,
          platformBalance: { reddit: 1.0 },
          isHealthy: false,
          issues: ['Queue too small']
        },
        recommendations: [
          { platform: 'youtube', priority: 'high', reason: 'No video content', contentType: 'video' },
          { platform: 'giphy', priority: 'medium', reason: 'Low GIF content', contentType: 'gif' }
        ],
        nextScanTime: '2023-01-01T12:00:00.000Z'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.actions.recommendedActions).toContain('URGENT: Trigger auto-scan for priority platforms')
      expect(data.actions.recommendedActions.some(action => action.includes('youtube'))).toBe(true)
      expect(data.recommendations.immediate).toHaveLength(1)
      expect(data.recommendations.suggested).toHaveLength(1)
    })
  })

  describe('POST /api/admin/queue-health', () => {
    it('should return unauthorized without auth token', async () => {
      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should trigger auto-scan with correct auth token', async () => {
      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-auth-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ action: 'auto-scan' })
      })

      // Mock auto-scan manager response
      const { autoScanManager } = await import('@/lib/services/auto-scan-manager')
      vi.mocked(autoScanManager.performAutoScan).mockResolvedValue({
        success: true,
        triggeredScans: ['reddit: GitHub Actions workflow'],
        skippedScans: ['youtube: Already scanned recently'],
        errors: [],
        queueHealth: {
          totalApproved: 5,
          daysOfContent: 0.83,
          platformBalance: { reddit: 1.0 },
          isHealthy: false,
          issues: []
        },
        recommendations: []
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.action).toBe('auto-scan')
      expect(data.emergency).toBe(false)
      expect(data.result.success).toBe(true)
      expect(data.result.triggeredScans).toHaveLength(1)
    })

    it('should trigger emergency replenishment when requested', async () => {
      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-auth-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ action: 'auto-scan', emergency: true })
      })

      // Mock emergency replenishment response
      const { autoScanManager } = await import('@/lib/services/auto-scan-manager')
      vi.mocked(autoScanManager.emergencyReplenishment).mockResolvedValue({
        success: true,
        triggeredScans: [
          'reddit: Direct API call',
          'pixabay: GitHub Actions workflow',
          'giphy: Direct API call'
        ],
        skippedScans: [],
        errors: [],
        queueHealth: {
          totalApproved: 15,
          daysOfContent: 2.5,
          platformBalance: { reddit: 0.4, pixabay: 0.3, giphy: 0.3 },
          isHealthy: true,
          issues: []
        },
        recommendations: []
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.emergency).toBe(true)
      expect(data.result.triggeredScans).toHaveLength(3)
      expect(vi.mocked(autoScanManager.emergencyReplenishment)).toHaveBeenCalled()
    })

    it('should reject unknown actions', async () => {
      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-auth-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ action: 'unknown-action' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Unknown action')
    })

    it('should handle auto-scan manager errors gracefully', async () => {
      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-auth-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ action: 'auto-scan' })
      })

      // Mock auto-scan manager error
      const { autoScanManager } = await import('@/lib/services/auto-scan-manager')
      vi.mocked(autoScanManager.performAutoScan).mockRejectedValue(new Error('Network error'))

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Network error')
    })
  })

  describe('Integration with queue manager', () => {
    it('should calculate content type percentages correctly', async () => {
      // Setup diverse content
      await db.query(`
        INSERT INTO content_queue (content_text, content_type, source_platform, original_url, content_hash, scraped_at, is_approved, confidence_score)
        VALUES 
        ('Video 1', 'video', 'youtube', 'http://test1.com', 'hash1', datetime('now'), 1, 0.9),
        ('Video 2', 'video', 'youtube', 'http://test2.com', 'hash2', datetime('now'), 1, 0.8),
        ('Image 1', 'image', 'pixabay', 'http://test3.com', 'hash3', datetime('now'), 1, 0.7),
        ('GIF 1', 'gif', 'giphy', 'http://test4.com', 'hash4', datetime('now'), 1, 0.6),
        ('Text 1', 'text', 'reddit', 'http://test5.com', 'hash5', datetime('now'), 1, 0.5)
      `)

      const request = new NextRequest('http://localhost/api/admin/queue-health', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-auth-token'
        }
      })

      // Mock auto-scan manager response
      const { autoScanManager } = await import('@/lib/services/auto-scan-manager')
      vi.mocked(autoScanManager.getScanStatus).mockResolvedValue({
        queueHealth: {
          totalApproved: 5,
          daysOfContent: 0.83,
          platformBalance: { youtube: 0.4, pixabay: 0.2, giphy: 0.2, reddit: 0.2 },
          isHealthy: false,
          issues: []
        },
        recommendations: [],
        nextScanTime: '2023-01-01T12:00:00.000Z'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.diversity.contentTypes).toHaveLength(4)
      
      // Check video content type
      const videoType = data.diversity.contentTypes.find((ct: any) => ct.type === 'video')
      expect(videoType).toBeDefined()
      expect(videoType.count).toBe(2)
      expect(parseFloat(videoType.percentage)).toBe(40.0)
      expect(parseFloat(videoType.target)).toBe(30.0)
    })
  })
})