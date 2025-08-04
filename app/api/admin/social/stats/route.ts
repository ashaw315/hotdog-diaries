import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/lib/services/social-media'

export async function GET(request: NextRequest) {
  try {
    const stats = await socialMediaService.getAllPlatformStatus()
    
    return NextResponse.json({
      success: true,
      data: {
        totalPlatforms: stats.totalPlatforms,
        activePlatforms: stats.activePlatforms,
        totalContentScanned: stats.totalContentScanned,
        totalContentApproved: stats.totalContentApproved,
        overallHealthScore: stats.overallHealthScore,
        platformStats: stats.platformStats.map(platform => ({
          platform: platform.platform,
          isEnabled: platform.isEnabled,
          isAuthenticated: platform.isAuthenticated,
          lastScanTime: platform.lastScanTime?.toISOString(),
          nextScanTime: platform.nextScanTime?.toISOString(),
          totalContent: platform.totalContent,
          errorRate: platform.errorRate,
          healthStatus: platform.healthStatus
        }))
      }
    })

  } catch (error) {
    console.error('Social media stats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get social media statistics',
        details: error.message
      },
      { status: 500 }
    )
  }
}