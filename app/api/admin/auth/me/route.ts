import { NextRequest, NextResponse } from 'next/server'
import { AdminService } from '@/lib/services/admin'
import { AuthService } from '@/lib/services/auth'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError,
  verifyAdminAuth
} from '@/lib/api-middleware'

/**
 * Current User Information Endpoint
 * 
 * GET /api/admin/auth/me - Get current authenticated user
 */

async function getCurrentUserHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const authResult = await verifyAdminAuth(request)
    if (!authResult.success) {
      throw createApiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    // Get full user details
    const user = await AdminService.getAdminById(authResult.user.id)
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
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
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