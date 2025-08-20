import { NextRequest, NextResponse } from 'next/server'
import { mastodonService } from '@/lib/services/mastodon-scanning'

export async function POST(request: NextRequest) {
  console.log('🐘 Starting Mastodon federated scan...')
  
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

    console.log('✅ Authentication successful for Mastodon scan')

    // Mastodon doesn't require API keys for public content
    console.log('✅ Mastodon federated access available (no API key required)')

    // Test Mastodon connection first
    console.log('🧪 Testing Mastodon federated network connection...')
    const connectionTest = await mastodonService.testConnection()
    
    if (!connectionTest.success) {
      console.error('❌ Mastodon connection test failed:', connectionTest.message)
      return NextResponse.json({
        success: false,
        error: `Mastodon federated network connection failed: ${connectionTest.message}`,
        details: connectionTest.details || {},
        posts_added: 0
      }, { status: 500 })
    }

    console.log('✅ Mastodon federated network connection successful')
    console.log(`🌐 Connected to instances: ${connectionTest.details?.testResults?.filter((r: any) => r.success).length}/${connectionTest.details?.testResults?.length}`)

    // Parse request options
    const body = await request.json().catch(() => ({}))
    const maxPosts = body.maxPosts || 20

    console.log(`🎯 Starting Mastodon federated scan with up to ${maxPosts} posts`)

    // Perform Mastodon scan
    const scanResult = await mastodonService.performScan({ 
      maxPosts 
    })

    console.log(`📊 Mastodon scan complete: ${scanResult.processed} processed, ${scanResult.approved} approved`)

    // Determine success/failure based on posts added
    const success = scanResult.approved > 0

    return NextResponse.json({
      success,
      message: success 
        ? `Successfully added ${scanResult.approved} Mastodon posts about hotdogs`
        : 'No new content added - all items were duplicates, low quality, or failed processing',
      posts_added: scanResult.approved,
      stats: {
        totalFound: scanResult.totalFound,
        processed: scanResult.processed,
        approved: scanResult.approved,
        rejected: scanResult.rejected,
        duplicates: scanResult.duplicates,
        errors: scanResult.errors,
        platform: 'mastodon',
        federatedInstances: ['mastodon.social', 'mastodon.world', 'mas.to', 'fosstodon.org']
      }
    }, { status: success ? 200 : 400 })

  } catch (error) {
    console.error('❌ Critical error in Mastodon scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      posts_added: 0
    }, { status: 500 })
  }
}