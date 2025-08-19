import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { db } from '@/lib/db'

async function deleteContentHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  validateRequestMethod(request, ['DELETE'])

  try {
    const resolvedParams = await params
    const contentId = parseInt(resolvedParams.id)

    if (isNaN(contentId)) {
      throw createApiError('Invalid content ID', 400, 'INVALID_CONTENT_ID')
    }

    // Check if content exists first
    const existingContent = await db.query(
      'SELECT id FROM content_queue WHERE id = $1',
      [contentId]
    )

    if (existingContent.rows.length === 0) {
      throw createApiError('Content not found', 404, 'CONTENT_NOT_FOUND')
    }

    // Delete the content
    const result = await db.query(
      'DELETE FROM content_queue WHERE id = $1 RETURNING id',
      [contentId]
    )

    return createSuccessResponse(
      { deletedId: contentId },
      'Content deleted successfully'
    )

  } catch (error) {
    if (error instanceof Error && error.message.includes('CONTENT_NOT_FOUND')) {
      throw error
    }
    
    console.error('Failed to delete content:', error)
    throw createApiError('Failed to delete content', 500, 'CONTENT_DELETE_ERROR')
  }
}

async function updateContentHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  validateRequestMethod(request, ['PUT', 'PATCH'])

  try {
    const resolvedParams = await params
    const contentId = parseInt(resolvedParams.id)
    
    if (isNaN(contentId)) {
      throw createApiError('Invalid content ID', 400, 'INVALID_CONTENT_ID')
    }

    const body = await request.json()
    const { is_approved, admin_notes, is_posted } = body

    // Build update query dynamically based on provided fields
    const updateFields: string[] = []
    const queryParams: any[] = []
    let paramCount = 1

    if (typeof is_approved === 'boolean') {
      updateFields.push(`is_approved = $${paramCount}`)
      queryParams.push(is_approved)
      paramCount++
    }

    if (admin_notes !== undefined) {
      updateFields.push(`admin_notes = $${paramCount}`)
      queryParams.push(admin_notes)
      paramCount++
    }

    if (typeof is_posted === 'boolean') {
      updateFields.push(`is_posted = $${paramCount}`)
      queryParams.push(is_posted)
      paramCount++

      if (is_posted) {
        updateFields.push(`posted_at = $${paramCount}`)
        queryParams.push(new Date())
        paramCount++
      }
    }

    if (updateFields.length === 0) {
      throw createApiError('No valid fields to update', 400, 'NO_UPDATE_FIELDS')
    }

    updateFields.push(`updated_at = $${paramCount}`)
    queryParams.push(new Date())
    paramCount++

    // Add ID parameter last
    queryParams.push(contentId)

    const updateQuery = `
      UPDATE content_queue 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const result = await db.query(updateQuery, queryParams)

    if (result.rows.length === 0) {
      throw createApiError('Content not found', 404, 'CONTENT_NOT_FOUND')
    }

    return createSuccessResponse(result.rows[0], 'Content updated successfully')

  } catch (error) {
    if (error instanceof Error && error.message.includes('CONTENT_NOT_FOUND')) {
      throw error
    }
    
    console.error('Failed to update content:', error)
    throw createApiError('Failed to update content', 500, 'CONTENT_UPDATE_ERROR')
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    return await deleteContentHandler(request, context)
  } catch (error) {
    const resolvedParams = await context.params
    return await handleApiError(error, request, `/api/admin/content/${resolvedParams.id}`)
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    return await updateContentHandler(request, context)
  } catch (error) {
    const resolvedParams = await context.params
    return await handleApiError(error, request, `/api/admin/content/${resolvedParams.id}`)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    return await updateContentHandler(request, context)
  } catch (error) {
    const resolvedParams = await context.params
    return await handleApiError(error, request, `/api/admin/content/${resolvedParams.id}`)
  }
}