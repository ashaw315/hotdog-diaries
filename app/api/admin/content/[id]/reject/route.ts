import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { db } from '@/lib/db'

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

export async function POST(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  try {
    return await rejectContentHandler(request, context)
  } catch (error) {
    return await handleApiError(error, request, `/api/admin/content/${context.params.id}/reject`)
  }
}