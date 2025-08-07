import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const instance = 'https://lemmy.world'
    const searchTerm = 'hotdog'
    const url = `${instance}/api/v3/search?q=${encodeURIComponent(searchTerm)}&type_=Posts&limit=5&sort=Hot`
    
    console.log(`Fetching: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HotdogDiaries/1.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `API error: ${response.status} ${response.statusText}`,
        url
      })
    }

    const data = await response.json()
    
    // Show the structure
    const summary = {
      totalPosts: data.posts?.length || 0,
      firstPost: data.posts?.[0] ? {
        id: data.posts[0].id,
        name: data.posts[0].name,
        body: data.posts[0].body?.substring(0, 100),
        url: data.posts[0].url,
        thumbnail_url: data.posts[0].thumbnail_url,
        creator: data.posts[0].creator,
        community: data.posts[0].community,
        counts: data.posts[0].counts,
        hasImage: !!(data.posts[0].url || data.posts[0].thumbnail_url)
      } : null
    }

    return NextResponse.json({
      success: true,
      url,
      summary,
      rawData: data
    })

  } catch (error) {
    console.error('Lemmy raw test error:', error)
    
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