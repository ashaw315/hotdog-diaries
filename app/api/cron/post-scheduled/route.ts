import { NextRequest, NextResponse } from 'next/server'
import { postAllFromSchedule } from '@/lib/services/posting/schedule-only-poster'
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

    if (!expectedToken) {
      console.error('❌ Server configuration error: No CRON_SECRET or AUTH_TOKEN env var set')
      return NextResponse.json({
        success: false,
        error: 'Server misconfigured - missing auth token'
      }, { status: 500 })
    }

    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Missing authorization header'
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const expected = expectedToken.trim()

    if (token !== expected) {
      console.error('❌ Auth mismatch:', {
        receivedLength: token.length,
        expectedLength: expected.length,
        receivedPrefix: token.substring(0, 10) + '...',
        expectedPrefix: expected.substring(0, 10) + '...'
      })
      return NextResponse.json({
        success: false,
        error: 'Invalid cron authorization'
      }, { status: 401 })
    }
    
    console.log('🤖 Cron job: Starting scheduled content posting...')

    // Step 1: Post ALL scheduled content that is due (using new batch poster)
    // Use 60-minute grace window to account for GitHub Actions delays (can be 20-50 min late)
    const batchResult = await postAllFromSchedule({ graceMinutes: 60 })

    // Step 2: If we posted content, ensure next batch is scheduled
    let schedulingResult = null
    if (batchResult.success && batchResult.totalPosted > 0) {
      console.log('📅 Replenishing schedule after posting...')
      try {
        schedulingResult = await scheduleNextBatch(7, 6) // Schedule next 7 days
      } catch (error) {
        console.error('Warning: Failed to replenish schedule:', error)
        // Don't fail the whole operation if scheduling fails
      }
    }

    // Calculate platform distribution from results
    const platformDistribution: Record<string, number> = {}
    for (const result of batchResult.results) {
      if (result.success && result.type === 'POSTED' && result.platform) {
        platformDistribution[result.platform] = (platformDistribution[result.platform] || 0) + 1
      }
    }

    // Step 3: Compile results
    const response = {
      timestamp: new Date().toISOString(),
      posting: {
        success: batchResult.success,
        totalPosted: batchResult.totalPosted,
        results: batchResult.results,
        platformDistribution,
        errors: batchResult.errors
      },
      scheduling: schedulingResult ? {
        totalScheduled: schedulingResult.summary.totalScheduled,
        daysScheduled: schedulingResult.summary.totalDays,
        platformDistribution: schedulingResult.summary.platformDistribution,
        errors: schedulingResult.errors
      } : null,
      status: batchResult.totalPosted > 0 ? 'POSTED' : 'NO_SCHEDULED_CONTENT'
    }

    // Log the cron execution
    console.log('🤖 Cron job completed:', {
      posted: batchResult.totalPosted,
      scheduled: schedulingResult?.summary.totalScheduled || 0,
      errors: batchResult.errors.length
    })

    const message = batchResult.totalPosted > 0
      ? `Posted ${batchResult.totalPosted} scheduled content item(s)`
      : batchResult.errors.length > 0
      ? `Failed to post content: ${batchResult.errors[0]}`
      : 'No scheduled content due for posting'

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