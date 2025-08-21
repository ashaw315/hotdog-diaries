import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Security: Verify this is from GitHub Actions or authenticated admin
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get today's statistics
    const stats = await getDailyStats()
    
    return NextResponse.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      ...stats
    })

  } catch (error: any) {
    console.error('❌ Error getting daily stats:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

async function getDailyStats() {
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
  
  if (isSqlite) {
    await db.connect()
    
    const todayPosts = await db.query(`
      SELECT COUNT(*) as count FROM posted_content 
      WHERE DATE(posted_at) = DATE('now')
    `)
    
    const weekPosts = await db.query(`
      SELECT COUNT(*) as count FROM posted_content 
      WHERE posted_at >= datetime('now', '-7 days')
    `)
    
    const monthPosts = await db.query(`
      SELECT COUNT(*) as count FROM posted_content 
      WHERE posted_at >= datetime('now', '-30 days')
    `)
    
    const totalPosts = await db.query(`
      SELECT COUNT(*) as count FROM posted_content
    `)
    
    const queueStats = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN is_posted = 1 THEN 1 ELSE 0 END) as posted,
        SUM(CASE WHEN is_approved = 1 AND is_posted = 0 THEN 1 ELSE 0 END) as ready_to_post
      FROM content_queue
    `)
    
    await db.disconnect()
    
    const queue = queueStats.rows[0] || {}
    
    return {
      postsToday: todayPosts.rows[0]?.count || 0,
      postsThisWeek: weekPosts.rows[0]?.count || 0,
      postsThisMonth: monthPosts.rows[0]?.count || 0,
      totalPosts: totalPosts.rows[0]?.count || 0,
      queueSize: queue.total || 0,
      approved: queue.approved || 0,
      posted: queue.posted || 0,
      readyToPost: queue.ready_to_post || 0,
      daysOfContent: Math.floor((queue.ready_to_post || 0) / 6)
    }
    
  } else {
    const supabase = createSimpleClient()
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: todayPosts } = await supabase
      .from('posted_content')
      .select('id', { count: 'exact' })
      .gte('posted_at', `${today}T00:00:00.000Z`)
      .lt('posted_at', `${today}T23:59:59.999Z`)
    
    const { data: weekPosts } = await supabase
      .from('posted_content')
      .select('id', { count: 'exact' })
      .gte('posted_at', weekAgo)
    
    const { data: monthPosts } = await supabase
      .from('posted_content')
      .select('id', { count: 'exact' })
      .gte('posted_at', monthAgo)
    
    const { data: totalPosts } = await supabase
      .from('posted_content')
      .select('id', { count: 'exact' })
    
    const { data: queueData } = await supabase
      .from('content_queue')
      .select('is_approved, is_posted')
    
    const approved = queueData?.filter(item => item.is_approved && !item.is_posted).length || 0
    const posted = queueData?.filter(item => item.is_posted).length || 0
    
    return {
      postsToday: todayPosts?.length || 0,
      postsThisWeek: weekPosts?.length || 0,
      postsThisMonth: monthPosts?.length || 0,
      totalPosts: totalPosts?.length || 0,
      queueSize: queueData?.length || 0,
      approved,
      posted,
      readyToPost: approved,
      daysOfContent: Math.floor(approved / 6)
    }
  }
}