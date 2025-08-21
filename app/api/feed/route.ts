import { NextResponse } from 'next/server'
import { postingService } from '@/lib/services/posting'

export async function GET() {
  try {
    // Use the same posting service as the admin endpoints (which work in production)
    const postedContent = await postingService.getPostingHistory(50)

    if (!postedContent || postedContent.length === 0) {
      return NextResponse.json({
        success: true,
        content: [],
        count: 0,
        message: 'No posted content found'
      })
    }

    // Transform the data to match the expected format for the TikTok feed
    const transformedContent = postedContent.map(item => ({
      id: item.content_queue_id,
      content_text: item.content_text,
      content_type: item.content_type,
      source_platform: item.source_platform,
      original_url: item.original_url,
      original_author: item.original_author,
      content_image_url: item.content_image_url,
      content_video_url: item.content_video_url,
      content_metadata: null,
      scraped_at: new Date(item.scraped_at || item.created_at),
      is_posted: true,
      is_approved: true,
      posted_at: new Date(item.posted_at),
      // Add feed-specific metadata
      feed_metadata: {
        post_id: item.id,
        scheduled_time: item.scheduled_time,
        post_order: item.post_order
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
  }
}