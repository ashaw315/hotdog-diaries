import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const videoId = searchParams.get('v')
  
  if (!videoId) {
    return NextResponse.json({ error: 'Missing video ID' }, { status: 400 })
  }

  // Return YouTube player HTML that will be server-rendered
  // This avoids CORS because the iframe is served from our domain
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { margin: 0; padding: 0; overflow: hidden; }
        iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
      </style>
    </head>
    <body>
      <iframe 
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </body>
    </html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'X-Frame-Options': 'SAMEORIGIN'
    }
  })
}