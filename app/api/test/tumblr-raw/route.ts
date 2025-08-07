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

    // Test direct API call
    const url = `https://api.tumblr.com/v2/tagged?tag=hotdog&api_key=${apiKey}&limit=5`
    
    console.log(`🔍 Testing Tumblr API: ${url.replace(apiKey, 'HIDDEN_KEY')}`)
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HotdogDiaries/1.0'
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
        error: 'Invalid JSON response from Tumblr API',
        status: response.status,
        statusText: response.statusText,
        responsePreview: responseText.substring(0, 500)
      })
    }

    // Log some details about the response
    if (data.response && Array.isArray(data.response)) {
      console.log(`✅ Found ${data.response.length} posts`)
      if (data.response.length > 0) {
        const firstPost = data.response[0]
        console.log(`📋 First post: "${firstPost.summary || firstPost.slug}" from ${firstPost.blog_name}`)
      }
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: url.replace(apiKey, 'HIDDEN_KEY'),
      hasData: !!(data.response && data.response.length > 0),
      postCount: data.response?.length || 0,
      firstPost: data.response?.[0] ? {
        id: data.response[0].id,
        blog_name: data.response[0].blog_name,
        type: data.response[0].type,
        summary: data.response[0].summary,
        slug: data.response[0].slug,
        tags: data.response[0].tags?.slice(0, 5),
        note_count: data.response[0].note_count
      } : null,
      rawResponse: data
    })

  } catch (error) {
    console.error('❌ Tumblr API test failed:', error)
    
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