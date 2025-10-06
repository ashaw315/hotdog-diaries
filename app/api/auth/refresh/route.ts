import { NextRequest, NextResponse } from 'next/server'
import { AuthService, JWTPayload } from '@/lib/services/auth'
import { AdminService } from '@/lib/services/admin'
import { db } from '@/lib/db'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from request
    const body = await request.json()
    const { refreshToken, serviceAccount } = body

    // Special handling for service accounts (long-lived tokens for CI/CD)
    if (serviceAccount) {
      const serviceSecret = process.env.SERVICE_ACCOUNT_SECRET
      if (!serviceSecret || serviceAccount !== serviceSecret) {
        await logToDatabase(
          LogLevel.ERROR,
          'Invalid service account credentials',
          'auth-refresh',
          { attempt: 'service_account' }
        )
        return NextResponse.json(
          { error: 'Invalid service account credentials' },
          { status: 401 }
        )
      }

      // Generate a long-lived token for service accounts (30 days)
      const serviceUser = await AdminService.getServiceAccount()
      if (!serviceUser) {
        // Create service account if it doesn't exist
        const newServiceUser = await AdminService.createServiceAccount()
        const serviceToken = AuthService.generateServiceToken(newServiceUser)
        
        await logToDatabase(
          LogLevel.INFO,
          'Service account token generated',
          'auth-refresh',
          { userId: newServiceUser.id }
        )

        return NextResponse.json({
          accessToken: serviceToken,
          expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
          tokenType: 'service'
        })
      }

      const serviceToken = AuthService.generateServiceToken(serviceUser)
      
      await logToDatabase(
        LogLevel.INFO,
        'Service account token refreshed',
        'auth-refresh',
        { userId: serviceUser.id }
      )

      return NextResponse.json({
        accessToken: serviceToken,
        expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
        tokenType: 'service'
      })
    }

    // Regular refresh token flow
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    // Verify refresh token
    let decoded: JWTPayload
    try {
      decoded = AuthService.verifyRefreshToken(refreshToken)
    } catch (error) {
      await logToDatabase(
        LogLevel.WARNING,
        'Invalid or expired refresh token',
        'auth-refresh',
        { error: error.message }
      )
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

    // Get user from database
    const user = await AdminService.getAdminById(decoded.userId)
    if (!user) {
      await logToDatabase(
        LogLevel.ERROR,
        'User not found for refresh token',
        'auth-refresh',
        { userId: decoded.userId }
      )
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user is active
    if (!user.is_active) {
      await logToDatabase(
        LogLevel.WARNING,
        'Inactive user attempted token refresh',
        'auth-refresh',
        { userId: user.id, username: user.username }
      )
      return NextResponse.json(
        { error: 'User account is inactive' },
        { status: 403 }
      )
    }

    // Generate new tokens
    const tokens = AuthService.generateTokens({
      id: user.id,
      username: user.username
    })

    // Log successful refresh
    await logToDatabase(
      LogLevel.INFO,
      'Token refreshed successfully',
      'auth-refresh',
      { userId: user.id, username: user.username }
    )

    // Update last activity
    await AdminService.updateLastActivity(user.id)

    return NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
      tokenType: 'bearer'
    })

  } catch (error) {
    console.error('Token refresh error:', error)
    await logToDatabase(
      LogLevel.ERROR,
      'Token refresh failed',
      'auth-refresh',
      { error: error.message }
    )
    
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/auth/refresh',
    methods: ['POST'],
    description: 'Token refresh endpoint for access token renewal'
  })
}