import { NextRequest, NextResponse } from 'next/server'
import { pixabayScanningService } from '@/lib/services/pixabay-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Parse request body for scan parameters
    let maxPosts = 10 // Default
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
      'MANUAL_PIXABAY_SCAN_STARTED',
      'Starting manual Pixabay scan via admin endpoint',
      { maxPosts, triggeredBy: 'admin_api' }
    )

    console.log(`🔍 Starting Pixabay scan with maxPosts: ${maxPosts}`)
    
    const startTime = Date.now()
    const result = await pixabayScanningService.performScan({ maxPosts })
    const duration = Date.now() - startTime

    console.log(`✅ Pixabay scan completed in ${duration}ms:`, result)

    await logToDatabase(
      LogLevel.INFO,
      'MANUAL_PIXABAY_SCAN_COMPLETED',
      'Manual Pixabay scan completed successfully',
      { 
        ...result, 
        duration,
        triggeredBy: 'admin_api'
      }
    )

    return NextResponse.json({
      success: true,
      message: `Pixabay scan completed: ${result.approved} approved, ${result.rejected} rejected`,
      data: {
        scanId: `pixabay_scan_${Date.now()}`,
        startTime: new Date(Date.now() - duration).toISOString(),
        endTime: new Date().toISOString(),
        duration: `${duration}ms`,
        imagesFound: result.totalFound,
        imagesProcessed: result.processed,
        imagesApproved: result.approved,
        imagesRejected: result.rejected,
        duplicatesFound: result.duplicates,
        errors: result.errors,
        nextScanTime: new Date(Date.now() + 240 * 60 * 1000).toISOString() // 4 hours later
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'MANUAL_PIXABAY_SCAN_ERROR',
      `Manual Pixabay scan failed: ${errorMessage}`,
      { error: errorMessage, triggeredBy: 'admin_api' }
    )

    console.error('Pixabay scan error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Pixabay scan failed',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}