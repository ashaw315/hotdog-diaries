import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🚀 Starting scan-all endpoint...')
  
  try {
    // Auth check - same as other admin endpoints
    let userId: string | null = null
    let username: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through to normal auth
      }
    }

    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ Authentication successful for scan-all')

    // Get the base URL for internal API calls
    const baseUrl = process.env.NEXTAUTH_URL || request.headers.get('host') 
      ? `https://${request.headers.get('host')}` 
      : 'https://hotdog-diaries.vercel.app'

    const results = {
      giphy: 0,
      youtube: 0,
      total: 0,
      errors: []
    }

    // Call Giphy scan endpoint
    console.log('📡 Scanning Giphy...')
    try {
      const giphyResponse = await fetch(`${baseUrl}/api/admin/scan-giphy-now`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader || '',
          'Content-Type': 'application/json'
        }
      })

      if (giphyResponse.ok) {
        const giphyData = await giphyResponse.json()
        results.giphy = giphyData.gifs_added || 0
        console.log(`✅ Giphy scan: ${results.giphy} GIFs added`)
      } else {
        const errorText = await giphyResponse.text()
        results.errors.push(`Giphy scan failed: ${giphyResponse.status} ${errorText}`)
        console.error('❌ Giphy scan failed:', giphyResponse.status)
      }
    } catch (giphyError) {
      results.errors.push(`Giphy scan error: ${giphyError.message}`)
      console.error('❌ Giphy scan error:', giphyError)
    }

    // Call YouTube scan endpoint
    console.log('📡 Scanning YouTube...')
    try {
      const youtubeResponse = await fetch(`${baseUrl}/api/admin/scan-youtube-now`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader || '',
          'Content-Type': 'application/json'
        }
      })

      if (youtubeResponse.ok) {
        const youtubeData = await youtubeResponse.json()
        results.youtube = youtubeData.videos_added || 0
        console.log(`✅ YouTube scan: ${results.youtube} videos added`)
      } else {
        const errorText = await youtubeResponse.text()
        results.errors.push(`YouTube scan failed: ${youtubeResponse.status} ${errorText}`)
        console.error('❌ YouTube scan failed:', youtubeResponse.status)
      }
    } catch (youtubeError) {
      results.errors.push(`YouTube scan error: ${youtubeError.message}`)
      console.error('❌ YouTube scan error:', youtubeError)
    }

    // Calculate total
    results.total = results.giphy + results.youtube

    console.log(`📊 Scan complete: ${results.total} total items added (${results.giphy} GIFs + ${results.youtube} videos)`)

    return NextResponse.json({
      success: true,
      message: `Scan complete! Added ${results.total} new hotdog items`,
      results,
      summary: {
        giphy: results.giphy,
        youtube: results.youtube,
        total: results.total
      }
    })

  } catch (error) {
    console.error('❌ Critical error in scan-all:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results: {
        giphy: 0,
        youtube: 0,
        total: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }, { status: 500 })
  }
}