import { NextRequest, NextResponse } from 'next/server'
import { youtubeScanningService } from '@/lib/services/youtube-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing YouTube scan...')
    
    const result = await youtubeScanningService.performScan({ maxPosts: 5 })
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ YouTube scan test failed:', error)
    
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