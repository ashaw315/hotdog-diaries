import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check available content for posting
    const availableContent = await db.query(`
      SELECT 
        COUNT(*) as ready_to_post,
        MIN(scraped_at) as oldest_content,
        MAX(scraped_at) as newest_content,
        STRING_AGG(DISTINCT source_platform::text, ', ') as platforms
      FROM content_queue
      WHERE is_approved = true 
      AND is_posted = false;
    `)

    // Check recent posting history
    const recentPosts = await db.query(`
      SELECT 
        cq.id as content_id,
        cq.posted_at,
        cq.source_platform as platform,
        cq.content_type,
        SUBSTRING(cq.content_text, 1, 100) as content_preview
      FROM content_queue cq
      WHERE cq.is_posted = true
      ORDER BY cq.posted_at DESC
      LIMIT 5;
    `)

    // Check content by platform breakdown
    const platformBreakdown = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as ready,
        COUNT(*) FILTER (WHERE is_approved = true AND is_posted = true) as posted,
        COUNT(*) FILTER (WHERE is_approved = true) as total_approved
      FROM content_queue
      GROUP BY source_platform
      ORDER BY ready DESC;
    `)

    return NextResponse.json({
      success: true,
      availableContent: availableContent.rows[0],
      recentPosts: recentPosts.rows,
      platformBreakdown: platformBreakdown.rows,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Posting status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}