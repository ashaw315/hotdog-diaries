/**
 * Centralized authentication mocks for test suite
 * Supports both new consolidated API auth and legacy auth systems
 */

import { jest } from '@jest/globals'

// Mock for new consolidated API middleware
export function mockVerifyAdminAuth(success: boolean = true) {
  const mockAuth = jest.fn()
  
  if (success) {
    mockAuth.mockResolvedValue({
      success: true,
      user: { id: 1, username: 'admin' }
    })
  } else {
    mockAuth.mockResolvedValue({
      success: false,
      user: null
    })
  }

  jest.doMock('@/lib/api-middleware', () => ({
    verifyAdminAuth: mockAuth,
    createSuccessResponse: jest.fn((data, message) => 
      Response.json({ success: true, data, message })
    ),
    createApiError: jest.fn((message, status, code) => {
      const error = new Error(message)
      error.statusCode = status
      error.code = code
      return error
    }),
    handleApiError: jest.fn((error, request, endpoint) => {
      const status = error.statusCode || 500
      const message = error.message || 'Internal server error'
      return Response.json({ error: message }, { status })
    }),
    validateRequestMethod: jest.fn(),
    withErrorHandling: jest.fn((handler, endpoint) => {
      return async (request) => {
        try {
          return await handler(request)
        } catch (error) {
          const status = error.statusCode || 500
          const message = error.message || 'Internal server error'
          return Response.json({ error: message }, { status })
        }
      }
    }),
    validateJsonBody: jest.fn((schema) => (data) => data)
  }))

  return mockAuth
}

// Mock for legacy NextAuthUtils system
export function mockNextAuthUtils(success: boolean = true) {
  const mockAuth = jest.fn()
  
  if (success) {
    mockAuth.mockResolvedValue({
      isValid: true,
      user: { id: 1, username: 'admin' }
    })
  } else {
    mockAuth.mockResolvedValue({
      isValid: false,
      user: null
    })
  }

  jest.doMock('@/lib/auth', () => ({
    NextAuthUtils: {
      verifyRequestAuth: mockAuth,
      getAuthTokenFromRequest: jest.fn().mockReturnValue('mock-token'),
      generateJWT: jest.fn().mockReturnValue('mock-jwt-token'),
      verifyJWT: jest.fn().mockReturnValue({ userId: 1, username: 'admin' })
    }
  }))

  return mockAuth
}

// Helper to mock authentication failure for testing unauthorized access
export function mockAuthFailure(authSystem: 'new' | 'legacy' = 'new') {
  if (authSystem === 'new') {
    return mockVerifyAdminAuth(false)
  } else {
    return mockNextAuthUtils(false)
  }
}

// Helper to get the appropriate auth mock based on endpoint type
export function getAuthMockForEndpoint(endpoint: string) {
  // Consolidated endpoints use new auth system
  const consolidatedEndpoints = [
    '/api/admin/content',
    '/api/admin/auth', 
    '/api/admin/platforms',
    '/api/admin/analytics'
  ]
  
  const isConsolidated = consolidatedEndpoints.some(consolidated => 
    endpoint.startsWith(consolidated)
  )
  
  return isConsolidated ? 'new' : 'legacy'
}

// Mock for API middleware functions
export function mockApiMiddleware() {
  jest.doMock('@/lib/api-middleware', () => ({
    validateRequestMethod: jest.fn(),
    createSuccessResponse: jest.fn().mockImplementation((data, message, status = 200) => ({
      json: () => Promise.resolve({ success: true, data, message }),
      status,
      headers: new Headers([
        ['Set-Cookie', 'auth-token=test; HttpOnly'],
        ['X-Content-Type-Options', 'nosniff'],
        ['X-Frame-Options', 'DENY']
      ])
    })),
    createApiError: jest.fn().mockImplementation((message, status, code) => {
      const error = new Error(message)
      error.statusCode = status
      error.code = code
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
    })),
    withErrorHandling: jest.fn((handler) => handler)
  }))
}

// Mock for API deprecation middleware
export function mockDeprecation() {
  jest.doMock('@/lib/api-deprecation', () => ({
    createDeprecatedHandler: jest.fn().mockImplementation((endpoint, handler) => {
      // Return a wrapper that handles headers properly and forwards to handler
      return async (request) => {
        try {
          // Mock a response with proper headers object
          const result = await handler(request)
          if (result && typeof result === 'object' && result.headers) {
            // Ensure headers is a proper Headers object, not Map
            if (!(result.headers instanceof Headers)) {
              const headers = new Headers()
              if (result.headers instanceof Map) {
                for (const [key, value] of result.headers) {
                  headers.set(key, value)
                }
              }
              result.headers = headers
            }
          }
          return result
        } catch (error) {
          throw error
        }
      }
    })
  }))

  // Also mock auth validation since the login route uses it
  jest.doMock('@/lib/auth', () => ({
    NextAuthUtils: {
      setAuthCookies: jest.fn()
    },
    AuthValidation: {
      validateLoginCredentials: jest.fn().mockReturnValue({
        isValid: true,
        errors: []
      }),
      sanitizeUsername: jest.fn().mockImplementation((username) => 
        username.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
      )
    }
  }))

  // Mock auth-edge utilities
  jest.doMock('@/lib/auth-edge', () => ({
    EdgeAuthUtils: {
      setAuthCookies: jest.fn()
    }
  }))
}