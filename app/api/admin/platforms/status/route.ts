import { NextRequest, NextResponse } from 'next/server'
import { flickrScanningService } from '@/lib/services/flickr-scanning'
import { youtubeScanningService } from '@/lib/services/youtube-scanning'
import { unsplashScanningService } from '@/lib/services/unsplash-scanning'
import { mastodonScanningService } from '@/lib/services/mastodon-scanning'

export interface PlatformStatus {
  name: string
  status: 'available' | 'partial' | 'unavailable' | 'mock'
  message: string
  usingMockData: boolean
  hasApiKey: boolean
  lastTestTime: string
  details?: any
}

export interface PlatformStatusResponse {
  success: boolean
  timestamp: string
  platforms: PlatformStatus[]
  summary: {
    totalPlatforms: number
    availablePlatforms: number
    platformsWithMockData: number
    platformsWithApiKeys: number
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const testStartTime = new Date().toISOString()
    
    // Test all platform connections
    const platformTests = await Promise.allSettled([
      testPlatformStatus('Flickr', flickrScanningService, !!process.env.FLICKR_API_KEY),
      testPlatformStatus('YouTube', youtubeScanningService, !!process.env.YOUTUBE_API_KEY),
      testPlatformStatus('Unsplash', unsplashScanningService, !!process.env.UNSPLASH_ACCESS_KEY),
      testPlatformStatus('Mastodon', mastodonScanningService, false) // No API key needed
    ])

    const platforms: PlatformStatus[] = []
    
    platformTests.forEach((result, index) => {
      const platformNames = ['Flickr', 'YouTube', 'Unsplash', 'Mastodon']
      
      if (result.status === 'fulfilled') {
        platforms.push(result.value)
      } else {
        platforms.push({
          name: platformNames[index],
          status: 'unavailable',
          message: `Platform test failed: ${result.reason}`,
          usingMockData: true,
          hasApiKey: false,
          lastTestTime: testStartTime,
          details: { error: result.reason }
        })
      }
    })

    const summary = {
      totalPlatforms: platforms.length,
      availablePlatforms: platforms.filter(p => p.status === 'available').length,
      platformsWithMockData: platforms.filter(p => p.usingMockData).length,
      platformsWithApiKeys: platforms.filter(p => p.hasApiKey).length
    }

    const response: PlatformStatusResponse = {
      success: true,
      timestamp: testStartTime,
      platforms,
      summary
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Platform status check failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check platform status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

async function testPlatformStatus(
  name: string, 
  service: any, 
  hasApiKey: boolean
): Promise<PlatformStatus> {
  const testStartTime = new Date().toISOString()
  
  try {
    const connectionResult = await service.testConnection()
    
    // Determine status based on connection result
    let status: PlatformStatus['status'] = 'unavailable'
    let usingMockData = true
    
    if (connectionResult.success) {
      if (connectionResult.details?.usingMockData === false) {
        status = 'available'
        usingMockData = false
      } else if (connectionResult.details?.usingMockData === true) {
        status = 'mock'
        usingMockData = true
      } else {
        // For platforms like Mastodon that might be partially available
        if (name === 'Mastodon' && connectionResult.details?.workingInstances?.length > 0) {
          const totalInstances = connectionResult.details.totalInstances || 1
          const workingInstances = connectionResult.details.workingInstances?.length || 0
          
          if (workingInstances === totalInstances) {
            status = 'available'
            usingMockData = false
          } else if (workingInstances > 0) {
            status = 'partial'
            usingMockData = false
          } else {
            status = 'mock'
            usingMockData = true
          }
        } else {
          status = connectionResult.success ? 'available' : 'mock'
        }
      }
    }

    // Add API key warnings to message
    let message = connectionResult.message
    if (!hasApiKey && name !== 'Mastodon') {
      message += ` (API key not configured)`
    }

    return {
      name,
      status,
      message,
      usingMockData,
      hasApiKey,
      lastTestTime: testStartTime,
      details: connectionResult.details
    }

  } catch (error) {
    return {
      name,
      status: 'unavailable',
      message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      usingMockData: true,
      hasApiKey,
      lastTestTime: testStartTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}