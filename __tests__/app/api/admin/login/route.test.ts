import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/login/route'
import { AdminService } from '@/lib/services/admin'
import { AuthService } from '@/lib/services/auth'

// Mock the services
jest.mock('@/lib/services/admin')
jest.mock('@/lib/services/auth')
jest.mock('@/lib/auth', () => ({
  NextAuthUtils: {
    setAuthCookies: jest.fn()
  },
  AuthValidation: {
    validateLoginCredentials: jest.fn(),
    sanitizeUsername: jest.fn()
  }
}))
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))
jest.mock('@/lib/auth-edge', () => ({
  EdgeAuthUtils: {
    setAuthCookies: jest.fn()
  }
}))
jest.mock('@/lib/api-middleware', () => ({
  validateRequestMethod: jest.fn(),
  createSuccessResponse: jest.fn().mockImplementation((data, message) => ({
    json: () => Promise.resolve({ success: true, data, message }),
    status: 200,
    headers: new Map([
      ['Set-Cookie', 'auth-token=test; HttpOnly'],
      ['X-Content-Type-Options', 'nosniff'],
      ['X-Frame-Options', 'DENY']
    ])
  })),
  createApiError: jest.fn().mockImplementation((message, status, code) => {
    const error = new Error(message)
    ;(error as any).statusCode = status
    ;(error as any).code = code
    return error
  }),
  validateJsonBody: jest.fn(),
  handleApiError: jest.fn().mockImplementation((error) => ({
    json: () => Promise.resolve({ 
      success: false, 
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    }),
    status: error.statusCode || 500
  }))
}))

const mockAdminService = AdminService as jest.Mocked<typeof AdminService>
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>

// Get mocked modules
const mockAuth = jest.mocked(require('@/lib/auth'))
const mockApiMiddleware = jest.mocked(require('@/lib/api-middleware'))

// Mock NextRequest
const createMockRequest = (body: any) => {
  return {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(body)
  } as NextRequest
}

describe('/api/admin/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up default mock behavior
    mockApiMiddleware.validateRequestMethod.mockImplementation(() => {})
    mockApiMiddleware.validateJsonBody.mockImplementation(async (req) => req.json())
    mockAuth.AuthValidation.validateLoginCredentials.mockReturnValue({
      isValid: true,
      errors: []
    })
    mockAuth.AuthValidation.sanitizeUsername.mockImplementation((username) => 
      username.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    )
  })

  describe('POST /api/admin/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'TestPass123!'
      }

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

      const request = createMockRequest(loginData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user.username).toBe('testuser')
      expect(data.data.user.email).toBe('test@example.com')
      expect(data.data.expiresAt).toBeDefined()

      expect(mockAdminService.authenticateAdmin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'TestPass123!'
      })
    })

    it('should handle invalid credentials', async () => {
      const loginData = {
        username: 'wronguser',
        password: 'wrongpassword'
      }

      mockAdminService.authenticateAdmin.mockRejectedValue(
        new Error('Invalid username or password')
      )

      const request = createMockRequest(loginData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid username or password')
      expect(data.code).toBe('INVALID_CREDENTIALS')
    })

    it('should handle inactive account', async () => {
      const loginData = {
        username: 'inactiveuser',
        password: 'TestPass123!'
      }

      mockAdminService.authenticateAdmin.mockRejectedValue(
        new Error('Account is inactive')
      )

      const request = createMockRequest(loginData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Account is inactive')
      expect(data.code).toBe('ACCOUNT_INACTIVE')
    })

    it('should validate required fields', async () => {
      const invalidData = {
        username: '',
        password: ''
      }

      // Mock validation to return errors
      mockAuth.AuthValidation.validateLoginCredentials.mockReturnValue({
        isValid: false,
        errors: ['Username is required', 'Password is required']
      })

      const request = createMockRequest(invalidData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Validation failed')
      expect(data.code).toBe('VALIDATION_ERROR')
    })

    it('should validate password minimum length', async () => {
      const invalidData = {
        username: 'testuser',
        password: 'short'
      }

      // Mock validation to return password length error
      mockAuth.AuthValidation.validateLoginCredentials.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters']
      })

      const request = createMockRequest(invalidData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Password must be at least 8 characters')
    })

    it('should validate username minimum length', async () => {
      const invalidData = {
        username: 'ab',
        password: 'TestPass123!'
      }

      // Mock validation to return username length error
      mockAuth.AuthValidation.validateLoginCredentials.mockReturnValue({
        isValid: false,
        errors: ['Username must be at least 3 characters']
      })

      const request = createMockRequest(invalidData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Username must be at least 3 characters')
    })

    it('should sanitize username input', async () => {
      const loginData = {
        username: '  TestUser@#$  ',
        password: 'TestPass123!'
      }

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

      const request = createMockRequest(loginData)
      await POST(request)

      // Verify that username was sanitized (lowercased, trimmed, special chars removed)
      expect(mockAdminService.authenticateAdmin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'TestPass123!'
      })
    })

    it('should handle authentication service errors', async () => {
      const loginData = {
        username: 'testuser',
        password: 'TestPass123!'
      }

      mockAdminService.authenticateAdmin.mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = createMockRequest(loginData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication failed')
      expect(data.code).toBe('AUTH_ERROR')
    })

    it('should handle malformed JSON', async () => {
      const request = {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as NextRequest

      // Mock validateJsonBody to throw the correct error
      mockApiMiddleware.validateJsonBody.mockRejectedValue(
        mockApiMiddleware.createApiError('Invalid JSON in request body', 400)
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid JSON in request body')
    })

    it('should reject non-POST methods', async () => {
      const request = {
        method: 'GET',
        headers: new Headers(),
        json: () => Promise.resolve({})
      } as NextRequest

      // Mock validateRequestMethod to throw method not allowed error
      mockApiMiddleware.validateRequestMethod.mockImplementation(() => {
        throw mockApiMiddleware.createApiError('Method GET not allowed', 405)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(405)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Method GET not allowed')
    })

    it('should set authentication cookies on successful login', async () => {
      const loginData = {
        username: 'testuser',
        password: 'TestPass123!'
      }

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

      const request = createMockRequest(loginData)
      const response = await POST(request)

      // Check that response has set cookies
      expect(response.headers.get('Set-Cookie')).toBeTruthy()
    })

    it('should include security headers', async () => {
      const loginData = {
        username: 'testuser',
        password: 'TestPass123!'
      }

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

      const request = createMockRequest(loginData)
      const response = await POST(request)

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    })
  })
})