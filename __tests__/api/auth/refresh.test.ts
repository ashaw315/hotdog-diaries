import { POST, GET } from '@/app/api/auth/refresh/route'
import { AuthService } from '@/lib/services/auth'
import { AdminService } from '@/lib/services/admin'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/services/auth')
jest.mock('@/lib/services/admin')
jest.mock('@/lib/db')

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>
const mockAdminService = AdminService as jest.Mocked<typeof AdminService>

describe('/api/auth/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SERVICE_ACCOUNT_SECRET = 'test-service-secret'
    process.env.JWT_SECRET = 'test-jwt-secret'
  })

  describe('POST /api/auth/refresh', () => {
    describe('Service Account Authentication', () => {
      it('should generate service token with valid service account secret', async () => {
        const mockServiceUser = {
          id: 999,
          username: 'service-account',
          email: 'service@hotdog-diaries.com',
          is_active: true
        }

        mockAdminService.getServiceAccount = jest.fn().mockResolvedValue(mockServiceUser)
        mockAuthService.generateServiceToken = jest.fn().mockReturnValue('service-token-123')

        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ serviceAccount: 'test-service-secret' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data).toEqual({
          accessToken: 'service-token-123',
          expiresIn: 30 * 24 * 60 * 60,
          tokenType: 'service'
        })
        expect(mockAuthService.generateServiceToken).toHaveBeenCalledWith(mockServiceUser)
      })

      it('should create service account if it does not exist', async () => {
        const mockNewServiceUser = {
          id: 1000,
          username: 'service-account',
          email: 'service@hotdog-diaries.com',
          is_active: true
        }

        mockAdminService.getServiceAccount = jest.fn().mockResolvedValue(null)
        mockAdminService.createServiceAccount = jest.fn().mockResolvedValue(mockNewServiceUser)
        mockAuthService.generateServiceToken = jest.fn().mockReturnValue('new-service-token')

        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ serviceAccount: 'test-service-secret' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.accessToken).toBe('new-service-token')
        expect(mockAdminService.createServiceAccount).toHaveBeenCalled()
      })

      it('should reject invalid service account secret', async () => {
        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ serviceAccount: 'invalid-secret' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Invalid service account credentials')
      })
    })

    describe('Refresh Token Authentication', () => {
      it('should refresh tokens with valid refresh token', async () => {
        const mockUser = {
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          is_active: true
        }

        const mockDecodedToken = {
          userId: 1,
          username: 'admin',
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 86400
        }

        mockAuthService.verifyRefreshToken = jest.fn().mockReturnValue(mockDecodedToken)
        mockAdminService.getAdminById = jest.fn().mockResolvedValue(mockUser)
        mockAdminService.updateLastActivity = jest.fn().mockResolvedValue(undefined)
        mockAuthService.generateTokens = jest.fn().mockReturnValue({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token'
        })

        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'valid-refresh-token' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data).toEqual({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 24 * 60 * 60,
          tokenType: 'bearer'
        })
        expect(mockAdminService.updateLastActivity).toHaveBeenCalledWith(1)
      })

      it('should reject expired refresh token', async () => {
        mockAuthService.verifyRefreshToken = jest.fn().mockImplementation(() => {
          throw new Error('Token has expired')
        })

        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'expired-token' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Invalid or expired refresh token')
      })

      it('should reject refresh token for non-existent user', async () => {
        const mockDecodedToken = {
          userId: 999,
          username: 'deleted-user',
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 86400
        }

        mockAuthService.verifyRefreshToken = jest.fn().mockReturnValue(mockDecodedToken)
        mockAdminService.getAdminById = jest.fn().mockResolvedValue(null)

        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'valid-token-deleted-user' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data.error).toBe('User not found')
      })

      it('should reject refresh token for inactive user', async () => {
        const mockUser = {
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          is_active: false
        }

        const mockDecodedToken = {
          userId: 1,
          username: 'admin',
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 86400
        }

        mockAuthService.verifyRefreshToken = jest.fn().mockReturnValue(mockDecodedToken)
        mockAdminService.getAdminById = jest.fn().mockResolvedValue(mockUser)

        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'valid-token-inactive-user' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.error).toBe('User account is inactive')
      })
    })

    describe('Error Handling', () => {
      it('should return 400 when no token provided', async () => {
        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({})
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Refresh token is required')
      })

      it('should handle malformed JSON', async () => {
        const request = new NextRequest('http://localhost/api/auth/refresh', {
          method: 'POST',
          body: 'invalid-json'
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Token refresh failed')
      })
    })
  })

  describe('GET /api/auth/refresh', () => {
    it('should return health check information', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        status: 'healthy',
        endpoint: '/api/auth/refresh',
        methods: ['POST'],
        description: 'Token refresh endpoint for access token renewal'
      })
    })
  })
})