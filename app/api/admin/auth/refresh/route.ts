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
 * Token Refresh Endpoint
 * 
 * POST /api/admin/auth/refresh - Refresh access token
 */

async function refreshTokenHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken) {
      throw createApiError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN')
    }

    // Verify refresh token
    let decoded
    try {
      decoded = AuthService.verifyJWT(refreshToken)
    } catch (error) {
      throw createApiError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN')
    }

    // Get user and verify they still exist and are active
    const user = await AdminService.getAdminById(decoded.userId)
    if (!user || !user.is_active) {
      throw createApiError('User account not found or inactive', 401, 'USER_INACTIVE')
    }

    // Generate new access token
    const newAccessToken = AuthService.generateJWT({
      id: user.id,
      username: user.username
    })

    return createSuccessResponse(
      {
        accessToken: newAccessToken,
        refreshToken: refreshToken, // Keep same refresh token
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      },
      'Token refreshed successfully'
    )

  } catch (error) {
    console.error('Token refresh failed:', error)
    if (error instanceof Error && 
        (error.message.includes('INVALID_REFRESH_TOKEN') || 
         error.message.includes('USER_INACTIVE'))) {
      throw error
    }
    throw createApiError('Failed to refresh token', 500, 'TOKEN_REFRESH_ERROR')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['POST'])
    return await refreshTokenHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/auth/refresh')
  }
}