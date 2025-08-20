import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { createSimpleClient } from '@/utils/supabase/server'
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
    // Use same auth method as /api/admin/me (which works)
    let userId: string | null = null
    let username: string | null = null

    // TEMPORARY: Check for test token in Authorization header (same as /api/admin/me)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through to normal auth
      }
    }

    // If not using test token, get from middleware headers
    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get('id')
    
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { content_text, content_status, reviewed_by, rejection_reason } = body

    // Use Supabase for the update
    const supabase = createSimpleClient()
    
    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    if (content_text !== undefined) {
      updateData.content_text = content_text
    }
    
    if (content_status !== undefined) {
      updateData.content_status = content_status
      
      // Update approved status based on content_status
      if (content_status === 'approved') {
        updateData.is_approved = true
      } else if (content_status === 'rejected') {
        updateData.is_approved = false
      }
    }
    
    if (reviewed_by !== undefined) {
      updateData.reviewed_by = reviewed_by
      updateData.reviewed_at = new Date().toISOString()
    }
    
    if (rejection_reason !== undefined) {
      updateData.rejection_reason = rejection_reason
    }

    const { data, error } = await supabase
      .from('content_queue')
      .update(updateData)
      .eq('id', parseInt(contentId))
      .select()
      .single()
    
    if (error) {
      throw new Error(`Database update failed: ${error.message}`)
    }
    
    const result = { rows: [data] }
    
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
        user: username 
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
    // Use same auth method as /api/admin/me (which works)
    let userId: string | null = null
    let username: string | null = null

    // TEMPORARY: Check for test token in Authorization header (same as /api/admin/me)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through to normal auth
      }
    }

    // If not using test token, get from middleware headers
    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const platform = searchParams.get('platform') || 'all'
    const sortBy = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Use Supabase for the query
    const supabase = createSimpleClient()
    console.log('🔧 [AdminQueue] Starting database query...')
    
    try {
      // Start with the simplest possible query
      console.log('🔍 [AdminQueue] Testing basic table access...')
      
      // Test 1: Check if table exists at all
      const { data: tableTest, error: tableError } = await supabase
        .from('content_queue')
        .select('id')
        .limit(1)
      
      if (tableError) {
        console.error('❌ [AdminQueue] Table access failed:', tableError)
        
        // Try alternative table names
        const tableNames = ['posts', 'content', 'queued_content', 'hotdog_content']
        for (const tableName of tableNames) {
          console.log(`🔍 [AdminQueue] Trying table: ${tableName}`)
          const { data: altData, error: altError } = await supabase
            .from(tableName)
            .select('id')
            .limit(1)
          
          if (!altError) {
            console.log(`✅ [AdminQueue] Found working table: ${tableName}`)
            return NextResponse.json({
              error: `Table 'content_queue' not found, but '${tableName}' exists`,
              suggestion: `Update your code to use table '${tableName}' instead`,
              availableTable: tableName
            }, { status: 500 })
          }
        }
        
        return NextResponse.json({
          error: 'No content tables found',
          details: {
            message: tableError.message,
            hint: tableError.hint,
            code: tableError.code
          },
          suggestion: 'Check Supabase dashboard for table structure'
        }, { status: 500 })
      }
      
      console.log('✅ [AdminQueue] Table exists, building query...')
      
      let query = supabase
        .from('content_queue')
        .select('*', { count: 'exact' })

      // Apply filters
      if (status !== 'all') {
        query = query.eq('content_status', status)
      }

      if (platform !== 'all') {
        query = query.eq('source_platform', platform)
      }

      // Apply sorting
      const validSortFields = ['created_at', 'updated_at', 'scraped_at', 'content_status', 'confidence_score']
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at'
      const ascending = order === 'asc'
      
      query = query.order(sortField, { ascending })

      // Apply pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query
      
      if (error) {
        console.error('❌ [AdminQueue] Database error:', error)
        console.error('❌ [AdminQueue] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        return NextResponse.json({
          error: 'Database query failed',
          details: {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          }
        }, { status: 500 })
      }
      
      console.log('✅ [AdminQueue] Query successful, found:', data?.length || 0, 'items')
      
      // Log sample data structure if we have items
      if (data && data.length > 0) {
        console.log('📊 [AdminQueue] Sample item keys:', Object.keys(data[0]))
      }
      
      const total = count || 0

      await logToDatabase(
        LogLevel.INFO,
        'Content queue fetched',
        'AdminAPI',
        { 
          status, 
          platform, 
          count: data?.length || 0,
          total,
          user: username 
        }
      )

      return NextResponse.json({
        content: data || [],
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      })
      
    } catch (queryError) {
      console.error('❌ [AdminQueue] Query execution error:', queryError)
      return NextResponse.json({
        error: 'Query execution failed',
        details: queryError instanceof Error ? queryError.message : String(queryError)
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