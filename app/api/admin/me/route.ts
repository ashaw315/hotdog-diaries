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
    // Use Edge-compatible auth utils to verify JWT from cookies
    const { EdgeAuthUtils } = await import('@/lib/auth-edge')
    
    // Get and verify JWT token from cookies or Authorization header
    const token = EdgeAuthUtils.getAuthTokenFromRequest(request)
    
    if (!token) {
      throw createApiError('No authentication token provided', 401, 'NO_TOKEN')
    }

    // Verify the JWT token
    let payload
    try {
      payload = await EdgeAuthUtils.verifyJWT(token)
    } catch (error) {
      throw createApiError('Invalid or expired token', 401, 'INVALID_TOKEN')
    }

    const userId = payload.userId
    const username = payload.username

    // Get full user profile from database
    const { AdminService } = await import('@/lib/services/admin')
    const user = await AdminService.getAdminById(userId)
    
    if (!user) {
      throw createApiError('User not found', 404, 'USER_NOT_FOUND')
    }

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
    // If it's already an auth error, re-throw it
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || 
          error.message.includes('No authentication token') || 
          error.message.includes('Invalid or expired token')) {
        throw error
      }
      
      // Log the actual error for debugging
      console.error('User profile retrieval error:', error.message)
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