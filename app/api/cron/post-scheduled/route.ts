import { NextRequest, NextResponse } from 'next/server'
import { postScheduledContentDue } from '@/lib/services/posting-service'
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
    
    // Step 1: Post any scheduled content that is due
    const postingResult = await postScheduledContentDue()
    
    // Step 2: If we posted content, ensure next batch is scheduled
    let schedulingResult = null
    if (postingResult.summary.totalPosted > 0) {
      console.log('📅 Replenishing schedule after posting...')
      schedulingResult = await scheduleNextBatch(7, 6) // Schedule next 7 days
    }
    
    // Step 3: Compile results
    const response = {
      timestamp: new Date().toISOString(),
      posting: {
        totalPosted: postingResult.summary.totalPosted,
        platformDistribution: postingResult.summary.platformDistribution,
        errors: postingResult.errors
      },
      scheduling: schedulingResult ? {
        totalScheduled: schedulingResult.summary.totalScheduled,
        daysScheduled: schedulingResult.summary.totalDays,
        platformDistribution: schedulingResult.summary.platformDistribution,
        errors: schedulingResult.errors
      } : null,
      status: postingResult.summary.totalPosted > 0 ? 'posted' : 'no_content_due'
    }
    
    // Log the cron execution
    console.log('🤖 Cron job completed:', {
      posted: postingResult.summary.totalPosted,
      scheduled: schedulingResult?.summary.totalScheduled || 0,
      errors: postingResult.errors.length + (schedulingResult?.errors.length || 0)
    })
    
    const message = postingResult.summary.totalPosted > 0 
      ? `Posted ${postingResult.summary.totalPosted} scheduled content items`
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