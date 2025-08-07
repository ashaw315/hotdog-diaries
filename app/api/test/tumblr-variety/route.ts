import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.TUMBLR_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'No Tumblr API key configured'
      })
    }

    // Test different search tags
    const tags = ['food', 'foodporn', 'cooking']
    const results = []
    
    for (const tag of tags) {
      const url = `https://api.tumblr.com/v2/tagged?tag=${encodeURIComponent(tag)}&api_key=${apiKey}&limit=3`
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        results.push({
          tag,
          postCount: data.response?.length || 0,
          types: data.response?.map(p => p.type) || []
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        searchResults: results
      }
    })

  } catch (error) {
    console.error('❌ Tumblr variety test failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}