import { NextRequest, NextResponse } from 'next/server'
import { unsplashService } from '@/lib/services/unsplash'

export async function GET(request: NextRequest) {
  try {
    const apiStatus = await unsplashService.getApiStatus()
    
    if (apiStatus.isAuthenticated) {
      // Try a simple search to test the connection
      try {
        const testPhotos = await unsplashService.searchPhotos({
          query: 'hotdog',
          maxResults: 1
        })
        
        return NextResponse.json({
          success: true,
          message: 'Unsplash API connection successful',
          data: {
            isAuthenticated: true,
            requestsUsed: apiStatus.requestsUsed,
            requestsRemaining: apiStatus.requestsRemaining,
            testSearchResults: testPhotos.length,
            connectionTime: new Date().toISOString()
          }
        })
      } catch (searchError) {
        return NextResponse.json({
          success: false,
          message: 'Unsplash API authenticated but search failed',
          data: {
            isAuthenticated: true,
            searchError: searchError.message,
            connectionTime: new Date().toISOString()
          }
        })
      }
    } else {
      return NextResponse.json({
        success: false,
        message: apiStatus.lastError || 'Unsplash API not authenticated',
        data: {
          isAuthenticated: false,
          lastError: apiStatus.lastError,
          connectionTime: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Unsplash connection test error:', error)
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