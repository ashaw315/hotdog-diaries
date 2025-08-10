import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('[REDDIT TEST] Starting test')
    
    // Test Reddit connectivity without auth
    const testUrl = 'https://www.reddit.com/r/hotdogs.json?limit=5'
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'HotdogDiaries/1.0 (by /u/test)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const posts = data.data?.children || []
    
    return NextResponse.json({
      success: true,
      message: `Reddit test successful - found ${posts.length} posts`,
      data: {
        postsFound: posts.length,
        samplePost: posts[0]?.data?.title || 'No posts',
        url: testUrl
      }
    })
    
  } catch (error) {
    console.error('[REDDIT TEST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Reddit test failed'
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    console.log('[REDDIT TEST] Starting scan test')
    
    // Import the scanning service
    const { redditScanningService } = await import('@/lib/services/reddit-scanning')
    
    // Test the scan
    const result = await redditScanningService.performScan()
    
    return NextResponse.json({
      success: true,
      message: `Reddit scan test completed`,
      data: {
        totalFound: result.postsFound,
        processed: result.postsProcessed,
        approved: result.postsApproved,
        rejected: result.postsRejected,
        errors: result.errors
      }
    })
    
  } catch (error) {
    console.error('[REDDIT TEST] Scan error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Reddit scan test failed'
    }, { status: 500 })
  }
}