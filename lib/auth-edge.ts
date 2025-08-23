/**
 * Edge Runtime compatible authentication utilities
 * This file uses only Web APIs that work in Next.js Edge Runtime
 */

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

export const AUTH_COOKIE_NAME = 'auth-token'
export const REFRESH_COOKIE_NAME = 'refresh-token'

export interface JWTPayload {
  userId: number
  username: string
  iat?: number
  exp?: number
}

/**
 * Edge Runtime compatible auth utilities
 */
export class EdgeAuthUtils {
  /**
   * Get JWT secret as Uint8Array for jose library
   */
  private static getJWTSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }
    return new TextEncoder().encode(secret)
  }

  /**
   * Get refresh secret as Uint8Array for jose library
   */
  private static getRefreshSecret(): Uint8Array {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }
    return new TextEncoder().encode(secret)
  }

  /**
   * Verify JWT token using Web Crypto API (Edge Runtime compatible)
   */
  static async verifyJWT(token: string): Promise<JWTPayload> {
    try {
      const secret = this.getJWTSecret()
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'hotdog-diaries',
        audience: 'admin'
      })

      return {
        userId: payload.userId as number,
        username: payload.username as string,
        iat: payload.iat,
        exp: payload.exp
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          throw new Error('Token has expired')
        } else if (error.message.includes('invalid')) {
          throw new Error('Invalid token')
        }
      }
      throw new Error('Token verification failed')
    }
  }

  /**
   * Verify refresh token using Web Crypto API
   */
  static async verifyRefreshToken(token: string): Promise<JWTPayload> {
    try {
      const secret = this.getRefreshSecret()
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'hotdog-diaries',
        audience: 'admin-refresh'
      })

      return {
        userId: payload.userId as number,
        username: payload.username as string,
        iat: payload.iat,
        exp: payload.exp
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          throw new Error('Refresh token has expired')
        } else if (error.message.includes('invalid')) {
          throw new Error('Invalid refresh token')
        }
      }
      throw new Error('Refresh token verification failed')
    }
  }

  /**
   * Generate new JWT token using Web Crypto API
   */
  static async generateJWT(user: { id: number; username: string }): Promise<string> {
    try {
      const secret = this.getJWTSecret()
      
      const token = await new SignJWT({
        userId: user.id,
        username: user.username
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .setIssuer('hotdog-diaries')
        .setAudience('admin')
        .sign(secret)

      return token
    } catch (error) {
      throw new Error(`JWT generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate refresh token using Web Crypto API
   */
  static async generateRefreshToken(user: { id: number; username: string }): Promise<string> {
    try {
      const secret = this.getRefreshSecret()
      
      const token = await new SignJWT({
        userId: user.id,
        username: user.username
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .setIssuer('hotdog-diaries')
        .setAudience('admin-refresh')
        .sign(secret)

      return token
    } catch (error) {
      throw new Error(`Refresh token generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get authentication token from request cookies or Authorization header
   */
  static getAuthTokenFromRequest(request: NextRequest): string | null {
    console.log('🔍 [EdgeAuth] getAuthTokenFromRequest called')
    console.log('🔍 [EdgeAuth] AUTH_COOKIE_NAME:', AUTH_COOKIE_NAME)
    
    // Log all cookies for debugging
    const allCookies = request.cookies.getAll()
    console.log('🔍 [EdgeAuth] All cookies in request:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value, valueLength: c.value?.length || 0 })))
    
    // First try Bearer token from Authorization header
    const authHeader = request.headers.get('authorization')
    console.log('🔍 [EdgeAuth] Authorization header:', authHeader ? `Bearer ${authHeader.substring(0, 20)}...` : 'null')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      console.log('🔍 [EdgeAuth] Found Bearer token, length:', token.length)
      return token
    }
    
    // Fallback to cookie
    const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value || null
    console.log('🔍 [EdgeAuth] Cookie token:', cookieToken ? `Found (${cookieToken.length} chars)` : 'null')
    
    if (!cookieToken) {
      // Try alternative cookie names
      const altToken1 = request.cookies.get('accessToken')?.value || null
      const altToken2 = request.cookies.get('auth')?.value || null
      console.log('🔍 [EdgeAuth] Alternative tokens:', { 
        accessToken: altToken1 ? `Found (${altToken1.length} chars)` : 'null',
        auth: altToken2 ? `Found (${altToken2.length} chars)` : 'null'
      })
    }
    
    return cookieToken
  }

  /**
   * Get refresh token from request cookies
   */
  static getRefreshTokenFromRequest(request: NextRequest): string | null {
    return request.cookies.get(REFRESH_COOKIE_NAME)?.value || null
  }

  /**
   * Set authentication cookies on response
   */
  static setAuthCookies(
    response: NextResponse,
    accessToken: string,
    refreshToken?: string
  ): void {
    console.log('🍪 [EdgeAuth] setAuthCookies called with tokens:', {
      accessTokenLength: accessToken.length,
      refreshTokenLength: refreshToken?.length,
      isDevelopment: process.env.NODE_ENV !== 'production'
    })
    
    const cookieOptions = {
      httpOnly: true,
      secure: false, // Allow non-HTTPS in development
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 24 * 60 * 60 // 24 hours
    }
    
    console.log('🍪 [EdgeAuth] Cookie options:', cookieOptions)

    response.cookies.set(AUTH_COOKIE_NAME, accessToken, cookieOptions)
    console.log('🍪 [EdgeAuth] Set access token cookie:', AUTH_COOKIE_NAME)

    if (refreshToken) {
      response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 // 7 days
      })
      console.log('🍪 [EdgeAuth] Set refresh token cookie:', REFRESH_COOKIE_NAME)
    }
    
    // Log response headers to see what's actually being set
    const setCookieHeaders = response.headers.getSetCookie?.() || []
    console.log('🍪 [EdgeAuth] Set-Cookie headers being sent:', setCookieHeaders)
  }

  /**
   * Clear authentication cookies
   */
  static clearAuthCookies(response: NextResponse): void {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 0
    }

    response.cookies.set(AUTH_COOKIE_NAME, '', cookieOptions)
    response.cookies.set(REFRESH_COOKIE_NAME, '', cookieOptions)
  }

  /**
   * Create redirect response to login
   */
  static createLoginRedirect(from?: string): NextResponse {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const loginUrl = new URL('/admin/login', baseUrl)
    
    if (from) {
      loginUrl.searchParams.set('from', from)
    }
    
    return NextResponse.redirect(loginUrl)
  }

  /**
   * Create redirect response after authentication
   */
  static createAuthRedirect(redirectTo: string = '/admin'): NextResponse {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    return NextResponse.redirect(new URL(redirectTo, baseUrl))
  }

  /**
   * Verify authentication from request (Edge Runtime compatible)
   */
  static async verifyRequestAuth(request: NextRequest): Promise<{ 
    isValid: boolean
    payload?: JWTPayload
  }> {
    try {
      const token = this.getAuthTokenFromRequest(request)
      
      if (!token) {
        return { isValid: false }
      }

      const payload = await this.verifyJWT(token)
      return { isValid: true, payload }
    } catch (error) {
      return { isValid: false }
    }
  }

  /**
   * Attempt to refresh token using refresh token (Edge Runtime compatible)
   */
  static async attemptTokenRefresh(request: NextRequest): Promise<{
    success: boolean
    accessToken?: string
    refreshToken?: string
    payload?: JWTPayload
  }> {
    try {
      const refreshToken = this.getRefreshTokenFromRequest(request)
      if (!refreshToken) {
        return { success: false }
      }

      const payload = await this.verifyRefreshToken(refreshToken)
      
      // Generate new tokens
      const newAccessToken = await this.generateJWT({
        id: payload.userId,
        username: payload.username
      })
      
      const newRefreshToken = await this.generateRefreshToken({
        id: payload.userId,
        username: payload.username
      })

      return {
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        payload
      }
    } catch (error) {
      return { success: false }
    }
  }

  /**
   * Handle authentication with automatic refresh
   */
  static async handleAuthWithRefresh(request: NextRequest): Promise<{
    isAuthenticated: boolean
    response?: NextResponse
    payload?: JWTPayload
  }> {
    // Try access token first
    const authResult = await this.verifyRequestAuth(request)
    
    if (authResult.isValid) {
      return { 
        isAuthenticated: true, 
        payload: authResult.payload 
      }
    }

    // Try refresh token
    const refreshResult = await this.attemptTokenRefresh(request)
    
    if (refreshResult.success) {
      // Create response with new tokens
      const response = NextResponse.next()
      this.setAuthCookies(
        response, 
        refreshResult.accessToken!, 
        refreshResult.refreshToken!
      )
      
      return { 
        isAuthenticated: true, 
        response, 
        payload: refreshResult.payload 
      }
    }

    // Authentication failed - redirect to login
    const response = this.createLoginRedirect(request.nextUrl.pathname)
    this.clearAuthCookies(response)
    
    return { 
      isAuthenticated: false, 
      response 
    }
  }

  /**
   * Check if token is expired (without verification)
   */
  static isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return true
      
      const payload = JSON.parse(atob(parts[1]))
      const now = Math.floor(Date.now() / 1000)
      
      return payload.exp ? payload.exp <= now : true
    } catch {
      return true
    }
  }
}