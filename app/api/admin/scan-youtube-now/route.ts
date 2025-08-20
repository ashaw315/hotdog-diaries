import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  console.log('🎬 Starting YouTube scan...')
  
  try {
    // Auth check - same as /api/admin/me
    let userId: string | null = null
    let username: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through to normal auth
      }
    }

    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ Authentication successful for YouTube scan')

    // Check YouTube API key
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      console.error('❌ YOUTUBE_API_KEY not found in environment')
      return NextResponse.json({
        success: false,
        error: 'YouTube API key not configured',
        videos_added: 0
      }, { status: 500 })
    }

    console.log('✅ YouTube API key found')

    // Search for hotdog videos
    const searchUrl = 'https://www.googleapis.com/youtube/v3/search'
    const params = new URLSearchParams({
      key: apiKey,
      q: 'hotdog recipe',
      part: 'snippet',
      type: 'video',
      maxResults: '10',
      order: 'relevance',
      safeSearch: 'moderate',
      videoEmbeddable: 'true'
    })

    console.log('🔍 Fetching videos from YouTube API...')
    const response = await fetch(`${searchUrl}?${params}`)
    
    if (!response.ok) {
      console.error('❌ YouTube API error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ YouTube API error body:', errorText)
      return NextResponse.json({
        success: false,
        error: `YouTube API error: ${response.status} ${response.statusText}`,
        videos_added: 0
      }, { status: 500 })
    }

    const youtubeData = await response.json()
    console.log('✅ YouTube API response received, videos found:', youtubeData.items?.length || 0)

    if (!youtubeData.items || youtubeData.items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hotdog videos found',
        videos_added: 0
      })
    }

    // Connect to Supabase
    const supabase = createSimpleClient()
    let addedCount = 0
    const errors = []

    // Process each video
    for (const item of youtubeData.items) {
      try {
        const video = item.snippet
        const videoId = item.id.videoId
        
        // Generate content hash for duplicate detection
        const hashInput = `youtube_${videoId}_${video.title}`
        const contentHash = require('crypto').createHash('md5').update(hashInput).digest('hex')

        const videoData = {
          content_text: video.title || 'Hotdog Video',
          content_image_url: video.thumbnails?.medium?.url || video.thumbnails?.default?.url,
          content_video_url: `https://www.youtube.com/watch?v=${videoId}`,
          content_type: 'video',
          source_platform: 'youtube',
          original_url: `https://www.youtube.com/watch?v=${videoId}`,
          original_author: video.channelTitle || 'YouTube User',
          content_hash: contentHash,
          content_status: 'discovered',
          confidence_score: 0.85,
          is_approved: true, // Auto-approve YouTube content
          is_rejected: false,
          is_posted: false,
          scraped_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        console.log(`📝 Attempting to save video: "${video.title}" (${videoId})`)

        const { data, error } = await supabase
          .from('content_queue')
          .insert(videoData)
          .select('id')
          .single()

        if (error) {
          if (error.message?.includes('duplicate')) {
            console.log(`⚠️ Duplicate video skipped: "${video.title}"`)
          } else {
            console.error(`❌ Error saving video "${video.title}":`, error)
            errors.push(`Failed to save "${video.title}": ${error.message}`)
          }
        } else {
          console.log(`✅ Successfully saved video with ID: ${data.id}`)
          addedCount++
        }

      } catch (videoError) {
        console.error(`❌ Error processing video "${item.snippet?.title}":`, videoError)
        errors.push(`Error processing "${item.snippet?.title}": ${videoError.message}`)
      }
    }

    console.log(`📊 YouTube scan complete: ${addedCount} videos added, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedCount} hotdog videos from YouTube`,
      videos_added: addedCount,
      total_found: youtubeData.items.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('❌ Critical error in YouTube scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      videos_added: 0
    }, { status: 500 })
  }
}