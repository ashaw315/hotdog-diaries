import { NextRequest, NextResponse } from 'next/server'
import { tumblrScanningService } from '@/lib/services/tumblr-scanning'

export async function GET(request: NextRequest) {
  try {
    // Test connection first
    const connectionTest = await tumblrScanningService.testConnection()
    
    // Perform a scan
    const scanResult = await tumblrScanningService.performScan({
      maxPosts: 3
    })

    return NextResponse.json({
      success: true,
      message: 'Tumblr scan test completed',
      data: {
        timestamp: new Date().toISOString(),
        tests: {
          connection: connectionTest,
          scanning: {
            success: scanResult.errors.length === 0,
            message: 'Scan test completed',
            data: scanResult
          }
        }
      }
    })

  } catch (error) {
    console.error('Tumblr test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error
      },
      { status: 500 }
    )
  }
}