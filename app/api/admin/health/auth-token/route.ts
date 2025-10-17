import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth Token Health Probe Endpoint
 * 
 * Validates JWT tokens using proper JWT verification for deploy gate functionality.
 * Returns 200 for valid tokens, 401 with specific error codes for invalid tokens.
 */

export async function GET(request: NextRequest) {
  try {
    // Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET
    
    if (!jwtSecret) {
      return NextResponse.json(
        { 
          code: 'JWT_SECRET_NOT_CONFIGURED',
          message: 'JWT_SECRET not configured in environment',
          status: 'error'
        },
        { status: 500 }
      )
    }
    
    // Get token from request headers
    const authHeader = request.headers.get('authorization')
    const xAdminToken = request.headers.get('x-admin-token')
    
    let providedToken: string | null = null
    
    // Support both Authorization: Bearer <token> and x-admin-token: <token>
    if (authHeader?.startsWith('Bearer ')) {
      providedToken = authHeader.substring(7)
    } else if (xAdminToken) {
      providedToken = xAdminToken
    }
    
    if (!providedToken) {
      return NextResponse.json(
        {
          code: 'AUTH_TOKEN_MISSING',
          message: 'No authentication token provided. Use Authorization: Bearer <token> or x-admin-token header',
          status: 'error'
        },
        { status: 401 }
      )
    }
    
    // Validate JWT token using proper verification
    try {
      // Import auth service for JWT verification
      const { AuthService } = await import('@/lib/services/auth')
      const decoded = AuthService.verifyJWT(providedToken)
      
      // Check if it's an admin token
      if (!decoded || !decoded.username || decoded.username !== 'admin') {
        return NextResponse.json(
          {
            code: 'AUTH_TOKEN_INVALID_USER',
            message: 'Token is not for admin user',
            status: 'error'
          },
          { status: 401 }
        )
      }
      
      // Token is valid
      return NextResponse.json(
        {
          code: 'AUTH_TOKEN_VALID',
          message: 'Authentication token is valid',
          status: 'success',
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'unknown',
          user: decoded.username,
          expires: new Date(decoded.exp * 1000).toISOString()
        },
        { status: 200 }
      )
      
    } catch (jwtError) {
      return NextResponse.json(
        {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Invalid or expired JWT token',
          status: 'error',
          hint: 'Token may be malformed, expired, or signed with wrong secret'
        },
        { status: 401 }
      )
    }
    
  } catch (error) {
    console.error('Auth token health probe error:', error)
    
    return NextResponse.json(
      {
        code: 'HEALTH_PROBE_ERROR',
        message: 'Internal error during token validation',
        status: 'error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Also support POST for deploy gate flexibility
  return GET(request)
}