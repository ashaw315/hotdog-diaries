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
 * Current User Information Endpoint
 * 
 * GET /api/admin/auth/me - Get current authenticated user
 */

async function getCurrentUserHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Get auth token from Authorization header OR cookies (Edge compatible)
    let token: string | null = null
    
    // First try Authorization header
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '')
    } else {
      // Fallback to cookies (for httpOnly cookie auth)
      token = EdgeAuthUtils.getAuthTokenFromRequest(request)
    }
    
    if (!token) {
      throw createApiError('No authentication token provided', 401, 'NO_TOKEN')
    }

    // Try standard JWT verification first (for compatibility)
    let decoded
    try {
      decoded = AuthService.verifyJWT(token)
    } catch (error) {
      // Fallback to Edge JWT verification for older tokens
      console.log('Standard JWT verification failed, trying Edge JWT verification')
      decoded = await EdgeAuthUtils.verifyJWT(token)
    }
    
    // Get full user details
    const user = await AdminService.getAdminById(decoded.userId)
    if (!user) {
      throw createApiError('User not found', 404, 'USER_NOT_FOUND')
    }

    return createSuccessResponse(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        isActive: user.is_active,
        lastLogin: user.last_login_at,
        createdAt: user.created_at
      },
      'User information retrieved successfully'
    )

  } catch (error) {
    console.error('Failed to get current user:', error)
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      throw error
    }
    throw createApiError('Failed to retrieve user information', 500, 'USER_INFO_ERROR')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['GET'])
    return await getCurrentUserHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/auth/me')
  }
}