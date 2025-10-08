import { NextRequest, NextResponse } from 'next/server'
import { 
  scheduleNextBatch, 
  getUpcomingSchedule, 
  cancelScheduledContent,
  rescheduleContent 
} from '@/lib/services/schedule-content'
import { 
  validateRequestMethod,
  createSuccessResponse,
  handleApiError,
  authenticateAdmin
} from '@/lib/api-middleware'

/**
 * GET /api/admin/queue/schedule
 * Get upcoming scheduled content queue
 */
export async function GET(request: NextRequest) {
  try {
    validateRequestMethod(request, ['GET'])
    // await authenticateAdmin(request) // TODO: Re-enable authentication
    
    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get('days') || '7')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    const schedule = await getUpcomingSchedule(days)
    
    // Limit results if requested
    const limitedSchedule = limit > 0 ? schedule.slice(0, limit) : schedule
    
    return createSuccessResponse({
      schedule: limitedSchedule,
      total: schedule.length,
      days,
      summary: {
        totalScheduled: schedule.length,
        platformDistribution: schedule.reduce((dist, item) => {
          const platform = item.source_platform
          dist[platform] = (dist[platform] || 0) + 1
          return dist
        }, {} as Record<string, number>),
        timeSlots: schedule.reduce((slots, item) => {
          if (item.scheduled_for) {
            const time = new Date(item.scheduled_for).toTimeString().slice(0, 5)
            slots[time] = (slots[time] || 0) + 1
          }
          return slots
        }, {} as Record<string, number>)
      }
    }, `Retrieved ${limitedSchedule.length} scheduled content items`)
    
  } catch (error) {
    return handleApiError(error, request, '/api/admin/queue/schedule')
  }
}

/**
 * POST /api/admin/queue/schedule
 * Schedule new content batch
 */
export async function POST(request: NextRequest) {
  try {
    validateRequestMethod(request, ['POST'])
    // await authenticateAdmin(request) // TODO: Re-enable authentication
    
    const body = await request.json().catch(() => ({}))
    const { 
      daysAhead = 7, 
      postsPerDay = 6 
    } = body
    
    if (daysAhead < 1 || daysAhead > 30) {
      return NextResponse.json({
        success: false,
        error: 'daysAhead must be between 1 and 30'
      }, { status: 400 })
    }
    
    if (postsPerDay < 1 || postsPerDay > 12) {
      return NextResponse.json({
        success: false,
        error: 'postsPerDay must be between 1 and 12'
      }, { status: 400 })
    }
    
    const result = await scheduleNextBatch(daysAhead, postsPerDay)
    
    return createSuccessResponse({
      scheduled: result.scheduled,
      skipped: result.skipped,
      errors: result.errors,
      summary: result.summary
    }, result.summary.totalScheduled > 0 
      ? `Scheduled ${result.summary.totalScheduled} content items for ${result.summary.totalDays} days`
      : 'No new content was scheduled'
    )
    
  } catch (error) {
    return handleApiError(error, request, '/api/admin/queue/schedule')
  }
}

/**
 * PUT /api/admin/queue/schedule
 * Update scheduled content (cancel or reschedule)
 */
export async function PUT(request: NextRequest) {
  try {
    validateRequestMethod(request, ['PUT'])
    // await authenticateAdmin(request) // TODO: Re-enable authentication
    
    const body = await request.json()
    const { contentId, action, newScheduleTime } = body
    
    if (!contentId || !action) {
      return NextResponse.json({
        success: false,
        error: 'contentId and action are required'
      }, { status: 400 })
    }
    
    let result = false
    let message = ''
    
    switch (action) {
      case 'cancel':
        result = await cancelScheduledContent(contentId)
        message = result ? 'Content unscheduled successfully' : 'Failed to unschedule content'
        break
        
      case 'reschedule':
        if (!newScheduleTime) {
          return NextResponse.json({
            success: false,
            error: 'newScheduleTime is required for reschedule action'
          }, { status: 400 })
        }
        
        result = await rescheduleContent(contentId, newScheduleTime)
        message = result ? 'Content rescheduled successfully' : 'Failed to reschedule content'
        break
        
      default:
        return NextResponse.json({
          success: false,
          error: `Invalid action: ${action}. Use 'cancel' or 'reschedule'`
        }, { status: 400 })
    }
    
    if (result) {
      return createSuccessResponse({ contentId, action }, message)
    } else {
      return NextResponse.json({
        success: false,
        error: message
      }, { status: 500 })
    }
    
  } catch (error) {
    return handleApiError(error, request, '/api/admin/queue/schedule')
  }
}