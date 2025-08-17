import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/services/queue-manager'
import { scanningScheduler } from '@/lib/services/scanning-scheduler'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing Queue Management System...')
    
    // Get queue statistics
    const stats = await queueManager.getQueueStats()
    console.log(`📊 Queue Status: ${stats.totalApproved} items (${stats.daysOfContent.toFixed(1)} days)`)
    
    // Get scan recommendations  
    const recommendations = await queueManager.getScanRecommendations()
    console.log(`📋 Scan Recommendations: ${recommendations.length} platforms analyzed`)
    
    // Check queue health
    const health = await queueManager.isQueueHealthy()
    console.log(`💚 Queue Health: ${health.healthy ? 'Healthy' : 'Issues Found'}`)
    
    // Get weekly schedule
    const schedule = await scanningScheduler.getWeeklySchedule()
    console.log(`📅 Weekly Schedule: ${schedule.filter(d => d.shouldScan).length}/7 days need scanning`)

    // Test smart scanning logic
    const shouldScanTests = await Promise.all([
      queueManager.shouldScanPlatform('pixabay'),
      queueManager.shouldScanPlatform('youtube'),
      queueManager.shouldScanPlatform('reddit')
    ])

    return NextResponse.json({
      success: true,
      message: 'Queue management system test completed',
      data: {
        queueStats: {
          totalApproved: stats.totalApproved,
          daysOfContent: stats.daysOfContent,
          needsScanning: stats.needsScanning,
          platformDistribution: Object.entries(stats.platforms)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([platform, count]) => ({ platform, count, percentage: ((stats.platformPercentages[platform] || 0) * 100).toFixed(1) }))
        },
        contentBalance: {
          video: ((stats.contentTypePercentages.video || 0) * 100).toFixed(1) + '%',
          gif: ((stats.contentTypePercentages.gif || 0) * 100).toFixed(1) + '%', 
          image: ((stats.contentTypePercentages.image || 0) * 100).toFixed(1) + '%',
          text: ((stats.contentTypePercentages.text || 0) * 100).toFixed(1) + '%'
        },
        queueHealth: {
          healthy: health.healthy,
          issues: health.issues
        },
        scanRecommendations: recommendations.map(rec => ({
          platform: rec.platform,
          priority: rec.priority,
          contentType: rec.contentType,
          reason: rec.reason.substring(0, 100) + (rec.reason.length > 100 ? '...' : '')
        })),
        smartScanningDecisions: [
          { platform: 'pixabay', ...shouldScanTests[0] },
          { platform: 'youtube', ...shouldScanTests[1] },
          { platform: 'reddit', ...shouldScanTests[2] }
        ],
        weeklySchedule: schedule.map(day => ({
          day: day.day,
          shouldScan: day.shouldScan,
          platforms: day.priority,
          reason: day.reason.substring(0, 80) + (day.reason.length > 80 ? '...' : '')
        })),
        summary: {
          currentCapacity: stats.daysOfContent > 14 ? 'Over capacity - scanning will be skipped' :
                           stats.daysOfContent > 7 ? 'Well stocked - selective scanning' :
                           stats.daysOfContent > 3 ? 'Healthy - normal scanning' :
                           'Low - aggressive scanning needed',
          apiCallsSaved: recommendations.filter(r => r.priority === 'skip').length * 10,
          platformsToScan: recommendations.filter(r => r.priority !== 'skip').length,
          estimatedNewContent: recommendations.filter(r => r.priority === 'high').length * 15 +
                              recommendations.filter(r => r.priority === 'medium').length * 10 +
                              recommendations.filter(r => r.priority === 'low').length * 5
        }
      }
    })

  } catch (error) {
    console.error('Queue management test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}