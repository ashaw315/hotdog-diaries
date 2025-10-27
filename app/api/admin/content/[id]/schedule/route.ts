import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db } from '@/lib/db'
import { createDeprecatedHandler } from '@/lib/api-deprecation'

// Original handler for backward compatibility
async function originalPATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const contentId = resolvedParams.id
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(contentId)) {
      return NextResponse.json(
        { error: 'Invalid content ID format' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { scheduled_for } = body

    if (!scheduled_for) {
      return NextResponse.json(
        { error: 'scheduled_for is required' },
        { status: 400 }
      )
    }

    // Validate that scheduled_for is a valid date in the future
    const scheduledDate = new Date(scheduled_for)
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'scheduled_for must be a valid future date' },
        { status: 400 }
      )
    }

    // Check if content exists and is in a schedulable state
    const checkQuery = `
      SELECT id, is_approved 
      FROM content_queue 
      WHERE id = $1 AND is_posted = FALSE
    `
    const checkResult = await db.query(checkQuery, [contentId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Content not found or not in schedulable state' },
        { status: 404 }
      )
    }

    // Update the content with schedule - handle both scheduled_post_time and scheduled_for columns
    const updateQuery = `
      UPDATE content_queue 
      SET 
        scheduled_post_time = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, content_text, scheduled_post_time
    `

    const result = await db.query(updateQuery, [contentId, scheduledDate.toISOString()])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to schedule content' },
        { status: 500 }
      )
    }

    const updatedContent = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Content scheduled successfully',
      content: {
        id: updatedContent.id,
        content_text: updatedContent.content_text,
        scheduled_for: new Date(updatedContent.scheduled_post_time)
      }
    })
  } catch (error) {
    console.error('Error scheduling content:', error)
    return NextResponse.json(
      { error: 'Failed to schedule content' },
      { status: 500 }
    )
  }
}

// Deprecated handler with redirection to consolidated endpoint
export const PATCH = createDeprecatedHandler(
  '/api/admin/content/[id]/schedule',
  async (request: NextRequest, context: any): Promise<NextResponse> => {
    try {
      // Forward to the new consolidated content endpoint
      const { PATCH: contentPatch } = await import('@/app/api/admin/content/[id]/route')
      
      // Transform the request to use the new API format
      const body = await request.json()
      const newRequest = new NextRequest(request.url.replace('/schedule', ''), {
        method: 'PATCH',
        headers: request.headers,
        body: JSON.stringify({ 
          status: 'scheduled', 
          scheduled_for: body.scheduled_for,
          reason: 'Legacy schedule endpoint' 
        })
      })
      
      return await contentPatch(newRequest, context)
    } catch (error) {
      console.error('Error redirecting schedule to consolidated endpoint:', error)
      // Fallback to original handler
      return await originalPATCHHandler(request, context)
    }
  }
)