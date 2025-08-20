import { NextRequest, NextResponse } from 'next/server'
import { blueskyService } from '@/lib/services/bluesky-scanning'

export async function POST(request: NextRequest) {
  console.log('🦋 Starting Bluesky scan with AT Protocol authentication...')
  
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

    console.log('✅ Authentication successful for Bluesky scan')

    // Check Bluesky API credentials
    const identifier = process.env.BLUESKY_IDENTIFIER
    const appPassword = process.env.BLUESKY_APP_PASSWORD

    if (!identifier || !appPassword) {
      console.error('❌ Bluesky API credentials not found')
      return NextResponse.json({
        success: false,
        error: 'Bluesky AT Protocol credentials not configured',
        details: {
          message: 'Missing BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD',
          solution: 'Configure Bluesky authentication in environment variables',
          documentation: 'https://atproto.com/specs/atp'
        },
        posts_added: 0
      }, { status: 500 })
    }

    console.log('✅ Bluesky credentials found')
    console.log(`🔍 Identifier: ${identifier}`)

    // Test Bluesky connection first
    console.log('🧪 Testing Bluesky AT Protocol connection...')
    const connectionTest = await blueskyService.testConnection()
    
    if (!connectionTest.success) {
      console.error('❌ Bluesky connection test failed:', connectionTest.message)
      return NextResponse.json({
        success: false,
        error: `Bluesky AT Protocol connection failed: ${connectionTest.message}`,
        details: connectionTest.details || {},
        posts_added: 0
      }, { status: 500 })
    }

    console.log('✅ Bluesky AT Protocol connection successful')
    console.log(`🦋 Connected as: ${connectionTest.details?.handle}`)

    // Parse request options
    const body = await request.json().catch(() => ({}))
    const maxPosts = body.maxPosts || 15

    console.log(`🎯 Starting Bluesky scan with up to ${maxPosts} posts`)

    // Perform Bluesky scan
    const scanResult = await blueskyService.performScan({ 
      maxPosts 
    })

    console.log(`📊 Bluesky scan complete: ${scanResult.processed} processed, ${scanResult.approved} approved`)

    // Determine success/failure based on posts added
    const success = scanResult.approved > 0

    return NextResponse.json({
      success,
      message: success 
        ? `Successfully added ${scanResult.approved} Bluesky posts about hotdogs`
        : 'No new content added - all items were duplicates, low quality, or failed processing',
      posts_added: scanResult.approved,
      stats: {
        totalFound: scanResult.totalFound,
        processed: scanResult.processed,
        approved: scanResult.approved,
        rejected: scanResult.rejected,
        duplicates: scanResult.duplicates,
        errors: scanResult.errors
      }
    }, { status: success ? 200 : 400 })

  } catch (error) {
    console.error('❌ Critical error in Bluesky scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      posts_added: 0
    }, { status: 500 })
  }
}