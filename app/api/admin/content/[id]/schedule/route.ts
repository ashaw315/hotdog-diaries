import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentId = params.id
    
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
      SELECT id, status 
      FROM content 
      WHERE id = $1 AND status IN ('pending', 'approved')
    `
    const checkResult = await db.query(checkQuery, [contentId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Content not found or not in schedulable state' },
        { status: 404 }
      )
    }

    // Update the content with schedule
    const updateQuery = `
      UPDATE content 
      SET 
        status = 'scheduled',
        scheduled_for = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, scheduled_for
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
        title: updatedContent.title,
        scheduled_for: new Date(updatedContent.scheduled_for)
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