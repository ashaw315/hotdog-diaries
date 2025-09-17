import { NextRequest } from 'next/server'
import { AdminService } from '@/lib/services/admin'
import { AuthService } from '@/lib/services/auth'

// Mock all dependencies first
jest.mock('@/lib/services/admin')
jest.mock('@/lib/services/auth')
jest.mock('@/lib/auth')
jest.mock('@/lib/db')
jest.mock('@/lib/auth-edge', () => ({
  EdgeAuthUtils: {
    setAuthCookies: jest.fn()
  }
}))
jest.mock('@/lib/api-middleware')
jest.mock('@/lib/api-deprecation')
jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn()
}))

// Mock the consolidated auth endpoint that the deprecated handler forwards to
jest.mock('@/app/api/admin/auth/route', () => ({
  POST: jest.fn()
}))

const mockAdminService = AdminService as jest.Mocked<typeof AdminService>
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>

// Mock NextRequest
const createMockRequest = (body: any) => {
  return {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(body)
  } as NextRequest
}

describe('/api/admin/login', () => {
  let POST: jest.MockedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock implementations
    const mockAuth = require('@/lib/auth')
    mockAuth.AuthValidation = {
      validateLoginCredentials: jest.fn().mockReturnValue({
        isValid: true,
        errors: []
      }),
      sanitizeUsername: jest.fn().mockImplementation((username) => 
        username.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
      )
    }
    mockAuth.NextAuthUtils = {
      setAuthCookies: jest.fn()
    }

    // EdgeAuthUtils is already mocked above, just get reference
    const mockAuthEdge = require('@/lib/auth-edge')

    const mockApiMiddleware = require('@/lib/api-middleware')
    mockApiMiddleware.validateRequestMethod = jest.fn()
    mockApiMiddleware.validateJsonBody = jest.fn().mockImplementation(async (req) => req.json())
    mockApiMiddleware.createSuccessResponse = jest.fn().mockImplementation((data, message) => ({
      json: () => Promise.resolve({ success: true, data, message }),
      status: 200,
      headers: new Headers([
        ['Set-Cookie', 'auth-token=test; HttpOnly'],
        ['X-Content-Type-Options', 'nosniff'],
        ['X-Frame-Options', 'DENY']
      ])
    }))
    mockApiMiddleware.createApiError = jest.fn().mockImplementation((message, status, code) => {
      const error = new Error(message)
      error.statusCode = status
      error.code = code
      return error
    })
    mockApiMiddleware.handleApiError = jest.fn().mockImplementation((error) => ({
      json: () => Promise.resolve({ 
        success: false, 
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      }),
      status: error.statusCode || 500
    }))

    // Mock the deprecation handler to forward to the auth endpoint
    const mockDeprecation = require('@/lib/api-deprecation')
    mockDeprecation.createDeprecatedHandler = jest.fn().mockImplementation((endpoint, handler) => {
      return handler // Just return the handler directly for testing
    })

    // Get the mocked auth POST endpoint
    const mockAuthRoute = require('@/app/api/admin/auth/route')
    POST = mockAuthRoute.POST
    
    // Set up a default successful response
    POST.mockResolvedValue({
      json: () => Promise.resolve({ 
        success: true, 
        data: {
          user: { id: 1, username: 'testuser' },
          expiresAt: new Date()
        }
      }),
      status: 200,
      headers: new Headers([['Set-Cookie', 'auth-token=test; HttpOnly']])
    })
  })

  describe('POST /api/admin/login', () => {
    it('should forward to auth endpoint successfully', async () => {
      const loginData = {
        username: 'testuser',
        password: 'TestPass123!'
      }

      const request = createMockRequest(loginData)
      
      // Import and call the POST handler
      const { POST: loginPOST } = await import('@/app/api/admin/login/route')
      const response = await loginPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(POST).toHaveBeenCalledWith(request)
    })

    it('should handle auth endpoint errors', async () => {
      const loginData = {
        username: 'wronguser',
        password: 'wrongpassword'
      }

      // Mock auth endpoint to return error
      POST.mockResolvedValue({
        json: () => Promise.resolve({ 
          success: false, 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        }),
        status: 401
      })

      const request = createMockRequest(loginData)
      
      const { POST: loginPOST } = await import('@/app/api/admin/login/route')
      const response = await loginPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid credentials')
      expect(POST).toHaveBeenCalledWith(request)
    })

    it('should fallback to original handler if auth endpoint fails', async () => {
      const loginData = {
        username: 'testuser',
        password: 'TestPass123!'
      }

      // Mock successful authentication result
      const mockAuthResult = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          full_name: 'Test User',
          is_active: true,
          created_at: new Date(),
          last_login_at: new Date(),
          login_count: 1
        },
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        }
      }

      mockAdminService.authenticateAdmin.mockResolvedValue(mockAuthResult)

      // Make auth endpoint throw error to trigger fallback
      POST.mockRejectedValue(new Error('Auth endpoint failed'))

      const request = createMockRequest(loginData)
      
      const { POST: loginPOST } = await import('@/app/api/admin/login/route')
      const response = await loginPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user.username).toBe('testuser')
      expect(mockAdminService.authenticateAdmin).toHaveBeenCalled()
    })
  })
})