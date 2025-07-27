import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  handleApiError
} from '@/lib/api-middleware'
import { NextAuthUtils } from '@/lib/auth'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

async function logoutHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    // Get current user info before logout for logging
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    
    // Create success response
    const response = createSuccessResponse(
      { message: 'Logged out successfully' },
      'Logout successful'
    )

    // Clear authentication cookies
    NextAuthUtils.clearAuthCookies(response)

    // Log logout event
    if (authResult.isValid && authResult.user) {
      await logToDatabase(
        LogLevel.INFO,
        'ADMIN_LOGOUT',
        `Admin user logged out: ${authResult.user.username}`,
        { userId: authResult.user.id, username: authResult.user.username }
      )
    }

    return response

  } catch (error) {
    // Even if there's an error, we should still clear cookies and log out
    const response = createSuccessResponse(
      { message: 'Logged out successfully' },
      'Logout successful'
    )
    
    NextAuthUtils.clearAuthCookies(response)
    
    return response
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await logoutHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/logout')
  }
}