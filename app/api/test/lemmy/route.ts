import { NextRequest, NextResponse } from 'next/server'
import { lemmyScanningService } from '@/lib/services/lemmy-scanning'

export async function GET(request: NextRequest) {
  try {
    // Test connection first
    const connectionTest = await lemmyScanningService.testConnection()
    
    // Perform a scan
    const scanResult = await lemmyScanningService.performScan({
      maxPosts: 10
    })

    return NextResponse.json({
      success: true,
      message: 'Lemmy scan test completed',
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
    console.error('Lemmy test error:', error)
    
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