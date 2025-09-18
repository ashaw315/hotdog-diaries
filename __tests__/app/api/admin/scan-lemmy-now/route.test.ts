import { POST } from '@/app/api/admin/scan-lemmy-now/route'
import { NextRequest } from 'next/server'

// Mock the Lemmy scanning service with factory function to avoid hoisting issues
jest.mock('@/lib/services/lemmy-scanning', () => {
  const mockLemmyScanningService = {
    performScan: jest.fn(),
    testConnection: jest.fn()
  }
  
  return {
    lemmyScanningService: mockLemmyScanningService
  }
})

describe('/api/admin/scan-lemmy-now', () => {
  let mockLemmyScanningService: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mock service instance
    const { lemmyScanningService } = require('@/lib/services/lemmy-scanning')
    mockLemmyScanningService = lemmyScanningService
  })

  describe('POST', () => {
    it('should successfully trigger Lemmy federated scan with admin auth', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities',
        details: { 
          communityResults: [
            {
              community: 'lemmy.world/c/hot_dog',
              success: true,
              postsFound: 15,
              description: 'Main hotdog community - 185 subscribers, active moderation'
            },
            {
              community: 'lemmy.world/c/food',
              success: true,
              postsFound: 22,
              description: 'General food community - may have hotdog content'
            }
          ]
        }
      }

      const mockScanResult = {
        totalFound: 28,
        processed: 22,
        approved: 16,
        rejected: 6,
        duplicates: 6,
        errors: []
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      // Create request with admin authorization header
      const adminToken = Buffer.from(JSON.stringify({ username: 'admin', id: 1 })).toString('base64')
      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ maxPosts: 20 })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockLemmyScanningService.testConnection).toHaveBeenCalled()
      expect(mockLemmyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Successfully added 16 Lemmy posts')
      expect(data.posts_added).toBe(16)
      expect(data.stats.totalFound).toBe(28)
      expect(data.stats.processed).toBe(22)
      expect(data.stats.approved).toBe(16)
      expect(data.stats.rejected).toBe(6)
      expect(data.stats.duplicates).toBe(6)
      expect(data.stats.platform).toBe('lemmy')
      expect(data.stats.federatedCommunities).toEqual(['lemmy.world/c/hot_dog', 'lemmy.world/c/food'])
    })

    it('should successfully trigger Lemmy scan with header auth', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities'
      }

      const mockScanResult = {
        totalFound: 15,
        processed: 12,
        approved: 9,
        rejected: 3,
        duplicates: 3,
        errors: []
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.posts_added).toBe(9)
    })

    it('should handle partial federated community connectivity', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 1/2 Lemmy communities',
        details: { 
          communityResults: [
            {
              community: 'lemmy.world/c/hot_dog',
              success: true,
              postsFound: 8,
              description: 'Main hotdog community - 185 subscribers, active moderation'
            },
            {
              community: 'lemmy.ml/c/food',
              success: false,
              error: 'Instance temporarily unavailable',
              description: 'Alternative food community'
            }
          ]
        }
      }

      const mockScanResult = {
        totalFound: 12,
        processed: 10,
        approved: 7,
        rejected: 3,
        duplicates: 2,
        errors: ['lemmy.ml instance unreachable']
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Successfully added 7 Lemmy posts')
      expect(data.stats.errors).toBe(1) // Number of error messages
    })

    it('should handle case with no approved posts', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities'
      }

      const mockScanResult = {
        totalFound: 18,
        processed: 18,
        approved: 0, // No posts approved
        rejected: 18,
        duplicates: 0,
        errors: []
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.message).toContain('No new content added')
      expect(data.posts_added).toBe(0)
    })

    it('should handle complete federated network failure', async () => {
      const mockConnectionTest = {
        success: false,
        message: 'Connected to 0/2 Lemmy communities',
        details: { 
          communityResults: [
            {
              community: 'lemmy.world/c/hot_dog',
              success: false,
              error: 'Connection timeout',
              description: 'Main hotdog community - 185 subscribers, active moderation'
            },
            {
              community: 'lemmy.world/c/food',
              success: false,
              error: 'Server error 500',
              description: 'General food community - may have hotdog content'
            }
          ]
        }
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Lemmy federated network connection failed')
      expect(data.posts_added).toBe(0)
    })

    it('should handle authentication failure', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST'
        // No authentication headers
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle scan failure', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities'
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockRejectedValue(
        new Error('Lemmy federated network overloaded')
      )

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('federated network overloaded')
      expect(data.posts_added).toBe(0)
    })

    it('should use default maxPosts when not provided', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities'
      }

      const mockScanResult = {
        totalFound: 18,
        processed: 15,
        approved: 11,
        rejected: 4,
        duplicates: 3,
        errors: []
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
        // No body provided
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockLemmyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle invalid JSON body gracefully', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities'
      }

      const mockScanResult = {
        totalFound: 12,
        processed: 10,
        approved: 7,
        rejected: 3,
        duplicates: 2,
        errors: []
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        },
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      // Should use default maxPosts (20) when JSON is invalid
      expect(mockLemmyScanningService.performScan).toHaveBeenCalledWith({ maxPosts: 20 })
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle scan with federated errors but some success', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 1/2 Lemmy communities'
      }

      const mockScanResult = {
        totalFound: 20,
        processed: 15,
        approved: 10,
        rejected: 5,
        duplicates: 5,
        errors: ['Failed to fetch from beehaw.org due to federation issues', 'ActivityPub timeout for lemmy.ml']
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true) // Still successful because some posts were approved
      expect(data.posts_added).toBe(10)
      expect(data.stats.errors).toBe(2) // Number of error messages
    })

    it('should include federated community information in response', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities',
        details: { 
          communityResults: [
            {
              community: 'lemmy.world/c/hot_dog',
              success: true,
              postsFound: 15
            },
            {
              community: 'lemmy.world/c/food',
              success: true,
              postsFound: 12
            }
          ]
        }
      }

      const mockScanResult = {
        totalFound: 25,
        processed: 20,
        approved: 14,
        rejected: 6,
        duplicates: 5,
        errors: []
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stats.platform).toBe('lemmy')
      expect(data.stats.federatedCommunities).toEqual(['lemmy.world/c/hot_dog', 'lemmy.world/c/food'])
      expect(data.posts_added).toBe(14)
    })

    it('should handle ActivityPub federation delays', async () => {
      const mockConnectionTest = {
        success: true,
        message: 'Connected to 2/2 Lemmy communities'
      }

      const mockScanResult = {
        totalFound: 16,
        processed: 12,
        approved: 8,
        rejected: 4,
        duplicates: 0,
        errors: ['ActivityPub federation lag detected for some instances']
      }

      mockLemmyScanningService.testConnection.mockResolvedValue(mockConnectionTest)
      mockLemmyScanningService.performScan.mockResolvedValue(mockScanResult)

      const request = new NextRequest('http://localhost:3000/api/admin/scan-lemmy-now', {
        method: 'POST',
        headers: {
          'x-user-id': '1',
          'x-username': 'admin'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.posts_added).toBe(8)
      expect(data.stats.errors).toBe(1)
    })
  })
})