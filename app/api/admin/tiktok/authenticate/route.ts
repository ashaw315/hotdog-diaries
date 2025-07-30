import { NextRequest, NextResponse } from 'next/server'
import { tiktokService } from '@/lib/services/tiktok'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { authCode, redirectUri } = body

    if (!authCode || !redirectUri) {
      return NextResponse.json(
        { success: false, error: 'authCode and redirectUri are required' },
        { status: 400 }
      )
    }

    // Handle TikTok authentication
    const tokens = await tiktokService.handleTikTokAuth(authCode, redirectUri)

    await logToDatabase(
      LogLevel.INFO,
      'TIKTOK_AUTH_API_SUCCESS',
      'TikTok authentication completed via API',
      { openId: tokens.openId }
    )

    return NextResponse.json({
      success: true,
      data: {
        openId: tokens.openId,
        expiresAt: tokens.expiresAt.toISOString(),
        scope: tokens.scope
      }
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'TIKTOK_AUTH_API_ERROR',
      `TikTok authentication API failed: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}