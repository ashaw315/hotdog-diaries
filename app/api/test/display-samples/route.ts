import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get one sample from each platform
    const platforms = ['youtube', 'pixabay', 'imgur', 'reddit', 'lemmy', 'tumblr', 'bluesky', 'giphy']
    const samples = []
    
    for (const platform of platforms) {
      const query = `
        SELECT 
          id,
          source_platform as platform,
          content_type as "contentType",
          content_text as "contentText",
          content_image_url as "contentImageUrl",
          content_video_url as "contentVideoUrl",
          original_url as "originalUrl"
        FROM content_queue 
        WHERE source_platform = ?
          AND (content_image_url IS NOT NULL OR content_video_url IS NOT NULL OR content_text IS NOT NULL)
        ORDER BY id DESC
        LIMIT 1
      `
      
      const result = await db.query(query, [platform])
      if (result.rows.length > 0) {
        samples.push(result.rows[0])
      }
    }
    
    return NextResponse.json({
      success: true,
      samples,
      message: `Found ${samples.length} content samples`
    })
    
  } catch (error) {
    console.error('Error fetching display samples:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}