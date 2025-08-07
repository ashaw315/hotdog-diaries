import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Test YouTube video ID extraction and embedding
    const testUrls = [
      'https://www.youtube.com/watch?v=5XWa9xGg6p0',
      'https://www.youtube.com/watch?v=IYsq0XEt9yM',
      'https://www.youtube.com/watch?v=M3WwWt7H20M'
    ]
    
    const embedTests = testUrls.map(url => {
      const videoId = url.split('v=')[1]?.split('&')[0]
      return {
        originalUrl: url,
        videoId,
        embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'YouTube embedding test results',
        embedTests,
        sampleHtml: `
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/${embedTests[0].videoId}"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        `
      }
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}