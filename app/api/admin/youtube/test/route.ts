import { NextRequest, NextResponse } from 'next/server'
import { youtubeScanningService } from '@/lib/services/youtube-scanning'

export async function GET(request: NextRequest) {
  try {
    const connectionTest = await youtubeScanningService.testConnection()
    
    return NextResponse.json({
      success: connectionTest.success,
      message: connectionTest.message,
      data: connectionTest.details
    })

  } catch (error) {
    console.error('YouTube connection test error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Connection test failed',
        error: error.message
      },
      { status: 500 }
    )
  }
}