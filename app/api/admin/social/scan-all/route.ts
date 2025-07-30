import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/lib/services/social-media'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Trigger coordinated scan across all platforms
    const scanResult = await socialMediaService.performCoordinatedScan()

    await logToDatabase(
      LogLevel.INFO,
      'UNIFIED_SCAN_API_SUCCESS',
      `Unified scan completed via API: ${scanResult.totalPostsApproved} posts approved across ${scanResult.successfulPlatforms} platforms`,
      { scanId: scanResult.scanId, summary: {
        platforms: scanResult.platforms.length,
        successful: scanResult.successfulPlatforms,
        failed: scanResult.failedPlatforms,
        totalFound: scanResult.totalPostsFound,
        totalApproved: scanResult.totalPostsApproved
      }}
    )

    return NextResponse.json({
      success: true,
      data: {
        ...scanResult,
        duration: new Date(scanResult.endTime).getTime() - new Date(scanResult.startTime).getTime(),
        averageSuccessRate: scanResult.platforms.length > 0 
          ? scanResult.platforms.reduce((sum, p) => sum + (p.success ? 100 : 0), 0) / scanResult.platforms.length
          : 0
      }
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'UNIFIED_SCAN_API_ERROR',
      `Unified scan API failed: ${error.message}`,
      { error: error.message }
    )

    // Handle specific error cases
    if (error.message.includes('already in progress')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}