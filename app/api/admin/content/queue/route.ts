import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

interface ContentQueueItem {
  id: number
  content_text: string | null
  content_image_url: string | null
  content_video_url: string | null
  content_type: string
  source_platform: string
  original_url: string
  original_author: string | null
  scraped_at: string
  content_status: string
  is_approved: boolean | null
  is_posted: boolean
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  scheduled_for: string | null
  confidence_score: number | null
  is_spam: boolean | null
  is_inappropriate: boolean | null
  is_unrelated: boolean | null
  is_valid_hotdog: boolean | null
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get('id')
    
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { content_text, content_status, reviewed_by, rejection_reason } = body

    // Build update fields
    const updateFields: string[] = ['updated_at = NOW()']
    const updateValues: any[] = []
    
    if (content_text !== undefined) {
      updateFields.push(`content_text = $${updateValues.length + 1}`)
      updateValues.push(content_text)
    }
    
    if (content_status !== undefined) {
      updateFields.push(`content_status = $${updateValues.length + 1}`)
      updateValues.push(content_status)
    }
    
    if (reviewed_by !== undefined) {
      updateFields.push(`reviewed_by = $${updateValues.length + 1}`)
      updateValues.push(reviewed_by)
      updateFields.push('reviewed_at = NOW()')
    }
    
    if (rejection_reason !== undefined) {
      updateFields.push(`rejection_reason = $${updateValues.length + 1}`)
      updateValues.push(rejection_reason)
    }

    // Update approved status based on content_status
    if (content_status === 'approved') {
      updateFields.push('is_approved = true')
    } else if (content_status === 'rejected') {
      updateFields.push('is_approved = false')
    }

    const query = `
      UPDATE content_queue 
      SET ${updateFields.join(', ')}
      WHERE id = $${updateValues.length + 1}
      RETURNING *
    `
    
    updateValues.push(parseInt(contentId))

    const result = await db.query(query, updateValues)
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    await logToDatabase(
      LogLevel.INFO,
      'Content updated',
      'AdminAPI',
      { 
        contentId: parseInt(contentId),
        updatedFields: Object.keys(body),
        user: authResult.user.username 
      }
    )

    return NextResponse.json({
      success: true,
      content: result.rows[0]
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to update content',
      'AdminAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json(
      { error: 'Failed to update content' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const platform = searchParams.get('platform') || 'all'
    const sortBy = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build WHERE clause
    const whereConditions: string[] = []
    const queryParams: any[] = []

    if (status !== 'all') {
      whereConditions.push(`cq.content_status = $${queryParams.length + 1}`)
      queryParams.push(status)
    }

    if (platform !== 'all') {
      whereConditions.push(`cq.source_platform = $${queryParams.length + 1}`)
      queryParams.push(platform)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Build ORDER BY clause
    const validSortFields = ['created_at', 'updated_at', 'scraped_at', 'content_status', 'confidence_score']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at'
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

    const query = `
      SELECT 
        cq.*,
        ca.confidence_score,
        ca.is_spam,
        ca.is_inappropriate,
        ca.is_unrelated,
        ca.is_valid_hotdog
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      ${whereClause}
      ORDER BY cq.${sortField} ${sortOrder}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `

    queryParams.push(limit, offset)

    const result = await db.query<ContentQueueItem>(query, queryParams)

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM content_queue cq
      ${whereClause}
    `

    const countResult = await db.query(countQuery, queryParams.slice(0, -2))
    const total = parseInt(countResult.rows[0].total)

    await logToDatabase(
      LogLevel.INFO,
      'Content queue fetched',
      'AdminAPI',
      { 
        status, 
        platform, 
        count: result.rows.length,
        total,
        user: authResult.user.username 
      }
    )

    return NextResponse.json({
      content: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to fetch content queue',
      'AdminAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json(
      { error: 'Failed to fetch content queue' },
      { status: 500 }
    )
  }
}