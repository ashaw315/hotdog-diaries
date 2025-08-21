import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await db.connect()
    
    // Get posted content with content details, ordered by most recent
    const result = await db.query(`
      SELECT 
        pc.id,
        pc.posted_at,
        pc.scheduled_time,
        pc.post_order,
        cq.id as content_id,
        cq.content_text,
        cq.content_type,
        cq.source_platform,
        cq.original_url,
        cq.original_author,
        cq.content_image_url,
        cq.content_video_url,
        cq.scraped_at
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
      LIMIT 50
    `)

    if (!result.rows) {
      return NextResponse.json({
        success: true,
        content: [],
        count: 0,
        message: 'No posted content found'
      })
    }

    // Transform the data to match the expected format for the TikTok feed
    const transformedContent = result.rows.map(row => ({
      id: row.content_id,
      content_text: row.content_text,
      content_type: row.content_type,
      source_platform: row.source_platform,
      original_url: row.original_url,
      original_author: row.original_author,
      content_image_url: row.content_image_url,
      content_video_url: row.content_video_url,
      content_metadata: null,
      scraped_at: new Date(row.scraped_at),
      is_posted: true,
      is_approved: true,
      posted_at: new Date(row.posted_at),
      // Add feed-specific metadata
      feed_metadata: {
        post_id: row.id,
        scheduled_time: row.scheduled_time,
        post_order: row.post_order
      }
    }))

    return NextResponse.json({
      success: true,
      content: transformedContent,
      count: transformedContent.length,
      message: `Retrieved ${transformedContent.length} posted hotdog items`,
      metadata: {
        source: 'posted_content',
        latest_post: transformedContent[0]?.posted_at || null,
        platforms: [...new Set(transformedContent.map(c => c.source_platform))]
      }
    })

  } catch (error) {
    console.error('❌ Feed API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      content: [],
      count: 0
    }, { status: 500 })
  } finally {
    await db.disconnect()
  }
}