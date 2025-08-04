import { NextRequest, NextResponse } from 'next/server'
import { unsplashService } from '@/lib/services/unsplash'

export async function GET(request: NextRequest) {
  try {
    const apiStatus = await unsplashService.getApiStatus()
    
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
        avgLikes: 0 // Will be populated from database in full implementation
      }
    })

  } catch (error) {
    console.error('Unsplash status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Unsplash API status',
        details: error.message
      },
      { status: 500 }
    )
  }
}