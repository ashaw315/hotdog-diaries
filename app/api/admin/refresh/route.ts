import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { NextAuthUtils, REFRESH_COOKIE_NAME } from '@/lib/auth'

async function refreshTokenHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    // Get refresh token from cookies
    const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value

    if (!refreshToken) {
      throw createApiError('Refresh token not found', 401, 'REFRESH_TOKEN_MISSING')
    }

    // Attempt to refresh the tokens
    const newTokens = await NextAuthUtils.refreshAccessToken(refreshToken)

    if (!newTokens) {
      throw createApiError('Invalid or expired refresh token', 401, 'REFRESH_TOKEN_INVALID')
    }

    // Create success response
    const response = createSuccessResponse(
      { 
        message: 'Tokens refreshed successfully',
        expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
      },
      'Tokens refreshed successfully'
    )

    // Set new authentication cookies
    await NextAuthUtils.setAuthCookies(
      response,
      newTokens.accessToken,
      newTokens.refreshToken
    )

    return response

  } catch (error) {
    // Clear cookies on refresh failure
    const response = NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
        code: 'REFRESH_FAILED'
      },
      { status: 401 }
    )

    NextAuthUtils.clearAuthCookies(response)
    return response
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await refreshTokenHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/refresh')
  }
}