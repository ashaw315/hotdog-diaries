import { NextRequest, NextResponse } from 'next/server'
import { blueskyService } from '@/lib/services/bluesky-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Getting Bluesky status...')
    
    const [config, stats, connectionTest] = await Promise.all([
      blueskyService.getScanConfig(),
      blueskyService.getScanningStats(),
      blueskyService.testConnection()
    ])

    const status = {
      platform: 'bluesky',
      isEnabled: config.isEnabled,
      isAuthenticated: connectionTest.success,
      connectionStatus: connectionTest.success ? 'connected' : 'error',
      connectionMessage: connectionTest.message,
      
      // Scanning configuration
      scanInterval: config.scanInterval,
      searchTerms: config.searchTerms,
      lastScanTime: config.lastScanTime?.toISOString(),
      nextScanTime: config.nextScanTime?.toISOString(),
      
      // Statistics
      stats: {
        totalPostsFound: stats.totalPostsFound,
        postsProcessed: stats.postsProcessed,
        postsApproved: stats.postsApproved,
        postsRejected: stats.postsRejected,
        successRate: Math.round(stats.successRate * 100),
        
        // Health indicators
        healthStatus: connectionTest.success ? 
          (stats.successRate > 0.5 ? 'healthy' : 'warning') : 'error',
        errorRate: Math.round((1 - stats.successRate) * 100)
      },

      // Platform capabilities
      capabilities: {
        requiresAuthentication: false,
        supportsSearch: true,
        supportsImages: true,
        supportsVideos: true,
        supportsMixedContent: true,
        apiEndpoint: 'https://public.api.bsky.app'
      }
    }

    console.log(`✅ Bluesky status retrieved: ${status.healthStatus}`)
    
    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('Error getting Bluesky status:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Bluesky status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}