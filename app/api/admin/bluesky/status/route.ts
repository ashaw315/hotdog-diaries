import { NextResponse } from 'next/server'
import { blueskyService } from '@/lib/services/bluesky-scanning'
import { ServiceStatus } from '@/types'

export async function GET(): Promise<NextResponse> {
  try {
    console.log('📊 Getting Bluesky status...')
    
    const [config, stats, connectionTest] = await Promise.all([
      blueskyService.getScanConfig(),
      blueskyService.getScanningStats(),
      blueskyService.testConnection()
    ])

    const healthStatus = connectionTest.success ? 
      (stats.successRate > 0.5 ? 'healthy' : 'warning') : 'error'

    const status: ServiceStatus = {
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
      healthStatus,
      
      // Statistics
      stats: {
        totalScanned: stats.totalPostsFound,
        totalApproved: stats.postsApproved,
        totalRejected: stats.postsRejected,
        successRate: Math.round(stats.successRate * 100)
      },

      // Platform capabilities
      capabilities: {
        canSchedule: true,
        canPost: true,
        supportsVideo: true,
        supportsImages: true
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