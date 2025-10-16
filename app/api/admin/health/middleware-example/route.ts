import { NextRequest, NextResponse } from 'next/server'
import { withAdminMiddleware, AdminRequestContext } from '@/lib/middleware/admin-middleware'
import { db } from '@/lib/db'

// Example handler function that would normally be the route export
async function healthExampleHandler(
  request: NextRequest,
  context: AdminRequestContext
): Promise<NextResponse> {
  // Simulate some work with database
  const result = await db.query('SELECT COUNT(*) as count FROM content_queue')
  
  // Simulate potential delay (remove in production)
  await new Promise(resolve => setTimeout(resolve, 100))
  
  return NextResponse.json({
    ok: true,
    message: 'Health check with middleware',
    request_id: context.requestId,
    started_at: new Date(context.startTime).toISOString(),
    data: {
      content_count: result.rows[0]?.count || result.rows[0]?.[0] || 0,
      path: context.path,
      method: context.method
    }
  })
}

// Example of slow handler that might timeout
async function slowExampleHandler(
  request: NextRequest,
  context: AdminRequestContext
): Promise<NextResponse> {
  // Simulate slow operation that might timeout
  const delay = parseInt(request.nextUrl.searchParams.get('delay') || '1000')
  
  await new Promise(resolve => setTimeout(resolve, delay))
  
  return NextResponse.json({
    ok: true,
    message: `Completed after ${delay}ms delay`,
    request_id: context.requestId
  })
}

// Export wrapped handlers with middleware
export const GET = withAdminMiddleware(healthExampleHandler, {
  timeoutMs: 5000,
  enableLogging: true,
  additionalHeaders: {
    'X-Health-Check': 'middleware-example'
  }
})

export const POST = withAdminMiddleware(slowExampleHandler, {
  timeoutMs: 2000, // Shorter timeout for demo
  enableLogging: true
})