import { NextRequest, NextResponse } from 'next/server'
import { youtubeScanningService } from '@/lib/services/youtube-scanning'

export async function POST(request: NextRequest) {
  try {
    const result = await youtubeScanningService.performScan()
    
    return NextResponse.json({
      success: true,
      data: {
        scanId: result.scanId,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        videosFound: result.videosFound,
        videosProcessed: result.videosProcessed,
        videosApproved: result.videosApproved,
        videosRejected: result.videosRejected,
        videosFlagged: result.videosFlagged,
        duplicatesFound: result.duplicatesFound,
        quotaUsed: result.quotaUsed,
        searchTermsUsed: result.searchTermsUsed,
        errors: result.errors,
        nextScanTime: result.nextScanTime?.toISOString(),
        highestViewedVideo: result.highestViewedVideo
      }
    })

  } catch (error) {
    console.error('YouTube scan error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'YouTube scan failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}