import { NextRequest, NextResponse } from 'next/server'
import { tiktokScanningService } from '@/lib/services/tiktok-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const stats = await tiktokScanningService.getScanStats()

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'TIKTOK_STATS_API_ERROR',
      `Failed to get TikTok statistics via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}