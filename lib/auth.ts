import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { AuthService, JWTPayload } from './services/auth'
import { AdminService, AdminProfile } from './services/admin'

export const AUTH_COOKIE_NAME = 'auth-token'
export const REFRESH_COOKIE_NAME = 'refresh-token'

export interface AuthState {
  isAuthenticated: boolean
  user: AdminProfile | null
  token: string | null
}

export interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  maxAge?: number
  path?: string
}

/**
 * Server-side auth utilities for Next.js
 */
export class NextAuthUtils {
  /**
   * Get default cookie options for authentication
   */
  private static getDefaultCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 // 24 hours
    }
  }

  /**
   * Set authentication cookies
   */
  static async setAuthCookies(
    response: NextResponse,
    accessToken: string,
    refreshToken?: string
  ): Promise<void> {
    const cookieOptions = this.getDefaultCookieOptions()

    // Set access token cookie
    response.cookies.set(AUTH_COOKIE_NAME, accessToken, cookieOptions)

    // Set refresh token cookie (longer expiry)
    if (refreshToken) {
      response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 // 7 days
      })
    }
  }

  /**
   * Clear authentication cookies
   */
  static clearAuthCookies(response: NextResponse): void {
    const cookieOptions = {
      ...this.getDefaultCookieOptions(),
      maxAge: 0
    }

    response.cookies.set(AUTH_COOKIE_NAME, '', cookieOptions)
    response.cookies.set(REFRESH_COOKIE_NAME, '', cookieOptions)
  }

  /**
   * Get authentication token from cookies (server-side)
   */
  static async getAuthToken(): Promise<string | null> {
    try {
      const cookieStore = await cookies()
      const tokenCookie = cookieStore.get(AUTH_COOKIE_NAME)
      return tokenCookie?.value || null
    } catch (error) {
      console.error('Error getting auth token from cookies:', error)
      return null
    }
  }

  /**
   * Get refresh token from cookies (server-side)
   */
  static async getRefreshToken(): Promise<string | null> {
    try {
      const cookieStore = await cookies()
      const tokenCookie = cookieStore.get(REFRESH_COOKIE_NAME)
      return tokenCookie?.value || null
    } catch (error) {
      console.error('Error getting refresh token from cookies:', error)
      return null
    }
  }

  /**
   * Get authentication token from request cookies
   */
  static getAuthTokenFromRequest(request: NextRequest): string | null {
    // First try Bearer token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }
    
    // Fallback to cookie
    return request.cookies.get(AUTH_COOKIE_NAME)?.value || null
  }

  /**
   * Get current authenticated user (server-side)
   */
  static async getCurrentUser(): Promise<AdminProfile | null> {
    try {
      const token = await this.getAuthToken()
      if (!token) return null

      const payload = AuthService.verifyJWT(token)
      const user = await AdminService.getAdminById(payload.userId)
      
      return user
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  }

  /**
   * Verify authentication from request
   */
  static async verifyRequestAuth(request: NextRequest): Promise<{ 
    isValid: boolean
    payload?: JWTPayload
    user?: AdminProfile 
  }> {
    try {
      const token = this.getAuthTokenFromRequest(request)
      if (!token) {
        return { isValid: false }
      }

      const payload = AuthService.verifyJWT(token)
      const user = await AdminService.getAdminById(payload.userId)

      if (!user) {
        return { isValid: false }
      }

      return { isValid: true, payload, user }
    } catch (error) {
      console.error('Request auth verification failed:', error)
      return { isValid: false }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
  } | null> {
    try {
      const payload = AuthService.verifyRefreshToken(refreshToken)
      const user = await AdminService.getAdminById(payload.userId)

      if (!user) {
        return null
      }

      // Generate new tokens
      const tokens = AuthService.generateTokens({
        id: user.id,
        username: user.username
      })

      return tokens
    } catch (error) {
      console.error('Token refresh failed:', error)
      return null
    }
  }

  /**
   * Create authenticated redirect response
   */
  static createAuthRedirect(redirectTo: string = '/admin'): NextResponse {
    return NextResponse.redirect(new URL(redirectTo, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'))
  }

  /**
   * Create unauthenticated redirect response
   */
  static createLoginRedirect(from?: string): NextResponse {
    const loginUrl = new URL('/admin/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    
    if (from) {
      loginUrl.searchParams.set('from', from)
    }
    
    return NextResponse.redirect(loginUrl)
  }

  /**
   * Validate authentication state and handle token refresh
   */
  static async validateAndRefreshAuth(request: NextRequest): Promise<{
    isAuthenticated: boolean
    response?: NextResponse
    user?: AdminProfile
  }> {
    const accessToken = this.getAuthTokenFromRequest(request)
    
    // No access token - redirect to login
    if (!accessToken) {
      return {
        isAuthenticated: false,
        response: this.createLoginRedirect(request.nextUrl.pathname)
      }
    }

    try {
      // Try to verify access token
      const payload = AuthService.verifyJWT(accessToken)
      const user = await AdminService.getAdminById(payload.userId)

      if (user) {
        return { isAuthenticated: true, user }
      }
    } catch (error) {
      // Access token is invalid or expired, try refresh token
      const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value

      if (refreshToken) {
        const newTokens = await this.refreshAccessToken(refreshToken)
        
        if (newTokens) {
          // Create response with new tokens
          const response = NextResponse.next()
          await this.setAuthCookies(response, newTokens.accessToken, newTokens.refreshToken)
          
          const user = await AdminService.getAdminById(
            AuthService.verifyJWT(newTokens.accessToken).userId
          )
          
          return { isAuthenticated: true, response, user }
        }
      }
    }

    // Authentication failed - clear cookies and redirect
    const response = this.createLoginRedirect(request.nextUrl.pathname)
    this.clearAuthCookies(response)
    
    return { isAuthenticated: false, response }
  }
}

/**
 * Client-side auth utilities
 */
export class ClientAuthUtils {
  /**
   * Check if user is authenticated (client-side)
   */
  static isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false
    
    // In a real implementation, you might check a client-side auth state
    // For now, we'll rely on server-side authentication
    return true // This should be managed by your auth context
  }

  /**
   * Get user from client-side state
   */
  static getCurrentUser(): AdminProfile | null {
    if (typeof window === 'undefined') return null
    
    // This should be managed by your auth context
    // For now, return null and let the context handle it
    return null
  }

  /**
   * Redirect to login page
   */
  static redirectToLogin(from?: string): void {
    if (typeof window === 'undefined') return
    
    const loginUrl = new URL('/admin/login', window.location.origin)
    if (from) {
      loginUrl.searchParams.set('from', from)
    }
    
    window.location.href = loginUrl.toString()
  }

  /**
   * Redirect after successful login
   */
  static redirectAfterLogin(to?: string): void {
    if (typeof window === 'undefined') return
    
    const defaultRedirect = '/admin'
    const redirectTo = to || defaultRedirect
    
    window.location.href = redirectTo
  }

  /**
   * Clear client-side auth state
   */
  static clearAuthState(): void {
    if (typeof window === 'undefined') return
    
    // Clear any client-side auth state
    // This should be handled by your auth context
  }
}

/**
 * Auth validation utilities
 */
export class AuthValidation {
  /**
   * Validate login credentials format
   */
  static validateLoginCredentials(username: string, password: string): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!username || username.trim().length === 0) {
      errors.push('Username is required')
    }

    if (username && username.length < 3) {
      errors.push('Username must be at least 3 characters')
    }

    if (!password || password.length === 0) {
      errors.push('Password is required')
    }

    if (password && password.length < 8) {
      errors.push('Password must be at least 8 characters')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Sanitize username input
   */
  static sanitizeUsername(username: string): string {
    return username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '')
  }
}

/**
 * Auth error types
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: new AuthError('Invalid username or password', 'INVALID_CREDENTIALS', 401),
  TOKEN_EXPIRED: new AuthError('Session has expired', 'TOKEN_EXPIRED', 401),
  TOKEN_INVALID: new AuthError('Invalid session token', 'TOKEN_INVALID', 401),
  UNAUTHORIZED: new AuthError('Unauthorized access', 'UNAUTHORIZED', 401),
  FORBIDDEN: new AuthError('Access forbidden', 'FORBIDDEN', 403),
  USER_INACTIVE: new AuthError('User account is inactive', 'USER_INACTIVE', 403),
  RATE_LIMITED: new AuthError('Too many login attempts', 'RATE_LIMITED', 429)
} as const