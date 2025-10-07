import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/services/queue-manager'
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

    console.log('📊 Queue health check requested...')

    // Get comprehensive queue health data
    const [
      queueStats,
      queueHealthCheck,
      scanRecommendations,
      scanStatus
    ] = await Promise.all([
      queueManager.getQueueStats(),
      queueManager.isQueueHealthy(),
      queueManager.getScanRecommendations(),
      autoScanManager.getScanStatus()
    ])

    // Calculate platform diversity score
    const platformCount = Object.keys(queueStats.platforms).length
    const totalPlatforms = 8 // Expected number of platforms
    const diversityScore = platformCount / totalPlatforms

    // Calculate content type balance score
    const contentTypeTargets = { video: 0.30, gif: 0.25, image: 0.40, text: 0.05 }
    let typeBalanceScore = 0
    let typeCount = 0
    
    for (const [type, target] of Object.entries(contentTypeTargets)) {
      const actual = queueStats.contentTypePercentages[type] || 0
      const ratio = actual / target
      const score = Math.min(ratio, 1 / ratio) // Score between 0-1, where 1 is perfect balance
      typeBalanceScore += score
      typeCount++
    }
    typeBalanceScore = typeCount > 0 ? typeBalanceScore / typeCount : 0

    // Determine overall health status
    let healthStatus: 'healthy' | 'warning' | 'critical' | 'emergency'
    let healthColor: string
    let healthMessage: string

    if (queueStats.totalApproved === 0) {
      healthStatus = 'emergency'
      healthColor = '#ff0000'
      healthMessage = 'EMERGENCY: No approved content available'
    } else if (queueStats.totalApproved < 12) { // Less than 2 days
      healthStatus = 'critical'
      healthColor = '#ff6600'
      healthMessage = `CRITICAL: Only ${queueStats.daysOfContent.toFixed(1)} days of content remaining`
    } else if (queueStats.totalApproved < 24 || !queueHealthCheck.healthy) { // Less than 4 days or other issues
      healthStatus = 'warning'
      healthColor = '#ffaa00'
      healthMessage = `WARNING: ${queueStats.daysOfContent.toFixed(1)} days of content, ${queueHealthCheck.issues.length} issues`
    } else {
      healthStatus = 'healthy'
      healthColor = '#00aa00'
      healthMessage = `HEALTHY: ${queueStats.daysOfContent.toFixed(1)} days of content available`
    }

    // Get top platforms and content types
    const topPlatforms = Object.entries(queueStats.platforms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([platform, count]) => ({
        platform,
        count,
        percentage: queueStats.totalApproved > 0 ? (count / queueStats.totalApproved * 100).toFixed(1) : '0'
      }))

    const contentTypesData = Object.entries(queueStats.contentTypes)
      .map(([type, count]) => ({
        type,
        count,
        percentage: queueStats.totalApproved > 0 ? (count / queueStats.totalApproved * 100).toFixed(1) : '0',
        target: (contentTypeTargets[type as keyof typeof contentTypeTargets] * 100).toFixed(1)
      }))

    // Get priority scan recommendations
    const priorityScans = scanRecommendations.filter(rec => 
      rec.priority === 'high' || rec.priority === 'medium'
    )

    // Build response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      health: {
        status: healthStatus,
        color: healthColor,
        message: healthMessage,
        score: Math.round((queueStats.daysOfContent / 7) * 100), // Percentage of optimal (7 days)
        isHealthy: queueHealthCheck.healthy
      },
      queue: {
        totalApproved: queueStats.totalApproved,
        totalPending: queueStats.totalPending,
        daysOfContent: Math.round(queueStats.daysOfContent * 10) / 10,
        optimalDays: 7,
        needsScanning: queueStats.needsScanning
      },
      diversity: {
        platformCount,
        totalPlatforms,
        diversityScore: Math.round(diversityScore * 100),
        contentTypeBalanceScore: Math.round(typeBalanceScore * 100),
        topPlatforms,
        contentTypes: contentTypesData
      },
      issues: queueHealthCheck.issues,
      recommendations: {
        immediate: priorityScans.filter(rec => rec.priority === 'high'),
        suggested: priorityScans.filter(rec => rec.priority === 'medium'),
        nextScanTime: scanStatus.nextScanTime
      },
      automation: {
        autoScanEnabled: !!process.env.GITHUB_TOKEN,
        lastScanResult: 'Available via /api/admin/auto-scan',
        emergencyThreshold: 12, // Less than 2 days triggers emergency
        warningThreshold: 24    // Less than 4 days triggers warning
      },
      actions: {
        canTriggerScans: !!process.env.GITHUB_TOKEN || !!process.env.AUTH_TOKEN,
        recommendedActions: getRecommendedActions(queueStats, queueHealthCheck, priorityScans)
      }
    }

    await loggingService.logInfo('QueueHealthAPI', 'Queue health check completed', {
      status: healthStatus,
      totalApproved: queueStats.totalApproved,
      daysOfContent: queueStats.daysOfContent,
      issueCount: queueHealthCheck.issues.length,
      priorityScans: priorityScans.length
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Queue health check failed:', error)
    
    await loggingService.logError('QueueHealthAPI', 'Queue health check failed', {}, error as Error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      health: {
        status: 'critical',
        color: '#ff0000',
        message: 'Unable to check queue health',
        score: 0,
        isHealthy: false
      }
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
    const { action = 'auto-scan', emergency = false } = body

    console.log(`🚀 Queue health action requested: ${action}`)

    let result
    if (action === 'auto-scan') {
      if (emergency) {
        console.log('⚠️ Emergency replenishment triggered')
        result = await autoScanManager.emergencyReplenishment()
      } else {
        console.log('🤖 Auto-scan triggered')
        result = await autoScanManager.performAutoScan()
      }
    } else {
      return NextResponse.json({
        success: false,
        error: `Unknown action: ${action}. Supported actions: auto-scan`
      }, { status: 400 })
    }

    await loggingService.logInfo('QueueHealthAPI', `Queue health action completed: ${action}`, {
      action,
      emergency,
      success: result.success,
      triggeredScans: result.triggeredScans.length,
      errors: result.errors.length
    })

    return NextResponse.json({
      success: true,
      action,
      emergency,
      result
    })

  } catch (error) {
    console.error(`❌ Queue health action failed:`, error)
    
    await loggingService.logError('QueueHealthAPI', 'Queue health action failed', {}, error as Error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Generate recommended actions based on queue state
 */
function getRecommendedActions(
  queueStats: any,
  queueHealthCheck: any,
  priorityScans: any[]
): string[] {
  const actions: string[] = []

  if (queueStats.totalApproved === 0) {
    actions.push('EMERGENCY: Trigger emergency content replenishment')
    actions.push('Manually approve pending content if available')
    actions.push('Check platform API credentials')
  } else if (queueStats.totalApproved < 12) {
    actions.push('URGENT: Trigger auto-scan for priority platforms')
    actions.push('Approve more pending content')
    actions.push('Consider running emergency replenishment')
  } else if (queueStats.totalApproved < 24) {
    actions.push('Schedule content scanning for depleted platforms')
    actions.push('Review content approval thresholds')
  }

  if (priorityScans.length > 0) {
    const highPriority = priorityScans.filter(s => s.priority === 'high')
    if (highPriority.length > 0) {
      actions.push(`Scan high-priority platforms: ${highPriority.map(s => s.platform).join(', ')}`)
    }
  }

  if (queueHealthCheck.issues.length > 0) {
    actions.push('Address platform balance issues')
    actions.push('Review content type distribution')
  }

  if (actions.length === 0) {
    actions.push('Queue is healthy - no immediate actions required')
    actions.push('Monitor queue levels and platform diversity')
  }

  return actions
}