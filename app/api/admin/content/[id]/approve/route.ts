import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { db } from '@/lib/db'
import { createDeprecatedHandler } from '@/lib/api-deprecation'

async function approveContentHandler(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    const contentId = parseInt(params.id)

    if (isNaN(contentId)) {
      throw createApiError('Invalid content ID', 400, 'INVALID_CONTENT_ID')
    }

    // Update content to approved status
    const result = await db.query(
      `UPDATE content_queue 
       SET is_approved = TRUE, 
           updated_at = NOW(),
           admin_notes = CASE 
             WHEN admin_notes IS NULL THEN 'Approved'
             ELSE admin_notes || ' | Approved'
           END
       WHERE id = $1
       RETURNING *`,
      [contentId]
    )

    if (result.rows.length === 0) {
      throw createApiError('Content not found', 404, 'CONTENT_NOT_FOUND')
    }

    return createSuccessResponse(
      result.rows[0],
      'Content approved successfully'
    )

  } catch (error) {
    if (error instanceof Error && error.message.includes('CONTENT_NOT_FOUND')) {
      throw error
    }
    
    console.error('Failed to approve content:', error)
    throw createApiError('Failed to approve content', 500, 'CONTENT_APPROVE_ERROR')
  }
}

// Original handler for backward compatibility
async function originalPOSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const resolvedParams = await params
    return await approveContentHandler(request, { params: resolvedParams })
  } catch (error) {
    const resolvedParams = await params
    return await handleApiError(error, request, `/api/admin/content/${resolvedParams.id}/approve`)
  }
}

// Deprecated handler with redirection to consolidated endpoint
export const POST = createDeprecatedHandler(
  '/api/admin/content/[id]/approve',
  async (request: NextRequest, context: any): Promise<NextResponse> => {
    try {
      // Forward to the new consolidated content endpoint
      const { PATCH } = await import('@/app/api/admin/content/[id]/route')
      
      // Transform the request to use the new API format
      const newRequest = new NextRequest(request.url.replace('/approve', ''), {
        method: 'PATCH',
        headers: request.headers,
        body: JSON.stringify({ status: 'approved', reason: 'Legacy approve endpoint' })
      })
      
      return await PATCH(newRequest, context)
    } catch (error) {
      console.error('Error redirecting approve to consolidated endpoint:', error)
      // Fallback to original handler
      return await originalPOSTHandler(request, context)
    }
  }
)