import { NextRequest, NextResponse } from 'next/server'
import { EdgeAuthUtils } from '@/lib/auth-edge'
import { db } from '@/lib/db'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[AdminContentAPI] Incoming request to /api/admin/content')
    
    const token = EdgeAuthUtils.getAuthTokenFromRequest(request)
    if (!token) {
      console.warn('[AdminContentAPI] No token found')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await EdgeAuthUtils.verifyJWT(token)
    if (!user) {
      console.warn('[AdminContentAPI] Invalid token')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('[AdminContentAPI] User verified:', user.username)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') || searchParams.get('status') || 'all'
    
    const actualOffset = offset || (page - 1) * limit
    
    console.log(`[AdminContentAPI] Query params - type: ${type}, page: ${page}, limit: ${limit}, offset: ${actualOffset}`)

    // Build WHERE clause based on type filter
    let whereClause = '1=1'
    const queryParams: (string | number | boolean)[] = []
    
    switch (type) {
      case 'pending':
        whereClause = 'is_approved = FALSE AND is_posted = FALSE AND (admin_notes IS NULL OR admin_notes NOT LIKE \'%Rejected%\')'
        break
      case 'approved':
        whereClause = 'is_approved = TRUE AND is_posted = FALSE'
        break
      case 'posted':
        whereClause = 'is_posted = TRUE'
        break
      case 'rejected':
        whereClause = 'is_approved = FALSE AND is_posted = FALSE AND admin_notes LIKE \'%Rejected%\''
        break
      case 'all':
      default:
        whereClause = '1=1'
        break
    }

    // Get content with pagination - special handling for posted content
    let contentQuery: string
    let orderBy = 'scraped_at DESC'
    
    if (type === 'posted') {
      console.log('[AdminContentAPI] Using content_queue filter for posted content')
      whereClause = 'is_posted = TRUE'
      contentQuery = `
        SELECT 
          id,
          content_text,
          content_type,
          source_platform,
          original_url,
          original_author,
          content_image_url,
          content_video_url,
          scraped_at,
          is_posted,
          is_approved,
          posted_at,
          admin_notes,
          id as post_order
        FROM content_queue
        WHERE ${whereClause}
        ORDER BY posted_at DESC NULLS LAST, created_at DESC
        LIMIT $1 OFFSET $2
      `
      queryParams.push(limit, actualOffset)
    } else {
      contentQuery = `
        SELECT 
          id,
          content_text,
          content_type,
          source_platform,
          original_url,
          original_author,
          content_image_url,
          content_video_url,
          scraped_at,
          is_posted,
          is_approved,
          posted_at,
          admin_notes
        FROM content_queue
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $1 OFFSET $2
      `
      queryParams.push(limit, actualOffset)
    }
    
    console.log(`[AdminContentAPI] Executing query for type: ${type}`)
    console.log(`[AdminContentAPI] Query: ${contentQuery.replace(/\s+/g, ' ').trim()}`)
    console.log(`[AdminContentAPI] Params: [${queryParams.join(', ')}]`)
    
    try {
      const contentResult = await db.query(contentQuery, queryParams)
      console.log(`[AdminContentAPI] Content query successful - Found ${contentResult.rows.length} rows`)
      
      // Get total count for pagination
      let countQuery: string
      let total: number
      
      if (type === 'posted') {
        countQuery = `
          SELECT COUNT(*) as total
          FROM content_queue
          WHERE is_posted = TRUE
        `
        const countResult = await db.query(countQuery)
        total = parseInt(countResult.rows[0].total)
      } else {
        countQuery = `
          SELECT COUNT(*) as total
          FROM content_queue
          WHERE ${whereClause}
        `
        const countResult = await db.query(countQuery)
        total = parseInt(countResult.rows[0].total)
      }
      
      console.log(`[AdminContentAPI] Total count: ${total}`)

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
        post_order: row.post_order // Only available for posted content
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
        filter: type
      }

      console.log(`[AdminContentAPI] Successfully returning ${content.length} content items`)
      return NextResponse.json({
        success: true,
        data: responseData,
        message: `Retrieved ${content.length} content items`
      })

    } catch (dbError) {
      console.error('[AdminContentAPI] Database error occurred', {
        error: dbError instanceof Error ? dbError.message : 'Unknown DB error',
        stack: dbError instanceof Error ? dbError.stack : undefined,
        query: contentQuery.replace(/\s+/g, ' ').trim(),
        params: queryParams,
        timestamp: new Date().toISOString()
      })
      
      return NextResponse.json(
        { error: 'Database error occurred while retrieving content' },
        { status: 500 }
      )
    }

  } catch (err: any) {
    console.error('[AdminContentAPI] Auth verification failed', {
      error: err?.message || 'Unknown error',
      stack: err?.stack,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[AdminContentAPI] Incoming request to /api/admin/content')
    
    const token = EdgeAuthUtils.getAuthTokenFromRequest(request)
    if (!token) {
      console.warn('[AdminContentAPI] No token found')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await EdgeAuthUtils.verifyJWT(token)
    if (!user) {
      console.warn('[AdminContentAPI] Invalid token')
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

    try {
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

    } catch (dbError) {
      console.error('[AdminContentAPI] Database error occurred', {
        error: dbError instanceof Error ? dbError.message : 'Unknown DB error',
        stack: dbError instanceof Error ? dbError.stack : undefined,
        timestamp: new Date().toISOString()
      })
      
      return NextResponse.json(
        { error: 'Database error occurred while creating content' },
        { status: 500 }
      )
    }

  } catch (err: any) {
    console.error('[AdminContentAPI] Auth verification failed', {
      error: err?.message || 'Unknown error',
      stack: err?.stack,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[AdminContentAPI] Incoming request to /api/admin/content')
    
    const token = EdgeAuthUtils.getAuthTokenFromRequest(request)
    if (!token) {
      console.warn('[AdminContentAPI] No token found')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await EdgeAuthUtils.verifyJWT(token)
    if (!user) {
      console.warn('[AdminContentAPI] Invalid token')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('[AdminContentAPI] User verified:', user.username)

    // Parse request body
    const body = await request.json()
    const { id, is_approved, admin_notes, is_posted } = body

    if (!id) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 })
    }

    try {
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

    } catch (dbError) {
      console.error('[AdminContentAPI] Database error occurred', {
        error: dbError instanceof Error ? dbError.message : 'Unknown DB error',
        stack: dbError instanceof Error ? dbError.stack : undefined,
        timestamp: new Date().toISOString()
      })
      
      return NextResponse.json(
        { error: 'Database error occurred while updating content' },
        { status: 500 }
      )
    }

  } catch (err: any) {
    console.error('[AdminContentAPI] Auth verification failed', {
      error: err?.message || 'Unknown error',
      stack: err?.stack,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}