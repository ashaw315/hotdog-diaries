/**
 * Tests for Auth Self-Test API endpoint
 * 
 * Validates runtime JWT verification for CI gates
 */

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/health/auth-selftest/route'
import { mintToken } from '@/scripts/ci/lib/jwt'

// Test JWT secret (64 hex chars)
const TEST_JWT_SECRET = 'a'.repeat(64)
const WRONG_JWT_SECRET = 'b'.repeat(64)

describe('/api/health/auth-selftest', () => {
  let originalJwtSecret: string | undefined
  let originalKeyVersion: string | undefined
  
  beforeEach(() => {
    originalJwtSecret = process.env.JWT_SECRET
    originalKeyVersion = process.env.JWT_KEY_VERSION
    
    process.env.JWT_SECRET = TEST_JWT_SECRET
    delete process.env.JWT_KEY_VERSION
  })
  
  afterEach(() => {
    if (originalJwtSecret !== undefined) {
      process.env.JWT_SECRET = originalJwtSecret
    } else {
      delete process.env.JWT_SECRET
    }
    
    if (originalKeyVersion !== undefined) {
      process.env.JWT_KEY_VERSION = originalKeyVersion
    } else {
      delete process.env.JWT_KEY_VERSION
    }
  })
  
  function createRequest(headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('http://localhost:3000/api/health/auth-selftest', {
      headers: new Headers(headers)
    })
  }

  describe('GET method', () => {
    it('should return 200 for valid Bearer token', async () => {
      const token = mintToken({ 
        sub: 'ci-test', 
        aud: 'self-test', 
        iss: 'hotdog-diaries',
        ttl: '15m' 
      })
      
      const request = createRequest({
        'authorization': `Bearer ${token}`
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.sub).toBe('ci-test')
      expect(data.aud).toBe('self-test')
      expect(data.iss).toBe('hotdog-diaries')
      expect(data.now).toBeDefined()
      expect(data.exp).toBeDefined()
      expect(data.keyVersion).toBeNull()
    })

    it('should return 200 for valid x-admin-token header', async () => {
      const token = mintToken({ 
        sub: 'ci-admin', 
        ttl: '30m' 
      })
      
      const request = createRequest({
        'x-admin-token': token
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.sub).toBe('ci-admin')
    })

    it('should include keyVersion when JWT_KEY_VERSION is set', async () => {
      process.env.JWT_KEY_VERSION = 'v2-test'
      
      const token = mintToken({ ttl: '15m' })
      const request = createRequest({
        'authorization': `Bearer ${token}`
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.keyVersion).toBe('v2-test')
    })

    it('should return 401 MISSING when no token provided', async () => {
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
      expect(data.code).toBe('MISSING')
      expect(data.detail).toContain('No authentication token provided')
    })

    it('should return 401 INVALID_SIGNATURE for wrong secret', async () => {
      // Create token with test secret
      const token = mintToken({ ttl: '15m' })
      
      // Change JWT_SECRET to simulate production mismatch
      process.env.JWT_SECRET = WRONG_JWT_SECRET
      
      const request = createRequest({
        'authorization': `Bearer ${token}`
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
      expect(data.code).toBe('INVALID_SIGNATURE')
      expect(data.detail).toContain('Invalid signature')
    })

    it('should return 401 EXPIRED for expired token', async () => {
      // Create token with very short TTL
      const token = mintToken({ ttl: '1s' })
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      const request = createRequest({
        'authorization': `Bearer ${token}`
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
      expect(data.code).toBe('EXPIRED')
      expect(data.detail).toContain('expired')
    }, 2000)

    it('should return 401 MALFORMED for invalid JWT format', async () => {
      const request = createRequest({
        'authorization': 'Bearer invalid.jwt.format'
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
      expect(data.code).toBe('MALFORMED')
    })

    it('should return 401 MALFORMED for completely invalid token', async () => {
      const request = createRequest({
        'authorization': 'Bearer not-a-jwt-at-all'
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
      expect(data.code).toBe('MALFORMED')
    })

    it('should return 500 when JWT_SECRET not configured', async () => {
      delete process.env.JWT_SECRET
      
      const request = createRequest({
        'authorization': 'Bearer any.token.here'
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.ok).toBe(false)
      expect(data.code).toBe('JWT_SECRET_NOT_CONFIGURED')
    })

    it('should handle tokens with different algorithms gracefully', async () => {
      // Create a JWT with unsupported algorithm (this is a mock test)
      const fakeToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.invalid'
      
      const request = createRequest({
        'authorization': `Bearer ${fakeToken}`
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
      expect(data.code).toBe('INVALID')
    })
  })

  describe('POST method', () => {
    it('should work identically to GET method', async () => {
      const token = mintToken({ ttl: '15m' })
      
      const request = createRequest({
        'authorization': `Bearer ${token}`
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
    })
  })

  describe('Response Format', () => {
    it('should include all required fields in success response', async () => {
      const token = mintToken({ 
        sub: 'test-subject',
        aud: 'test-audience', 
        iss: 'test-issuer',
        ttl: '1h' 
      })
      
      const request = createRequest({
        'authorization': `Bearer ${token}`
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data).toMatchObject({
        ok: true,
        iss: 'test-issuer',
        aud: 'test-audience', 
        sub: 'test-subject',
        keyVersion: null,
        now: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        exp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      })
    })

    it('should format timestamps correctly', async () => {
      const token = mintToken({ ttl: '2h' })
      
      const request = createRequest({
        'authorization': `Bearer ${token}`
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      const now = new Date(data.now)
      const exp = new Date(data.exp)
      
      expect(now).toBeInstanceOf(Date)
      expect(exp).toBeInstanceOf(Date)
      expect(exp.getTime()).toBeGreaterThan(now.getTime())
      
      // Should be approximately 2 hours apart (allow some variance)
      const diffHours = (exp.getTime() - now.getTime()) / (1000 * 60 * 60)
      expect(diffHours).toBeCloseTo(2, 1)
    })
  })

  describe('Security', () => {
    it('should not leak sensitive information in error responses', async () => {
      const request = createRequest({
        'authorization': 'Bearer malicious.token.attempt'
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(JSON.stringify(data)).not.toContain(TEST_JWT_SECRET)
      expect(JSON.stringify(data)).not.toContain('JWT_SECRET')
    })

    it('should validate token format before attempting verification', async () => {
      const invalidTokens = [
        'Bearer',
        'justonepart',
        'two.parts',
        'four.parts.are.invalid',
        '',
        'null',
        'undefined'
      ]
      
      for (const invalidToken of invalidTokens) {
        const request = createRequest({
          'authorization': `Bearer ${invalidToken}`
        })
        
        const response = await GET(request)
        const data = await response.json()
        
        expect(response.status).toBe(401)
        expect(data.ok).toBe(false)
        expect(['MALFORMED', 'INVALID']).toContain(data.code)
      }
    })
  })
})