import { NextRequest, NextResponse } from 'next/server'
import { instagramScanningService } from '@/lib/services/instagram-scanning'
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

    const stats = await instagramScanningService.getScanStats()

    return NextResponse.json({
      success: true,
      data: stats,
      message: 'Instagram statistics retrieved successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'INSTAGRAM_STATS_GET_ERROR',
      `Failed to get Instagram statistics: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve Instagram statistics'
      },
      { status: 500 }
    )
  }
}