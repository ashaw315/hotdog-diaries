import { NextRequest, NextResponse } from 'next/server'
import { autoScanManager } from '@/lib/services/auto-scan-manager'
import { loggingService } from '@/lib/services/logging'

export async function GET(request: NextRequest) {
  try {
    // Auth check for GitHub Actions and admin access
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('📊 Auto-scan status requested...')

    // Get current scan status without triggering scans
    const status = await autoScanManager.getScanStatus()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      status: {
        queueHealth: status.queueHealth,
        recommendations: status.recommendations,
        nextScheduledScan: status.nextScanTime,
        autoScanEnabled: !!process.env.GITHUB_TOKEN || !!process.env.AUTH_TOKEN,
        emergencyThreshold: 12, // Triggers emergency scans
        warningThreshold: 24    // Triggers warning alerts
      },
      capabilities: {
        githubWorkflows: !!process.env.GITHUB_TOKEN,
        directApiCalls: !!process.env.AUTH_TOKEN,
        emergencyReplenishment: true,
        smartPlatformSelection: true
      }
    })

  } catch (error) {
    console.error('❌ Auto-scan status failed:', error)
    
    await loggingService.logError('AutoScanAPI', 'Auto-scan status check failed', {}, error as Error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check for GitHub Actions and admin access
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { 
      mode = 'auto',           // 'auto', 'emergency', 'status-only'
      force = false,           // Force scans even if not recommended
      platforms = null,        // Specific platforms to target (array)
      dryRun = false          // Preview what would be scanned without doing it
    } = body

    console.log(`🚀 Auto-scan triggered with mode: ${mode}`)

    let result

    if (mode === 'status-only' || dryRun) {
      // Return scan recommendations without actually triggering scans
      const status = await autoScanManager.getScanStatus()
      
      result = {
        success: true,
        mode: dryRun ? 'dry-run' : 'status-only',
        triggeredScans: [],
        skippedScans: [],
        errors: [],
        queueHealth: status.queueHealth,
        recommendations: status.recommendations,
        wouldTrigger: status.recommendations
          .filter(rec => rec.priority === 'high' || rec.priority === 'medium')
          .map(rec => `${rec.platform} (${rec.priority}): ${rec.reason}`)
      }

      if (dryRun) {
        console.log('🧪 Dry run completed - no scans triggered')
      }

    } else if (mode === 'emergency') {
      console.log('⚠️ Emergency replenishment mode activated')
      result = await autoScanManager.emergencyReplenishment()
      
    } else if (mode === 'auto') {
      console.log('🤖 Auto-scan mode activated')
      result = await autoScanManager.performAutoScan()
      
    } else {
      return NextResponse.json({
        success: false,
        error: `Invalid mode: ${mode}. Supported modes: auto, emergency, status-only`
      }, { status: 400 })
    }

    // Log the auto-scan result
    await loggingService.logInfo('AutoScanAPI', 'Auto-scan completed', {
      mode,
      force,
      platforms,
      dryRun,
      success: result.success,
      triggeredScans: result.triggeredScans?.length || 0,
      errors: result.errors?.length || 0
    })

    // Enhance response with additional metadata
    const enhancedResult = {
      ...result,
      metadata: {
        mode,
        triggeredAt: new Date().toISOString(),
        triggeredBy: 'auto-scan-api',
        dryRun,
        force,
        platforms: platforms || 'all-eligible'
      },
      summary: {
        totalTriggered: result.triggeredScans?.length || 0,
        totalSkipped: result.skippedScans?.length || 0,
        totalErrors: result.errors?.length || 0,
        queueDaysAfter: result.queueHealth?.daysOfContent || 0,
        isQueueHealthy: result.queueHealth?.isHealthy || false
      }
    }

    return NextResponse.json(enhancedResult)

  } catch (error) {
    console.error('❌ Auto-scan failed:', error)
    
    await loggingService.logError('AutoScanAPI', 'Auto-scan execution failed', {}, error as Error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        mode: 'unknown',
        triggeredAt: new Date().toISOString(),
        triggeredBy: 'auto-scan-api',
        failed: true
      }
    }, { status: 500 })
  }
}

// OPTIONS for CORS if needed
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}