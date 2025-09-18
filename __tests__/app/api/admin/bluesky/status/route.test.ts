import { GET } from '@/app/api/admin/bluesky/status/route'
import { NextRequest } from 'next/server'

// Mock the Bluesky service with factory function to avoid hoisting issues
jest.mock('@/lib/services/bluesky-scanning', () => {
  const mockBlueskyService = {
    getScanConfig: jest.fn(),
    getScanningStats: jest.fn(),
    testConnection: jest.fn()
  }
  
  return {
    blueskyService: mockBlueskyService
  }
})

describe('/api/admin/bluesky/status', () => {
  let mockBlueskyService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mock service instance
    const { blueskyService } = require('@/lib/services/bluesky-scanning')
    mockBlueskyService = blueskyService
  })

  describe('GET', () => {
    it('should return healthy Bluesky status', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240,
        searchTerms: ['hotdog', 'hot dog'],
        lastScanTime: new Date('2024-01-01T10:00:00Z'),
        nextScanTime: new Date('2024-01-01T14:00:00Z')
      }

      const mockStats = {
        totalPostsFound: 120,
        postsApproved: 85,
        postsRejected: 35,
        successRate: 0.708
      }

      const mockConnection = {
        success: true,
        message: 'Bluesky connection successful',
        details: { authenticated: true }
      }

      mockBlueskyService.getScanConfig.mockResolvedValue(mockConfig)
      mockBlueskyService.getScanningStats.mockResolvedValue(mockStats)
      mockBlueskyService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/status')

      const response = await GET(request)
      const data = await response.json()

      expect(mockBlueskyService.getScanConfig).toHaveBeenCalled()
      expect(mockBlueskyService.getScanningStats).toHaveBeenCalled()
      expect(mockBlueskyService.testConnection).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.platform).toBe('bluesky')
      expect(data.data.isEnabled).toBe(true)
      expect(data.data.isAuthenticated).toBe(true)
      expect(data.data.connectionStatus).toBe('connected')
      expect(data.data.healthStatus).toBe('healthy')
      expect(data.data.stats.totalScanned).toBe(120)
      expect(data.data.stats.totalApproved).toBe(85)
      expect(data.data.stats.successRate).toBe(71) // Rounded percentage
      expect(data.data.capabilities.supportsVideo).toBe(true)
      expect(data.data.capabilities.supportsImages).toBe(true)
    })

    it('should return warning status when connection is good but success rate is low', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240,
        searchTerms: ['hotdog'],
        lastScanTime: new Date('2024-01-01T10:00:00Z'),
        nextScanTime: new Date('2024-01-01T14:00:00Z')
      }

      const mockStats = {
        totalPostsFound: 50,
        postsApproved: 15,
        postsRejected: 35,
        successRate: 0.3 // Low success rate
      }

      const mockConnection = {
        success: true,
        message: 'Bluesky connection successful',
        details: { authenticated: true }
      }

      mockBlueskyService.getScanConfig.mockResolvedValue(mockConfig)
      mockBlueskyService.getScanningStats.mockResolvedValue(mockStats)
      mockBlueskyService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.healthStatus).toBe('warning') // Due to low success rate
      expect(data.data.stats.successRate).toBe(30)
    })

    it('should return error status when connection fails', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240,
        searchTerms: ['hotdog'],
        lastScanTime: new Date('2024-01-01T10:00:00Z'),
        nextScanTime: new Date('2024-01-01T14:00:00Z')
      }

      const mockStats = {
        totalPostsFound: 0,
        postsApproved: 0,
        postsRejected: 0,
        successRate: 0
      }

      const mockConnection = {
        success: false,
        message: 'Bluesky authentication failed',
        details: { authenticated: false, error: 'Invalid credentials' }
      }

      mockBlueskyService.getScanConfig.mockResolvedValue(mockConfig)
      mockBlueskyService.getScanningStats.mockResolvedValue(mockStats)
      mockBlueskyService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isAuthenticated).toBe(false)
      expect(data.data.connectionStatus).toBe('error')
      expect(data.data.connectionMessage).toBe('Bluesky authentication failed')
      expect(data.data.healthStatus).toBe('error')
    })

    it('should return disabled service status', async () => {
      const mockConfig = {
        isEnabled: false,
        scanInterval: 240,
        searchTerms: ['hotdog'],
        lastScanTime: null,
        nextScanTime: null
      }

      const mockStats = {
        totalPostsFound: 0,
        postsApproved: 0,
        postsRejected: 0,
        successRate: 0
      }

      const mockConnection = {
        success: false,
        message: 'Bluesky service disabled',
        details: { authenticated: false }
      }

      mockBlueskyService.getScanConfig.mockResolvedValue(mockConfig)
      mockBlueskyService.getScanningStats.mockResolvedValue(mockStats)
      mockBlueskyService.testConnection.mockResolvedValue(mockConnection)

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isEnabled).toBe(false)
      expect(data.data.lastScanTime).toBeUndefined()
      expect(data.data.nextScanTime).toBeUndefined()
    })

    it('should handle service failure', async () => {
      mockBlueskyService.getScanConfig.mockRejectedValue(
        new Error('Failed to get Bluesky configuration')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to get Bluesky status')
      expect(data.details).toContain('Failed to get Bluesky configuration')
    })

    it('should handle partial service failures gracefully', async () => {
      const mockConfig = {
        isEnabled: true,
        scanInterval: 240,
        searchTerms: ['hotdog'],
        lastScanTime: new Date('2024-01-01T10:00:00Z'),
        nextScanTime: new Date('2024-01-01T14:00:00Z')
      }

      // Config succeeds, but stats and connection fail
      mockBlueskyService.getScanConfig.mockResolvedValue(mockConfig)
      mockBlueskyService.getScanningStats.mockRejectedValue(new Error('Stats unavailable'))
      mockBlueskyService.testConnection.mockRejectedValue(new Error('Connection test failed'))

      const request = new NextRequest('http://localhost:3000/api/admin/bluesky/status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to get Bluesky status')
    })
  })
})