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

    // Test different search terms for variety
    const searchTerms = [
      'street food hot dogs',
      'hot dog eating contest',
      'hot dog reviews',
      'ballpark hot dogs'
    ]
    
    const results = []
    
    for (const searchTerm of searchTerms) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=video&maxResults=3&key=${apiKey}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.items && data.items.length > 0) {
        results.push({
          searchTerm,
          videoCount: data.items.length,
          videos: data.items.map(video => ({
            title: video.snippet.title,
            channel: video.snippet.channelTitle,
            videoId: video.id.videoId,
            thumbnail: video.snippet.thumbnails.medium?.url,
            publishedAt: video.snippet.publishedAt,
            description: video.snippet.description.substring(0, 100)
          }))
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        searchResults: results,
        totalSearches: searchTerms.length,
        totalVideos: results.reduce((sum, result) => sum + result.videoCount, 0)
      }
    })

  } catch (error) {
    console.error('❌ YouTube variety test failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}