import { NextRequest, NextResponse } from 'next/server'
import { YouTubeService } from '@/lib/services/youtube'

const youtubeService = new YouTubeService()

export async function GET(request: NextRequest) {
  try {
    const apiStatus = await youtubeService.getApiStatus()
    
    return NextResponse.json({
      success: true,
      data: {
        isAuthenticated: apiStatus.isAuthenticated,
        quotaUsed: apiStatus.quotaUsed,
        quotaRemaining: apiStatus.quotaRemaining,
        dailyQuotaLimit: apiStatus.dailyQuotaLimit,
        quotaResetTime: apiStatus.quotaResetTime,
        lastError: apiStatus.lastError,
        lastRequest: apiStatus.lastRequest,
        videosScanned: 0, // Will be populated from database in full implementation
        channelsFollowed: 0, // Will be populated from database in full implementation
        avgViews: 0 // Will be populated from database in full implementation
      }
    })

  } catch (error) {
    console.error('YouTube status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get YouTube API status',
        details: error.message
      },
      { status: 500 }
    )
  }
}