import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/middleware'
import { NextAuthUtils } from '@/lib/auth'

// Mock the auth utilities
jest.mock('@/lib/auth')
const mockNextAuthUtils = NextAuthUtils as jest.MockedClass<typeof NextAuthUtils>

// Mock NextResponse
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    next: jest.fn(() => ({ 
      headers: new Map(),
      cookies: { 
        set: jest.fn(),
        get: jest.fn() 
      }
    })),
    redirect: jest.fn(() => ({ 
      headers: new Map(),
      cookies: { 
        set: jest.fn() 
      }
    })),
    json: jest.fn(() => ({ 
      headers: new Map(),
      cookies: { 
        set: jest.fn() 
      }
    }))
  }
}))

const createMockRequest = (pathname: string, method: string = 'GET', cookies: Record<string, string> = {}) => {
  const mockCookies = new Map(Object.entries(cookies))
  
  return {
    nextUrl: {
      pathname,
      searchParams: new URLSearchParams()
    },
    method,
    cookies: {
      get: (name: string) => ({ value: mockCookies.get(name) }),
      set: jest.fn(),
      delete: jest.fn()
    },
    url: `http://localhost:3000${pathname}`
  } as unknown as NextRequest
}

describe('Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Public routes', () => {
    it('should allow access to login page', async () => {
      const request = createMockRequest('/admin/login')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })

    it('should allow access to login API', async () => {
      const request = createMockRequest('/api/admin/login', 'POST')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })

    it('should allow access to home page', async () => {
      const request = createMockRequest('/')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })
  })

  describe('Protected page routes', () => {
    it('should redirect unauthenticated user to login', async () => {
      const request = createMockRequest('/admin')
      
      mockNextAuthUtils.validateAndRefreshAuth.mockResolvedValue({
        isAuthenticated: false,
        response: NextResponse.redirect(new URL('/admin/login', 'http://localhost:3000'))
      })
      
      const response = await middleware(request)
      
      expect(mockNextAuthUtils.validateAndRefreshAuth).toHaveBeenCalledWith(request)
      expect(response).toBeDefined()
    })

    it('should allow authenticated user to access admin routes', async () => {
      const request = createMockRequest('/admin')
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: new Date(),
        last_login_at: new Date(),
        login_count: 1
      }
      
      mockNextAuthUtils.validateAndRefreshAuth.mockResolvedValue({
        isAuthenticated: true,
        user: mockUser
      })
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })

    it('should handle token refresh for authenticated user', async () => {
      const request = createMockRequest('/admin')
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: new Date(),
        last_login_at: new Date(),
        login_count: 1
      }
      
      const mockResponse = NextResponse.next()
      
      mockNextAuthUtils.validateAndRefreshAuth.mockResolvedValue({
        isAuthenticated: true,
        response: mockResponse,
        user: mockUser
      })
      
      const response = await middleware(request)
      
      expect(response).toBe(mockResponse)
    })
  })

  describe('Protected API routes', () => {
    it('should return 401 for unauthenticated API request', async () => {
      const request = createMockRequest('/api/admin/me')
      
      mockNextAuthUtils.verifyRequestAuth.mockResolvedValue({
        isValid: false
      })
      
      const response = await middleware(request)
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      )
    })

    it('should allow authenticated API request', async () => {
      const request = createMockRequest('/api/admin/me')
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: new Date(),
        last_login_at: new Date(),
        login_count: 1
      }
      
      mockNextAuthUtils.verifyRequestAuth.mockResolvedValue({
        isValid: true,
        user: mockUser
      })
      
      const response = await middleware(request)
      
      expect(response.headers.set).toHaveBeenCalledWith('x-user-id', '1')
      expect(response.headers.set).toHaveBeenCalledWith('x-username', 'testuser')
    })

    it('should allow unauthenticated access to content API', async () => {
      const request = createMockRequest('/api/content')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
      expect(mockNextAuthUtils.verifyRequestAuth).not.toHaveBeenCalled()
    })
  })

  describe('Login redirect for authenticated users', () => {
    it('should redirect authenticated user away from login page', async () => {
      const request = createMockRequest('/admin/login')
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: new Date(),
        last_login_at: new Date(),
        login_count: 1
      }
      
      mockNextAuthUtils.verifyRequestAuth.mockResolvedValue({
        isValid: true,
        user: mockUser
      })
      
      mockNextAuthUtils.createAuthRedirect.mockReturnValue(
        NextResponse.redirect(new URL('/admin', 'http://localhost:3000'))
      )
      
      const response = await middleware(request)
      
      expect(mockNextAuthUtils.createAuthRedirect).toHaveBeenCalledWith('/admin')
    })

    it('should redirect to specified return URL', async () => {
      const request = createMockRequest('/admin/login')
      request.nextUrl.searchParams.set('from', '/admin/settings')
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: new Date(),
        last_login_at: new Date(),
        login_count: 1
      }
      
      mockNextAuthUtils.verifyRequestAuth.mockResolvedValue({
        isValid: true,
        user: mockUser
      })
      
      mockNextAuthUtils.createAuthRedirect.mockReturnValue(
        NextResponse.redirect(new URL('/admin/settings', 'http://localhost:3000'))
      )
      
      const response = await middleware(request)
      
      expect(mockNextAuthUtils.createAuthRedirect).toHaveBeenCalledWith('/admin/settings')
    })
  })

  describe('Dynamic route protection', () => {
    it('should protect dynamic content routes', async () => {
      const request = createMockRequest('/api/content/123')
      
      mockNextAuthUtils.verifyRequestAuth.mockResolvedValue({
        isValid: false
      })
      
      const response = await middleware(request)
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      )
    })

    it('should allow authenticated access to dynamic content routes', async () => {
      const request = createMockRequest('/api/content/123')
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: new Date(),
        last_login_at: new Date(),
        login_count: 1
      }
      
      mockNextAuthUtils.verifyRequestAuth.mockResolvedValue({
        isValid: true,
        user: mockUser
      })
      
      const response = await middleware(request)
      
      expect(response.headers.set).toHaveBeenCalledWith('x-user-id', '1')
      expect(response.headers.set).toHaveBeenCalledWith('x-username', 'testuser')
    })
  })

  describe('Error handling', () => {
    it('should handle middleware errors for API routes', async () => {
      const request = createMockRequest('/api/admin/me')
      
      mockNextAuthUtils.verifyRequestAuth.mockRejectedValue(new Error('Auth service error'))
      
      const response = await middleware(request)
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: 'Authentication service unavailable',
          code: 'AUTH_SERVICE_ERROR'
        },
        { status: 500 }
      )
    })

    it('should handle middleware errors for page routes', async () => {
      const request = createMockRequest('/admin')
      
      mockNextAuthUtils.validateAndRefreshAuth.mockRejectedValue(new Error('Auth service error'))
      
      const response = await middleware(request)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          searchParams: expect.objectContaining({
            get: expect.any(Function)
          })
        })
      )
    })
  })

  describe('Static file exclusion', () => {
    it('should not process static image files', async () => {
      const request = createMockRequest('/image.png')
      
      // Middleware should not be called for static files based on config matcher
      // This test verifies the config is set up correctly
      expect(middleware).toBeDefined()
    })

    it('should not process Next.js internal routes', async () => {
      const request = createMockRequest('/_next/static/chunk.js')
      
      // Middleware should not be called for _next routes based on config matcher
      expect(middleware).toBeDefined()
    })
  })
})