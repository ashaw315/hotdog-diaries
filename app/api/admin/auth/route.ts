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
 * POST /api/admin/auth - Login
 * DELETE /api/admin/auth - Logout
 */

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

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['DELETE'])
    return await logoutHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/auth')
  }
}