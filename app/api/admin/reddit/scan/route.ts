import { NextRequest, NextResponse } from 'next/server'
import { redditScanningService } from '@/lib/services/reddit-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    const body = await request.json().catch(() => ({}))
    const maxPosts = Math.min(body.maxPosts || 20, 50) // Limit to 50 posts max

    await logToDatabase(
      LogLevel.INFO,
      'REDDIT_MANUAL_SCAN_INITIATED',
      'Manual Reddit scan initiated from admin panel',
      { maxPosts }
    )

    const scanResult = await redditScanningService.performScan({ maxPosts })

    const response = {
      success: true,
      data: {
        totalFound: scanResult.postsFound || 0,
        processed: scanResult.postsProcessed || 0,
        approved: scanResult.postsApproved || 0,
        rejected: scanResult.postsRejected || 0,
        duplicates: scanResult.duplicates || 0,
        errors: scanResult.errors || [],
        timestamp: new Date().toISOString(),
        maxPostsRequested: maxPosts
      },
      message: `Reddit scan completed: ${scanResult.postsProcessed} processed, ${scanResult.postsApproved} approved`
    }

    await logToDatabase(
      LogLevel.INFO,
      'REDDIT_MANUAL_SCAN_COMPLETED',
      `Manual Reddit scan completed: ${scanResult.postsProcessed} processed, ${scanResult.postsApproved} approved`,
      { scanResult: response.data }
    )

    return NextResponse.json(response)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logToDatabase(
      LogLevel.ERROR,
      'REDDIT_MANUAL_SCAN_ERROR',
      `Manual Reddit scan error: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Reddit scan failed'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Return scan status/configuration info for GET requests
  try {
    const config = await redditScanningService.getScanConfig()

    return NextResponse.json({
      success: true,
      data: {
        isEnabled: config.isEnabled,
        canRunManualScan: config.isEnabled,
        lastScanTime: config.lastScanTime,
        scanInterval: config.scanInterval,
        limits: {
          maxPostsPerRequest: 50,
          recommendedMaxPosts: 20
        }
      },
      message: 'Reddit scan configuration retrieved'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Failed to retrieve scan configuration'
      },
      { status: 500 }
    )
  }
}