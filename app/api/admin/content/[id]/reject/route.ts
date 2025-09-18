import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { db } from '@/lib/db'
import { createDeprecatedHandler } from '@/lib/api-deprecation'

async function rejectContentHandler(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    const contentId = parseInt(params.id)

    if (isNaN(contentId)) {
      throw createApiError('Invalid content ID', 400, 'INVALID_CONTENT_ID')
    }

    const body = await request.json().catch(() => ({}))
    const { reason } = body

    const rejectionNote = reason ? `Rejected: ${reason}` : 'Rejected'

    // Update content to rejected status
    const result = await db.query(
      `UPDATE content_queue 
       SET is_approved = FALSE, 
           updated_at = NOW(),
           admin_notes = CASE 
             WHEN admin_notes IS NULL THEN $2
             ELSE admin_notes || ' | ' || $2
           END
       WHERE id = $1
       RETURNING *`,
      [contentId, rejectionNote]
    )

    if (result.rows.length === 0) {
      throw createApiError('Content not found', 404, 'CONTENT_NOT_FOUND')
    }

    return createSuccessResponse(
      result.rows[0],
      'Content rejected successfully'
    )

  } catch (error) {
    if (error instanceof Error && error.message.includes('CONTENT_NOT_FOUND')) {
      throw error
    }
    
    console.error('Failed to reject content:', error)
    throw createApiError('Failed to reject content', 500, 'CONTENT_REJECT_ERROR')
  }
}

// Original handler for backward compatibility
async function originalPOSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const resolvedParams = await context.params
    return await rejectContentHandler(request, { params: resolvedParams })
  } catch (error) {
    const resolvedParams = await context.params
    return await handleApiError(error, request, `/api/admin/content/${resolvedParams.id}/reject`)
  }
}

// Deprecated handler with redirection to consolidated endpoint
export const POST = createDeprecatedHandler(
  '/api/admin/content/[id]/reject',
  async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Forward to the new consolidated content endpoint
      const { PATCH } = await import('@/app/api/admin/content/[id]/route')
      const url = new URL(request.url)
      const id = url.pathname.split('/')[4] // Extract ID from path
      
      // Transform the request to use the new API format
      const newRequest = new NextRequest(request.url.replace('/reject', ''), {
        method: 'PATCH',
        headers: request.headers,
        body: JSON.stringify({ status: 'rejected', reason: 'Legacy reject endpoint' })
      })
      
      return await PATCH(newRequest, { params: Promise.resolve({ id }) })
    } catch (error) {
      console.error('Error redirecting reject to consolidated endpoint:', error)
      // Fallback to original handler
      const url = new URL(request.url)
      const id = url.pathname.split('/')[4]
      return await originalPOSTHandler(request, { params: Promise.resolve({ id }) })
    }
  }
)