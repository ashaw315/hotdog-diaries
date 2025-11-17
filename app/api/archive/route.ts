import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = parseInt(searchParams.get('limit') || '20')
    const offsetParam = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(isNaN(limitParam) ? 20 : limitParam, 100)
    const offset = isNaN(offsetParam) ? 0 : offsetParam

    // Get total count for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM content_queue
      WHERE is_posted = true
    `)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get paginated content
    const result = await db.query(`
      SELECT
        id,
        content_type,
        source_platform,
        content_text,
        content_image_url,
        content_video_url,
        content_metadata,
        original_author,
        original_url,
        scraped_at,
        created_at as posted_at
      FROM content_queue
      WHERE is_posted = true
      ORDER BY created_at DESC
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
