import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    const pageUrl = searchParams.get('page')
    
    if (!imageUrl) {
      return new NextResponse('Missing URL parameter', { status: 400 })
    }
    
    // Validate it's a Pixabay URL
    if (!imageUrl.includes('pixabay.com')) {
      return new NextResponse('Invalid URL - only Pixabay URLs allowed', { status: 400 })
    }
    
    console.log('🖼️ Proxying Pixabay image:', imageUrl)
    
    // Try the original URL first
    let response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://pixabay.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    
    // If the URL is expired (400 error), try to get a fresh one from the API
    if (!response.ok && (response.status === 400 || response.status === 403)) {
      console.log('🔄 Pixabay URL expired, trying to get fresh URL...')
      
      // Extract image ID from the page URL or try to parse it from the expired URL
      let imageId = null
      
      if (pageUrl && pageUrl.includes('pixabay.com/photos/')) {
        // Extract ID from URL like: https://pixabay.com/photos/sausage-bread-roll-hotdog-4207649/
        console.log('🔍 Extracting ID from page URL:', pageUrl)
        const match = pageUrl.match(/-(\d+)\/?$/)
        console.log('🔍 Regex match result:', match)
        if (match) {
          imageId = match[1]
          console.log('✅ Extracted image ID:', imageId)
        }
      }
      
      if (!imageId) {
        // Try to extract from expired URL pattern (less reliable but worth trying)
        console.log('⚠️ No page URL provided, cannot refresh expired Pixabay image')
        return new NextResponse(`Pixabay URL expired and cannot refresh without page URL. Original status: ${response.status}`, { 
          status: response.status 
        })
      }
      
      // Get fresh URL from Pixabay API
      const apiKey = process.env.PIXABAY_API_KEY
      if (!apiKey) {
        console.error('❌ No Pixabay API key configured')
        return new NextResponse('Pixabay API key not configured', { status: 500 })
      }
      
      try {
        const apiResponse = await fetch(
          `https://pixabay.com/api/?key=${apiKey}&id=${imageId}&image_type=photo&category=food`
        )
        
        if (apiResponse.ok) {
          const data = await apiResponse.json()
          if (data.hits && data.hits.length > 0) {
            const freshImageUrl = data.hits[0].webformatURL
            console.log('✨ Got fresh Pixabay URL:', freshImageUrl)
            
            // Fetch the fresh image
            response = await fetch(freshImageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://pixabay.com/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
              }
            })
          }
        }
      } catch (apiError) {
        console.error('❌ Failed to get fresh Pixabay URL:', apiError)
      }
    }
    
    if (!response.ok) {
      console.error('❌ Pixabay image fetch failed:', response.status, response.statusText)
      return new NextResponse(`Pixabay fetch failed: ${response.status}`, { status: response.status })
    }
    
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    console.log('✅ Pixabay image fetched successfully, content-type:', contentType, 'size:', imageBuffer.byteLength)
    
    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes (less than 24h expiry)
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
    
  } catch (error) {
    console.error('Pixabay proxy error:', error)
    return new NextResponse(`Proxy error: ${error.message}`, { status: 500 })
  }
}