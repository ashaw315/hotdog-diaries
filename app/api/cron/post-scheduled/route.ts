import { NextRequest, NextResponse } from 'next/server'
import { postFromSchedule } from '@/lib/services/posting/schedule-only-poster'
import { scheduleNextBatch } from '@/lib/services/schedule-content'
import {
  validateRequestMethod,
  createSuccessResponse,
  handleApiError
} from '@/lib/api-middleware'

/**
 * POST /api/cron/post-scheduled
 * Cron job endpoint for automatically posting scheduled content
 * This should be called every 15-30 minutes by external cron services (GitHub Actions, Vercel Cron, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    validateRequestMethod(request, ['POST'])
    
    // Validate authorization header for cron jobs
    const authHeader = request.headers.get('Authorization')
    const expectedToken = process.env.CRON_SECRET || process.env.AUTH_TOKEN
    
    if (!authHeader || !expectedToken) {
      return NextResponse.json({
        success: false,
        error: 'Missing cron authorization'
      }, { status: 401 })
    }
    
    const token = authHeader.replace('Bearer ', '')
    if (token !== expectedToken) {
      return NextResponse.json({
        success: false,
        error: 'Invalid cron authorization'
      }, { status: 401 })
    }
    
    console.log('🤖 Cron job: Starting scheduled content posting...')

    // Step 1: Post any scheduled content that is due (using new schedule-only-poster)
    const postingResult = await postFromSchedule({ graceMinutes: 5 })

    // Step 2: If we posted content, ensure next batch is scheduled
    let schedulingResult = null
    if (postingResult.success && postingResult.type === 'POSTED') {
      console.log('📅 Replenishing schedule after posting...')
      try {
        schedulingResult = await scheduleNextBatch(7, 6) // Schedule next 7 days
      } catch (error) {
        console.error('Warning: Failed to replenish schedule:', error)
        // Don't fail the whole operation if scheduling fails
      }
    }

    // Step 3: Compile results
    const response = {
      timestamp: new Date().toISOString(),
      posting: {
        success: postingResult.success,
        type: postingResult.type,
        totalPosted: postingResult.type === 'POSTED' ? 1 : 0,
        scheduledSlotId: postingResult.scheduledSlotId,
        contentId: postingResult.contentId,
        platform: postingResult.platform,
        postedAt: postingResult.postedAt,
        error: postingResult.error,
        platformDistribution: postingResult.platform ? { [postingResult.platform]: 1 } : {},
        errors: postingResult.error ? [postingResult.error] : []
      },
      scheduling: schedulingResult ? {
        totalScheduled: schedulingResult.summary.totalScheduled,
        daysScheduled: schedulingResult.summary.totalDays,
        platformDistribution: schedulingResult.summary.platformDistribution,
        errors: schedulingResult.errors
      } : null,
      status: postingResult.type
    }

    // Log the cron execution
    console.log('🤖 Cron job completed:', {
      type: postingResult.type,
      posted: postingResult.type === 'POSTED' ? 1 : 0,
      scheduled: schedulingResult?.summary.totalScheduled || 0,
      errors: postingResult.error ? 1 : 0
    })

    const message = postingResult.type === 'POSTED'
      ? `Posted scheduled content to ${postingResult.platform}`
      : postingResult.type === 'NO_SCHEDULED_CONTENT'
      ? 'No scheduled content due for posting'
      : postingResult.type === 'EMPTY_SCHEDULE_SLOT'
      ? 'Schedule slot has no content assigned'
      : postingResult.error || 'Unknown status'
    
    return createSuccessResponse(response, message)
    
  } catch (error) {
    console.error('❌ Cron job failed:', error)
    return handleApiError(error, request, '/api/cron/post-scheduled')
  }
}

/**
 * GET /api/cron/post-scheduled
 * Health check for the cron endpoint
 */
export async function GET(request: NextRequest) {
  try {
    return createSuccessResponse({
      endpoint: '/api/cron/post-scheduled',
      purpose: 'Automated posting of scheduled content',
      method: 'POST',
      authentication: 'Bearer token required',
      schedule: 'Every 15-30 minutes',
      lastRun: null // Could be enhanced to track last execution
    }, 'Cron endpoint is healthy')
    
  } catch (error) {
    return handleApiError(error, request, '/api/cron/post-scheduled')
  }
}