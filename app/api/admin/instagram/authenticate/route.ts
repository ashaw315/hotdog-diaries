import { NextRequest, NextResponse } from 'next/server'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { instagramService } from '@/lib/services/instagram'
import { query, insert } from '@/lib/db-query-builder'

export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    // const auth = await verifyAdminAuth(request)
    // if (!auth.success) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   )
    // }

    const body = await request.json().catch(() => ({}))

    // Check if this is a callback with auth code
    if (body.code && body.redirectUri) {
      try {
        const tokens = await instagramService.handleInstagramAuth(body.code, body.redirectUri)
        
        // Store tokens in database
        await insert('instagram_auth')
          .values({
            user_id: tokens.userId,
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expires_at: tokens.expiresAt,
            scope: tokens.scope,
            is_active: true
          })

        await logToDatabase(
          LogLevel.INFO,
          'INSTAGRAM_AUTH_SUCCESS',
          'Instagram authentication completed from admin panel',
          { userId: tokens.userId }
        )

        return NextResponse.json({
          success: true,
          data: {
            userId: tokens.userId,
            expiresAt: tokens.expiresAt,
            scope: tokens.scope
          },
          message: 'Instagram authentication successful'
        })

      } catch (error) {
        return NextResponse.json(
          { 
            success: false, 
            error: error.message,
            message: 'Instagram authentication failed'
          },
          { status: 400 }
        )
      }
    }

    // Generate Instagram OAuth URL
    const clientId = process.env.INSTAGRAM_CLIENT_ID
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/admin/instagram/callback`

    if (!clientId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Instagram client ID not configured',
          message: 'Instagram authentication not properly configured'
        },
        { status: 500 }
      )
    }

    const scopes = ['user_profile', 'user_media'].join(',')
    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`

    return NextResponse.json({
      success: true,
      data: { authUrl },
      message: 'Instagram authentication URL generated'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'INSTAGRAM_AUTH_ERROR',
      `Instagram authentication failed: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to initiate Instagram authentication'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    
    // Get current authentication status
    const authRecord = await query('instagram_auth')
      .select(['user_id', 'expires_at', 'scope', 'is_active', 'created_at'])
      .where('is_active', true)
      .orderBy('created_at', 'desc')
      .first()

    if (!authRecord) {
      return NextResponse.json({
        success: true,
        data: {
          isAuthenticated: false,
          message: 'No active Instagram authentication found'
        }
      })
    }

    const isExpired = new Date(authRecord.expires_at) <= new Date()
    
    return NextResponse.json({
      success: true,
      data: {
        isAuthenticated: !isExpired && authRecord.is_active,
        userId: authRecord.user_id,
        expiresAt: authRecord.expires_at,
        scope: authRecord.scope,
        isExpired
      },
      message: 'Instagram authentication status retrieved'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to get Instagram authentication status'
      },
      { status: 500 }
    )
  }
}