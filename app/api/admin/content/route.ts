import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { EdgeAuthUtils } from '@/lib/auth-edge'
import { db } from '@/lib/db'

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[AdminContentAPI] GET /api/admin/content request received')

  // Cookie-based authentication
  const cookieStore = cookies()
  const token = cookieStore.get('auth')?.value

  if (!token) {
    console.warn('[AdminContentAPI] No token found in cookies')
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Verify JWT token
  let user
  try {
    user = await EdgeAuthUtils.verifyJWT(token)
    if (!user) {
      console.warn('[AdminContentAPI] Token verification returned null')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
  } catch (error) {
    console.error('[AdminContentAPI] Token verification error:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  console.log('[AdminContentAPI] User verified:', user.username)

  // Parse query parameters
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const status = searchParams.get('status') || 'all'
  
  const actualOffset = offset || (page - 1) * limit
  
  console.log(`[AdminContentAPI] Query params - status: ${status}, page: ${page}, limit: ${limit}, offset: ${actualOffset}`)

  try {
    let contentQuery: string
    let countQuery: string
    const queryParams = [limit, actualOffset]
    
    if (status === 'posted') {
      // Query content_queue joined with posting_history for posted content
      console.log('[AdminContentAPI] Filtering for posted content (JOIN with posting_history)')
      
      contentQuery = `
        SELECT 
          cq.id,
          cq.content_text,
          cq.content_type,
          cq.source_platform,
          cq.original_url,
          cq.original_author,
          cq.content_image_url,
          cq.content_video_url,
          cq.scraped_at,
          cq.is_posted,
          cq.is_approved,
          cq.admin_notes,
          cq.created_at,
          cq.updated_at,
          ph.posted_at
        FROM content_queue cq
        JOIN posting_history ph ON ph.content_queue_id = cq.id
        WHERE ph.posted_at IS NOT NULL
        ORDER BY ph.posted_at DESC
        LIMIT $1 OFFSET $2
      `
      
      countQuery = `
        SELECT COUNT(*) as total
        FROM content_queue cq
        JOIN posting_history ph ON ph.content_queue_id = cq.id
        WHERE ph.posted_at IS NOT NULL
      `
      
    } else {
      // Query content_queue only for other statuses
      let whereClause = '1=1'
      let orderBy = 'cq.scraped_at DESC'
      
      if (status === 'pending') {
        whereClause = 'cq.is_approved = FALSE AND NOT EXISTS (SELECT 1 FROM posting_history WHERE content_queue_id = cq.id) AND (cq.admin_notes IS NULL OR cq.admin_notes NOT LIKE \'%Rejected%\')'
      } else if (status === 'approved') {
        whereClause = 'cq.is_approved = TRUE AND NOT EXISTS (SELECT 1 FROM posting_history WHERE content_queue_id = cq.id)'
      } else if (status === 'rejected') {
        whereClause = 'cq.is_approved = FALSE AND cq.admin_notes LIKE \'%Rejected%\''
      }
      // For 'all' or any other value, keep whereClause as '1=1'
      
      console.log(`[AdminContentAPI] Filtering for ${status} content with WHERE: ${whereClause}`)
      
      contentQuery = `
        SELECT 
          cq.id,
          cq.content_text,
          cq.content_type,
          cq.source_platform,
          cq.original_url,
          cq.original_author,
          cq.content_image_url,
          cq.content_video_url,
          cq.scraped_at,
          cq.is_posted,
          cq.is_approved,
          cq.admin_notes,
          cq.created_at,
          cq.updated_at,
          NULL as posted_at
        FROM content_queue cq
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $1 OFFSET $2
      `
      
      countQuery = `
        SELECT COUNT(*) as total
        FROM content_queue cq
        WHERE ${whereClause}
      `
    }
    
    console.log(`[AdminContentAPI] Executing content query for status: ${status}`)
    
    // Execute content query
    const contentResult = await db.query(contentQuery, queryParams)
    console.log(`[AdminContentAPI] Query success: ${contentResult.rows.length} rows`)
    
    // Execute count query
    const countResult = await db.query(countQuery)
    const total = parseInt(countResult.rows[0].total)
    
    console.log(`[AdminContentAPI] Total count: ${total}`)

    // Map rows to response format
    const content = contentResult.rows.map(row => ({
      id: row.id,
      content_text: row.content_text,
      content_type: row.content_type,
      source_platform: row.source_platform,
      original_url: row.original_url,
      original_author: row.original_author,
      content_image_url: row.content_image_url,
      content_video_url: row.content_video_url,
      scraped_at: row.scraped_at,
      is_posted: row.is_posted,
      is_approved: row.is_approved,
      posted_at: row.posted_at,
      admin_notes: row.admin_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      post_order: row.id // Use id as post_order for compatibility
    }))

    const responseData = {
      content,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: actualOffset + content.length < total
      },
      filter: status
    }

    console.log(`[AdminContentAPI] Successfully returning ${content.length} content items`)
    return NextResponse.json({
      success: true,
      data: responseData,
      message: `Retrieved ${content.length} content items`
    })

  } catch (err) {
    console.error('[AdminContentAPI] Database error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[AdminContentAPI] POST /api/admin/content request received')

    const cookieStore = cookies()
    const token = cookieStore.get('auth')?.value

    if (!token) {
      console.warn('[AdminContentAPI] No token found in cookies')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let user
    try {
      user = await EdgeAuthUtils.verifyJWT(token)
      if (!user) {
        console.warn('[AdminContentAPI] Token verification returned null')
        try {
          const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
          console.log('[AdminContentAPI] Decoded token payload:', decoded)
        } catch (e) {
          console.warn('[AdminContentAPI] Could not decode token body')
        }
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    } catch (error) {
      console.error('[AdminContentAPI] Token verification error:', error)
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
        console.log('[AdminContentAPI] Decoded token payload:', decoded)
      } catch (e) {
        console.warn('[AdminContentAPI] Could not decode token body')
      }
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('[AdminContentAPI] User verified:', user.username)

    // Parse request body
    const body = await request.json()
    const {
      contentText,
      contentType,
      sourcePlatform,
      sourceUrl,
      originalAuthor,
      contentImageUrl,
      contentVideoUrl,
      confidenceScore = 0.5
    } = body

    if (!contentText || !contentType || !sourcePlatform) {
      return NextResponse.json(
        { error: 'contentText, contentType, and sourcePlatform are required' }, 
        { status: 400 }
      )
    }

    // Generate content hash for duplicate detection
    const crypto = require('crypto')
    const contentHash = crypto
      .createHash('sha256')
      .update(`${contentText}-${sourcePlatform}`)
      .digest('hex')

    // Check for duplicates
    const existingContent = await db.query(
      'SELECT id FROM content_queue WHERE content_hash = $1',
      [contentHash]
    )

    if (existingContent.rows.length > 0) {
      return NextResponse.json({ error: 'Duplicate content detected' }, { status: 409 })
    }

    // Insert new content
    const result = await db.query(
      `INSERT INTO content_queue (
        content_text, content_type, source_platform, source_url,
        original_author, content_image_url, content_video_url,
        content_hash, confidence_score, scraped_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        contentText,
        contentType,
        sourcePlatform,
        sourceUrl,
        originalAuthor,
        contentImageUrl,
        contentVideoUrl,
        contentHash,
        confidenceScore
      ]
    )

    console.log('[AdminContentAPI] Content created successfully')
    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Content created successfully'
    })

  } catch (err: any) {
    console.error('[AdminContentAPI] Database error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[AdminContentAPI] PUT /api/admin/content request received')

    const cookieStore = cookies()
    const token = cookieStore.get('auth')?.value

    if (!token) {
      console.warn('[AdminContentAPI] No token found in cookies')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let user
    try {
      user = await EdgeAuthUtils.verifyJWT(token)
      if (!user) {
        console.warn('[AdminContentAPI] Token verification returned null')
        try {
          const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
          console.log('[AdminContentAPI] Decoded token payload:', decoded)
        } catch (e) {
          console.warn('[AdminContentAPI] Could not decode token body')
        }
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    } catch (error) {
      console.error('[AdminContentAPI] Token verification error:', error)
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
        console.log('[AdminContentAPI] Decoded token payload:', decoded)
      } catch (e) {
        console.warn('[AdminContentAPI] Could not decode token body')
      }
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('[AdminContentAPI] User verified:', user.username)

    // Parse request body
    const body = await request.json()
    const { id, is_approved, admin_notes, is_posted } = body

    if (!id) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 })
    }

    // Build update query dynamically based on provided fields
    const updateFields: string[] = []
    const queryParams: (string | number | boolean)[] = []
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
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updateFields.push(`updated_at = $${paramCount}`)
    queryParams.push(new Date())
    paramCount++

    // Add ID parameter last
    queryParams.push(id)

    const updateQuery = `
      UPDATE content_queue 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const result = await db.query(updateQuery, queryParams)

    if (result.rows.length === 0) {
      console.warn('[AdminContentAPI] Content not found:', id)
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    console.log('[AdminContentAPI] Content updated successfully:', id)
    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Content updated successfully'
    })

  } catch (err: any) {
    console.error('[AdminContentAPI] Database error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}