import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/middleware'

// Mock NextResponse  
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    next: jest.fn(() => ({ 
      headers: new Headers(),
      cookies: { 
        set: jest.fn(),
        get: jest.fn() 
      }
    })),
    redirect: jest.fn(() => ({ 
      headers: new Headers(),
      cookies: { 
        set: jest.fn() 
      }
    })),
    json: jest.fn(() => ({ 
      headers: new Headers(),
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

  describe('Disabled middleware (current state)', () => {
    it('should allow all requests to pass through', async () => {
      const request = createMockRequest('/admin')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })

    it('should allow access to protected routes', async () => {
      const request = createMockRequest('/api/admin/content')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })

    it('should allow access to public routes', async () => {
      const request = createMockRequest('/')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })

    it('should allow access to login routes', async () => {
      const request = createMockRequest('/admin/login')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })

    it('should allow API routes', async () => {
      const request = createMockRequest('/api/admin/auth', 'POST')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
    })
  })

  describe('Middleware configuration', () => {
    it('should have empty matcher (disabled)', () => {
      const config = require('@/middleware').config
      expect(config.matcher).toEqual([])
    })

    it('should be defined and callable', () => {
      expect(middleware).toBeDefined()
      expect(typeof middleware).toBe('function')
    })
  })
})