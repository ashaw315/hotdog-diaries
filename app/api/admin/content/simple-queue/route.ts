import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  console.log('🔧 [SimpleQueue] Starting simple queue test...')
  
  try {
    // Auth check - same as /api/admin/me
    let userId: string | null = null
    let username: string | null = null

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

    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ [SimpleQueue] Authentication successful for user:', username)

    // Connect to Supabase
    const supabase = createSimpleClient()
    console.log('✅ [SimpleQueue] Supabase client created')

    // Try the simplest possible query
    console.log('🔍 [SimpleQueue] Testing content_queue table...')
    const { data, error, count } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('❌ [SimpleQueue] Query error:', error)
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        }
      }, { status: 500 })
    }

    console.log('✅ [SimpleQueue] Query successful! Found:', data?.length || 0, 'items')

    // Return in the format expected by frontend
    return NextResponse.json({
      success: true,
      content: data || [],
      pagination: {
        total: count || 0,
        limit: 10,
        offset: 0,
        hasMore: false
      },
      message: `Found ${data?.length || 0} content items`
    })

  } catch (error) {
    console.error('❌ [SimpleQueue] Critical error:', error)
    return NextResponse.json({
      success: false,
      error: 'Critical error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}