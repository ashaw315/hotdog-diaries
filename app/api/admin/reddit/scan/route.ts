import { NextRequest, NextResponse } from 'next/server'
import { redditScanningService } from '@/lib/services/reddit-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { 
  createDeprecatedHandler, 
  createPlatformScanRedirectHandler 
} from '@/lib/api-deprecation'

// Original handler for backward compatibility
async function originalPOSTHandler(request: NextRequest): Promise<NextResponse> {
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
      'REDDIT_MANUAL_SCAN_INITIATED',
      'Manual Reddit scan initiated from admin panel'
    )

    const result = await redditScanningService.performScan()

    await logToDatabase(
      LogLevel.INFO,
      'REDDIT_MANUAL_SCAN_COMPLETED',
      `Manual Reddit scan completed: ${result.postsApproved} posts approved`,
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
      'REDDIT_MANUAL_SCAN_ERROR',
      `Manual Reddit scan failed: ${errorMessage}`,
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

}

// Original GET handler for backward compatibility  
async function originalGETHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Add authentication check here
    
    // Get scan configuration to show current status
    const config = await redditScanningService.getScanConfig()
    
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

// Deprecated handlers with redirection to consolidated endpoints
export const POST = createDeprecatedHandler(
  '/api/admin/reddit/scan',
  createPlatformScanRedirectHandler('reddit')
)

export const GET = createDeprecatedHandler(
  '/api/admin/reddit/scan', 
  originalGETHandler
)