import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { AdminService } from '@/lib/services/admin'
import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    validateRequestMethod(request, ['GET'])

    // Get user info from middleware headers (middleware already verified auth)
    const userId = request.headers.get('x-user-id')
    const username = request.headers.get('x-username')
    
    if (!userId || !username) {
      throw createApiError('Unauthorized', 401, 'UNAUTHORIZED')
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
        SUM(CASE WHEN content_status = 'approved' THEN 1 ELSE 0 END) as approved_today,
        SUM(CASE WHEN content_status = 'rejected' THEN 1 ELSE 0 END) as rejected_today,
        AVG(
          (julianday(reviewed_at) - julianday(created_at)) * 24 * 60
        ) as avg_review_time_minutes
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
        SUM(CASE WHEN content_status = 'approved' THEN 1 ELSE 0 END) as approved_available,
        SUM(CASE WHEN content_status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_upcoming,
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
        SUM(CASE WHEN content_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
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
        user: username
      }
    )

    return createSuccessResponse(metrics, 'Content metrics retrieved successfully')

  } catch (error) {
    return await handleApiError(error, request, '/api/admin/content/metrics')
  }
}