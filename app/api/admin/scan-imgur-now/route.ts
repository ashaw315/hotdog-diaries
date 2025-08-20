import { NextRequest, NextResponse } from 'next/server'
import { imgurScanningService } from '@/lib/services/imgur-scanning'

export async function POST(request: NextRequest) {
  console.log('🖼️  Starting Imgur scan with Client-ID authentication...')
  
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

    console.log('✅ Authentication successful for Imgur scan')

    // Check Imgur API credentials
    const clientId = process.env.IMGUR_CLIENT_ID

    if (!clientId) {
      console.error('❌ Imgur API credentials not found')
      return NextResponse.json({
        success: false,
        error: 'Imgur API credentials not configured',
        details: {
          message: 'Missing IMGUR_CLIENT_ID',
          solution: 'Configure Imgur Client-ID in environment variables',
          documentation: 'https://apidocs.imgur.com/'
        },
        posts_added: 0
      }, { status: 500 })
    }

    console.log('✅ Imgur API credentials found')
    console.log(`🔍 Client ID: ${clientId.substring(0, 8)}...`)

    // Test Imgur connection first
    console.log('🧪 Testing Imgur API connection...')
    const connectionTest = await imgurScanningService.testConnection()
    
    if (!connectionTest.success) {
      console.error('❌ Imgur connection test failed:', connectionTest.message)
      return NextResponse.json({
        success: false,
        error: `Imgur API connection failed: ${connectionTest.message}`,
        details: connectionTest.details || {},
        posts_added: 0
      }, { status: 500 })
    }

    console.log('✅ Imgur API connection successful')

    // Parse request options
    const body = await request.json().catch(() => ({}))
    const maxPosts = body.maxPosts || 20

    console.log(`🎯 Starting Imgur scan with up to ${maxPosts} posts`)

    // Perform Imgur scan
    const scanResult = await imgurScanningService.performScan({ 
      maxPosts 
    })

    console.log(`📊 Imgur scan complete: ${scanResult.processed} processed, ${scanResult.approved} approved`)

    // Determine success/failure based on posts added
    const success = scanResult.approved > 0

    return NextResponse.json({
      success,
      message: success 
        ? `Successfully added ${scanResult.approved} Imgur posts about hotdogs`
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
    console.error('❌ Critical error in Imgur scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      posts_added: 0
    }, { status: 500 })
  }
}