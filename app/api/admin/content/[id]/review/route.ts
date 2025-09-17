import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createDeprecatedHandler } from '@/lib/api-deprecation'

// Original handler for backward compatibility
async function originalPUTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params
    const contentId = resolvedParams.id
    const { action, reason, notes } = await request.json()

    if (!contentId) {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      )
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action (approve/reject) is required' },
        { status: 400 }
      )
    }

    const client = await query('BEGIN')

    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      
      await query(`
        UPDATE content 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `, [newStatus, contentId])

      await query(`
        INSERT INTO content_reviews (content_id, action, reason, notes, reviewed_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [contentId, action, reason || '', notes || ''])

      await query('COMMIT')

      return NextResponse.json({ success: true })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error processing review action:', error)
    return NextResponse.json(
      { error: 'Failed to process review action' },
      { status: 500 }
    )
  }
}

// Deprecated handler with redirection to consolidated endpoint
export const PUT = createDeprecatedHandler(
  '/api/admin/content/[id]/review',
  async (request: NextRequest, context: any): Promise<NextResponse> => {
    try {
      // Forward to the new consolidated content endpoint
      const { PATCH } = await import('@/app/api/admin/content/[id]/route')
      
      // Transform the request to use the new API format
      const body = await request.json()
      const status = body.action === 'approve' ? 'approved' : 'rejected'
      const newRequest = new NextRequest(request.url.replace('/review', ''), {
        method: 'PATCH',
        headers: request.headers,
        body: JSON.stringify({ 
          status,
          reason: body.reason || body.notes || 'Legacy review endpoint',
          notes: body.notes
        })
      })
      
      return await PATCH(newRequest, context)
    } catch (error) {
      console.error('Error redirecting review to consolidated endpoint:', error)
      // Fallback to original handler
      return await originalPUTHandler(request, context)
    }
  }
)