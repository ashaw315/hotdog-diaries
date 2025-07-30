import { NextRequest, NextResponse } from 'next/server'
import { tiktokScanningService } from '@/lib/services/tiktok-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Trigger manual TikTok scan
    const scanResult = await tiktokScanningService.performScan()

    await logToDatabase(
      LogLevel.INFO,
      'TIKTOK_MANUAL_SCAN_API_SUCCESS',
      `Manual TikTok scan completed via API: ${scanResult.videosApproved} videos approved`,
      { scanId: scanResult.scanId }
    )

    return NextResponse.json({
      success: true,
      data: scanResult
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'TIKTOK_MANUAL_SCAN_API_ERROR',
      `Manual TikTok scan API failed: ${error.message}`,
      { error: error.message }
    )

    // Handle specific error cases
    if (error.message.includes('already in progress')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    if (error.message.includes('rate limit') || error.message.includes('quota')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}