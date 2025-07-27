import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const { contentIds, action, reason } = await request.json()

    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      return NextResponse.json(
        { error: 'Content IDs array is required' },
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
      
      const placeholders = contentIds.map((_, index) => `$${index + 1}`).join(',')
      
      await query(`
        UPDATE content 
        SET status = $${contentIds.length + 1}, updated_at = NOW()
        WHERE id IN (${placeholders})
      `, [...contentIds, newStatus])

      for (const contentId of contentIds) {
        await query(`
          INSERT INTO content_reviews (content_id, action, reason, notes, reviewed_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [contentId, action, reason || 'Bulk action', 'Processed via bulk action'])
      }

      await query('COMMIT')

      return NextResponse.json({ 
        success: true, 
        processed: contentIds.length 
      })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error processing bulk review action:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk review action' },
      { status: 500 }
    )
  }
}