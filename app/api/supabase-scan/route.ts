import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    console.log('🌭 Starting Supabase content scan...');
    
    const supabase = await createClient();
    let totalScanned = 0;
    let errors: string[] = [];

    // Create content_queue table if it doesn't exist
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS content_queue (
          id SERIAL PRIMARY KEY,
          content_text TEXT,
          content_type VARCHAR(50),
          source_platform VARCHAR(50),
          original_url TEXT,
          original_author VARCHAR(255),
          content_image_url TEXT,
          content_video_url TEXT,
          content_hash VARCHAR(255),
          scraped_at TIMESTAMP DEFAULT NOW(),
          is_posted BOOLEAN DEFAULT false,
          is_approved BOOLEAN DEFAULT true,
          posted_at TIMESTAMP
        );
      `
    });

    // Reddit scanning
    try {
      console.log('📱 Scanning Reddit...');
      const response = await fetch('https://www.reddit.com/r/hotdogs.json?limit=5');
      if (!response.ok) throw new Error(`Reddit API failed: ${response.status}`);
      
      const data = await response.json();
      
      for (const post of data.data.children) {
        const postData = post.data;
        
        const { error: insertError } = await supabase
          .from('content_queue')
          .insert({
            content_text: postData.title,
            content_type: postData.url?.includes('v.redd.it') ? 'video' : 
                         postData.url?.match(/\.(jpg|jpeg|png|gif)$/i) ? 'image' : 'text',
            source_platform: 'reddit',
            original_url: `https://reddit.com${postData.permalink}`,
            original_author: postData.author,
            content_image_url: postData.url?.match(/\.(jpg|jpeg|png|gif)$/i) ? postData.url : null,
            content_hash: `reddit_${postData.id}`
          });
          
        if (!insertError) {
          totalScanned++;
        } else {
          console.error('Reddit insert error:', insertError);
          errors.push(`Reddit: ${insertError.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Reddit scan failed:', error);
      errors.push(`Reddit: ${error.message}`);
    }

    // YouTube scanning
    try {
      console.log('📺 Scanning YouTube...');
      const apiKey = process.env.YOUTUBE_API_KEY;
      
      if (!apiKey) throw new Error('YouTube API key not configured');
      
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=hotdog&type=video&maxResults=3&key=${apiKey}`
      );
      
      if (!response.ok) throw new Error(`YouTube API failed: ${response.status}`);
      
      const data = await response.json();
      
      for (const video of data.items) {
        const { error: insertError } = await supabase
          .from('content_queue')
          .insert({
            content_text: video.snippet.title,
            content_type: 'video',
            source_platform: 'youtube',
            original_url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            original_author: video.snippet.channelTitle,
            content_image_url: video.snippet.thumbnails?.high?.url,
            content_video_url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            content_hash: `youtube_${video.id.videoId}`
          });
          
        if (!insertError) {
          totalScanned++;
        } else {
          console.error('YouTube insert error:', insertError);
          errors.push(`YouTube: ${insertError.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ YouTube scan failed:', error);
      errors.push(`YouTube: ${error.message}`);
    }

    // Get final count
    const { count } = await supabase
      .from('content_queue')
      .select('id', { count: 'exact' });

    return NextResponse.json({
      success: true,
      message: `Supabase scan completed! Added ${totalScanned} new items`,
      results: {
        newItems: totalScanned,
        totalInDatabase: count || 0,
        errors: errors
      }
    });

  } catch (error) {
    console.error('❌ Supabase scan failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Supabase content scan failed'
    }, { status: 500 });
  }
}