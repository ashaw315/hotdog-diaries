import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check content_queue table schema
    const contentQueueSchema = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'content_queue'
      ORDER BY ordinal_position;
    `)

    // Check for posted_content table
    let postedContentExists = false
    let postedContentSchema = []
    try {
      const postedCheck = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'posted_content'
        ORDER BY ordinal_position;
      `)
      postedContentExists = true
      postedContentSchema = postedCheck.rows
    } catch (error) {
      postedContentExists = false
    }

    // Check content_status values
    const statusValues = await db.query(`
      SELECT content_status, COUNT(*) as count
      FROM content_queue
      GROUP BY content_status
      ORDER BY count DESC;
    `)

    // Check recent posted items with different statuses
    const recentItems = await db.query(`
      SELECT 
        id,
        content_status,
        is_posted,
        is_approved,
        posted_at,
        source_platform
      FROM content_queue
      WHERE posted_at > NOW() - INTERVAL '1 hour'
      ORDER BY posted_at DESC;
    `)

    return NextResponse.json({
      success: true,
      contentQueueSchema: contentQueueSchema.rows,
      postedContentExists,
      postedContentSchema,
      statusValues: statusValues.rows,
      recentItems: recentItems.rows,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Schema check error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}