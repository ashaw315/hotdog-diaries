import { NextRequest, NextResponse } from 'next/server'
import { instagramScanningService } from '@/lib/services/instagram-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
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
      'INSTAGRAM_MANUAL_SCAN_INITIATED',
      'Manual Instagram scan initiated from admin panel'
    )

    const result = await instagramScanningService.performScan()

    await logToDatabase(
      LogLevel.INFO,
      'INSTAGRAM_MANUAL_SCAN_COMPLETED',
      `Manual Instagram scan completed: ${result.postsApproved} posts approved`,
      { scanResult: result }
    )

    return NextResponse.json({
      success: true,
      data: result,
      message: `Scan completed: ${result.postsProcessed} posts processed, ${result.postsApproved} approved`
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'INSTAGRAM_MANUAL_SCAN_ERROR',
      `Manual Instagram scan failed: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Manual scan failed'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    
    // Get scan configuration to show current status
    const config = await instagramScanningService.getScanConfig()
    
    return NextResponse.json({
      success: true,
      data: {
        isEnabled: config.isEnabled,
        canRunManualScan: config.isEnabled,
        lastScanTime: config.lastScanTime,
        scanInterval: config.scanInterval
      },
      message: 'Scan status retrieved successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to get scan status'
      },
      { status: 500 }
    )
  }
}