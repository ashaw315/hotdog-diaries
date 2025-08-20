import { NextRequest, NextResponse } from 'next/server'
import { lemmyScanningService } from '@/lib/services/lemmy-scanning'

export async function POST(request: NextRequest) {
  console.log('🌐 Starting Lemmy federated scan...')
  
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

    console.log('✅ Authentication successful for Lemmy scan')

    // Lemmy doesn't require API keys for public content
    console.log('✅ Lemmy federated access available (no API key required)')

    // Test Lemmy connection first
    console.log('🧪 Testing Lemmy federated network connection...')
    const connectionTest = await lemmyScanningService.testConnection()
    
    if (!connectionTest.success) {
      console.error('❌ Lemmy connection test failed:', connectionTest.message)
      return NextResponse.json({
        success: false,
        error: `Lemmy federated network connection failed: ${connectionTest.message}`,
        details: connectionTest.details || {},
        posts_added: 0
      }, { status: 500 })
    }

    console.log('✅ Lemmy federated network connection successful')
    console.log(`🌐 Connected to communities: ${connectionTest.details?.communityResults?.filter((r: any) => r.success).length}/${connectionTest.details?.communityResults?.length}`)

    // Parse request options
    const body = await request.json().catch(() => ({}))
    const maxPosts = body.maxPosts || 20

    console.log(`🎯 Starting Lemmy federated scan with up to ${maxPosts} posts`)

    // Perform Lemmy scan
    const scanResult = await lemmyScanningService.performScan({ 
      maxPosts 
    })

    console.log(`📊 Lemmy scan complete: ${scanResult.processed} processed, ${scanResult.approved} approved`)

    // Determine success/failure based on posts added
    const success = scanResult.approved > 0

    return NextResponse.json({
      success,
      message: success 
        ? `Successfully added ${scanResult.approved} Lemmy posts about hotdogs`
        : 'No new content added - all items were duplicates, low quality, or failed processing',
      posts_added: scanResult.approved,
      stats: {
        totalFound: scanResult.totalFound,
        processed: scanResult.processed,
        approved: scanResult.approved,
        rejected: scanResult.rejected,
        duplicates: scanResult.duplicates,
        errors: scanResult.errors.length,
        platform: 'lemmy',
        federatedCommunities: ['lemmy.world/c/hot_dog', 'lemmy.world/c/food']
      }
    }, { status: success ? 200 : 400 })

  } catch (error) {
    console.error('❌ Critical error in Lemmy scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      posts_added: 0
    }, { status: 500 })
  }
}