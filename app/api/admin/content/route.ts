import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError,
  verifyAdminAuth
} from '@/lib/api-middleware'
import { db } from '@/lib/db'

async function getContentHandler(request: NextRequest): Promise<NextResponse> {
  try {
    console.log(`🔍 Getting content - Environment: ${process.env.NODE_ENV}`)
    
    // Use Edge-compatible auth utils to verify JWT from cookies (same as /api/admin/me)
    const { EdgeAuthUtils } = await import('@/lib/auth-edge')
    
    // Get and verify JWT token from cookies or Authorization header
    const token = EdgeAuthUtils.getAuthTokenFromRequest(request)
    
    if (!token) {
      throw createApiError('No authentication token provided', 401, 'NO_TOKEN')
    }

    // Verify the JWT token
    let payload
    try {
      payload = await EdgeAuthUtils.verifyJWT(token)
    } catch (error) {
      console.error('[AdminContentAPI] JWT verification failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenLength: token ? token.length : 0
      })
      throw createApiError('Invalid or expired token', 401, 'INVALID_TOKEN')
    }
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') || searchParams.get('status') || 'all'
    
    const actualOffset = offset || (page - 1) * limit
    
    console.log(`📊 Query params - type: ${type}, page: ${page}, limit: ${limit}, offset: ${actualOffset}`)

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
    let fromClause = 'content_queue'
    
    if (type === 'posted') {
      // Simple fallback: just get posted content from content_queue
      // This works regardless of whether posts or posted_content tables exist
      console.log('🔄 Using simple content_queue filter for posted content')
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
    
    console.log(`🗄️ Executing query for type: ${type}`)
    console.log(`📝 Query: ${contentQuery.replace(/\s+/g, ' ').trim()}`)
    console.log(`🔢 Params: [${queryParams.join(', ')}]`)
    
    const contentResult = await db.query(contentQuery, queryParams)
    console.log(`✅ Content query successful - Found ${contentResult.rows.length} rows`)
    
    // Get total count for pagination
    let countQuery: string
    let total: number
    
    if (type === 'posted') {
      // Simple count from content_queue
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
    
    console.log(`📊 Total count: ${total}`)

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

    console.log(`🎉 Successfully returning ${content.length} content items`)
    return createSuccessResponse(responseData, `Retrieved ${content.length} content items`)

  } catch (error) {
    console.error('[AdminContentAPI] Request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      statusCode: error instanceof Error && 'statusCode' in error ? (error as any).statusCode : undefined,
      endpoint: '/api/admin/content GET',
      timestamp: new Date().toISOString()
    })
    
    // Re-throw auth errors without modification
    if (error instanceof Error && 
        (error.message.includes('No authentication token') || 
         error.message.includes('Invalid or expired token'))) {
      throw error
    }
    
    throw createApiError('Failed to retrieve content', 500, 'CONTENT_RETRIEVAL_ERROR')
  }
}

async function updateContentHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['PUT'])

  try {
    const body = await request.json()
    const { id, is_approved, admin_notes, is_posted } = body

    if (!id) {
      throw createApiError('Content ID is required', 400, 'MISSING_CONTENT_ID')
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
      throw createApiError('No valid fields to update', 400, 'NO_UPDATE_FIELDS')
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await getContentHandler(request)
  } catch (error) {
    console.error('[AdminContentAPI] GET request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      statusCode: error instanceof Error && 'statusCode' in error ? (error as any).statusCode : undefined
    })
    
    // Return structured JSON error responses
    if (error instanceof Error && 'statusCode' in error) {
      return NextResponse.json(
        { success: false, error: error.message || 'Unknown error' },
        { status: (error as any).statusCode || 500 }
      )
    }
    
    return await handleApiError(error, request, '/api/admin/content')
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    return await updateContentHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/content')
  }
}

async function createContentHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Use Edge-compatible auth utils to verify JWT from cookies (same as /api/admin/me)
    const { EdgeAuthUtils } = await import('@/lib/auth-edge')
    
    const token = EdgeAuthUtils.getAuthTokenFromRequest(request)
    if (!token) {
      throw createApiError('No authentication token provided', 401, 'NO_TOKEN')
    }

    try {
      await EdgeAuthUtils.verifyJWT(token)
    } catch (error) {
      throw createApiError('Invalid or expired token', 401, 'INVALID_TOKEN')
    }

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
      throw createApiError(
        'contentText, contentType, and sourcePlatform are required', 
        400, 
        'MISSING_REQUIRED_FIELDS'
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
      throw createApiError('Duplicate content detected', 409, 'DUPLICATE_CONTENT')
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

    return createSuccessResponse(
      result.rows[0],
      'Content created successfully'
    )

  } catch (error) {
    console.error('Failed to create content:', error)
    if (error instanceof Error && 
        (error.message.includes('UNAUTHORIZED') || 
         error.message.includes('DUPLICATE_CONTENT') ||
         error.message.includes('MISSING_REQUIRED_FIELDS'))) {
      throw error
    }
    throw createApiError('Failed to create content', 500, 'CONTENT_CREATE_ERROR')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['POST'])
    return await createContentHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/content')
  }
}