import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get total count for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
    `)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get paginated content
    const result = await db.query(`
      SELECT
        cq.id,
        cq.content_type,
        cq.source_platform,
        cq.content_text,
        cq.content_image_url,
        cq.content_video_url,
        cq.content_metadata,
        cq.original_author,
        cq.original_url,
        cq.scraped_at,
        pc.posted_at,
        pc.post_order
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    const totalPages = Math.ceil(total / limit)
    const currentPage = Math.floor(offset / limit) + 1

    return NextResponse.json({
      items: result.rows,
      pagination: {
        total,
        limit,
        offset,
        totalPages,
        currentPage,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to get archive content',
      'ArchiveAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
