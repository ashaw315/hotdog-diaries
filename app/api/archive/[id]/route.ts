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
      WHERE cq.id = $1
    `, [id])

    if (itemResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Item not found'
      }, { status: 404 })
    }

    const item = itemResult.rows[0]

    // Get previous item (newer by posted_at)
    const prevResult = await db.query(`
      SELECT cq.id
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      WHERE pc.posted_at > (
        SELECT posted_at FROM posted_content WHERE content_queue_id = $1
      )
      ORDER BY pc.posted_at ASC
      LIMIT 1
    `, [id])

    // Get next item (older by posted_at)
    const nextResult = await db.query(`
      SELECT cq.id
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      WHERE pc.posted_at < (
        SELECT posted_at FROM posted_content WHERE content_queue_id = $1
      )
      ORDER BY pc.posted_at DESC
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
