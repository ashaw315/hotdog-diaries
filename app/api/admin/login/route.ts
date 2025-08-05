import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  validateJsonBody,
  handleApiError
} from '@/lib/api-middleware'
import { AdminService } from '@/lib/services/admin'
import { NextAuthUtils, AuthValidation } from '@/lib/auth'

interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

interface LoginResponse {
  user: {
    id: number
    username: string
    email?: string
    full_name?: string
    last_login_at?: Date
  }
  expiresAt: Date
}

async function loginHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  const body = await validateJsonBody<LoginRequest>(request)

  // Validate input format
  const validation = AuthValidation.validateLoginCredentials(body.username, body.password)
  if (!validation.isValid) {
    throw createApiError(`Validation failed: ${validation.errors.join(', ')}`, 400, 'VALIDATION_ERROR')
  }

  // Sanitize username
  const sanitizedUsername = AuthValidation.sanitizeUsername(body.username)

  try {
    // Authenticate user
    const authResult = await AdminService.authenticateAdmin({
      username: sanitizedUsername,
      password: body.password
    })

    // Create response with user data
    const responseData: LoginResponse = {
      user: {
        id: authResult.user.id,
        username: authResult.user.username,
        email: authResult.user.email,
        full_name: authResult.user.full_name,
        last_login_at: authResult.user.last_login_at
      },
      expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
    }

    // Create success response
    const response = createSuccessResponse(responseData, 'Login successful')

    // Set authentication cookies using Edge-compatible utils
    const { EdgeAuthUtils } = await import('@/lib/auth-edge')
    
    console.log('🍪 [Login] Setting authentication cookies for user:', authResult.user.username)
    console.log('🍪 [Login] Access token length:', authResult.tokens.accessToken.length)
    console.log('🍪 [Login] Refresh token length:', authResult.tokens.refreshToken.length)
    
    EdgeAuthUtils.setAuthCookies(
      response,
      authResult.tokens.accessToken,
      authResult.tokens.refreshToken
    )
    
    console.log('🍪 [Login] Cookies set in response, returning to client')

    return response

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid username or password')) {
        throw createApiError('Invalid username or password', 401, 'INVALID_CREDENTIALS')
      }
      if (error.message.includes('inactive')) {
        throw createApiError('Account is inactive', 403, 'ACCOUNT_INACTIVE')
      }
    }
    
    throw createApiError('Authentication failed', 500, 'AUTH_ERROR')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await loginHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/login')
  }
}