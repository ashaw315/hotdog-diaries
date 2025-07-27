import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { NextAuthUtils } from '@/lib/auth'

async function getCurrentUserHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  try {
    // Verify authentication - this should already be handled by middleware
    // but we double-check for security
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    
    if (!authResult.isValid || !authResult.user) {
      throw createApiError('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const user = authResult.user

    // Return user profile without sensitive information
    const userProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      is_active: user.is_active,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      login_count: user.login_count
    }

    return createSuccessResponse(userProfile, 'User profile retrieved successfully')

  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      throw error
    }
    
    throw createApiError('Failed to retrieve user profile', 500, 'PROFILE_ERROR')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await getCurrentUserHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/me')
  }
}