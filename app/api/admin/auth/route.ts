import { NextRequest, NextResponse } from 'next/server'
import { AdminService } from '@/lib/services/admin'
import { AuthService } from '@/lib/services/auth'
import { EdgeAuthUtils } from '@/lib/auth-edge'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'

/**
 * Consolidated Authentication Endpoint
 * 
 * GET /api/admin/auth - Verify authentication (token/cookie)
 * POST /api/admin/auth - Login
 * DELETE /api/admin/auth - Logout
 */

async function verifyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    console.log(`[AuthAPI] Verifying token via GET /auth at ${new Date().toISOString()}`)
    
    // Extract token from Authorization header or cookies
    const authHeader = request.headers.get('authorization')
    let token = authHeader?.replace('Bearer ', '')
    
    // If no authorization header, try to get from cookies (primary method)
    if (!token) {
      token = EdgeAuthUtils.getAuthTokenFromRequest(request)
      console.log(`[AuthAPI] Token from cookies: ${token ? 'present' : 'not found'}`)
    } else {
      console.log(`[AuthAPI] Token from Authorization header: present`)
    }

    if (!token) {
      console.log(`[AuthAPI] No authentication token found`)
      return NextResponse.json({
        success: false,
        message: "Not authenticated"
      }, { status: 401 })
    }

    // Verify the JWT token
    try {
      const decoded = AuthService.verifyJWT(token)
      console.log(`[AuthAPI] Token verified for user: ${decoded.username}`)
      
      // Get fresh user data from database
      const user = await AdminService.getAdminById(decoded.userId)
      
      if (!user) {
        console.log(`[AuthAPI] User not found in database: ${decoded.userId}`)
        return NextResponse.json({
          success: false,
          message: "User not found"
        }, { status: 401 })
      }

      if (!user.is_active) {
        console.log(`[AuthAPI] User account is not active: ${user.username}`)
        return NextResponse.json({
          success: false,
          message: "Account disabled"
        }, { status: 401 })
      }

      console.log(`[AuthAPI] Authentication verification successful for: ${user.username}`)
      
      return NextResponse.json({
        success: true,
        data: {
          valid: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            lastLogin: user.last_login_at
          }
        },
        message: "Token verified"
      })

    } catch (tokenError) {
      console.log(`[AuthAPI] Token verification failed: ${tokenError.message}`)
      return NextResponse.json({
        success: false,
        message: "Invalid or expired token"
      }, { status: 401 })
    }

  } catch (error) {
    console.error(`[AuthAPI] Token verification error:`, error)
    return NextResponse.json({
      success: false,
      message: "Authentication verification failed"
    }, { status: 500 })
  }
}

async function loginHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      throw createApiError('Username and password are required', 400, 'MISSING_CREDENTIALS')
    }

    const authResult = await AdminService.authenticateAdmin({ username, password })

    // Create success response
    const response = createSuccessResponse(
      {
        user: {
          id: authResult.user.id,
          username: authResult.user.username,
          email: authResult.user.email,
          lastLogin: authResult.user.last_login_at
        },
        tokens: authResult.tokens
      },
      'Authentication successful'
    )

    // Set authentication cookies for httpOnly cookie auth
    console.log('🍪 [Auth] Setting authentication cookies for user:', authResult.user.username)
    
    EdgeAuthUtils.setAuthCookies(
      response,
      authResult.tokens.accessToken,
      authResult.tokens.refreshToken
    )
    
    console.log('🍪 [Auth] Cookies set in response')

    return response

  } catch (error) {
    console.error('Login failed:', error)
    if (error instanceof Error && error.message.includes('Invalid username or password')) {
      throw createApiError('Invalid username or password', 401, 'INVALID_CREDENTIALS')
    }
    throw createApiError('Authentication failed', 500, 'AUTH_ERROR')
  }
}

async function logoutHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract token from Authorization header or cookies for logout logging
    const authHeader = request.headers.get('authorization')
    let token = authHeader?.replace('Bearer ', '')
    
    // If no authorization header, try to get from cookies
    if (!token) {
      token = EdgeAuthUtils.getAuthTokenFromRequest(request)
    }

    if (token) {
      try {
        const decoded = AuthService.verifyJWT(token)
        console.log(`🚪 [Logout] User ${decoded.username} logging out`)
      } catch {
        // Token invalid/expired - still allow logout
        console.log('🚪 [Logout] Token invalid/expired - proceeding with logout')
      }
    }

    // Create the response
    const response = createSuccessResponse(
      {},
      'Logout successful'
    )

    // CRITICAL: Clear the authentication cookies
    console.log('🍪 [Logout] Clearing authentication cookies')
    EdgeAuthUtils.clearAuthCookies(response)
    
    console.log('🚪 [Logout] Logout complete - cookies cleared')

    return response

  } catch (error) {
    console.error('Logout error:', error)
    // Always return success for logout and clear cookies
    const response = createSuccessResponse({}, 'Logout completed')
    EdgeAuthUtils.clearAuthCookies(response)
    return response
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['POST'])
    return await loginHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/auth')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['GET'])
    return await verifyHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/auth')
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['DELETE'])
    return await logoutHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/auth')
  }
}