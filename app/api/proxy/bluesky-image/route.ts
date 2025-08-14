import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    
    if (!imageUrl) {
      return new NextResponse('Missing URL parameter', { status: 400 })
    }
    
    // Validate it's a Bluesky AT Protocol URL
    if (!imageUrl.includes('bsky.social') || !imageUrl.includes('com.atproto.sync.getBlob')) {
      return new NextResponse('Invalid URL - only Bluesky AT Protocol URLs allowed', { status: 400 })
    }
    
    // Fix the double xrpc issue in the URL
    let cleanUrl = imageUrl
    if (imageUrl.includes('/xrpc/xrpc/')) {
      cleanUrl = imageUrl.replace('/xrpc/xrpc/', '/xrpc/')
      console.log('🔧 Fixed double xrpc in URL:', cleanUrl)
    }
    
    console.log('🦋 Proxying Bluesky image:', imageUrl)
    
    // Fetch the blob with proper AT Protocol headers
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'HotdogDiariesBot/1.0',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    
    if (!response.ok) {
      console.error('❌ Bluesky image fetch failed:', response.status, response.statusText)
      
      // For debugging, let's see the response body
      const errorText = await response.text()
      console.error('Bluesky error response:', errorText)
      
      // If it's a 400 error with "Could not find repo", the blob might be deleted or DID is wrong
      if (response.status === 400 && errorText.includes('Could not find repo')) {
        console.log('🔍 Attempting fallback: The blob might be deleted or DID is incorrect')
        
        // Return a placeholder image for deleted/missing Bluesky content
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
          <rect width="400" height="300" fill="#00D4FF"/>
          <text x="200" y="140" text-anchor="middle" fill="white" font-size="18" font-family="Arial">
            Bluesky Image Unavailable
          </text>
          <text x="200" y="170" text-anchor="middle" fill="white" font-size="14" font-family="Arial">
            Content may have been deleted
          </text>
        </svg>`
        
        return new NextResponse(placeholderSvg, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          }
        })
      }
      
      return new NextResponse(`Bluesky fetch failed: ${response.status} - ${errorText}`, { status: response.status })
    }
    
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    console.log('✅ Bluesky image fetched successfully, content-type:', contentType, 'size:', imageBuffer.byteLength)
    
    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
    
  } catch (error) {
    console.error('Bluesky proxy error:', error)
    return new NextResponse(`Proxy error: ${error.message}`, { status: 500 })
  }
}