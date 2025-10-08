import { NextRequest, NextResponse } from 'next/server'
import { 
  postNextContent, 
  postScheduledContentDue, 
  getPostingStats 
} from '@/lib/services/posting-service'
import { 
  validateRequestMethod,
  createSuccessResponse,
  handleApiError,
  authenticateAdmin
} from '@/lib/api-middleware'

/**
 * POST /api/admin/posting/execute
 * Execute posting of content (scheduled or manual)
 */
export async function POST(request: NextRequest) {
  try {
    validateRequestMethod(request, ['POST'])
    // await authenticateAdmin(request) // TODO: Re-enable authentication
    
    const body = await request.json().catch(() => ({}))
    const { type = 'next' } = body
    
    switch (type) {
      case 'next':
        // Post the next available content (scheduled or approved)
        const nextResult = await postNextContent()
        
        if (nextResult.success) {
          return createSuccessResponse({
            type: 'single',
            content: nextResult,
            stats: await getPostingStats(1)
          }, 'Content posted successfully')
        } else {
          return NextResponse.json({
            success: false,
            error: nextResult.error
          }, { status: nextResult.error?.includes('No approved content') ? 404 : 500 })
        }
        
      case 'scheduled':
        // Post all scheduled content that is due
        const scheduledResult = await postScheduledContentDue()
        
        return createSuccessResponse({
          type: 'batch',
          posted: scheduledResult.posted,
          errors: scheduledResult.errors,
          summary: scheduledResult.summary,
          stats: await getPostingStats(1)
        }, scheduledResult.summary.totalPosted > 0 
          ? `Posted ${scheduledResult.summary.totalPosted} scheduled content items`
          : 'No scheduled content due for posting'
        )
        
      default:
        return NextResponse.json({
          success: false,
          error: `Invalid posting type: ${type}. Use 'next' or 'scheduled'`
        }, { status: 400 })
    }
    
  } catch (error) {
    return handleApiError(error, request, '/api/admin/posting/execute')
  }
}

/**
 * GET /api/admin/posting/execute
 * Get posting statistics and status
 */
export async function GET(request: NextRequest) {
  try {
    validateRequestMethod(request, ['GET'])
    // await authenticateAdmin(request) // TODO: Re-enable authentication
    
    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get('days') || '7')
    
    const stats = await getPostingStats(days)
    
    return createSuccessResponse({
      stats,
      period: `${days} days`
    }, 'Posting statistics retrieved successfully')
    
  } catch (error) {
    return handleApiError(error, request, '/api/admin/posting/execute')
  }
}