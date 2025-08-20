import { NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = createSimpleClient()
    
    // Get posted content with content details, ordered by most recent
    const { data: postedContent, error } = await supabase
      .from('posted_content')
      .select(`
        id,
        posted_at,
        scheduled_time,
        post_order,
        content_queue (
          id,
          content_text,
          content_type,
          source_platform,
          original_url,
          original_author,
          content_image_url,
          content_video_url,
          scraped_at
        )
      `)
      .order('posted_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('❌ Failed to fetch posted content:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        content: [],
        count: 0
      }, { status: 500 })
    }

    // Transform the data to match the expected format for the TikTok feed
    const transformedContent = postedContent?.map(item => {
      const content = item.content_queue
      if (!content) return null

      return {
        id: content.id,
        content_text: content.content_text,
        content_type: content.content_type,
        source_platform: content.source_platform,
        original_url: content.original_url,
        original_author: content.original_author,
        content_image_url: content.content_image_url,
        content_video_url: content.content_video_url,
        content_metadata: null,
        scraped_at: new Date(content.scraped_at),
        is_posted: true,
        is_approved: true,
        posted_at: new Date(item.posted_at),
        // Add feed-specific metadata
        feed_metadata: {
          post_id: item.id,
          scheduled_time: item.scheduled_time,
          post_order: item.post_order
        }
      }
    }).filter(Boolean) || []

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
  }
}