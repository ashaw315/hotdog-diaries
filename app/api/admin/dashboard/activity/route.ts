import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ActivityRow {
  id: string
  type: string
  description: string
  timestamp: Date
}

export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware

    // Get recent content activity from posted_content and content_queue
    const recentPostsQuery = `
      SELECT 
        pc.id,
        cq.content_text,
        pc.posted_at,
        'posted' as activity_type
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
      LIMIT 10
    `

    const recentAdditionsQuery = `
      SELECT 
        id,
        content_text,
        created_at,
        'added' as activity_type
      FROM content_queue 
      WHERE created_at > datetime('now', '-24 hours')
      ORDER BY created_at DESC
      LIMIT 10
    `

    const [postsResult, additionsResult] = await Promise.all([
      db.query(recentPostsQuery),
      db.query(recentAdditionsQuery)
    ])
    
    // Transform content data into activity items
    const activities: ActivityRow[] = []
    
    // Add posted content activities
    for (const row of postsResult.rows) {
      const contentPreview = row.content_text 
        ? row.content_text.substring(0, 50) + (row.content_text.length > 50 ? '...' : '')
        : 'Content posted'
      
      activities.push({
        id: `posted-${row.id}`,
        type: 'posted',
        description: `Posted: ${contentPreview}`,
        timestamp: new Date(row.posted_at)
      })
    }
    
    // Add recent additions
    for (const row of additionsResult.rows) {
      const contentPreview = row.content_text 
        ? row.content_text.substring(0, 50) + (row.content_text.length > 50 ? '...' : '')
        : 'New content added'
      
      activities.push({
        id: `added-${row.id}`,
        type: 'added',
        description: `Added to queue: ${contentPreview}`,
        timestamp: new Date(row.created_at)
      })
    }

    // Sort by timestamp descending and limit to 10 most recent
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    const recentActivities = activities.slice(0, 10)

    return NextResponse.json(recentActivities)
  } catch (error) {
    console.error('Error fetching dashboard activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard activity' },
      { status: 500 }
    )
  }
}