import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    // Get today's date for filtering
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Execute all queries in parallel
    const [
      totalContentResult,
      pendingContentResult,
      postedTodayResult,
      totalViewsResult,
      lastPostResult,
      avgEngagementResult
    ] = await Promise.all([
      // Total content count
      db.query('SELECT COUNT(*) as count FROM content_queue'),
      
      // Pending content count  
      db.query("SELECT COUNT(*) as count FROM content_queue WHERE NOT is_posted AND is_approved = false"),
      
      // Posted today count
      db.query(`
        SELECT COUNT(*) as count 
        FROM posted_content pc
        JOIN content_queue cq ON pc.content_queue_id = cq.id
        WHERE pc.posted_at >= $1 
        AND pc.posted_at < $2
      `, [today.toISOString(), tomorrow.toISOString()]),
      
      // Total views (placeholder - content_queue doesn't have views field yet)
      db.query("SELECT 0 as total_views"),
      
      // Last post time
      db.query(`
        SELECT posted_at 
        FROM posted_content 
        WHERE posted_at IS NOT NULL 
        ORDER BY posted_at DESC 
        LIMIT 1
      `),
      
      // Average engagement rate (placeholder)
      db.query("SELECT 0 as avg_engagement")
    ])

    // Calculate next post time (assuming 4-hour intervals, 6 posts per day)
    const lastPostTime = lastPostResult.rows[0]?.posted_at
    let nextPostTime: Date | undefined
    
    if (lastPostTime) {
      nextPostTime = new Date(lastPostTime)
      nextPostTime.setHours(nextPostTime.getHours() + 4)
      
      // If next post time is in the past, calculate the next slot
      if (nextPostTime.getTime() < Date.now()) {
        const now = new Date()
        const hoursUntilNext = 4 - (now.getHours() % 4)
        nextPostTime = new Date(now)
        nextPostTime.setHours(now.getHours() + hoursUntilNext, 0, 0, 0)
      }
    } else {
      // If no posts yet, schedule for next 4-hour slot
      const now = new Date()
      const hoursUntilNext = 4 - (now.getHours() % 4)
      nextPostTime = new Date(now)
      nextPostTime.setHours(now.getHours() + hoursUntilNext, 0, 0, 0)
    }

    const stats = {
      totalContent: parseInt(totalContentResult.rows[0]?.count || '0'),
      pendingContent: parseInt(pendingContentResult.rows[0]?.count || '0'),
      postedToday: parseInt(postedTodayResult.rows[0]?.count || '0'),
      totalViews: parseInt(totalViewsResult.rows[0]?.total_views || '0'),
      lastPostTime: lastPostTime ? new Date(lastPostTime) : undefined,
      nextPostTime,
      avgEngagement: parseFloat(avgEngagementResult.rows[0]?.avg_engagement || '0'),
      systemStatus: 'online' as const
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}