import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError,
  verifyAdminAuth
} from '@/lib/api-middleware'
import { db } from '@/lib/db'

/**
 * Handle consolidated status updates for RESTful API
 */
async function handleStatusUpdate(
  contentId: number, 
  status: string, 
  reason?: string, 
  notes?: string,
  scheduledAt?: string
): Promise<NextResponse> {
  const updateFields: string[] = []
  const queryParams: any[] = []
  let paramCount = 1

  switch (status) {
    case 'approved':
      updateFields.push(`is_approved = $${paramCount}`)
      queryParams.push(true)
      paramCount++
      
      if (reason) {
        updateFields.push(`admin_notes = $${paramCount}`)
        queryParams.push(`Approved: ${reason}`)
        paramCount++
      }
      break

    case 'rejected':
      updateFields.push(`is_approved = $${paramCount}`)
      queryParams.push(false)
      paramCount++
      
      const rejectionNote = reason ? `Rejected: ${reason}` : 'Rejected'
      updateFields.push(`admin_notes = $${paramCount}`)
      queryParams.push(rejectionNote)
      paramCount++
      break

    case 'pending':
      updateFields.push(`is_approved = $${paramCount}`)
      queryParams.push(null)
      paramCount++
      
      if (notes) {
        updateFields.push(`admin_notes = $${paramCount}`)
        queryParams.push(`Under review: ${notes}`)
        paramCount++
      }
      break

    case 'posted':
      updateFields.push(`is_posted = $${paramCount}`)
      queryParams.push(true)
      paramCount++
      
      updateFields.push(`posted_at = $${paramCount}`)
      queryParams.push(new Date())
      paramCount++
      break

    default:
      throw createApiError(`Invalid status: ${status}`, 400, 'INVALID_STATUS')
  }

  // Handle scheduling
  if (scheduledAt) {
    const scheduleDate = new Date(scheduledAt)
    if (isNaN(scheduleDate.getTime())) {
      throw createApiError('Invalid scheduled date format', 400, 'INVALID_SCHEDULE_DATE')
    }
    updateFields.push(`scheduled_at = $${paramCount}`)
    queryParams.push(scheduleDate)
    paramCount++
  }

  updateFields.push(`updated_at = $${paramCount}`)
  queryParams.push(new Date())
  paramCount++

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

  return createSuccessResponse(
    result.rows[0], 
    `Content ${status} successfully`
  )
}

async function getContentHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const authResult = await verifyAdminAuth(request)
    if (!authResult.success) {
      throw createApiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const resolvedParams = await params
    const contentId = parseInt(resolvedParams.id)

    if (isNaN(contentId)) {
      throw createApiError('Invalid content ID', 400, 'INVALID_CONTENT_ID')
    }

    const result = await db.query(
      'SELECT * FROM content_queue WHERE id = $1',
      [contentId]
    )

    if (result.rows.length === 0) {
      throw createApiError('Content not found', 404, 'CONTENT_NOT_FOUND')
    }

    return createSuccessResponse(
      result.rows[0],
      'Content retrieved successfully'
    )

  } catch (error) {
    console.error('Failed to get content:', error)
    if (error instanceof Error && 
        (error.message.includes('UNAUTHORIZED') || 
         error.message.includes('CONTENT_NOT_FOUND'))) {
      throw error
    }
    throw createApiError('Failed to retrieve content', 500, 'CONTENT_GET_ERROR')
  }
}

async function deleteContentHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const authResult = await verifyAdminAuth(request)
    if (!authResult.success) {
      throw createApiError('Authentication required', 401, 'UNAUTHORIZED')
    }
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
  try {
    const authResult = await verifyAdminAuth(request)
    if (!authResult.success) {
      throw createApiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const resolvedParams = await params
    const contentId = parseInt(resolvedParams.id)
    
    if (isNaN(contentId)) {
      throw createApiError('Invalid content ID', 400, 'INVALID_CONTENT_ID')
    }

    const body = await request.json()
    const { 
      status, 
      reason, 
      notes, 
      scheduledAt,
      hidden,
      is_approved, 
      admin_notes, 
      is_posted 
    } = body

    // Handle new RESTful status format
    if (status) {
      return await handleStatusUpdate(contentId, status, reason, notes, scheduledAt)
    }

    // Handle legacy format for backward compatibility

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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['GET'])
    return await getContentHandler(request, context)
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