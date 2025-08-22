import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSimpleClient()
    
    // Get YouTube videos from production
    const { data: youtubePosts, error } = await supabase
      .from('posted_content')
      .select(`
        id, posted_at,
        content_queue!inner(
          id, content_text, content_video_url, source_platform
        )
      `)
      .eq('content_queue.source_platform', 'youtube')
      .order('posted_at', { ascending: false })
      .limit(5)
    
    if (error) {
      console.error('Error fetching YouTube posts:', error)
    }
    
    // Also check available unposted YouTube content
    const { data: availableYoutube } = await supabase
      .from('content_queue')
      .select('id, content_text, content_video_url, is_approved, is_posted')
      .eq('source_platform', 'youtube')
      .eq('is_posted', false)
      .limit(10)
    
    return NextResponse.json({
      environment: process.env.VERCEL ? 'production' : 'development',
      database: 'supabase',
      timestamp: new Date().toISOString(),
      postedYoutubeVideos: youtubePosts?.length || 0,
      availableYoutubeContent: availableYoutube?.length || 0,
      recentPosts: youtubePosts?.map(p => ({
        id: p.id,
        contentId: p.content_queue.id,
        url: p.content_queue.content_video_url,
        text: p.content_queue.content_text?.substring(0, 100) + '...',
        posted: p.posted_at
      })) || [],
      availableContent: availableYoutube?.map(c => ({
        id: c.id,
        url: c.content_video_url,
        text: c.content_text?.substring(0, 100) + '...',
        approved: c.is_approved,
        posted: c.is_posted
      })) || [],
      autoplayInstructions: {
        testSteps: [
          '1. Visit https://hotdog-diaries.vercel.app',
          '2. Look for YouTube videos in the feed',
          '3. Tap anywhere on screen first (mobile requirement)',
          '4. Scroll YouTube video into view (>50%)',
          '5. Video should autoplay (muted)',
          '6. Scroll away - video should pause',
          '7. Only one video should play at a time'
        ],
        debugTips: [
          'Check browser console for autoplay logs',
          'Look for "🎬 Attempting autoplay" messages',
          'Verify YouTube iframe has enablejsapi=1',
          'Test on both desktop and mobile browsers'
        ]
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch YouTube content',
      message: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.VERCEL ? 'production' : 'development'
    }, { status: 500 })
  }
}