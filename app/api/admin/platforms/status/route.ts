import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError,
  verifyAdminAuth
} from '@/lib/api-middleware'
import { redditScanningService } from '@/lib/services/reddit-scanning'
import { blueskyService } from '@/lib/services/bluesky-scanning'
import { imgurScanningService } from '@/lib/services/imgur-scanning'
import { YouTubeService } from '@/lib/services/youtube'

/**
 * Consolidated Platform Status Endpoint
 * 
 * GET /api/admin/platforms/status - Get platform status
 */

interface PlatformStatus {
  platform: string
  isEnabled: boolean
  isAuthenticated: boolean
  isHealthy: boolean
  lastScanTime?: Date | null
  totalContent?: number
  errorRate?: number
  responseTime?: number
  quotaUsed?: number
  quotaRemaining?: number
  healthStatus: 'healthy' | 'warning' | 'error'
  statusMessage?: string
}

async function getPlatformStatusHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await verifyAdminAuth(request)
    if (!authResult.success) {
      throw createApiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const url = new URL(request.url)
    const requestedPlatform = url.searchParams.get('platform')

    const platforms = requestedPlatform 
      ? [requestedPlatform] 
      : ['reddit', 'youtube', 'bluesky', 'imgur']

    const statusResults: PlatformStatus[] = []

    for (const platform of platforms) {
      let status: PlatformStatus = {
        platform,
        isEnabled: false,
        isAuthenticated: false,
        isHealthy: false,
        healthStatus: 'error'
      }

      try {
        switch (platform) {
          case 'reddit':
            const redditConfig = await redditScanningService.getScanConfig()
            const redditConnection = await redditScanningService.testConnection()
            
            status = {
              ...status,
              isEnabled: redditConfig.isEnabled,
              isAuthenticated: redditConnection.success,
              isHealthy: redditConnection.success && redditConfig.isEnabled,
              lastScanTime: redditConfig.lastScanTime,
              healthStatus: redditConnection.success && redditConfig.isEnabled ? 'healthy' : 'error',
              statusMessage: redditConnection.message
            }
            break

          case 'youtube':
            const youtubeService = new YouTubeService()
            const youtubeStatus = await youtubeService.getApiStatus()
            
            status = {
              ...status,
              isEnabled: true, // YouTube is always enabled if API key exists
              isAuthenticated: youtubeStatus.isAuthenticated,
              isHealthy: youtubeStatus.isAuthenticated && (youtubeStatus.quotaRemaining > 100),
              quotaUsed: youtubeStatus.quotaUsed,
              quotaRemaining: youtubeStatus.quotaRemaining,
              healthStatus: youtubeStatus.isAuthenticated 
                ? (youtubeStatus.quotaRemaining > 100 ? 'healthy' : 'warning')
                : 'error',
              statusMessage: youtubeStatus.lastError || 'Operating normally'
            }
            break

          case 'bluesky':
            const blueskyConnection = await blueskyService.testConnection()
            const blueskyStats = await blueskyService.getScanningStats?.() || {}
            
            status = {
              ...status,
              isEnabled: true, // Bluesky doesn't have config toggle yet
              isAuthenticated: blueskyConnection.success,
              isHealthy: blueskyConnection.success,
              lastScanTime: blueskyStats.lastScanTime,
              totalContent: blueskyStats.totalPostsFound,
              healthStatus: blueskyConnection.success ? 'healthy' : 'error',
              statusMessage: blueskyConnection.message
            }
            break

          case 'imgur':
            const imgurConnection = await imgurScanningService.testConnection()
            
            status = {
              ...status,
              isEnabled: true, // Imgur doesn't have config toggle yet
              isAuthenticated: imgurConnection.success,
              isHealthy: imgurConnection.success,
              healthStatus: imgurConnection.success ? 'healthy' : 'error',
              statusMessage: imgurConnection.message
            }
            break

          default:
            status = {
              ...status,
              statusMessage: 'Platform not implemented'
            }
        }
      } catch (error) {
        console.error(`Failed to get ${platform} status:`, error)
        status = {
          ...status,
          healthStatus: 'error',
          statusMessage: `Error getting status: ${error.message}`
        }
      }

      statusResults.push(status)
    }

    // Calculate overall health metrics
    const totalPlatforms = statusResults.length
    const healthyPlatforms = statusResults.filter(p => p.healthStatus === 'healthy').length
    const activePlatforms = statusResults.filter(p => p.isEnabled).length
    const authenticatedPlatforms = statusResults.filter(p => p.isAuthenticated).length

    const overallHealthScore = Math.round((healthyPlatforms / totalPlatforms) * 100)

    const response = requestedPlatform 
      ? statusResults[0] // Single platform request
      : {
          // Multi-platform summary
          totalPlatforms,
          activePlatforms,
          authenticatedPlatforms,
          healthyPlatforms,
          overallHealthScore,
          platformStats: statusResults,
          lastUpdated: new Date()
        }

    return createSuccessResponse(
      response,
      requestedPlatform 
        ? `${requestedPlatform} status retrieved successfully`
        : 'Platform status retrieved successfully'
    )

  } catch (error) {
    console.error('Failed to get platform status:', error)
    
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      throw error
    }
    
    throw createApiError('Failed to retrieve platform status', 500, 'PLATFORM_STATUS_ERROR')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['GET'])
    return await getPlatformStatusHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/platforms/status')
  }
}