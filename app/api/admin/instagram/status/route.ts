import { NextRequest, NextResponse } from 'next/server'
import { instagramService } from '@/lib/services/instagram'
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

    const status = await instagramService.getApiStatus()

    return NextResponse.json({
      success: true,
      data: status,
      message: 'Instagram API status retrieved successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'INSTAGRAM_STATUS_GET_ERROR',
      `Failed to get Instagram API status: ${errorMessage}`,
      { error: errorMessage }
    )

    // Return status with error information
    return NextResponse.json({
      success: true,
      data: {
        isAuthenticated: false,
        rateLimits: {
          used: 0,
          remaining: 0,
          resetTime: new Date()
        },
        lastError: errorMessage,
        lastRequest: new Date()
      },
      message: 'Instagram API status retrieved (with errors)'
    })
  }
}