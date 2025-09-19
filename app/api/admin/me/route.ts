import { NextRequest, NextResponse } from 'next/server'
import { EdgeAuthUtils } from '@/lib/auth-edge'

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[AdminMeAPI] Incoming request to /api/admin/me')

  const token = EdgeAuthUtils.getAuthTokenFromRequest(request)
  if (!token) {
    console.warn('[AdminMeAPI] No token found')
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const user = await EdgeAuthUtils.verifyJWT(token)
    if (!user) {
      console.warn('[AdminMeAPI] Invalid token')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('[AdminMeAPI] User verified:', user.username)

    // Get full user profile from database
    const { AdminService } = await import('@/lib/services/admin')
    const fullUser = await AdminService.getAdminById(user.userId)
    
    if (!fullUser) {
      console.warn('[AdminMeAPI] User not found in database')
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Return user profile without sensitive information
    const userProfile = {
      id: fullUser.id,
      username: fullUser.username,
      email: fullUser.email,
      full_name: fullUser.full_name,
      is_active: fullUser.is_active,
      created_at: fullUser.created_at,
      last_login_at: fullUser.last_login_at,
      login_count: fullUser.login_count
    }

    return NextResponse.json({
      success: true,
      data: userProfile,
      message: 'User profile retrieved successfully'
    })

  } catch (error) {
    console.error('[AdminMeAPI] JWT verification failed:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}