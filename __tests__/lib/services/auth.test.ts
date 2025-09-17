import { AuthService } from '@/lib/services/auth'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Unmock the AuthService since we're testing it directly
jest.unmock('@/lib/services/auth')

// Mock environment variables
const originalEnv = process.env
beforeEach(() => {
  jest.clearAllMocks()
  process.env = {
    ...originalEnv,
    JWT_SECRET: 'test-jwt-secret-key-for-testing',
    JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing'
  }
})

afterEach(() => {
  process.env = originalEnv
})

describe('AuthService', () => {
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!'
      const hash = await AuthService.hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50)
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true)
    })

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!'
      const hash1 = await AuthService.hashPassword(password)
      const hash2 = await AuthService.hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty password', async () => {
      await expect(AuthService.hashPassword('')).rejects.toThrow('Password cannot be empty')
    })
  })

  describe('validatePassword', () => {
    it('should validate correct password', async () => {
      const password = 'TestPassword123!'
      const hash = await bcrypt.hash(password, 12)

      const isValid = await AuthService.validatePassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const correctPassword = 'TestPassword123!'
      const wrongPassword = 'WrongPassword123!'
      const hash = await bcrypt.hash(correctPassword, 12)

      const isValid = await AuthService.validatePassword(wrongPassword, hash)
      expect(isValid).toBe(false)
    })

    it('should handle invalid hash', async () => {
      const password = 'TestPassword123!'
      const invalidHash = 'invalid-hash'

      await expect(AuthService.validatePassword(password, invalidHash)).rejects.toThrow('Invalid hash format')
    })
  })

  describe('generateJWT', () => {
    it('should generate valid JWT token', () => {
      const user = { id: 1, username: 'testuser' }
      const token = AuthService.generateJWT(user)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should include correct payload', () => {
      const user = { id: 1, username: 'testuser' }
      const token = AuthService.generateJWT(user)
      
      const decoded = jwt.decode(token) as any
      expect(decoded.userId).toBe(user.id)
      expect(decoded.username).toBe(user.username)
      expect(decoded.iss).toBe('hotdog-diaries')
      expect(decoded.aud).toBe('admin')
    })

    it('should throw error without JWT_SECRET', () => {
      delete process.env.JWT_SECRET
      const user = { id: 1, username: 'testuser' }

      expect(() => AuthService.generateJWT(user)).toThrow('JWT_SECRET environment variable is required')
    })
  })

  describe('verifyJWT', () => {
    it('should verify valid token', () => {
      const user = { id: 1, username: 'testuser' }
      const token = AuthService.generateJWT(user)

      const payload = AuthService.verifyJWT(token)
      expect(payload.userId).toBe(user.id)
      expect(payload.username).toBe(user.username)
    })

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here'

      expect(() => AuthService.verifyJWT(invalidToken)).toThrow('Invalid token')
    })

    it('should throw error for expired token', () => {
      const user = { id: 1, username: 'testuser' }
      const expiredToken = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h', issuer: 'hotdog-diaries', audience: 'admin' }
      )

      expect(() => AuthService.verifyJWT(expiredToken)).toThrow('Token has expired')
    })

    it('should throw error without JWT_SECRET', () => {
      delete process.env.JWT_SECRET
      const token = 'some.token.here'

      expect(() => AuthService.verifyJWT(token)).toThrow('JWT_SECRET environment variable is required')
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate valid refresh token', () => {
      const user = { id: 1, username: 'testuser' }
      const token = AuthService.generateRefreshToken(user)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should include correct payload for refresh token', () => {
      const user = { id: 1, username: 'testuser' }
      const token = AuthService.generateRefreshToken(user)
      
      const decoded = jwt.decode(token) as any
      expect(decoded.userId).toBe(user.id)
      expect(decoded.username).toBe(user.username)
      expect(decoded.iss).toBe('hotdog-diaries')
      expect(decoded.aud).toBe('admin-refresh')
    })
  })

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const user = { id: 1, username: 'testuser' }
      const token = AuthService.generateRefreshToken(user)

      const payload = AuthService.verifyRefreshToken(token)
      expect(payload.userId).toBe(user.id)
      expect(payload.username).toBe(user.username)
    })

    it('should throw error for invalid refresh token', () => {
      const invalidToken = 'invalid.refresh.token'

      expect(() => AuthService.verifyRefreshToken(invalidToken)).toThrow('Invalid refresh token')
    })
  })

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', () => {
      const user = { id: 1, username: 'testuser' }
      const tokens = AuthService.generateTokens(user)

      expect(tokens.accessToken).toBeDefined()
      expect(tokens.refreshToken).toBeDefined()
      expect(typeof tokens.accessToken).toBe('string')
      expect(typeof tokens.refreshToken).toBe('string')
    })
  })

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      const header = `Bearer ${token}`

      const extracted = AuthService.extractTokenFromHeader(header)
      expect(extracted).toBe(token)
    })

    it('should return null for invalid header format', () => {
      const invalidHeaders = [
        'InvalidFormat token',
        'Bearer',
        'Bearer token1 token2',
        'token-without-bearer',
        ''
      ]

      invalidHeaders.forEach(header => {
        const extracted = AuthService.extractTokenFromHeader(header)
        expect(extracted).toBeNull()
      })
    })

    it('should return null for null header', () => {
      const extracted = AuthService.extractTokenFromHeader(null)
      expect(extracted).toBeNull()
    })
  })

  describe('isValidTokenFormat', () => {
    it('should validate correct JWT format', () => {
      const validToken = 'header.payload.signature'
      expect(AuthService.isValidTokenFormat(validToken)).toBe(true)
    })

    it('should reject invalid JWT format', () => {
      const invalidTokens = [
        'invalid-token',
        'only.two',  // Actually only 2 parts
        'too.many.parts.here.extra',
        'header..signature',
        '.payload.signature',
        'header.payload.',
        '',
        'invalid-chars!@#.test.token'  // Invalid characters
      ]

      invalidTokens.forEach(token => {
        const result = AuthService.isValidTokenFormat(token)
        expect(result).toBe(false)
      })
    })
  })

  describe('getTokenExpiry', () => {
    it('should get expiry from valid token', () => {
      const user = { id: 1, username: 'testuser' }
      const token = AuthService.generateJWT(user)

      const expiry = AuthService.getTokenExpiry(token)
      expect(expiry).toBeInstanceOf(Date)
      expect(expiry!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.format'
      const expiry = AuthService.getTokenExpiry(invalidToken)
      expect(expiry).toBeNull()
    })
  })

  describe('isTokenExpired', () => {
    it('should detect non-expired token', () => {
      const user = { id: 1, username: 'testuser' }
      const token = AuthService.generateJWT(user)

      const isExpired = AuthService.isTokenExpired(token)
      expect(isExpired).toBe(false)
    })

    it('should detect expired token', () => {
      const user = { id: 1, username: 'testuser' }
      const expiredToken = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      )

      const isExpired = AuthService.isTokenExpired(expiredToken)
      expect(isExpired).toBe(true)
    })

    it('should return true for invalid token', () => {
      const invalidToken = 'invalid.token.format'
      const isExpired = AuthService.isTokenExpired(invalidToken)
      expect(isExpired).toBe(true)
    })
  })

  describe('generateSecurePassword', () => {
    it('should generate password of specified length', () => {
      const password = AuthService.generateSecurePassword(20)
      expect(password.length).toBe(20)
    })

    it('should generate different passwords each time', () => {
      const password1 = AuthService.generateSecurePassword()
      const password2 = AuthService.generateSecurePassword()
      expect(password1).not.toBe(password2)
    })

    it('should use default length of 16', () => {
      const password = AuthService.generateSecurePassword()
      expect(password.length).toBe(16)
    })

    it('should contain mix of characters', () => {
      const password = AuthService.generateSecurePassword(100)
      expect(/[a-z]/.test(password)).toBe(true)
      expect(/[A-Z]/.test(password)).toBe(true)
      expect(/\d/.test(password)).toBe(true)
      expect(/[!@#$%^&*]/.test(password)).toBe(true)
    })
  })

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const strongPassword = 'StrongPass123!'
      const result = AuthService.validatePasswordStrength(strongPassword)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject password too short', () => {
      const shortPassword = 'Sh0rt!'
      const result = AuthService.validatePasswordStrength(shortPassword)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters long')
    })

    it('should require lowercase letter', () => {
      const password = 'PASSWORD123!'
      const result = AuthService.validatePasswordStrength(password)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should require uppercase letter', () => {
      const password = 'password123!'
      const result = AuthService.validatePasswordStrength(password)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should require number', () => {
      const password = 'Password!'
      const result = AuthService.validatePasswordStrength(password)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should require special character', () => {
      const password = 'Password123'
      const result = AuthService.validatePasswordStrength(password)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character')
    })

    it('should return multiple errors for weak password', () => {
      const weakPassword = 'weak'
      const result = AuthService.validatePasswordStrength(weakPassword)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })
})