import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { db } from '@/lib/db'

async function postContentHandler(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    const contentId = parseInt(params.id)

    if (isNaN(contentId)) {
      throw createApiError('Invalid content ID', 400, 'INVALID_CONTENT_ID')
    }

    // Update content to posted status (should be approved first)
    const result = await db.query(
      `UPDATE content_queue 
       SET is_posted = TRUE, 
           posted_at = NOW(),
           updated_at = NOW(),
           admin_notes = CASE 
             WHEN admin_notes IS NULL THEN 'Posted'
             ELSE admin_notes || ' | Posted'
           END
       WHERE id = $1 AND is_approved = TRUE AND is_posted = FALSE
       RETURNING *`,
      [contentId]
    )

    if (result.rows.length === 0) {
      // Check if content exists and get its status
      const checkResult = await db.query(
        'SELECT is_approved, is_posted FROM content_queue WHERE id = $1',
        [contentId]
      )

      if (checkResult.rows.length === 0) {
        throw createApiError('Content not found', 404, 'CONTENT_NOT_FOUND')
      }

      const content = checkResult.rows[0]
      if (!content.is_approved) {
        throw createApiError('Content must be approved before posting', 400, 'CONTENT_NOT_APPROVED')
      }
      if (content.is_posted) {
        throw createApiError('Content is already posted', 400, 'CONTENT_ALREADY_POSTED')
      }
    }

    return createSuccessResponse(
      result.rows[0],
      'Content posted successfully'
    )

  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('CONTENT_NOT_FOUND') ||
      error.message.includes('CONTENT_NOT_APPROVED') ||
      error.message.includes('CONTENT_ALREADY_POSTED')
    )) {
      throw error
    }
    
    console.error('Failed to post content:', error)
    throw createApiError('Failed to post content', 500, 'CONTENT_POST_ERROR')
  }
}

export async function POST(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  try {
    return await postContentHandler(request, context)
  } catch (error) {
    return await handleApiError(error, request, `/api/admin/content/${context.params.id}/post`)
  }
}