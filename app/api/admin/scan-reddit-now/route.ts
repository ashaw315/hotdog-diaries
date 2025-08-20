import { NextRequest, NextResponse } from 'next/server'
import { redditScanningService } from '@/lib/services/reddit-scanning'

export async function POST(request: NextRequest) {
  console.log('🔥 Starting Reddit scan with OAuth authentication...')
  
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

    console.log('✅ Authentication successful for Reddit scan')

    // Check Reddit API credentials
    const clientId = process.env.REDDIT_CLIENT_ID
    const clientSecret = process.env.REDDIT_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('❌ Reddit API credentials not found')
      return NextResponse.json({
        success: false,
        error: 'Reddit API credentials not configured',
        details: {
          message: 'Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET',
          solution: 'Configure Reddit OAuth app credentials in environment variables'
        },
        posts_added: 0
      }, { status: 500 })
    }

    console.log('✅ Reddit API credentials found')
    console.log(`🔍 Client ID: ${clientId.substring(0, 8)}...`)

    // Test Reddit connection first
    console.log('🧪 Testing Reddit OAuth connection...')
    const connectionTest = await redditScanningService.testConnection()
    
    if (!connectionTest.success) {
      console.error('❌ Reddit connection test failed:', connectionTest.message)
      return NextResponse.json({
        success: false,
        error: `Reddit API connection failed: ${connectionTest.message}`,
        details: connectionTest.details || {},
        posts_added: 0
      }, { status: 500 })
    }

    console.log('✅ Reddit OAuth connection successful')

    // Parse request options
    const body = await request.json().catch(() => ({}))
    const maxPosts = body.maxPosts || 20

    console.log(`🎯 Starting Reddit scan with up to ${maxPosts} posts`)

    // Perform Reddit scan
    const scanResult = await redditScanningService.performScan({ 
      maxPosts 
    })

    console.log(`📊 Reddit scan complete: ${scanResult.postsProcessed} processed, ${scanResult.postsApproved} approved`)

    // Determine success/failure based on posts added
    const success = scanResult.postsApproved > 0

    return NextResponse.json({
      success,
      message: success 
        ? `Successfully added ${scanResult.postsApproved} Reddit posts about hotdogs`
        : 'No new content added - all items were duplicates, low quality, or failed processing',
      posts_added: scanResult.postsApproved,
      stats: {
        scanId: scanResult.scanId,
        postsFound: scanResult.postsFound,
        postsProcessed: scanResult.postsProcessed,
        postsApproved: scanResult.postsApproved,
        postsRejected: scanResult.postsRejected,
        duplicatesFound: scanResult.duplicatesFound,
        subredditsScanned: scanResult.subredditsScanned,
        highestScoredPost: scanResult.highestScoredPost,
        errors: scanResult.errors,
        duration: scanResult.endTime.getTime() - scanResult.startTime.getTime()
      }
    }, { status: success ? 200 : 400 })

  } catch (error) {
    console.error('❌ Critical error in Reddit scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      posts_added: 0
    }, { status: 500 })
  }
}