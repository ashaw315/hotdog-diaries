import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('[MASTODON TEST] Starting test')
    
    // Test Mastodon connectivity - public API, no auth needed
    const instanceUrl = 'https://mastodon.social'
    const testUrl = `${instanceUrl}/api/v2/search?q=hotdog&type=statuses&limit=5`
    
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'HotdogDiaries/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Mastodon API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const statuses = data.statuses || []
    
    return NextResponse.json({
      success: true,
      message: `Mastodon test successful - found ${statuses.length} posts`,
      data: {
        instance: instanceUrl,
        postsFound: statuses.length,
        samplePost: statuses[0]?.content?.replace(/<[^>]*>/g, '').substring(0, 100) || 'No posts',
        url: testUrl
      }
    })
    
  } catch (error) {
    console.error('[MASTODON TEST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Mastodon test failed'
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    console.log('[MASTODON TEST] Starting scan test')
    
    // Import the scanning service
    const { mastodonScanningService } = await import('@/lib/services/mastodon-scanning')
    
    // Test the scan with options
    const result = await mastodonScanningService.performScan({ maxPosts: 5 })
    
    return NextResponse.json({
      success: true,
      message: `Mastodon scan test completed`,
      data: {
        totalFound: result.totalFound || 0,
        processed: result.processed || 0,
        approved: result.approved || 0,
        rejected: result.rejected || 0,
        duplicates: result.duplicates || 0,
        errors: result.errors || []
      }
    })
    
  } catch (error) {
    console.error('[MASTODON TEST] Scan error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Mastodon scan test failed'
    }, { status: 500 })
  }
}