import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { EdgeAuthUtils } from '@/lib/auth-edge'
import { db } from '@/lib/db'
import { logToDatabase } from '@/lib/db'
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
    console.log('[AdminQueueAPI] PATCH /api/admin/content/queue request received')

    // Cookie-based authentication (same as main content route)
    const cookieStore = cookies()
    const token = cookieStore.get('auth')?.value

    if (!token) {
      console.warn('[AdminQueueAPI] No token found in cookies')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify JWT token
    let user
    try {
      user = await EdgeAuthUtils.verifyJWT(token)
      if (!user) {
        console.warn('[AdminQueueAPI] Token verification returned null')
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    } catch (error) {
      console.error('[AdminQueueAPI] Token verification error:', error)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('[AdminQueueAPI] User verified:', user.username)

    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get('id')
    
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { content_text, content_status, reviewed_by, rejection_reason } = body

    // Build update query dynamically based on provided fields
    const updateFields: string[] = []
    const queryParams: (string | number | boolean)[] = []
    let paramCount = 1

    if (content_text !== undefined) {
      updateFields.push(`content_text = $${paramCount}`)
      queryParams.push(content_text)
      paramCount++
    }

    if (content_status !== undefined) {
      updateFields.push(`content_status = $${paramCount}`)
      queryParams.push(content_status)
      paramCount++
      
      // Update approved status based on content_status
      if (content_status === 'approved') {
        updateFields.push(`is_approved = $${paramCount}`)
        queryParams.push(true)
        paramCount++
      } else if (content_status === 'rejected') {
        updateFields.push(`is_approved = $${paramCount}`)
        queryParams.push(false)
        paramCount++
      }
    }

    if (reviewed_by !== undefined) {
      updateFields.push(`reviewed_by = $${paramCount}`)
      queryParams.push(reviewed_by)
      paramCount++
      
      updateFields.push(`reviewed_at = $${paramCount}`)
      queryParams.push(new Date())
      paramCount++
    }

    if (rejection_reason !== undefined) {
      updateFields.push(`rejection_reason = $${paramCount}`)
      queryParams.push(rejection_reason)
      paramCount++
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updateFields.push(`updated_at = $${paramCount}`)
    queryParams.push(new Date())
    paramCount++

    // Add ID parameter last
    queryParams.push(parseInt(contentId))

    const updateQuery = `
      UPDATE content_queue 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const result = await db.query(updateQuery, queryParams)
    
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
        user: user.username 
      }
    )

    return NextResponse.json({
      success: true,
      content: result.rows[0]
    })

  } catch (err: any) {
    console.error('[AdminQueueAPI] PATCH error:', err)
    console.error('[AdminQueueAPI] PATCH error details:', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      stack: err?.stack
    })
    
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to update content',
      'AdminAPI',
      { error: err instanceof Error ? err.message : 'Unknown error' }
    )

    return NextResponse.json(
      { 
        error: 'Failed to update content',
        details: process.env.NODE_ENV === 'development' ? err?.message : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[AdminQueueAPI] GET /api/admin/content/queue request received')
    console.log('[AdminQueueAPI] Environment:', process.env.NODE_ENV)
    console.log('[AdminQueueAPI] Database URL set:', Boolean(process.env.DATABASE_URL))

    // Cookie-based authentication (same as main content route)
    const cookieStore = cookies()
    const token = cookieStore.get('auth')?.value

    if (!token) {
      console.warn('[AdminQueueAPI] No token found in cookies')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify JWT token
    let user
    try {
      user = await EdgeAuthUtils.verifyJWT(token)
      if (!user) {
        console.warn('[AdminQueueAPI] Token verification returned null')
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    } catch (error) {
      console.error('[AdminQueueAPI] Token verification error:', error)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('[AdminQueueAPI] User verified:', user.username)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') || 'all'
    const platform = searchParams.get('platform') || 'all'
    
    const actualOffset = offset || (page - 1) * limit
    
    console.log(`[AdminQueueAPI] Query params - status: ${status}, platform: ${platform}, page: ${page}, limit: ${limit}, offset: ${actualOffset}`)

    try {
      // Check database connection and log current state
      const healthCheck = await db.healthCheck()
      console.log('[AdminQueueAPI] Database health:', healthCheck)
      
      let contentQuery: string
      let countQuery: string
      const queryParams = [limit, actualOffset]
      
      // Build WHERE clause based on filters
      let whereConditions: string[] = []
      
      if (status !== 'all') {
        if (status === 'pending') {
          whereConditions.push('is_approved = FALSE AND is_posted = FALSE')
        } else if (status === 'approved') {
          whereConditions.push('is_approved = TRUE AND is_posted = FALSE')
        } else if (status === 'rejected') {
          whereConditions.push('is_approved = FALSE AND (admin_notes LIKE \'%Rejected%\' OR admin_notes LIKE \'%rejected%\')')
        } else if (status === 'posted') {
          whereConditions.push('is_posted = TRUE')
        }
      }
      
      if (platform !== 'all') {
        whereConditions.push(`source_platform = '${platform}'`)
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
      
      console.log(`[AdminQueueAPI] Building query with WHERE: ${whereClause}`)
      
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
          admin_notes,
          created_at,
          updated_at,
          confidence_score,
          content_status,
          reviewed_at,
          reviewed_by,
          rejection_reason
        FROM content_queue
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `
      
      countQuery = `
        SELECT COUNT(*) as total
        FROM content_queue
        ${whereClause}
      `
      
      console.log(`[AdminQueueAPI] Executing content query for status: ${status}, platform: ${platform}`)
      console.log(`[AdminQueueAPI] SQL Query:`, contentQuery)
      console.log(`[AdminQueueAPI] Query Parameters:`, queryParams)
      
      // Execute content query
      const contentResult = await db.query(contentQuery, queryParams)
      console.log(`[AdminQueueAPI] Query success: ${contentResult.rows.length} rows`)
      
      // Execute count query
      const countResult = await db.query(countQuery)
      const total = parseInt(countResult.rows[0].total)
      
      console.log(`[AdminQueueAPI] Total count: ${total}`)

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
        admin_notes: row.admin_notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        confidence_score: row.confidence_score,
        content_status: row.content_status,
        reviewed_at: row.reviewed_at,
        reviewed_by: row.reviewed_by,
        rejection_reason: row.rejection_reason
      }))

      try {
        await logToDatabase(
          LogLevel.INFO,
          'Content queue fetched',
          'AdminAPI',
          { 
            status, 
            platform, 
            count: content.length,
            total,
            user: user.username 
          }
        )
      } catch (logError) {
        console.warn('⚠️ [AdminQueueAPI] Logging failed:', logError)
        // Don't fail the request just because logging failed
      }

      console.log(`[AdminQueueAPI] Successfully returning ${content.length} content items`)
      return NextResponse.json({
        success: true,
        content,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: actualOffset + content.length < total
        },
        filter: { status, platform }
      })
      
    } catch (err) {
      console.error('[AdminQueueAPI] Database error:', err)
      console.error('[AdminQueueAPI] Error details:', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        stack: err?.stack
      })
      
      // Check if this is a table/column missing error
      if (err?.message?.includes('relation') && err?.message?.includes('does not exist')) {
        console.error('[AdminQueueAPI] Schema mismatch detected - table/column missing')
        return NextResponse.json({ 
          error: 'Database schema mismatch', 
          details: 'Missing table or column in database'
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err?.message : undefined
      }, { status: 500 })
    }

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