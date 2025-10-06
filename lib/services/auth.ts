import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AdminUser } from '@/types'

export interface JWTPayload {
  userId: number
  username: string
  iat?: number
  exp?: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12
  private static readonly ACCESS_TOKEN_EXPIRY = '24h'
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'
  private static readonly SERVICE_TOKEN_EXPIRY = '30d'

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length === 0) {
      throw new Error('Password cannot be empty')
    }
    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS)
      return await bcrypt.hash(password, salt)
    } catch (error) {
      throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate a password against its hash
   */
  static async validatePassword(password: string, hash: string): Promise<boolean> {
    if (!hash || hash.length < 10 || !hash.startsWith('$2b$') && !hash.startsWith('$2a$')) {
      throw new Error('Invalid hash format')
    }
    try {
      return await bcrypt.compare(password, hash)
    } catch (error) {
      throw new Error(`Password validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate JWT access token
   */
  static generateJWT(user: Pick<AdminUser, 'id' | 'username'>): string {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username
    }

    try {
      return jwt.sign(payload, secret, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: 'hotdog-diaries',
        audience: 'admin'
      })
    } catch (error) {
      throw new Error(`JWT generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate refresh token (longer-lived)
   */
  static generateRefreshToken(user: Pick<AdminUser, 'id' | 'username'>): string {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username
    }

    try {
      return jwt.sign(payload, secret, {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: 'hotdog-diaries',
        audience: 'admin-refresh'
      })
    } catch (error) {
      throw new Error(`Refresh token generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify and decode JWT token
   */
  static verifyJWT(token: string): JWTPayload {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }

    try {
      const decoded = jwt.verify(token, secret, {
        issuer: 'hotdog-diaries',
        audience: 'admin'
      }) as JWTPayload

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired')
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token')
      } else {
        throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }

    try {
      const decoded = jwt.verify(token, secret, {
        issuer: 'hotdog-diaries',
        audience: 'admin-refresh'
      }) as JWTPayload

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token has expired')
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token')
      } else {
        throw new Error(`Refresh token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokens(user: Pick<AdminUser, 'id' | 'username'>): AuthTokens {
    return {
      accessToken: this.generateJWT(user),
      refreshToken: this.generateRefreshToken(user)
    }
  }

  /**
   * Generate service account token (long-lived for CI/CD)
   */
  static generateServiceToken(user: Pick<AdminUser, 'id' | 'username'>): string {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username
    }

    try {
      return jwt.sign(payload, secret, {
        expiresIn: this.SERVICE_TOKEN_EXPIRY,
        issuer: 'hotdog-diaries',
        audience: 'service-account'
      })
    } catch (error) {
      throw new Error(`Service token generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify service account token
   */
  static verifyServiceToken(token: string): JWTPayload {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }

    try {
      const decoded = jwt.verify(token, secret, {
        issuer: 'hotdog-diaries',
        audience: 'service-account'
      }) as JWTPayload

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Service token has expired')
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid service token')
      } else {
        throw new Error(`Service token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader) return null
    
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null
    }
    
    return parts[1]
  }

  /**
   * Validate token format
   */
  static isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false
    
    // Basic JWT format validation (3 parts separated by dots)
    const parts = token.split('.')
    if (parts.length !== 3) return false
    
    // Each part must be non-empty and base64-like
    return parts.every(part => {
      if (part.length === 0) return false
      // Check if it's valid base64url (basic check) - must have content and valid chars
      return part.length > 0 && /^[A-Za-z0-9_-]+$/.test(part)
    })
  }

  /**
   * Get token expiry time
   */
  static getTokenExpiry(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload | null
      if (!decoded || !decoded.exp) return null
      
      return new Date(decoded.exp * 1000)
    } catch {
      return null
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const expiry = this.getTokenExpiry(token)
    if (!expiry) return true
    
    return expiry.getTime() <= Date.now()
  }

  /**
   * Generate secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    
    return password
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}