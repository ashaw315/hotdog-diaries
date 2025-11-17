import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({
        error: 'Invalid ID'
      }, { status: 400 })
    }

    // Get the specific item
    const itemResult = await db.query(`
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
      WHERE id = $1 AND is_posted = true
    `, [id])

    if (itemResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Item not found'
      }, { status: 404 })
    }

    const item = itemResult.rows[0]

    // Get previous item (newer by created_at)
    const prevResult = await db.query(`
      SELECT id
      FROM content_queue
      WHERE is_posted = true
        AND created_at > (SELECT created_at FROM content_queue WHERE id = $1)
      ORDER BY created_at ASC
      LIMIT 1
    `, [id])

    // Get next item (older by created_at)
    const nextResult = await db.query(`
      SELECT id
      FROM content_queue
      WHERE is_posted = true
        AND created_at < (SELECT created_at FROM content_queue WHERE id = $1)
      ORDER BY created_at DESC
      LIMIT 1
    `, [id])

    return NextResponse.json({
      item,
      navigation: {
        prevId: prevResult.rows[0]?.id || null,
        nextId: nextResult.rows[0]?.id || null
      }
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to get archive item',
      'ArchiveItemAPI',
      {
        id: params.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
