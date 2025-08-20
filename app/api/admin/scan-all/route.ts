import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🚀 Starting comprehensive scan-all endpoint (8 platforms)...')
  
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

    // Also support cron secret for automated calls
    if (!userId && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      if (token === process.env.CRON_SECRET) {
        userId = 'cron'
        username = 'system'
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
    const host = request.headers.get('host')
    const baseUrl = process.env.NODE_ENV === 'development' && host?.includes('localhost')
      ? `http://${host}`
      : process.env.NEXTAUTH_URL || `https://${host}` || 'https://hotdog-diaries.vercel.app'

    // All 8 platforms - matches what the daily cron job scans
    const platforms = [
      { name: 'reddit', endpoint: 'scan-reddit-now', priority: 1 },
      { name: 'youtube', endpoint: 'scan-youtube-now', priority: 2 },
      { name: 'imgur', endpoint: 'scan-imgur-now', priority: 3 },
      { name: 'lemmy', endpoint: 'scan-lemmy-now', priority: 4 },
      { name: 'bluesky', endpoint: 'scan-bluesky-now', priority: 5 },
      { name: 'giphy', endpoint: 'scan-giphy-now', priority: 6 },
      { name: 'tumblr', endpoint: 'scan-tumblr-now', priority: 7 },
      { name: 'pixabay', endpoint: 'scan-pixabay-now', priority: 8 }
    ]

    const results = {}
    const errors = []
    let totalItems = 0

    console.log(`📡 Scanning ${platforms.length} platforms...`)

    // Scan each platform
    for (const platform of platforms) {
      console.log(`📡 Scanning ${platform.name}...`)
      
      try {
        const response = await fetch(`${baseUrl}/api/admin/${platform.endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            maxPosts: 20,  // Get more content per platform
            emergency: true // Flag for more aggressive scanning
          }),
          signal: AbortSignal.timeout(45000) // 45 second timeout per platform
        })

        if (response.ok) {
          const data = await response.json()
          const itemsAdded = data.posts_added || data.gifs_added || data.videos_added || data.images_added || data.items_added || data.stats?.approved || 0
          
          results[platform.name] = {
            success: true,
            items: itemsAdded,
            message: data.message || 'Success'
          }
          
          totalItems += itemsAdded
          console.log(`✅ ${platform.name}: ${itemsAdded} items added`)
        } else {
          const errorText = await response.text()
          results[platform.name] = {
            success: false,
            items: 0,
            error: `${response.status} ${errorText}`
          }
          errors.push(`${platform.name}: ${response.status} ${response.statusText}`)
          console.error(`❌ ${platform.name} scan failed: ${response.status}`)
        }
      } catch (platformError) {
        const errorMessage = platformError instanceof Error ? platformError.message : 'Unknown error'
        results[platform.name] = {
          success: false,
          items: 0,
          error: errorMessage
        }
        errors.push(`${platform.name}: ${errorMessage}`)
        console.error(`❌ ${platform.name} scan error:`, platformError)
      }
    }

    const successfulScans = Object.values(results).filter((r: any) => r.success).length
    const summary = {
      totalPlatforms: platforms.length,
      successfulScans: successfulScans,
      failedScans: platforms.length - successfulScans,
      totalItemsAdded: totalItems,
      platforms: platforms.map(p => p.name),
      results: results
    }

    console.log(`📊 Scan complete: ${totalItems} total items from ${successfulScans}/${platforms.length} platforms`)

    return NextResponse.json({
      success: successfulScans > 0,
      message: `Comprehensive scan complete! Added ${totalItems} items from ${successfulScans}/${platforms.length} platforms`,
      ...summary,
      errors: errors.length > 0 ? errors : undefined
    }, { status: successfulScans > 0 ? 200 : 500 })

  } catch (error) {
    console.error('❌ Critical error in comprehensive scan-all:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalItemsAdded: 0,
      platforms: []
    }, { status: 500 })
  }
}