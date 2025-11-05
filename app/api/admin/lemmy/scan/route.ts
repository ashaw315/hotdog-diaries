import { NextRequest, NextResponse } from 'next/server'
import { lemmyScanningService } from '@/lib/services/lemmy-scanning'
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
      'LEMMY_MANUAL_SCAN_INITIATED',
      'Manual Lemmy scan initiated from admin panel',
      { maxPosts }
    )

    const scanResult = await lemmyScanningService.performScan({
      maxPosts
    })

    const response = {
      success: true,
      data: {
        ...scanResult,
        timestamp: new Date().toISOString(),
        maxPostsRequested: maxPosts
      },
      message: `Lemmy scan completed: ${scanResult.processed} processed, ${scanResult.approved} approved`
    }

    await logToDatabase(
      LogLevel.INFO,
      'LEMMY_MANUAL_SCAN_COMPLETED',
      `Manual Lemmy scan completed: ${scanResult.processed} processed, ${scanResult.approved} approved`,
      { scanResult: response.data }
    )

    return NextResponse.json(response)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logToDatabase(
      LogLevel.ERROR,
      'LEMMY_MANUAL_SCAN_ERROR',
      `Manual Lemmy scan error: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Lemmy scan failed'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Return scan status/configuration info for GET requests
  try {
    return NextResponse.json({
      success: true,
      data: {
        mode: 'federated',
        environment: {
          nodeEnv: process.env.NODE_ENV
        },
        limits: {
          maxPostsPerRequest: 50,
          recommendedMaxPosts: 20
        },
        federatedCommunities: ['lemmy.world/c/hot_dog', 'lemmy.world/c/food']
      },
      message: 'Lemmy scan configuration retrieved (federated mode)'
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
