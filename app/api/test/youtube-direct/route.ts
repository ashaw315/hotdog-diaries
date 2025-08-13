import { NextRequest, NextResponse } from 'next/server'
import { youtubeScanningService } from '@/lib/services/youtube-scanning'

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Testing YouTube scanning with validation disabled...')
    
    const result = await youtubeScanningService.performScan({ maxPosts: 3 })
    
    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('YouTube direct scan error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}