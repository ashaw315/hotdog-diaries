import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Create a test response
  const response = NextResponse.json({
    message: 'Cookie test endpoint',
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(request.headers.entries()),
    cookies: Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value]))
  })

  // Set test cookies with different configurations
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 // 1 hour
  }

  console.log('🧪 [Debug] Setting test cookies with options:', cookieOptions)
  console.log('🧪 [Debug] NODE_ENV:', process.env.NODE_ENV)
  console.log('🧪 [Debug] Secure setting:', cookieOptions.secure)

  // Set multiple test cookies
  response.cookies.set('test-cookie-1', 'value1', cookieOptions)
  response.cookies.set('test-cookie-2', 'value2', {
    ...cookieOptions,
    httpOnly: false // This one should be visible to JS
  })
  response.cookies.set('test-cookie-3', 'value3', {
    ...cookieOptions,
    sameSite: 'strict'
  })

  console.log('🧪 [Debug] Test cookies set in response')

  return response
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Manual login test
    if (body.testLogin) {
      const { AdminService } = await import('@/lib/services/admin')
      const { EdgeAuthUtils } = await import('@/lib/auth-edge')
      
      console.log('🧪 [Debug] Testing manual authentication...')
      
      const authResult = await AdminService.authenticateAdmin({
        username: 'admin',
        password: 'StrongAdminPass123!'
      })
      
      console.log('🧪 [Debug] Auth result obtained')
      
      const response = NextResponse.json({
        success: true,
        user: authResult.user,
        tokenLengths: {
          access: authResult.tokens.accessToken.length,
          refresh: authResult.tokens.refreshToken.length
        },
        timestamp: new Date().toISOString()
      })
      
      console.log('🧪 [Debug] Setting auth cookies...')
      
      EdgeAuthUtils.setAuthCookies(
        response,
        authResult.tokens.accessToken,
        authResult.tokens.refreshToken
      )
      
      console.log('🧪 [Debug] Auth cookies set, returning response')
      
      return response
    }
    
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    
  } catch (error) {
    console.error('🧪 [Debug] Error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}