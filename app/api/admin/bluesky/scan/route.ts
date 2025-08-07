import { NextRequest, NextResponse } from 'next/server'
import { blueskyService } from '@/lib/services/bluesky-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Parse request body for scan parameters
    let maxPosts = 20 // Default
    try {
      const body = await request.json()
      if (body.maxPosts && typeof body.maxPosts === 'number') {
        maxPosts = body.maxPosts
      }
    } catch {
      // Use default if no valid body
    }

    await logToDatabase(
      LogLevel.INFO,
      'MANUAL_BLUESKY_SCAN_STARTED',
      'Starting manual Bluesky scan via admin endpoint',
      { maxPosts, triggeredBy: 'admin_api' }
    )

    console.log(`🔍 Starting Bluesky scan with maxPosts: ${maxPosts}`)
    
    const startTime = Date.now()
    const result = await blueskyService.performScan({ maxPosts })
    const duration = Date.now() - startTime

    console.log(`✅ Bluesky scan completed in ${duration}ms:`, result)

    await logToDatabase(
      LogLevel.INFO,
      'MANUAL_BLUESKY_SCAN_COMPLETED',
      'Manual Bluesky scan completed successfully',
      { 
        ...result, 
        duration,
        triggeredBy: 'admin_api'
      }
    )

    return NextResponse.json({
      success: true,
      message: `Bluesky scan completed: ${result.approved} approved, ${result.rejected} rejected`,
      data: {
        scanId: `bluesky_scan_${Date.now()}`,
        startTime: new Date(Date.now() - duration).toISOString(),
        endTime: new Date().toISOString(),
        duration: `${duration}ms`,
        postsFound: result.totalFound,
        postsProcessed: result.processed,
        postsApproved: result.approved,
        postsRejected: result.rejected,
        duplicatesFound: result.duplicates,
        errors: result.errors,
        nextScanTime: new Date(Date.now() + 240 * 60 * 1000).toISOString() // 4 hours later
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'MANUAL_BLUESKY_SCAN_ERROR',
      `Manual Bluesky scan failed: ${errorMessage}`,
      { error: errorMessage, triggeredBy: 'admin_api' }
    )

    console.error('Bluesky scan error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Bluesky scan failed',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}