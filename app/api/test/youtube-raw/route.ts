import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'No YouTube API key configured'
      })
    }

    // Test direct API call for hotdog recipe videos
    const query = 'hotdog recipe'
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${apiKey}`
    
    console.log(`🔍 Testing YouTube API: ${url.replace(apiKey, 'HIDDEN_KEY')}`)
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    })
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`)
    
    const responseText = await response.text()
    let data
    
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', responseText.substring(0, 200))
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON response from YouTube API',
        status: response.status,
        statusText: response.statusText,
        responsePreview: responseText.substring(0, 500)
      })
    }

    // Log some details about the response
    if (data.items && Array.isArray(data.items)) {
      console.log(`✅ Found ${data.items.length} videos`)
      if (data.items.length > 0) {
        const firstVideo = data.items[0]
        console.log(`📺 First video: "${firstVideo.snippet.title}" by ${firstVideo.snippet.channelTitle}`)
      }
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: url.replace(apiKey, 'HIDDEN_KEY'),
      hasData: !!(data.items && data.items.length > 0),
      videoCount: data.items?.length || 0,
      firstVideo: data.items?.[0] ? {
        videoId: data.items[0].id.videoId,
        title: data.items[0].snippet.title,
        channelTitle: data.items[0].snippet.channelTitle,
        description: data.items[0].snippet.description.substring(0, 200),
        publishedAt: data.items[0].snippet.publishedAt,
        thumbnailUrl: data.items[0].snippet.thumbnails.medium?.url
      } : null,
      rawResponse: data
    })

  } catch (error) {
    console.error('❌ YouTube API test failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error
      },
      { status: 500 }
    )
  }
}