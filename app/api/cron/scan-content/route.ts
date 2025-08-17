import { NextRequest, NextResponse } from 'next/server'
import { contentScanningService } from '@/lib/services/content-scanning'
import { ScanScheduler } from '@/lib/services/scan-scheduler'
import { scanningScheduler } from '@/lib/services/scanning-scheduler'
import { queueManager } from '@/lib/services/queue-manager'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'hotdog-cron-secret-2025'

    if (authHeader !== `Bearer ${cronSecret}`) {
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

    const { platforms, manual = false, force = false } = await request.json().catch(() => ({}))

    // Use smart scheduling unless manual or forced
    if (!manual && !force) {
      // Get queue statistics first
      const queueStats = await queueManager.getQueueStats()
      
      await logToDatabase(
        LogLevel.INFO,
        'Smart scheduling cron triggered',
        'ContentScanCronAPI',
        {
          currentQueue: queueStats.totalApproved,
          daysOfContent: queueStats.daysOfContent,
          needsScanning: queueStats.needsScanning
        }
      )

      // Execute smart daily scans
      const summary = await scanningScheduler.executeDailyScans()
      
      await logToDatabase(
        LogLevel.INFO,
        'Smart scanning completed',
        'ContentScanCronAPI',
        {
          totalScans: summary.totalScans,
          successfulScans: summary.successfulScans,
          itemsFound: summary.totalItemsFound,
          itemsApproved: summary.totalItemsApproved,
          skippedScans: summary.skippedScans,
          apiCallsSaved: summary.apiCallsSaved,
          queueGrowth: summary.queueStatsAfter.totalApproved - summary.queueStatsBefore.totalApproved
        }
      )
      
      return NextResponse.json({
        success: true,
        message: 'Smart scanning completed',
        summary
      })
    }

    // Manual or forced scan
    if (force && platforms && platforms.length > 0) {
      // Force scan specific platforms
      const results = await scanningScheduler.forceScanPlatforms(platforms, manual ? 'Manual trigger' : 'Forced scan')
      
      const totalFound = results.reduce((sum, r) => sum + r.itemsFound, 0)
      const totalApproved = results.reduce((sum, r) => sum + r.itemsApproved, 0)
      
      await logToDatabase(
        LogLevel.INFO,
        'Forced platform scan completed',
        'ContentScanCronAPI',
        {
          platforms,
          totalFound,
          totalApproved,
          successful: results.filter(r => r.success).length,
          manual
        }
      )
      
      return NextResponse.json({
        success: true,
        message: 'Forced scan completed',
        results,
        totalFound,
        totalApproved
      })
    }

    // Fallback to existing logic for compatibility
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