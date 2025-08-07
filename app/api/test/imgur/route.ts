import { NextRequest, NextResponse } from 'next/server'
import { imgurScanningService } from '@/lib/services/imgur-scanning'

export async function GET(request: NextRequest) {
  try {
    // Test connection first
    const connectionTest = await imgurScanningService.testConnection()
    
    // Perform a scan
    const scanResult = await imgurScanningService.performScan({
      maxPosts: 5
    })

    return NextResponse.json({
      success: true,
      message: 'Imgur scan test completed',
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
    console.error('Imgur test error:', error)
    
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