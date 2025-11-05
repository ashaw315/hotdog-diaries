import { NextRequest, NextResponse } from 'next/server'
import { tumblrScanningService } from '@/lib/services/tumblr-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    const body = await request.json().catch(() => ({}))
    const maxPosts = Math.min(body.maxPosts || 20, 50) // Limit to 50 posts max

    const apiKey = process.env.TUMBLR_API_KEY
    const mode = apiKey ? 'api' : 'mock'

    await logToDatabase(
      LogLevel.INFO,
      'TUMBLR_MANUAL_SCAN_INITIATED',
      `Manual Tumblr scan initiated from admin panel (${mode} mode)`,
      { maxPosts, mode }
    )

    const scanResult = await tumblrScanningService.performScan({
      maxPosts
    })

    const response = {
      success: true,
      data: {
        ...scanResult,
        mode,
        timestamp: new Date().toISOString(),
        maxPostsRequested: maxPosts
      },
      message: `Tumblr scan completed in ${mode} mode: ${scanResult.processed} processed, ${scanResult.approved} approved`
    }

    await logToDatabase(
      LogLevel.INFO,
      'TUMBLR_MANUAL_SCAN_COMPLETED',
      `Manual Tumblr scan completed: ${scanResult.processed} processed, ${scanResult.approved} approved`,
      { scanResult: response.data }
    )

    return NextResponse.json(response)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logToDatabase(
      LogLevel.ERROR,
      'TUMBLR_MANUAL_SCAN_ERROR',
      `Manual Tumblr scan error: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Tumblr scan failed'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Return scan status/configuration info for GET requests
  try {
    const apiKey = process.env.TUMBLR_API_KEY
    const mode = apiKey ? 'api' : 'mock'

    return NextResponse.json({
      success: true,
      data: {
        mode,
        environment: {
          hasApiKey: Boolean(apiKey),
          nodeEnv: process.env.NODE_ENV
        },
        limits: {
          maxPostsPerRequest: 50,
          recommendedMaxPosts: 20
        },
        searchTags: ['hotdog', 'hot dog', 'food photography', 'food blog']
      },
      message: `Tumblr scan configuration retrieved (${mode} mode)`
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
