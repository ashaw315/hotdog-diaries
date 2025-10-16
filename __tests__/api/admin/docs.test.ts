import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/admin/docs/openapi/route'

// Mock EdgeAuthUtils for testing
jest.mock('@/lib/auth-edge', () => ({
  EdgeAuthUtils: {
    verifyJWT: jest.fn()
  }
}))

import { EdgeAuthUtils } from '@/lib/auth-edge'

describe('/api/admin/docs/openapi', () => {
  const mockVerifyJWT = EdgeAuthUtils.verifyJWT as jest.MockedFunction<typeof EdgeAuthUtils.verifyJWT>
  
  beforeAll(() => {
    // Setup mock implementations
    mockVerifyJWT.mockImplementation(async (token: string) => {
      if (token === 'valid-token') {
        return { userId: 1, username: 'admin' }
      }
      throw new Error('Invalid token')
    })
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  describe('Authentication', () => {
    it('should return 401 when no auth header is provided', async () => {
      const request = new NextRequest('http://localhost/api/admin/docs/openapi')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      
      const body = await response.json()
      expect(body).toEqual({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Admin authentication required',
        rid: expect.stringMatching(/^req_\d+_[a-z0-9]+$/)
      })
    })

    it('should return 401 when invalid Bearer token is provided', async () => {
      const request = new NextRequest('http://localhost/api/admin/docs/openapi', {
        headers: { Authorization: 'Bearer invalid-token' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      
      const body = await response.json()
      expect(body).toEqual({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Invalid admin token',
        rid: expect.stringMatching(/^req_\d+_[a-z0-9]+$/)
      })
    })

    it('should return 401 when invalid x-admin-token is provided', async () => {
      const request = new NextRequest('http://localhost/api/admin/docs/openapi', {
        headers: { 'x-admin-token': 'invalid-token' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.code).toBe('UNAUTHORIZED')
    })

    it('should return OpenAPI spec when valid Bearer token is provided', async () => {
      const request = new NextRequest('http://localhost/api/admin/docs/openapi', {
        headers: { Authorization: 'Bearer valid-token' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/yaml')
      expect(response.headers.get('Cache-Control')).toBe('private, no-cache, no-store, must-revalidate')
      
      const yamlContent = await response.text()
      expect(yamlContent).toContain('openapi: 3.1.0')
      expect(yamlContent).toContain('title: Hotdog Diaries API')
      expect(yamlContent).toContain('/admin/schedule/forecast')
    })

    it('should return OpenAPI spec when valid x-admin-token is provided', async () => {
      const request = new NextRequest('http://localhost/api/admin/docs/openapi', {
        headers: { 'x-admin-token': 'valid-token' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/yaml')
      
      const yamlContent = await response.text()
      expect(yamlContent).toContain('openapi: 3.1.0')
    })
  })

  describe('Response Format', () => {
    it('should return proper YAML content type and headers', async () => {
      const request = new NextRequest('http://localhost/api/admin/docs/openapi', {
        headers: { Authorization: 'Bearer valid-token' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/yaml')
      expect(response.headers.get('Cache-Control')).toBe('private, no-cache, no-store, must-revalidate')
      expect(response.headers.get('Pragma')).toBe('no-cache')
      expect(response.headers.get('Expires')).toBe('0')
    })

    it('should return valid OpenAPI 3.1 specification', async () => {
      const request = new NextRequest('http://localhost/api/admin/docs/openapi', {
        headers: { Authorization: 'Bearer valid-token' }
      })
      
      const response = await GET(request)
      const yamlContent = await response.text()
      
      // Check for required OpenAPI 3.1 fields
      expect(yamlContent).toContain('openapi: 3.1.0')
      expect(yamlContent).toContain('info:')
      expect(yamlContent).toContain('title: Hotdog Diaries API')
      expect(yamlContent).toContain('servers:')
      expect(yamlContent).toContain('paths:')
      expect(yamlContent).toContain('components:')
      
      // Check for critical endpoints
      expect(yamlContent).toContain('/admin/schedule/forecast:')
      expect(yamlContent).toContain('/admin/schedule/forecast/refill:')
      expect(yamlContent).toContain('/admin/health/deep:')
      expect(yamlContent).toContain('/system/metrics:')
      
      // Check for security schemes
      expect(yamlContent).toContain('securitySchemes:')
      expect(yamlContent).toContain('AdminToken:')
    })
  })

  describe('Error Handling', () => {
    it('should handle JWT verification errors gracefully', async () => {
      mockVerifyJWT.mockImplementationOnce(async () => {
        throw new Error('Token expired')
      })
      
      const request = new NextRequest('http://localhost/api/admin/docs/openapi', {
        headers: { Authorization: 'Bearer expired-token' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.code).toBe('UNAUTHORIZED')
      expect(body.message).toBe('Invalid admin token')
    })

    it('should return proper error envelope format', async () => {
      const request = new NextRequest('http://localhost/api/admin/docs/openapi')
      const response = await GET(request)
      
      const body = await response.json()
      
      // Check error envelope structure
      expect(body).toHaveProperty('ok')
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('rid')
      
      expect(body.ok).toBe(false)
      expect(typeof body.code).toBe('string')
      expect(typeof body.message).toBe('string')
      expect(typeof body.rid).toBe('string')
      expect(body.rid).toMatch(/^req_\d+_[a-z0-9]+$/)
    })
  })

  describe('CORS Support', () => {
    it('should handle OPTIONS requests for CORS preflight', async () => {
      // Import OPTIONS handler
      const { OPTIONS } = await import('@/app/api/admin/docs/openapi/route')
      
      const request = new NextRequest('http://localhost/api/admin/docs/openapi', {
        method: 'OPTIONS'
      })
      
      const response = await OPTIONS(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('x-admin-token')
    })
  })
})