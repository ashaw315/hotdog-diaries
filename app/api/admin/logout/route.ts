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
    console.log('🚪 [Logout] Starting logout process...')
    
    // Get current user info before logout for logging
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    console.log('🚪 [Logout] Auth verification result:', { isValid: authResult.isValid, hasUser: !!authResult.user })
    
    // Create success response
    const response = createSuccessResponse(
      { message: 'Logged out successfully' },
      'Logout successful'
    )

    // Clear authentication cookies with aggressive settings
    console.log('🚪 [Logout] Clearing authentication cookies...')
    NextAuthUtils.clearAuthCookies(response)
    
    // Also clear with multiple variations to ensure compatibility
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 0
    }
    
    // Clear with different cookie name variations
    response.cookies.set('auth-token', '', cookieOptions)
    response.cookies.set('refresh-token', '', cookieOptions)
    response.cookies.set('accessToken', '', cookieOptions)
    response.cookies.set('refreshToken', '', cookieOptions)
    
    console.log('🚪 [Logout] Cookies cleared, response headers:', response.headers.getSetCookie?.())

    // Log logout event
    if (authResult.isValid && authResult.user) {
      await logToDatabase(
        LogLevel.INFO,
        'ADMIN_LOGOUT',
        `Admin user logged out: ${authResult.user.username}`,
        { userId: authResult.user.id, username: authResult.user.username }
      )
      console.log('🚪 [Logout] Logout event logged for user:', authResult.user.username)
    }

    console.log('🚪 [Logout] Logout completed successfully')
    return response

  } catch (error) {
    console.error('🚪 [Logout] Error during logout process:', error)
    
    // Even if there's an error, we should still clear cookies and log out
    const response = createSuccessResponse(
      { message: 'Logged out successfully' },
      'Logout successful'
    )
    
    NextAuthUtils.clearAuthCookies(response)
    
    // Also clear with aggressive settings
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 0
    }
    
    response.cookies.set('auth-token', '', cookieOptions)
    response.cookies.set('refresh-token', '', cookieOptions)
    
    console.log('🚪 [Logout] Error handled, cookies cleared anyway')
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