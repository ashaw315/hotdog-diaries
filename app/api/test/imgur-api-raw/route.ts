import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.IMGUR_CLIENT_ID
    
    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'No Imgur Client ID configured'
      })
    }

    // Test direct API call
    const url = 'https://api.imgur.com/3/gallery/search?q=hotdog'
    
    console.log(`🔍 Testing Imgur API: ${url}`)
    console.log(`📋 Using Client ID: ${clientId.substring(0, 4)}***${clientId.substring(clientId.length - 3)}`)
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${clientId}`,
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
        error: 'Invalid JSON response from Imgur API',
        status: response.status,
        statusText: response.statusText,
        responsePreview: responseText.substring(0, 500)
      })
    }

    // Log some details about the response
    if (data.data && Array.isArray(data.data)) {
      console.log(`✅ Found ${data.data.length} items`)
      if (data.data.length > 0) {
        const firstItem = data.data[0]
        console.log(`📸 First item: "${firstItem.title}" by ${firstItem.account_url || 'anonymous'}`)
      }
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
      hasData: !!(data.data && data.data.length > 0),
      itemCount: data.data?.length || 0,
      firstItem: data.data?.[0] ? {
        id: data.data[0].id,
        title: data.data[0].title,
        account_url: data.data[0].account_url,
        is_album: data.data[0].is_album,
        images_count: data.data[0].images_count,
        link: data.data[0].link,
        views: data.data[0].views,
        ups: data.data[0].ups
      } : null,
      rawResponse: data
    })

  } catch (error) {
    console.error('❌ Imgur API test failed:', error)
    
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