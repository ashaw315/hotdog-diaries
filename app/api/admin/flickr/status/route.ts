import { NextRequest, NextResponse } from 'next/server'
import { FlickrService } from '@/lib/services/flickr'

const flickrService = new FlickrService()

export async function GET(request: NextRequest) {
  try {
    const apiStatus = await flickrService.getApiStatus()
    
    return NextResponse.json({
      success: true,
      data: {
        isAuthenticated: apiStatus.isAuthenticated,
        requestsUsed: apiStatus.requestsUsed,
        requestsRemaining: apiStatus.requestsRemaining,
        requestsResetTime: apiStatus.requestsResetTime,
        lastError: apiStatus.lastError,
        lastRequest: apiStatus.lastRequest,
        photosScanned: 0, // Will be populated from database in full implementation
        avgViews: 0 // Will be populated from database in full implementation
      }
    })

  } catch (error) {
    console.error('Flickr status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Flickr API status',
        details: error.message
      },
      { status: 500 }
    )
  }
}