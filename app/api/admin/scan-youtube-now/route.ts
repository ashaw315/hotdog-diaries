import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  console.log('🎬 Starting YouTube scan with enhanced diagnostics...')
  
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

    // Enhanced API key diagnostics
    const apiKey = process.env.YOUTUBE_API_KEY
    console.log('🔑 YouTube API Key Status:', {
      exists: !!apiKey,
      length: apiKey ? apiKey.length : 0,
      firstChars: apiKey ? apiKey.substring(0, 10) + '...' : 'N/A'
    })

    if (!apiKey) {
      console.error('❌ YOUTUBE_API_KEY not found in environment')
      return NextResponse.json({
        success: false,
        error: 'YouTube API key not configured. Please set YOUTUBE_API_KEY environment variable.',
        details: {
          message: 'Missing API key',
          solution: 'Get a YouTube Data API v3 key from Google Cloud Console',
          documentation: 'https://developers.google.com/youtube/v3/getting-started'
        },
        videos_added: 0
      }, { status: 500 })
    }

    // Test API key first with a minimal request
    console.log('🧪 Testing YouTube API key validity...')
    const testUrl = 'https://www.googleapis.com/youtube/v3/search'
    const testParams = new URLSearchParams({
      key: apiKey,
      q: 'test',
      part: 'snippet',
      type: 'video',
      maxResults: '1'
    })

    const testResponse = await fetch(`${testUrl}?${testParams}`)
    console.log('🧪 Test response status:', testResponse.status)

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      console.error('❌ YouTube API key test failed:', errorText)
      
      let errorDetails
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.error || errorJson
      } catch (e) {
        errorDetails = { message: errorText }
      }

      // Provide specific error guidance
      let solution = 'Check your API key configuration'
      if (testResponse.status === 403) {
        if (errorDetails.message?.includes('unregistered callers')) {
          solution = 'API key is missing or invalid. Generate a new YouTube Data API v3 key.'
        } else if (errorDetails.message?.includes('quota')) {
          solution = 'YouTube API quota exceeded. Wait for reset or increase quota.'
        } else if (errorDetails.message?.includes('disabled')) {
          solution = 'YouTube Data API v3 is not enabled for this project.'
        }
      } else if (testResponse.status === 400) {
        solution = 'Invalid API request parameters. Check API key format.'
      }

      return NextResponse.json({
        success: false,
        error: `YouTube API authentication failed: ${testResponse.status}`,
        details: {
          status: testResponse.status,
          message: errorDetails.message || 'Unknown error',
          solution,
          errorType: testResponse.status === 403 ? 'authentication_error' : 'api_error'
        },
        videos_added: 0
      }, { status: 500 })
    }

    console.log('✅ YouTube API key test successful!')

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

    console.log('🔍 Fetching hotdog videos from YouTube API...')
    const response = await fetch(`${searchUrl}?${params}`)
    
    if (!response.ok) {
      console.error('❌ YouTube API search error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ YouTube API error body:', errorText)
      
      // Parse error for better user feedback
      let errorDetails
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.error || errorJson
      } catch (e) {
        errorDetails = { message: errorText }
      }

      return NextResponse.json({
        success: false,
        error: `YouTube API search failed: ${response.status} ${response.statusText}`,
        details: {
          status: response.status,
          message: errorDetails.message || 'Unknown error',
          query: 'hotdog recipe'
        },
        videos_added: 0
      }, { status: 500 })
    }

    const youtubeData = await response.json()
    console.log('✅ YouTube API response received, videos found:', youtubeData.items?.length || 0)

    if (!youtubeData.items || youtubeData.items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hotdog videos found for query "hotdog recipe"',
        videos_added: 0,
        quotaUsed: '100 units (search operation)'
      })
    }

    // Connect to database (SQLite for dev, PostgreSQL for production)
    await db.connect()
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

        console.log(`📝 Attempting to save video: "${video.title}" (${videoId})`)

        // Use standard database query that works with both SQLite and PostgreSQL
        const result = await db.query(
          `INSERT INTO content_queue (
            content_text, content_image_url, content_video_url, content_type,
            source_platform, original_url, original_author, content_hash,
            content_status, confidence_score, is_approved, is_rejected, is_posted,
            scraped_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
          RETURNING id`,
          [
            video.title || 'Hotdog Video',
            video.thumbnails?.medium?.url || video.thumbnails?.default?.url,
            `https://www.youtube.com/watch?v=${videoId}`,
            'video',
            'youtube',
            `https://www.youtube.com/watch?v=${videoId}`,
            video.channelTitle || 'YouTube User',
            contentHash,
            'discovered',
            0.85,
            true, // Auto-approve YouTube content
            false,
            false,
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString()
          ]
        )

        if (result.rows.length > 0) {
          console.log(`✅ Successfully saved video with ID: ${result.rows[0].id}`)
          addedCount++
        } else {
          errors.push(`Failed to save "${video.title}": No ID returned`)
        }

      } catch (videoError) {
        console.error(`❌ Error processing video "${item.snippet?.title}":`, videoError)
        if (videoError.message?.includes('duplicate') || videoError.message?.includes('UNIQUE constraint')) {
          console.log(`⚠️ Duplicate video skipped: "${item.snippet?.title}"`)
        } else {
          errors.push(`Error processing "${item.snippet?.title}": ${videoError.message}`)
        }
      }
    }

    console.log(`📊 YouTube scan complete: ${addedCount} videos added, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedCount} hotdog videos from YouTube`,
      videos_added: addedCount,
      total_found: youtubeData.items.length,
      quotaUsed: '100 units (search operation)',
      errors: errors.length > 0 ? errors : undefined,
      note: addedCount === 0 && errors.length === 0 ? 'All videos were duplicates' : undefined
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