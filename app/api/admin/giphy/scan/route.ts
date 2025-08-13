import { NextRequest, NextResponse } from 'next/server'
import { giphyScanningService } from '@/lib/services/giphy-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    const body = await request.json().catch(() => ({}))
    const maxPosts = Math.min(body.maxPosts || 10, 30) // Limit to 30 GIFs max

    const apiKey = process.env.GIPHY_API_KEY
    const mode = apiKey ? 'api' : 'mock'

    await logToDatabase(
      LogLevel.INFO,
      'GIPHY_MANUAL_SCAN_INITIATED',
      `Manual Giphy scan initiated from admin panel (${mode} mode)`,
      { maxPosts, mode }
    )

    const scanResult = await giphyScanningService.performScan({
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
      message: `Giphy scan completed in ${mode} mode: ${scanResult.processed} processed, ${scanResult.approved} approved`
    }

    await logToDatabase(
      LogLevel.INFO,
      'GIPHY_MANUAL_SCAN_COMPLETED',
      `Manual Giphy scan completed: ${scanResult.processed} processed, ${scanResult.approved} approved`,
      { scanResult: response.data }
    )

    return NextResponse.json(response)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'GIPHY_MANUAL_SCAN_ERROR',
      `Manual Giphy scan error: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Giphy scan failed'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Return scan status/configuration info for GET requests
  try {
    const config = await giphyScanningService.getScanConfig()
    const apiKey = process.env.GIPHY_API_KEY
    const mode = apiKey ? 'api' : 'mock'

    return NextResponse.json({
      success: true,
      data: {
        configuration: config,
        mode,
        environment: {
          hasApiKey: Boolean(apiKey),
          nodeEnv: process.env.NODE_ENV
        },
        limits: {
          maxPostsPerRequest: 30,
          recommendedMaxPosts: 10,
          hourlyLimit: 42,
          dailyLimit: 1000
        }
      },
      message: `Giphy scan configuration retrieved (${mode} mode)`
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