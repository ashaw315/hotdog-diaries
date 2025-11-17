import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'
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

    const supabase = createSimpleClient()

    // Get the specific item - matching feed API query pattern
    const { data: itemData, error: itemError } = await supabase
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
      .eq('content_queue_id', id)
      .single()

    if (itemError || !itemData) {
      return NextResponse.json({
        error: 'Item not found'
      }, { status: 404 })
    }

    // Transform item data
    const item = {
      id: itemData.content_queue.id,
      content_type: itemData.content_queue.content_type,
      source_platform: itemData.content_queue.source_platform,
      content_text: itemData.content_queue.content_text,
      content_image_url: itemData.content_queue.content_image_url,
      content_video_url: itemData.content_queue.content_video_url,
      content_metadata: itemData.content_queue.content_metadata,
      original_author: itemData.content_queue.original_author,
      original_url: itemData.content_queue.original_url,
      scraped_at: itemData.content_queue.scraped_at,
      posted_at: itemData.posted_at,
      post_order: itemData.post_order
    }

    // Get previous item (newer by posted_at)
    const { data: prevData } = await supabase
      .from('posted_content')
      .select('content_queue_id')
      .gt('posted_at', itemData.posted_at)
      .order('posted_at', { ascending: true })
      .limit(1)
      .single()

    // Get next item (older by posted_at)
    const { data: nextData } = await supabase
      .from('posted_content')
      .select('content_queue_id')
      .lt('posted_at', itemData.posted_at)
      .order('posted_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      item,
      navigation: {
        prevId: prevData?.content_queue_id || null,
        nextId: nextData?.content_queue_id || null
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
