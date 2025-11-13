import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { EdgeAuthUtils } from '@/lib/auth-edge'
import { db } from '@/lib/db'
import { mockAdminDataIfCI } from '@/app/api/admin/_testMock'
import { USE_MOCK_DATA } from '@/lib/env'
import { verifyTableColumns } from '@/lib/db-schema-utils'

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[AdminContentAPI] GET /api/admin/content request received')
  console.log('[AdminContentAPI] Environment:', process.env.NODE_ENV)
  console.log('[AdminContentAPI] Database URL set:', Boolean(process.env.DATABASE_URL))
  console.log('[AdminContentAPI] Supabase URL set:', Boolean(process.env.SUPABASE_URL))

  // Return mock data for CI/test environments
  if (USE_MOCK_DATA) {
    console.log('[AdminContentAPI] Returning mock data for CI/test environment')
    const mockData = mockAdminDataIfCI('queue')
    if (mockData) {
      return NextResponse.json({
        success: true,
        data: {
          content: mockData,
          pagination: { page: 1, limit: 50, total: mockData.length, totalPages: 1, hasMore: false },
          filter: 'all'
        },
        message: `Retrieved ${mockData.length} content items`
      })
    }
  }

  // Cookie-based authentication
  const cookieStore = await cookies()
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
  const platform = searchParams.get('platform') || null
  const contentType = searchParams.get('type') || null
  const sortOrder = searchParams.get('sortOrder') || searchParams.get('dir') || 'desc'
  const startDate = searchParams.get('startDate') || null
  const endDate = searchParams.get('endDate') || null

  const actualOffset = offset || (page - 1) * limit

  console.log(`[AdminContentAPI] Query params - status: ${status}, platform: ${platform}, type: ${contentType}, page: ${page}, limit: ${limit}, offset: ${actualOffset}, sortOrder: ${sortOrder}, startDate: ${startDate}, endDate: ${endDate}`)

  try {
    // Check database connection and log current state
    const healthCheck = await db.healthCheck()
    console.log('[AdminContentAPI] Database health:', healthCheck)
    
    // Verify schema and build safe column list
    console.log('[AdminContentAPI] Verifying database schema...')
    let contentQueueColumns = await verifyTableColumns('content_queue')
    let postedContentColumns = await verifyTableColumns('posted_content')

    // Fallback to known columns if schema detection fails
    if (contentQueueColumns.length === 0) {
      console.warn('[AdminContentAPI] Schema detection failed for content_queue, using fallback column list')
      contentQueueColumns = [
        'id', 'content_text', 'content_type', 'source_platform', 'original_url',
        'original_author', 'content_image_url', 'content_video_url', 'scraped_at',
        'is_posted', 'is_approved', 'admin_notes', 'created_at', 'updated_at',
        'confidence_score', 'content_hash', 'is_rejected', 'status', 'scheduled_for',
        'scheduled_post_time', 'content_status', 'reviewed_at', 'reviewed_by',
        'rejection_reason', 'is_spam', 'is_inappropriate', 'is_unrelated', 'is_valid_hotdog'
      ]
    }

    if (postedContentColumns.length === 0) {
      console.warn('[AdminContentAPI] Schema detection failed for posted_content, using fallback column list')
      postedContentColumns = ['content_queue_id', 'posted_at', 'platform', 'post_id', 'post_url', 'post_order']
    }

    console.log('[AdminContentAPI] Available columns in content_queue:', contentQueueColumns.length)
    console.log('[AdminContentAPI] Available columns in posted_content:', postedContentColumns.length)

    // Build safe SELECT clause based on existing columns
    const desiredColumns = [
      'id',
      'content_text',
      'content_type',
      'source_platform',
      'original_url',
      'original_author',
      'content_image_url',
      'content_video_url',
      'scraped_at',
      'is_posted',
      'is_approved',
      'admin_notes',
      'created_at',
      'updated_at',
      'confidence_score',
      'content_hash',
      'is_rejected',
      'status',
      'scheduled_for',
      'scheduled_post_time',
      'content_status',
      'reviewed_at',
      'reviewed_by',
      'rejection_reason',
      'is_spam',
      'is_inappropriate',
      'is_unrelated',
      'is_valid_hotdog'
    ]

    // Use direct column list to avoid NULL values from schema detection failures
    // Schema detection was causing all columns to be selected as NULL when it failed
    const safeSelectClause = desiredColumns.map(col => `cq.${col}`).join(', ')
    console.log('[AdminContentAPI] Using direct column selection to bypass schema detection issues')
    console.log('🔍 [DEBUG] SELECT clause includes original_url:', safeSelectClause.includes('original_url'))
    console.log('🔍 [DEBUG] Full SELECT clause:', safeSelectClause.substring(0, 200))
    
    let contentQuery: string
    let countQuery: string
    const queryParams: any[] = []
    let paramIndex = 1
    let whereClause: string // Declare at top level for debug access

    // Column detection - declare at top level for debug access
    const hasAdminNotes = contentQueueColumns.includes('admin_notes')
    const hasIsApproved = contentQueueColumns.includes('is_approved')
    const hasIsPosted = contentQueueColumns.includes('is_posted')
    const hasContentStatus = contentQueueColumns.includes('content_status')
    const hasScheduledPostTime = contentQueueColumns.includes('scheduled_post_time')

    if (status === 'posted') {
      // Query content_queue joined with posted_content for posted content
      console.log('[AdminContentAPI] Filtering for posted content (JOIN with posted_content)')

      // Add posted_at only if it exists in posted_content
      const postedAtClause = postedContentColumns.includes('posted_at')
        ? 'pc.posted_at'
        : 'NULL AS posted_at'

      console.log('🔍 [DEBUG] postedContentColumns array:', postedContentColumns)
      console.log('🔍 [DEBUG] postedContentColumns.includes("posted_at"):', postedContentColumns.includes('posted_at'))
      console.log('🔍 [DEBUG] postedAtClause:', postedAtClause)

      let postedWhereClause = 'pc.posted_at IS NOT NULL'
      whereClause = postedWhereClause // For debug access

      // 🔍 Debug: Log filters being applied (posted path)
      console.log(`[AdminContentAPI] 🔍 POSTED PATH - Applying filters - platform: ${platform}, contentType: ${contentType}`)
      console.log(`[AdminContentAPI] 🔍 POSTED - WHERE clause before filters: ${postedWhereClause}`)
      console.log(`[AdminContentAPI] 🔍 POSTED - queryParams before filters: [${queryParams.join(', ')}]`)

      // Add platform and content type filters if specified
      if (platform) {
        postedWhereClause += ` AND cq.source_platform = $${paramIndex}`
        whereClause = postedWhereClause // Keep in sync
        queryParams.push(platform)
        console.log(`[AdminContentAPI] ✅ POSTED - Added platform filter: ${platform} at $${paramIndex}`)
        paramIndex++
      }
      if (contentType) {
        postedWhereClause += ` AND cq.content_type = $${paramIndex}`
        whereClause = postedWhereClause // Keep in sync
        queryParams.push(contentType)
        console.log(`[AdminContentAPI] ✅ POSTED - Added contentType filter: ${contentType} at $${paramIndex}`)
        paramIndex++
      }

      console.log(`[AdminContentAPI] 🔍 POSTED - WHERE clause after filters: ${postedWhereClause}`)
      console.log(`[AdminContentAPI] 🔍 POSTED - queryParams after filters: [${queryParams.join(', ')}]`)

      // Add date range filtering if provided
      if (startDate) {
        postedWhereClause += ` AND pc.posted_at >= $${paramIndex}`
        queryParams.push(new Date(startDate).toISOString())
        console.log(`[AdminContentAPI] ✅ POSTED - Added startDate filter: ${startDate} at $${paramIndex}`)
        paramIndex++
      }

      if (endDate) {
        // Add 1 day to endDate to include the entire end day
        const endDateTime = new Date(endDate)
        endDateTime.setDate(endDateTime.getDate() + 1)
        postedWhereClause += ` AND pc.posted_at < $${paramIndex}`
        queryParams.push(endDateTime.toISOString())
        console.log(`[AdminContentAPI] ✅ POSTED - Added endDate filter: ${endDate} (exclusive: ${endDateTime.toISOString()}) at $${paramIndex}`)
        paramIndex++
      }

      // Add LIMIT and OFFSET parameters
      queryParams.push(limit, actualOffset)
      console.log(`[AdminContentAPI] 🔍 POSTED - queryParams after adding LIMIT/OFFSET: [${queryParams.join(', ')}]`)

      // Add post_order if it exists in posted_content
      const postOrderClause = postedContentColumns.includes('post_order')
        ? 'pc.post_order'
        : 'NULL AS post_order'

      // Determine sort order (default: DESC for newest first)
      const orderDirection = (sortOrder && sortOrder.toLowerCase() === 'asc') ? 'ASC' : 'DESC'

      contentQuery = `
        SELECT
          ${safeSelectClause},
          ${postedAtClause},
          ${postOrderClause}
        FROM content_queue cq
        JOIN posted_content pc ON pc.content_queue_id = cq.id
        WHERE ${postedWhereClause}
        ORDER BY pc.posted_at ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `

      countQuery = `
        SELECT COUNT(*) as total
        FROM content_queue cq
        JOIN posted_content pc ON pc.content_queue_id = cq.id
        WHERE ${postedWhereClause}
      `
      
    } else {
      // Query content_queue only for other statuses
      whereClause = '1=1' // Don't redeclare - use outer variable
      let orderBy = contentQueueColumns.includes('scraped_at')
        ? 'cq.scraped_at DESC'
        : 'cq.created_at DESC'

      console.log(`[AdminContentAPI] 🔍 Column detection: hasContentStatus=${hasContentStatus}, hasIsApproved=${hasIsApproved}, hasIsPosted=${hasIsPosted}`)
      console.log(`[AdminContentAPI] 🔍 Status filter: ${status}`)

      // Prefer content_status field over legacy is_approved field
      if (status === 'pending') {
        if (hasContentStatus) {
          // Use content_status for more accurate filtering
          whereClause = `(cq.content_status = 'discovered' OR cq.content_status = 'pending_review')`
          whereClause += ' AND NOT EXISTS (SELECT 1 FROM posted_content WHERE content_queue_id = cq.id)'
        } else if (hasIsApproved) {
          whereClause = 'cq.is_approved = FALSE'
          if (hasAdminNotes) {
            whereClause += ' AND (cq.admin_notes IS NULL OR cq.admin_notes NOT LIKE \'%Rejected%\')'
          }
          whereClause += ' AND NOT EXISTS (SELECT 1 FROM posted_content WHERE content_queue_id = cq.id)'
        } else if (hasIsPosted) {
          whereClause = 'cq.is_posted = FALSE'
          whereClause += ' AND NOT EXISTS (SELECT 1 FROM posted_content WHERE content_queue_id = cq.id)'
        }
      } else if (status === 'approved') {
        if (hasContentStatus) {
          whereClause = `cq.content_status = 'approved'`
          if (hasIsPosted) {
            whereClause += ' AND cq.is_posted = FALSE'
          }
        } else if (hasIsApproved) {
          whereClause = 'cq.is_approved = TRUE'
          if (hasIsPosted) {
            whereClause += ' AND cq.is_posted = FALSE'
          }
        } else {
          whereClause = '1=1' // Fallback if column doesn't exist
        }
      } else if (status === 'rejected') {
        if (hasContentStatus) {
          whereClause = `cq.content_status = 'rejected'`
        } else if (hasIsApproved && hasAdminNotes) {
          whereClause = 'cq.is_approved = FALSE AND cq.admin_notes LIKE \'%Rejected%\''
        } else if (hasIsApproved) {
          whereClause = 'cq.is_approved = FALSE'
        } else {
          whereClause = '1=0' // No rejected items if columns don't exist
        }
      } else if (status === 'scheduled') {
        // Check for scheduled content based on available columns
        const hasStatus = contentQueueColumns.includes('status')
        const hasScheduledFor = contentQueueColumns.includes('scheduled_for')

        // Production schema detection (Supabase uses different field names)
        if (hasContentStatus && hasScheduledPostTime) {
          // Production schema: content_status + scheduled_post_time
          whereClause = `(cq.content_status = 'scheduled' OR (cq.scheduled_post_time IS NOT NULL AND cq.is_approved = TRUE))`
          orderBy = 'cq.scheduled_post_time ASC'
          console.log('[AdminContentAPI] Using production schema for scheduled content')
          console.log('🧩 [ContentAPI] ORDER BY scheduled_post_time ASC applied for scheduled filter')
        } else if (process.env.NODE_ENV === 'development' && contentQueueColumns.length === 0) {
          console.log('[AdminContentAPI] Development mode: bypassing schema detection for scheduled status')
          // Include items with scheduled_for set (no status column in production)
          whereClause = `cq.scheduled_for IS NOT NULL`
          orderBy = 'cq.scheduled_for ASC'
          console.log('🧩 [ContentAPI] ORDER BY scheduled_for ASC applied for scheduled filter (dev mode)')
        } else if (hasScheduledFor) {
          whereClause = 'cq.scheduled_for IS NOT NULL'
          orderBy = 'cq.scheduled_for ASC'
          console.log('🧩 [ContentAPI] ORDER BY scheduled_for ASC applied for scheduled filter')
        } else {
          // If no scheduling columns exist, no scheduled items
          whereClause = '1=0'
        }
        
        console.log('🧩 [ContentAPI] Scheduled filter - hasContentStatus:', hasContentStatus, 'hasScheduledPostTime:', hasScheduledPostTime, 'hasStatus:', hasStatus, 'hasScheduledFor:', hasScheduledFor)
      }
      // For 'all' or any other value, keep whereClause as '1=1'

      console.log(`[AdminContentAPI] 🎯 Final WHERE clause for status '${status}': ${whereClause}`)

      // 🔍 Debug: Log filters being applied
      console.log(`[AdminContentAPI] 🔍 Applying filters - platform: ${platform}, contentType: ${contentType}`)
      console.log(`[AdminContentAPI] 🔍 WHERE clause before filters: ${whereClause}`)
      console.log(`[AdminContentAPI] 🔍 queryParams before filters: [${queryParams.join(', ')}]`)
      console.log(`[AdminContentAPI] 🔍 paramIndex before filters: ${paramIndex}`)

      // Add platform and content type filters if specified (using parameterized queries)
      if (platform) {
        whereClause += ` AND cq.source_platform = $${paramIndex}`
        queryParams.push(platform)
        console.log(`[AdminContentAPI] ✅ Added platform filter: ${platform} at $${paramIndex}`)
        paramIndex++
      }
      if (contentType) {
        whereClause += ` AND cq.content_type = $${paramIndex}`
        queryParams.push(contentType)
        console.log(`[AdminContentAPI] ✅ Added contentType filter: ${contentType} at $${paramIndex}`)
        paramIndex++
      }

      console.log(`[AdminContentAPI] 🔍 WHERE clause after filters: ${whereClause}`)
      console.log(`[AdminContentAPI] 🔍 queryParams after filters: [${queryParams.join(', ')}]`)

      // Add LIMIT and OFFSET parameters
      queryParams.push(limit, actualOffset)
      console.log(`[AdminContentAPI] 🔍 queryParams after adding LIMIT/OFFSET: [${queryParams.join(', ')}]`)

      console.log(`[AdminContentAPI] Filtering for ${status} content with WHERE: ${whereClause}`)

      contentQuery = `
        SELECT
          ${safeSelectClause},
          NULL as posted_at
        FROM content_queue cq
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `

      countQuery = `
        SELECT COUNT(*) as total
        FROM content_queue cq
        WHERE ${whereClause}
      `
      
      // Enhanced diagnostic logging
      console.log('🧩 [ContentAPI] Final WHERE Clause:', whereClause)
      console.log('🧩 [ContentAPI] Detected Columns:', contentQueueColumns.length, 
        contentQueueColumns.includes('status') ? '(has status)' : '', 
        contentQueueColumns.includes('scheduled_for') ? '(has scheduled_for)' : '')
    }
    
    console.log(`[AdminContentAPI] Executing content query for status: ${status}`)
    console.log(`[AdminContentAPI] 📝 Content Query SQL: ${contentQuery.substring(0, 300)}...`)
    console.log(`[AdminContentAPI] 📝 Content Query Params: [${queryParams.join(', ')}]`)

    // Execute content query
    const contentResult = await db.query(contentQuery, queryParams)
    console.log(`[AdminContentAPI] Query success: ${contentResult.rows.length} rows`)
    console.log('🧩 [ContentAPI] Row Count Returned:', contentResult.rows.length)

    // 🔍 DEBUG: Log first row to verify original_url and posted_at are present in database results
    if (contentResult.rows.length > 0) {
      const firstRow = contentResult.rows[0]
      console.log('🔍 [DEBUG] First row from database:')
      console.log('  - id:', firstRow.id)
      console.log('  - content_text:', firstRow.content_text?.substring(0, 50))
      console.log('  - source_platform:', firstRow.source_platform)
      console.log('  - original_url:', firstRow.original_url)
      console.log('  - original_url type:', typeof firstRow.original_url)
      console.log('  - original_url is null:', firstRow.original_url === null)
      console.log('  - original_url is undefined:', firstRow.original_url === undefined)
      console.log('  - posted_at:', firstRow.posted_at)
      console.log('  - posted_at type:', typeof firstRow.posted_at)
      console.log('  - posted_at is null:', firstRow.posted_at === null)
      console.log('  - posted_at is undefined:', firstRow.posted_at === undefined)
      console.log('  - post_order:', firstRow.post_order)
      console.log('  - post_order type:', typeof firstRow.post_order)
      console.log('  - All keys in row:', Object.keys(firstRow).sort().join(', '))
    }

    // Execute count query (use params without LIMIT/OFFSET)
    console.log(`[AdminContentAPI] 🔍 BEFORE slicing - queryParams.length: ${queryParams.length}, queryParams: [${queryParams.join(', ')}]`)
    const countParams = queryParams.slice(0, -2) // Remove last 2 params (limit, offset)
    console.log(`[AdminContentAPI] 🔍 AFTER slicing - countParams.length: ${countParams.length}, countParams: [${countParams.join(', ')}]`)
    console.log(`[AdminContentAPI] ⚡ Executing count query with ${countParams.length} params`)
    console.log(`[AdminContentAPI] ⚡ Count query SQL:\n${countQuery}`)
    console.log(`[AdminContentAPI] ⚡ Count params:`, countParams)

    console.log(`[AdminContentAPI] 🚨 ABOUT TO EXECUTE COUNT QUERY:`)
    console.log(`[AdminContentAPI] 📝 Count Query SQL: ${countQuery.substring(0, 300)}...`)
    console.log(`[AdminContentAPI] 📝 Count Params: [${countParams.join(', ')}]`)

    const countResult = await db.query(countQuery, countParams)

    console.log(`[AdminContentAPI] 🚨 COUNT QUERY RESULT:`)
    console.log(`[AdminContentAPI] Count result rows:`, countResult.rows.length)
    console.log(`[AdminContentAPI] Count result first row:`, JSON.stringify(countResult.rows[0]))
    console.log(`[AdminContentAPI] 🚨 Expected ~61 for reddit, got: ${countResult.rows[0]?.count || countResult.rows[0]?.total}`)

    // Vercel SQL returns 'count' instead of respecting the 'as total' alias
    const rawTotal = countResult.rows[0]?.total ?? countResult.rows[0]?.count ?? 0
    const total = typeof rawTotal === 'string' ? parseInt(rawTotal) : rawTotal

    console.log(`[AdminContentAPI] Total count: ${total}`)
    
    // 🧩 Diagnostic logging for scheduled content
    console.group('🧩 [Diagnostics] Scheduled Query Result')
    console.log('Requested status:', status)
    console.log('Rows returned from DB:', contentResult.rows.length)
    console.log('First row sample:', contentResult.rows[0])
    if (status === 'scheduled') {
      console.log('Scheduled content IDs:', contentResult.rows.map(r => r.id))
      console.log('Scheduled times:', contentResult.rows.map(r => r.scheduled_for))
    }
    console.groupEnd()

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
      post_order: row.post_order, // Use actual post_order from database
      // Additional fields for ContentQueue interface
      content_status: row.content_status || (row.status || 'discovered'),
      status: row.status || row.content_status || 'discovered',
      scheduled_for: row.scheduled_for || row.scheduled_post_time,
      scheduled_post_time: row.scheduled_post_time,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      rejection_reason: row.rejection_reason,
      confidence_score: row.confidence_score,
      is_spam: row.is_spam,
      is_inappropriate: row.is_inappropriate,
      is_unrelated: row.is_unrelated,
      is_valid_hotdog: row.is_valid_hotdog
    }))

    // 🔍 DEBUG: Log mapped content to verify posted_at is preserved
    if (content.length > 0) {
      console.log('🔍 [DEBUG] First mapped item:')
      console.log('  - id:', content[0].id)
      console.log('  - posted_at:', content[0].posted_at)
      console.log('  - posted_at type:', typeof content[0].posted_at)
      console.log('  - post_order:', content[0].post_order)
      console.log('  - post_order type:', typeof content[0].post_order)
    }

    const responseData = {
      content,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: actualOffset + content.length < total
      },
      filter: status,
      // 🐛 DEBUG: Temporary debug info
      _debug: {
        countQueryExecuted: true,
        countResultRows: countResult.rows.length,
        countResultFirstRow: countResult.rows[0],
        rawTotalField: countResult.rows[0]?.total,
        rawCountField: countResult.rows[0]?.count,
        rawTotalUsed: rawTotal,
        parsedTotal: total,
        queryParamsLength: queryParams.length,
        countParamsLength: countParams.length,
        whereClause: whereClause || '(not set)',
        contentQueryReturned: contentResult.rows.length,
        requestedStatus: status,
        // Column detection flags
        columnDetection: {
          hasContentStatus,
          hasIsApproved,
          hasIsPosted,
          hasScheduledPostTime,
          columnsDetected: contentQueueColumns.length,
          columnsList: contentQueueColumns
        },
        // SQL queries and parameters
        queries: {
          contentSQL: contentQuery.substring(0, 500),
          countSQL: countQuery.substring(0, 500),
          queryParams,
          countParams
        }
      }
    }

    // 🧩 Additional diagnostic logging for response
    console.group('🧩 [Diagnostics] Response Data')
    console.log('Mapped content length:', content.length)
    console.log('Response structure:', { 
      hasContent: !!responseData.content,
      contentLength: responseData.content.length,
      filter: responseData.filter,
      total: responseData.pagination.total
    })
    if (status === 'scheduled' && content.length > 0) {
      console.log('First mapped scheduled item:', content[0])
    }
    console.groupEnd()

    console.log(`[AdminContentAPI] Successfully returning ${content.length} content items`)
    return NextResponse.json({
      success: true,
      data: responseData,
      message: `Retrieved ${content.length} content items`
    })

  } catch (err: any) {
    console.error('[AdminContentAPI] Database error:', err)
    console.error('[AdminContentAPI] Error details:', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      detail: err?.detail,
      hint: err?.hint,
      position: err?.position
    })
    
    // Specific error handling for PostgreSQL column errors
    if (err?.code === '42703') {
      // Column does not exist
      const columnMatch = err.message.match(/column ["']?(\w+\.)?(\w+)["']? does not exist/i)
      const missingColumn = columnMatch ? columnMatch[2] : 'unknown'
      
      console.error(`[AdminContentAPI] Missing column detected: ${missingColumn}`)
      console.error('[AdminContentAPI] Attempting to recover with schema fallback...')
      
      return NextResponse.json({ 
        error: 'Database column missing', 
        message: `Column '${missingColumn}' does not exist in the database`,
        code: err.code,
        recovery: 'The API will use NULL fallbacks for missing columns'
      }, { status: 500 })
    }
    
    // Check if this is a table missing error
    if (err?.code === '42P01' || (err?.message?.includes('relation') && err?.message?.includes('does not exist'))) {
      console.error('[AdminContentAPI] Table missing - critical schema error')
      return NextResponse.json({ 
        error: 'Database table missing', 
        message: err?.message,
        code: err?.code || '42P01'
      }, { status: 500 })
    }
    
    // Generic database errors
    if (err?.code) {
      return NextResponse.json({ 
        error: 'Database error',
        message: process.env.NODE_ENV === 'development' ? err?.message : 'A database error occurred',
        code: err.code
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[AdminContentAPI] POST /api/admin/content request received')

    const cookieStore = await cookies()
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

    const cookieStore = await cookies()
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