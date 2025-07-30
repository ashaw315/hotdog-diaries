import { NextRequest, NextResponse } from 'next/server'
import { tiktokScanningService } from '@/lib/services/tiktok-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const connectionResult = await tiktokScanningService.testConnection()

    await logToDatabase(
      LogLevel.INFO,
      'TIKTOK_CONNECTION_TEST_API',
      `TikTok connection test via API: ${connectionResult.success ? 'success' : 'failed'}`,
      { result: connectionResult }
    )

    return NextResponse.json({
      success: true,
      data: connectionResult
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'TIKTOK_CONNECTION_TEST_API_ERROR',
      `TikTok connection test API failed: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}