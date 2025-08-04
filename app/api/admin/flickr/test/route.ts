import { NextRequest, NextResponse } from 'next/server'
import { flickrScanningService } from '@/lib/services/flickr-scanning'

export async function GET(request: NextRequest) {
  try {
    const connectionTest = await flickrScanningService.testConnection()
    
    return NextResponse.json({
      success: connectionTest.success,
      message: connectionTest.message,
      data: connectionTest.details
    })

  } catch (error) {
    console.error('Flickr connection test error:', error)
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