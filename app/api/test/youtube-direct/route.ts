import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'No YouTube API key configured'
      })
    }

    // Search for hotdog videos
    const query = 'hotdog recipe'
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=3&key=${apiKey}`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No videos found'
      })
    }

    const results = []
    
    // Process each video
    for (const video of data.items) {
      const videoData = {
        content_text: video.snippet.title,
        content_image_url: video.snippet.thumbnails.medium?.url,
        content_video_url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
        content_type: 'video' as const,
        source_platform: 'youtube' as const,
        original_url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
        original_author: `@${video.snippet.channelTitle} on YouTube`,
        scraped_at: new Date()
      }
      
      // Generate simple hash for duplicate detection
      const hashString = `${videoData.content_text}-${videoData.original_url}`
      const contentHash = require('crypto').createHash('sha256').update(hashString).digest('hex')
      
      try {
        // Insert into database
        const insertResult = await db.query(
          `INSERT INTO content_queue (
            content_text, content_image_url, content_video_url, content_type,
            source_platform, original_url, original_author, scraped_at, content_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
          ON CONFLICT (content_hash) DO UPDATE SET updated_at = NOW()
          RETURNING id, content_text, source_platform`,
          [
            videoData.content_text,
            videoData.content_image_url,
            videoData.content_video_url,
            videoData.content_type,
            videoData.source_platform,
            videoData.original_url,
            videoData.original_author,
            videoData.scraped_at,
            contentHash
          ]
        )
        
        results.push({
          id: insertResult.rows[0].id,
          title: video.snippet.title,
          channel: video.snippet.channelTitle,
          videoId: video.id.videoId,
          thumbnail: video.snippet.thumbnails.medium?.url,
          saved: true
        })
        
      } catch (dbError) {
        results.push({
          title: video.snippet.title,
          channel: video.snippet.channelTitle,
          videoId: video.id.videoId,
          error: dbError.message,
          saved: false
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalFound: data.items.length,
        processed: results.length,
        videos: results
      }
    })

  } catch (error) {
    console.error('❌ YouTube direct test failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}