import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/lib/services/social-media'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Get status of all social media platforms
    const platformData = await socialMediaService.getAllPlatformStatus()

    const responseData = {
      platforms: platformData.platformStats,
      summary: {
        totalPlatforms: platformData.totalPlatforms,
        activePlatforms: platformData.activePlatforms,
        totalContentScanned: platformData.totalContentScanned,
        totalContentApproved: platformData.totalContentApproved,
        overallHealthScore: platformData.overallHealthScore
      },
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'SOCIAL_MEDIA_STATUS_API_ERROR',
      `Failed to get social media status via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}