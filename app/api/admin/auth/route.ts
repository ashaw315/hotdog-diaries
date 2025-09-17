import { NextRequest, NextResponse } from 'next/server'
import { AdminService } from '@/lib/services/admin'
import { AuthService } from '@/lib/services/auth'
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

    return createSuccessResponse(
      {
        user: {
          id: authResult.user.id,
          username: authResult.user.username,
          email: authResult.user.email,
          lastLogin: authResult.user.last_login
        },
        tokens: authResult.tokens
      },
      'Authentication successful'
    )

  } catch (error) {
    console.error('Login failed:', error)
    if (error instanceof Error && error.message.includes('Invalid credentials')) {
      throw createApiError('Invalid username or password', 401, 'INVALID_CREDENTIALS')
    }
    throw createApiError('Authentication failed', 500, 'AUTH_ERROR')
  }
}

async function logoutHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract token from Authorization header for logout logging
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token) {
      try {
        const decoded = AuthService.verifyJWT(token)
        console.log(`User ${decoded.username} logged out`)
      } catch {
        // Token invalid/expired - still allow logout
      }
    }

    return createSuccessResponse(
      {},
      'Logout successful'
    )

  } catch (error) {
    console.error('Logout error:', error)
    // Always return success for logout
    return createSuccessResponse({}, 'Logout completed')
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