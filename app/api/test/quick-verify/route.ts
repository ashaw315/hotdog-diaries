import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check the most recent posted item
    const recentPost = await db.query(`
      SELECT 
        id,
        is_posted,
        content_status,
        posted_at,
        source_platform,
        content_type
      FROM content_queue
      WHERE posted_at IS NOT NULL
      ORDER BY posted_at DESC
      LIMIT 1;
    `)

    // Count current ready vs posted items
    const counts = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as ready_to_post,
        COUNT(*) FILTER (WHERE is_posted = true) as total_posted,
        COUNT(*) FILTER (WHERE content_status = 'posted') as status_posted
      FROM content_queue;
    `)

    return NextResponse.json({
      success: true,
      mostRecentPost: recentPost.rows[0],
      counts: counts.rows[0],
      isFixed: recentPost.rows[0]?.is_posted === true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}