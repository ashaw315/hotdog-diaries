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

    await logToDatabase(
      LogLevel.INFO,
      'REDDIT_CONNECTION_TEST_INITIATED',
      'Reddit API connection test initiated from admin panel'
    )

    const connectionResult = await redditScanningService.testConnection()

    if (connectionResult.success) {
      await logToDatabase(
        LogLevel.INFO,
        'REDDIT_CONNECTION_TEST_SUCCESS',
        'Reddit API connection test successful',
        { details: connectionResult.details }
      )

      return NextResponse.json({
        success: true,
        data: connectionResult.details,
        message: connectionResult.message
      })
    } else {
      await logToDatabase(
        LogLevel.WARNING,
        'REDDIT_CONNECTION_TEST_FAILED',
        `Reddit API connection test failed: ${connectionResult.message}`,
        { details: connectionResult.details }
      )

      return NextResponse.json(
        {
          success: false,
          error: connectionResult.message,
          details: connectionResult.details,
          message: 'Connection test failed'
        },
        { status: 503 } // Service Unavailable
      )
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'REDDIT_CONNECTION_TEST_ERROR',
      `Reddit API connection test error: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Connection test failed due to system error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Allow POST for compatibility, but just redirect to GET
  return GET(request)
}