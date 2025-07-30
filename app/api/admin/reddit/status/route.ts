import { NextRequest, NextResponse } from 'next/server'
import { RedditService } from '@/lib/services/reddit'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    // const auth = await verifyAdminAuth(request)
    // if (!auth.success) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   )
    // }

    const redditService = new RedditService()
    const status = await redditService.getApiStatus()

    return NextResponse.json({
      success: true,
      data: status,
      message: 'Reddit API status retrieved successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'REDDIT_STATUS_GET_ERROR',
      `Failed to get Reddit API status: ${errorMessage}`,
      { error: errorMessage }
    )

    // Return status with error information
    return NextResponse.json({
      success: true,
      data: {
        isConnected: false,
        rateLimits: {
          used: 0,
          remaining: 0,
          resetTime: new Date()
        },
        lastError: errorMessage,
        lastRequest: new Date(),
        userAgent: 'HotdogDiaries/1.0.0 by /u/hotdog_scanner'
      },
      message: 'Reddit API status retrieved (with errors)'
    })
  }
}