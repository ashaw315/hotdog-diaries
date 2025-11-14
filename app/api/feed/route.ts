import { NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (isDevelopment) {
      console.log('🗄️ Using SQLite for feed API in development')
      await db.connect()
      
      // Get posted content from SQLite (similar query to Supabase)
      const result = await db.query(`
        SELECT 
          pc.id as post_id,
          pc.content_queue_id,
          pc.posted_at,
          pc.scheduled_time,
          pc.post_order,
          pc.created_at as post_created_at,
          cq.id,
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
      
      if (!result.rows || result.rows.length === 0) {
        return NextResponse.json({
          success: true,
          content: [],
          count: 0,
          message: 'No posted content found in development database'
        })
      }
      
      // Transform the SQLite data to match the expected format
      const transformedContent = result.rows.map(item => ({
        id: item.id,
        content_text: item.content_text,
        content_type: item.content_type,
        source_platform: item.source_platform,
        original_url: item.original_url,
        original_author: item.original_author,
        content_image_url: item.content_image_url,
        content_video_url: item.content_video_url,
        content_metadata: item.content_metadata || null,
        scraped_at: new Date(item.scraped_at),
        is_posted: true,
        is_approved: true,
        posted_at: new Date(item.posted_at),
        // Add feed-specific metadata
        feed_metadata: {
          post_id: item.post_id,
          scheduled_time: item.scheduled_time,
          post_order: item.post_order
        }
      }))
      
      console.log(`✅ Loaded ${transformedContent.length} posted items from SQLite`)
      return NextResponse.json({
        success: true,
        content: transformedContent,
        count: transformedContent.length,
        message: `Retrieved ${transformedContent.length} posted hotdog items`,
        metadata: {
          source: 'posted_content_sqlite',
          latest_post: transformedContent[0]?.posted_at || null,
          platforms: [...new Set(transformedContent.map(c => c.source_platform))]
        }
      })
    } else {
      // Production: Use Supabase
      console.log('🗄️ Using Supabase for feed API in production')
      const supabase = createSimpleClient()
      
      // Get posted content from Supabase (exclude hidden posts)
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
        .limit(50)

      if (error) {
        console.error('❌ Supabase query error:', error)
        return NextResponse.json({
          success: false,
          error: error.message,
          content: [],
          count: 0
        }, { status: 500 })
      }

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
        id: item.content_queue.id,
        content_text: item.content_queue.content_text,
        content_type: item.content_queue.content_type,
        source_platform: item.content_queue.source_platform,
        original_url: item.content_queue.original_url,
        original_author: item.content_queue.original_author,
        content_image_url: item.content_queue.content_image_url,
        content_video_url: item.content_queue.content_video_url,
        content_metadata: item.content_queue.content_metadata,
        scraped_at: new Date(item.content_queue.scraped_at || item.created_at),
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
    }

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