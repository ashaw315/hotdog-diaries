import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get status counts
    const statusCountsQuery = `
      SELECT content_status, COUNT(*) as count
      FROM content_queue
      GROUP BY content_status
    `
    const statusCountsResult = await db.query(statusCountsQuery)
    
    const statusCounts = {
      discovered: 0,
      pending_review: 0,
      approved: 0,
      scheduled: 0,
      posted: 0,
      rejected: 0,
      archived: 0
    }
    
    statusCountsResult.rows.forEach(row => {
      statusCounts[row.content_status] = parseInt(row.count)
    })

    // Get flow metrics for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const flowMetricsQuery = `
      SELECT 
        COUNT(*) as processed_today,
        COUNT(*) FILTER (WHERE content_status = 'approved') as approved_today,
        COUNT(*) FILTER (WHERE content_status = 'rejected') as rejected_today,
        AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/60) as avg_review_time_minutes
      FROM content_queue
      WHERE reviewed_at >= $1
    `
    const flowMetricsResult = await db.query(flowMetricsQuery, [today.toISOString()])
    const flowData = flowMetricsResult.rows[0]

    const processedToday = parseInt(flowData.processed_today) || 0
    const approvedToday = parseInt(flowData.approved_today) || 0
    const approvalRate = processedToday > 0 ? (approvedToday / processedToday) * 100 : 0
    const processingRate = processedToday / 24 // rough estimate per hour
    const averageReviewTime = parseFloat(flowData.avg_review_time_minutes) || 0

    // Get queue health metrics
    const queueHealthQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE content_status = 'approved') as approved_available,
        COUNT(*) FILTER (WHERE content_status = 'scheduled') as scheduled_upcoming,
        MIN(scheduled_for) as next_scheduled
      FROM content_queue
      WHERE content_status IN ('approved', 'scheduled')
    `
    const queueHealthResult = await db.query(queueHealthQuery)
    const queueData = queueHealthResult.rows[0]

    const approvedAvailable = parseInt(queueData.approved_available) || 0
    const scheduledUpcoming = parseInt(queueData.scheduled_upcoming) || 0
    
    // Calculate next posting gap
    const nextScheduled = queueData.next_scheduled ? new Date(queueData.next_scheduled) : null
    const nextPostingGap = nextScheduled ? 
      Math.max(0, (nextScheduled.getTime() - Date.now()) / (1000 * 60 * 60)) : 24

    // Generate recommendations
    const recommendedActions = []
    if (approvedAvailable < 5) {
      recommendedActions.push('Review pending content to maintain healthy queue')
    }
    if (scheduledUpcoming < 10) {
      recommendedActions.push('Schedule more approved content for posting')
    }
    if (nextPostingGap > 6) {
      recommendedActions.push('Fill upcoming posting gap with scheduled content')
    }
    if (approvalRate < 50) {
      recommendedActions.push('Review content quality filters - low approval rate')
    }

    // Get platform performance
    const platformQuery = `
      SELECT 
        source_platform,
        COUNT(*) as total_processed,
        COUNT(*) FILTER (WHERE content_status = 'approved') as approved_count,
        AVG(ca.confidence_score) as avg_confidence
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      WHERE cq.reviewed_at IS NOT NULL
      GROUP BY source_platform
      HAVING COUNT(*) > 0
      ORDER BY COUNT(*) DESC
    `
    const platformResult = await db.query(platformQuery)
    
    const platformPerformance = platformResult.rows.map((row, index) => ({
      platform: row.source_platform,
      totalProcessed: parseInt(row.total_processed),
      approvalRate: parseInt(row.total_processed) > 0 ? 
        (parseInt(row.approved_count) / parseInt(row.total_processed)) * 100 : 0,
      averageConfidence: parseFloat(row.avg_confidence) || 0,
      topPerformer: index === 0 && parseInt(row.total_processed) > 0
    }))

    const metrics = {
      statusCounts,
      flowMetrics: {
        processedToday,
        processingRate,
        approvalRate,
        averageReviewTime
      },
      queueHealth: {
        approvedAvailable,
        scheduledUpcoming,
        nextPostingGap,
        recommendedActions
      },
      platformPerformance
    }

    await logToDatabase(
      LogLevel.INFO,
      'Content metrics fetched',
      'AdminAPI',
      { 
        totalContent: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        user: authResult.user.username 
      }
    )

    return NextResponse.json(metrics)

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to fetch content metrics',
      'AdminAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}