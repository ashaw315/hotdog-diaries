/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  withAdminMiddleware, 
  createErrorResponse, 
  createStructuredLog,
  AdminRequestContext 
} from '@/lib/middleware/admin-middleware'

describe('Admin Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('withAdminMiddleware', () => {
    it('should add request ID and cache-control headers', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withAdminMiddleware(mockHandler, {
        enableLogging: false
      })

      const request = new NextRequest('http://localhost:3000/api/admin/test')
      const response = await wrappedHandler(request)

      expect(response.headers.get('X-Request-ID')).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/) // ULID format
      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(mockHandler).toHaveBeenCalled()
    })

    it('should pass admin request context to handler', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withAdminMiddleware(mockHandler, {
        enableLogging: false
      })

      const request = new NextRequest('http://localhost:3000/api/admin/test', {
        method: 'POST'
      })
      await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          requestId: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
          startTime: expect.any(Number),
          path: '/api/admin/test',
          method: 'POST'
        })
      )
    })

    it('should handle timeout and return 504 response', async () => {
      const slowHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2s delay
        return NextResponse.json({ success: true })
      })

      const wrappedHandler = withAdminMiddleware(slowHandler, {
        timeoutMs: 500, // 500ms timeout
        enableLogging: false
      })

      const request = new NextRequest('http://localhost:3000/api/admin/slow')
      const response = await wrappedHandler(request)
      const data = await response.json()

      expect(response.status).toBe(504)
      expect(data).toEqual({
        ok: false,
        code: 'TIMEOUT',
        message: 'Request timed out after 500ms',
        rid: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
        timestamp: expect.any(String)
      })
    })

    it('should handle handler errors and return 500 response', async () => {
      const errorHandler = jest.fn().mockRejectedValue(
        new Error('Test error')
      )

      const wrappedHandler = withAdminMiddleware(errorHandler, {
        enableLogging: false
      })

      const request = new NextRequest('http://localhost:3000/api/admin/error')
      const response = await wrappedHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Test error',
        rid: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
        timestamp: expect.any(String)
      })
    })

    it('should add custom headers when provided', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withAdminMiddleware(mockHandler, {
        enableLogging: false,
        additionalHeaders: {
          'X-Custom-Header': 'test-value',
          'X-API-Version': '1.0'
        }
      })

      const request = new NextRequest('http://localhost:3000/api/admin/test')
      const response = await wrappedHandler(request)

      expect(response.headers.get('X-Custom-Header')).toBe('test-value')
      expect(response.headers.get('X-API-Version')).toBe('1.0')
    })

    it('should log structured request data when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log')
      
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 200 })
      )

      const wrappedHandler = withAdminMiddleware(mockHandler, {
        enableLogging: true
      })

      const request = new NextRequest('http://localhost:3000/api/admin/test')
      await wrappedHandler(request)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ADMIN] GET /api/admin/test 200'),
        expect.objectContaining({
          rid: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
          path: '/api/admin/test',
          method: 'GET',
          status: 200,
          duration_ms: expect.any(Number),
          timestamp: expect.any(String)
        })
      )
    })
  })

  describe('createErrorResponse', () => {
    it('should create properly formatted error response', () => {
      const response = createErrorResponse(
        'TEST_ERROR',
        'Test error message',
        'test-request-id',
        400
      )

      expect(response.status).toBe(400)
      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })

  describe('createStructuredLog', () => {
    it('should create properly formatted log entry', () => {
      const context: AdminRequestContext = {
        requestId: 'test-rid',
        startTime: Date.now() - 100,
        path: '/api/admin/test',
        method: 'GET'
      }

      const response = NextResponse.json({ success: true }, { status: 200 })
      const logEntry = createStructuredLog(context, response)

      expect(logEntry).toEqual({
        rid: 'test-rid',
        path: '/api/admin/test',
        method: 'GET',
        status: 200,
        duration_ms: expect.any(Number),
        timestamp: expect.any(String)
      })

      expect(logEntry.duration_ms).toBeGreaterThanOrEqual(100)
    })

    it('should include error message when provided', () => {
      const context: AdminRequestContext = {
        requestId: 'test-rid',
        startTime: Date.now(),
        path: '/api/admin/test',
        method: 'GET'
      }

      const response = NextResponse.json({}, { status: 500 })
      const error = new Error('Test error')
      const logEntry = createStructuredLog(context, response, error)

      expect(logEntry.error).toBe('Test error')
    })
  })
})