import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth Token Health Probe Endpoint
 * 
 * Validates AUTH_TOKEN against production secret for deploy gate functionality.
 * Returns 200 for valid tokens, 401 with specific error codes for mismatches.
 */

export async function GET(request: NextRequest) {
  try {
    // Get the AUTH_TOKEN from production environment
    const productionAuthToken = process.env.AUTH_TOKEN
    
    if (!productionAuthToken) {
      return NextResponse.json(
        { 
          code: 'AUTH_TOKEN_NOT_CONFIGURED',
          message: 'AUTH_TOKEN not configured in environment',
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
    
    // Validate token against production secret
    if (providedToken !== productionAuthToken) {
      return NextResponse.json(
        {
          code: 'AUTH_TOKEN_MISMATCH',
          message: 'Provided token does not match production secret',
          status: 'error',
          hint: 'Token may be expired, incorrect, or from wrong environment'
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
        environment: process.env.NODE_ENV || 'unknown'
      },
      { status: 200 }
    )
    
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