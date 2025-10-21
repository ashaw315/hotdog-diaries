import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth Self-Test Endpoint
 * 
 * Validates runtime-minted JWT tokens using production JWT_SECRET.
 * Used by CI gates to verify auth configuration is working end-to-end.
 */

interface AuthSelfTestResponse {
  ok: boolean
  iss?: string
  aud?: string
  sub?: string
  keyVersion?: string | null
  now?: string
  exp?: string
  code?: string
  detail?: string
}

async function verifyJWT(token: string, secret: string) {
  // Import crypto for HMAC verification
  const crypto = await import('crypto')
  
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  
  // Decode header and payload
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  
  // Verify algorithm
  if (header.alg !== 'HS256') {
    throw new Error('Unsupported algorithm: ' + header.alg)
  }
  
  // Verify signature
  const signingInput = `${parts[0]}.${parts[1]}`
  const expectedSignature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(signingInput)
    .digest('base64url')
  
  if (parts[2] !== expectedSignature) {
    throw new Error('Invalid signature')
  }
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired')
  }
  
  return { header, payload }
}

export async function GET(request: NextRequest) {
  try {
    const jwtSecret = process.env.JWT_SECRET
    
    if (!jwtSecret) {
      return NextResponse.json({
        ok: false,
        code: 'JWT_SECRET_NOT_CONFIGURED',
        detail: 'JWT_SECRET not configured in environment'
      }, { status: 500 })
    }
    
    // Get token from request headers
    const authHeader = request.headers.get('authorization')
    const xAdminToken = request.headers.get('x-admin-token')
    
    let token: string | null = null
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else if (xAdminToken) {
      token = xAdminToken
    }
    
    if (!token) {
      return NextResponse.json({
        ok: false,
        code: 'MISSING',
        detail: 'No authentication token provided. Use Authorization: Bearer <token> or x-admin-token header'
      }, { status: 401 })
    }
    
    try {
      const { header, payload } = await verifyJWT(token, jwtSecret)
      
      const now = new Date().toISOString()
      const exp = payload.exp ? new Date(payload.exp * 1000).toISOString() : null
      
      return NextResponse.json({
        ok: true,
        iss: payload.iss,
        aud: payload.aud,
        sub: payload.sub,
        keyVersion: process.env.JWT_KEY_VERSION || null,
        now,
        exp
      }, { status: 200 })
      
    } catch (jwtError) {
      const errorMessage = jwtError instanceof Error ? jwtError.message : 'Unknown error'
      
      let code: string
      if (errorMessage.includes('Invalid signature')) {
        code = 'INVALID_SIGNATURE'
      } else if (errorMessage.includes('expired')) {
        code = 'EXPIRED'
      } else if (errorMessage.includes('Invalid JWT format')) {
        code = 'MALFORMED'
      } else {
        code = 'INVALID'
      }
      
      return NextResponse.json({
        ok: false,
        code,
        detail: errorMessage
      }, { status: 401 })
    }
    
  } catch (error) {
    console.error('Auth self-test error:', error)
    
    return NextResponse.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      detail: 'Internal error during token validation'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Support both GET and POST for CI flexibility
  return GET(request)
}