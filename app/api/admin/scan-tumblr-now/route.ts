import { NextRequest, NextResponse } from 'next/server'
import { tumblrScanningService } from '@/lib/services/tumblr-scanning'

export async function POST(request: NextRequest) {
  console.log('🎨 Starting Tumblr creative content scan...')
  
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

    console.log('✅ Authentication successful for Tumblr scan')

    // Check Tumblr API configuration
    const hasApiKey = !!process.env.TUMBLR_API_KEY
    if (hasApiKey) {
      console.log('✅ Tumblr API key configured')
    } else {
      console.log('⚠️ Tumblr API key not configured, using mock data for testing')
    }

    // Test Tumblr connection first
    console.log('🧪 Testing Tumblr API connection...')
    const connectionTest = await tumblrScanningService.testConnection()
    
    if (!connectionTest.success && hasApiKey) {
      console.error('❌ Tumblr connection test failed:', connectionTest.message)
      return NextResponse.json({
        success: false,
        error: `Tumblr API connection failed: ${connectionTest.message}`,
        details: connectionTest.details || {},
        posts_added: 0
      }, { status: 500 })
    }

    console.log(`✅ Tumblr connection successful: ${connectionTest.message}`)

    // Parse request options
    const body = await request.json().catch(() => ({}))
    const maxPosts = body.maxPosts || 20

    console.log(`🎯 Starting Tumblr scan with up to ${maxPosts} posts`)

    // Perform Tumblr scan
    const scanResult = await tumblrScanningService.performScan({ 
      maxPosts 
    })

    console.log(`📊 Tumblr scan complete: ${scanResult.processed} processed, ${scanResult.approved} approved`)

    // Determine success/failure based on posts added
    const success = scanResult.approved > 0

    return NextResponse.json({
      success,
      message: success 
        ? `Successfully added ${scanResult.approved} creative Tumblr posts about hotdogs`
        : hasApiKey 
          ? 'No new content added - all items were duplicates, low quality, or failed processing'
          : 'Mock scan completed - configure TUMBLR_API_KEY for live data',
      posts_added: scanResult.approved,
      stats: {
        totalFound: scanResult.totalFound,
        processed: scanResult.processed,
        approved: scanResult.approved,
        rejected: scanResult.rejected,
        duplicates: scanResult.duplicates,
        errors: scanResult.errors.length,
        platform: 'tumblr',
        usingMockData: !hasApiKey,
        searchTags: hasApiKey ? ['hotdog', 'hot dog', 'food photography', 'food blog'] : ['mock']
      }
    }, { status: success ? 200 : (hasApiKey ? 400 : 200) }) // Return 200 for mock scans even with no approved content

  } catch (error) {
    console.error('❌ Critical error in Tumblr scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      posts_added: 0
    }, { status: 500 })
  }
}