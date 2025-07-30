import { NextRequest, NextResponse } from 'next/server'
import { redditScanningService } from '@/lib/services/reddit-scanning'
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

    const stats = await redditScanningService.getScanStats()

    return NextResponse.json({
      success: true,
      data: stats,
      message: 'Reddit statistics retrieved successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'REDDIT_STATS_GET_ERROR',
      `Failed to get Reddit statistics: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve Reddit statistics'
      },
      { status: 500 }
    )
  }
}