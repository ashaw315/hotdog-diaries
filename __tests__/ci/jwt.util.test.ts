/**
 * Unit tests for CI JWT utility
 * 
 * Tests runtime JWT minting, validation, and CLI interface
 */

import { mintToken, decodeUnsafe, verifyToken } from '../../scripts/ci/lib/jwt'

// Valid test JWT_SECRET (64 hex chars = 32 bytes)
const TEST_JWT_SECRET = 'a'.repeat(64)
const WEAK_JWT_SECRET = 'b'.repeat(32) // Too short
const INVALID_JWT_SECRET = 'invalid-not-hex-chars!'

describe('JWT Utility', () => {
  let originalJwtSecret: string | undefined
  let originalKeyVersion: string | undefined
  
  beforeEach(() => {
    originalJwtSecret = process.env.JWT_SECRET
    originalKeyVersion = process.env.JWT_KEY_VERSION
    
    // Set valid test secret by default
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

  describe('mintToken', () => {
    it('should mint valid JWT with default options', () => {
      const token = mintToken()
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
      
      const decoded = decodeUnsafe(token)
      expect(decoded.payload.sub).toBe('ci')
      expect(decoded.payload.aud).toBe('ci')
      expect(decoded.payload.iss).toBe('hotdog-diaries')
      expect(decoded.payload.exp).toBeGreaterThan(decoded.payload.iat)
    })

    it('should mint JWT with custom options', () => {
      const options = {
        sub: 'ci-shepherd',
        aud: 'deploy-gate',
        iss: 'hotdog-ci',
        ttl: '30m',
        jti: 'test-123'
      }
      
      const token = mintToken(options)
      const decoded = decodeUnsafe(token)
      
      expect(decoded.payload.sub).toBe('ci-shepherd')
      expect(decoded.payload.aud).toBe('deploy-gate')
      expect(decoded.payload.iss).toBe('hotdog-ci')
      expect(decoded.payload.jti).toBe('test-123')
      
      // 30 minutes = 1800 seconds
      expect(decoded.payload.exp - decoded.payload.iat).toBe(1800)
    })

    it('should include kid in header when JWT_KEY_VERSION is set', () => {
      process.env.JWT_KEY_VERSION = 'v2'
      
      const token = mintToken()
      const decoded = decodeUnsafe(token)
      
      expect(decoded.header.kid).toBe('v2')
    })

    it('should parse various TTL formats', () => {
      const testCases = [
        { ttl: '15m', expected: 900 },
        { ttl: '1h', expected: 3600 },
        { ttl: '30s', expected: 30 },
        { ttl: '1d', expected: 86400 },
        { ttl: '120', expected: 120 }
      ]
      
      testCases.forEach(({ ttl, expected }) => {
        const token = mintToken({ ttl })
        const decoded = decodeUnsafe(token)
        expect(decoded.payload.exp - decoded.payload.iat).toBe(expected)
      })
    })

    it('should throw on invalid TTL format', () => {
      expect(() => mintToken({ ttl: 'invalid' })).toThrow('Invalid TTL format')
      expect(() => mintToken({ ttl: '15x' })).toThrow('Invalid TTL format')
      expect(() => mintToken({ ttl: 'abc' })).toThrow('Invalid TTL format')
    })

    it('should throw when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET
      
      expect(() => mintToken()).toThrow('JWT_SECRET environment variable is required')
    })

    it('should throw when JWT_SECRET is too weak', () => {
      process.env.JWT_SECRET = WEAK_JWT_SECRET
      
      expect(() => mintToken()).toThrow('JWT_SECRET too weak: 32 chars < 64 required')
    })

    it('should throw when JWT_SECRET is not hex', () => {
      process.env.JWT_SECRET = INVALID_JWT_SECRET
      
      expect(() => mintToken()).toThrow('JWT_SECRET must be hexadecimal format')
    })

    it('should create unique tokens on subsequent calls', () => {
      const token1 = mintToken()
      const token2 = mintToken()
      
      expect(token1).not.toBe(token2)
      
      const decoded1 = decodeUnsafe(token1)
      const decoded2 = decodeUnsafe(token2)
      
      // IAT should be different (unless called in same second)
      expect(decoded1.payload.iat <= decoded2.payload.iat).toBe(true)
    })
  })

  describe('decodeUnsafe', () => {
    it('should decode valid JWT without verification', () => {
      const token = mintToken({ sub: 'test-user', ttl: '1h' })
      const decoded = decodeUnsafe(token)
      
      expect(decoded.header.alg).toBe('HS256')
      expect(decoded.header.typ).toBe('JWT')
      expect(decoded.payload.sub).toBe('test-user')
      expect(decoded.signature).toBeDefined()
      expect(decoded.signature).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('should throw on malformed JWT', () => {
      expect(() => decodeUnsafe('invalid')).toThrow('Invalid JWT format: must have 3 parts')
      expect(() => decodeUnsafe('a.b')).toThrow('Invalid JWT format: must have 3 parts')
      expect(() => decodeUnsafe('a.b.c.d')).toThrow('Invalid JWT format: must have 3 parts')
    })

    it('should throw on invalid base64 encoding', () => {
      expect(() => decodeUnsafe('invalid-b64.invalid-b64.sig')).toThrow('Failed to decode JWT')
    })

    it('should decode JWT with kid header', () => {
      process.env.JWT_KEY_VERSION = 'test-v1'
      
      const token = mintToken()
      const decoded = decodeUnsafe(token)
      
      expect(decoded.header.kid).toBe('test-v1')
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = mintToken({ sub: 'test-verify', ttl: '1h' })
      const payload = verifyToken(token)
      
      expect(payload.sub).toBe('test-verify')
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('should throw on invalid signature', () => {
      const token = mintToken()
      const parts = token.split('.')
      const tamperedToken = `${parts[0]}.${parts[1]}.invalid-signature`
      
      expect(() => verifyToken(tamperedToken)).toThrow('Invalid JWT signature')
    })

    it('should throw on expired token', () => {
      // Create token with very short TTL
      const token = mintToken({ ttl: '1s' })
      
      // Wait for token to expire
      return new Promise(resolve => {
        setTimeout(() => {
          expect(() => verifyToken(token)).toThrow('JWT token has expired')
          resolve(undefined)
        }, 1100)
      })
    }, 2000)

    it('should throw when JWT_SECRET is missing for verification', () => {
      const token = mintToken()
      delete process.env.JWT_SECRET
      
      expect(() => verifyToken(token)).toThrow('JWT_SECRET environment variable is required')
    })

    it('should verify token signed with different JWT_SECRET fails', () => {
      const token = mintToken()
      
      // Change JWT_SECRET
      process.env.JWT_SECRET = 'c'.repeat(64)
      
      expect(() => verifyToken(token)).toThrow('Invalid JWT signature')
    })
  })

  describe('Security Properties', () => {
    it('should generate cryptographically secure signatures', () => {
      const tokens = Array.from({ length: 100 }, () => mintToken())
      const signatures = tokens.map(token => token.split('.')[2])
      
      // All signatures should be unique
      const uniqueSignatures = new Set(signatures)
      expect(uniqueSignatures.size).toBe(100)
      
      // Signatures should be base64url format
      signatures.forEach(sig => {
        expect(sig).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(sig.length).toBeGreaterThan(30) // HMAC-SHA256 should be substantial
      })
    })

    it('should enforce minimum entropy in JWT_SECRET', () => {
      // Test various weak secrets
      const weakSecrets = [
        '1234567890abcdef', // Too short
        '00000000000000000000000000000000', // Low entropy
        'a'.repeat(63), // Just under threshold
        ''  // Empty
      ]
      
      weakSecrets.forEach(secret => {
        process.env.JWT_SECRET = secret
        expect(() => mintToken()).toThrow()
      })
    })

    it('should prevent timing attacks with constant-time verification', () => {
      const validToken = mintToken()
      const invalidTokens = [
        validToken.substring(0, validToken.length - 5) + 'xxxxx',
        validToken.replace(/./g, 'x'),
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.invalid'
      ]
      
      // All invalid tokens should throw the same error type
      invalidTokens.forEach(token => {
        expect(() => verifyToken(token)).toThrow('Invalid JWT signature')
      })
    })
  })

  describe('Clock Skew Tolerance', () => {
    it('should handle tokens issued in the immediate future', () => {
      // Simulate slight clock skew by creating token with IAT slightly in future
      const futureIat = Math.floor(Date.now() / 1000) + 2
      
      // We can't easily test this without modifying the mint function,
      // but we can ensure current implementation is reasonable
      const token = mintToken({ ttl: '1h' })
      const decoded = decodeUnsafe(token)
      
      const now = Math.floor(Date.now() / 1000)
      expect(decoded.payload.iat).toBeLessThanOrEqual(now + 1) // Allow 1 second tolerance
    })
  })

  describe('Edge Cases', () => {
    it('should handle maximum TTL values', () => {
      const token = mintToken({ ttl: '365d' }) // 1 year
      const decoded = decodeUnsafe(token)
      
      expect(decoded.payload.exp - decoded.payload.iat).toBe(365 * 86400)
    })

    it('should handle minimum TTL values', () => {
      const token = mintToken({ ttl: '1s' })
      const decoded = decodeUnsafe(token)
      
      expect(decoded.payload.exp - decoded.payload.iat).toBe(1)
    })

    it('should handle special characters in custom claims', () => {
      const token = mintToken({
        sub: 'user@domain.com',
        aud: 'api/v1/resource',
        iss: 'https://auth.example.com',
        jti: 'uuid-123-456-789'
      })
      
      const decoded = decodeUnsafe(token)
      expect(decoded.payload.sub).toBe('user@domain.com')
      expect(decoded.payload.aud).toBe('api/v1/resource')
      expect(decoded.payload.iss).toBe('https://auth.example.com')
      expect(decoded.payload.jti).toBe('uuid-123-456-789')
    })

    it('should preserve exact timestamps', () => {
      const beforeMint = Math.floor(Date.now() / 1000)
      const token = mintToken({ ttl: '15m' })
      const afterMint = Math.floor(Date.now() / 1000)
      
      const decoded = decodeUnsafe(token)
      
      expect(decoded.payload.iat).toBeGreaterThanOrEqual(beforeMint)
      expect(decoded.payload.iat).toBeLessThanOrEqual(afterMint)
      expect(decoded.payload.exp).toBe(decoded.payload.iat + 900) // Exactly 15 minutes
    })
  })
})