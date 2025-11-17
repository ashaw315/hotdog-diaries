import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = parseInt(searchParams.get('limit') || '20')
    const offsetParam = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(isNaN(limitParam) ? 20 : limitParam, 100)
    const offset = isNaN(offsetParam) ? 0 : offsetParam

    const supabase = createSimpleClient()

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('posted_content')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      throw countError
    }

    const total = count || 0

    // Get paginated content - matching feed API query pattern
    const { data: postedContent, error } = await supabase
      .from('posted_content')
      .select(`
        id,
        content_queue_id,
        posted_at,
        scheduled_time,
        post_order,
        created_at,
        content_queue!inner (
          id,
          content_text,
          content_type,
          source_platform,
          original_url,
          original_author,
          content_image_url,
          content_video_url,
          content_metadata,
          scraped_at
        )
      `)
      .order('posted_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    // Transform the data to match expected format
    const items = (postedContent || []).map(item => ({
      id: item.content_queue.id,
      content_type: item.content_queue.content_type,
      source_platform: item.content_queue.source_platform,
      content_text: item.content_queue.content_text,
      content_image_url: item.content_queue.content_image_url,
      content_video_url: item.content_queue.content_video_url,
      content_metadata: item.content_queue.content_metadata,
      original_author: item.content_queue.original_author,
      original_url: item.content_queue.original_url,
      scraped_at: item.content_queue.scraped_at,
      posted_at: item.posted_at,
      post_order: item.post_order
    }))

    const totalPages = Math.ceil(total / limit)
    const currentPage = Math.floor(offset / limit) + 1

    return NextResponse.json({
      items,
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
