import { NextRequest, NextResponse } from 'next/server'
import { contentScanningService } from '@/lib/services/content-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      await logToDatabase(
        LogLevel.WARN,
        'Unauthorized cron scan request',
        'ContentScanCronAPI',
        { authHeader: authHeader ? 'present' : 'missing' }
      )
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { platforms, manual = false } = await request.json().catch(() => ({}))

    const result = await contentScanningService.runScheduledScan(platforms)

    await logToDatabase(
      LogLevel.INFO,
      'Content scanning cron job executed',
      'ContentScanCronAPI',
      { 
        scannedPlatforms: result.scannedPlatforms,
        totalFound: result.totalFound,
        totalProcessed: result.totalProcessed,
        totalApproved: result.totalApproved,
        errors: result.errors.length,
        manual
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Content scanning completed',
      results: result
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Content scanning cron job failed',
      'ContentScanCronAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const status = await contentScanningService.getScanningStatus()

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to get content scanning status',
      'ContentScanCronAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}