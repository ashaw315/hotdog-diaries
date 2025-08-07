import { NextRequest, NextResponse } from 'next/server'
import { blueskyService } from '@/lib/services/bluesky-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Bluesky connection...')
    
    const startTime = Date.now()
    const connectionTest = await blueskyService.testConnection()
    const duration = Date.now() - startTime

    const testResults = {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      connection: {
        success: connectionTest.success,
        message: connectionTest.message,
        details: connectionTest.details
      },
      
      // Additional test details
      apiEndpoint: 'https://public.api.bsky.app',
      testQuery: 'test',
      
      // Connection quality indicators
      responseTime: duration,
      status: connectionTest.success ? 
        (duration < 2000 ? 'excellent' : duration < 5000 ? 'good' : 'slow') : 'failed'
    }

    console.log(`✅ Bluesky connection test completed: ${testResults.status}`)
    
    return NextResponse.json({
      success: connectionTest.success,
      message: connectionTest.success ? 
        'Bluesky API connection test successful' : 
        'Bluesky API connection test failed',
      data: testResults
    })

  } catch (error) {
    console.error('Bluesky connection test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Bluesky connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        data: {
          timestamp: new Date().toISOString(),
          status: 'error',
          apiEndpoint: 'https://public.api.bsky.app'
        }
      },
      { status: 500 }
    )
  }
}