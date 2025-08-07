import { NextRequest, NextResponse } from 'next/server'
import { tumblrScanningService } from '@/lib/services/tumblr-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing Tumblr scan...')
    
    const result = await tumblrScanningService.performScan({ maxPosts: 5 })
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Tumblr scan test failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error
      },
      { status: 500 }
    )
  }
}