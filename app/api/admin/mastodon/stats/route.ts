import { NextRequest, NextResponse } from 'next/server'
import { mastodonService } from '@/lib/services/mastodon'
import { mastodonScanningService } from '@/lib/services/mastodon-scanning'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const [scanningStats, instanceStats, recentScans, contentToday, totalContent] = await Promise.all([
      mastodonScanningService.getScanningStats(),
      mastodonService.getInstanceStats(),
      mastodonScanningService.getRecentScanResults(5),
      mastodonScanningService.getContentAddedToday(),
      mastodonScanningService.getTotalContentCount()
    ])
    
    return NextResponse.json({
      success: true,
      data: {
        scanningStats,
        instanceStats,
        recentScans,
        contentToday,
        totalContent,
        platform: 'mastodon'
      },
      message: 'Mastodon statistics retrieved successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Mastodon test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}