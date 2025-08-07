import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check content with ID 94 specifically
    const contentCheck = await db.query(`
      SELECT 
        id,
        is_posted,
        posted_at,
        content_text,
        source_platform,
        content_type
      FROM content_queue
      WHERE id = 94;
    `)

    // Check if there's a posted_content table and what's in it
    let postedContentTable = null
    try {
      const postedContentCheck = await db.query(`
        SELECT * FROM posted_content 
        WHERE content_queue_id = 94 OR content_id = 94
        ORDER BY posted_at DESC;
      `)
      postedContentTable = postedContentCheck.rows
    } catch (error) {
      postedContentTable = { error: 'posted_content table not found or different schema' }
    }

    // Check recent posts by looking at is_posted = true
    const recentPostedContent = await db.query(`
      SELECT 
        id,
        posted_at,
        source_platform,
        content_type,
        SUBSTRING(content_text, 1, 100) as content_preview
      FROM content_queue
      WHERE is_posted = true
      ORDER BY posted_at DESC
      LIMIT 10;
    `)

    // Check if content 94 was marked as posted
    const content94Status = await db.query(`
      SELECT 
        id,
        is_posted,
        posted_at,
        is_approved,
        content_text
      FROM content_queue
      WHERE id = 94;
    `)

    return NextResponse.json({
      success: true,
      contentCheck: contentCheck.rows,
      postedContentTable,
      recentPostedContent: recentPostedContent.rows,
      content94Status: content94Status.rows[0],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Post verification error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}