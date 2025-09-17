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
import { YouTubeScanningService } from '@/lib/services/youtube-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

/**
 * Consolidated Platform Scanning Endpoint
 * 
 * POST /api/admin/platforms/scan - Trigger platform scans
 */

interface ScanRequest {
  platform: 'reddit' | 'youtube' | 'bluesky' | 'giphy' | 'imgur' | 'pixabay' | 'unsplash' | 'tumblr' | 'lemmy' | 'all'
  maxPosts?: number
  options?: {
    subreddits?: string[]
    searchTerms?: string[]
    timeRange?: string
  }
}

async function scanPlatformHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await verifyAdminAuth(request)
    if (!authResult.success) {
      throw createApiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const { platform, maxPosts = 25, options }: ScanRequest = await request.json()

    if (!platform) {
      throw createApiError('Platform parameter is required', 400, 'MISSING_PLATFORM')
    }

    await logToDatabase(
      LogLevel.INFO,
      'PLATFORM_SCAN_INITIATED',
      `Manual ${platform} scan initiated from admin panel`,
      { platform, maxPosts, options }
    )

    let result: any = {}

    try {
      switch (platform) {
        case 'reddit':
          result = await redditScanningService.performScan({ maxPosts })
          break

        case 'youtube':
          const youtubeService = new YouTubeScanningService()
          result = await youtubeService.performScan({ maxPosts })
          break

        case 'bluesky':
          result = await blueskyService.performScan({ maxPosts })
          break

        case 'imgur':
          result = await imgurScanningService.performScan({ maxPosts })
          break

        case 'all':
          // Run all platform scans in parallel
          const [redditResult, youtubeResult, blueskyResult, imgurResult] = await Promise.allSettled([
            redditScanningService.performScan({ maxPosts: Math.floor(maxPosts / 4) }),
            new YouTubeScanningService().performScan({ maxPosts: Math.floor(maxPosts / 4) }),
            blueskyService.performScan({ maxPosts: Math.floor(maxPosts / 4) }),
            imgurScanningService.performScan({ maxPosts: Math.floor(maxPosts / 4) })
          ])

          result = {
            scanId: `all_platforms_${Date.now()}`,
            startTime: new Date(),
            endTime: new Date(),
            platform: 'all',
            results: {
              reddit: redditResult.status === 'fulfilled' ? redditResult.value : { error: redditResult.reason },
              youtube: youtubeResult.status === 'fulfilled' ? youtubeResult.value : { error: youtubeResult.reason },
              bluesky: blueskyResult.status === 'fulfilled' ? blueskyResult.value : { error: blueskyResult.reason },
              imgur: imgurResult.status === 'fulfilled' ? imgurResult.value : { error: imgurResult.reason }
            },
            totalFound: 0,
            totalProcessed: 0,
            totalApproved: 0,
            errors: []
          }

          // Aggregate results
          Object.values(result.results).forEach((platformResult: any) => {
            if (platformResult && !platformResult.error) {
              result.totalFound += platformResult.totalFound || platformResult.postsFound || 0
              result.totalProcessed += platformResult.processed || platformResult.postsProcessed || 0
              result.totalApproved += platformResult.approved || platformResult.postsApproved || 0
              if (platformResult.errors?.length > 0) {
                result.errors.push(...platformResult.errors)
              }
            }
          })
          break

        case 'pixabay':
        case 'unsplash':
        case 'giphy':
        case 'tumblr':
        case 'lemmy':
          // These platforms would need their scanning services implemented
          throw createApiError(`${platform} scanning not yet implemented`, 501, 'PLATFORM_NOT_IMPLEMENTED')

        default:
          throw createApiError(`Unknown platform: ${platform}`, 400, 'INVALID_PLATFORM')
      }

      await logToDatabase(
        LogLevel.INFO,
        'PLATFORM_SCAN_COMPLETED',
        `${platform} scan completed successfully`,
        { 
          platform, 
          postsProcessed: result.processed || result.totalProcessed || 0,
          postsApproved: result.approved || result.totalApproved || 0
        }
      )

      return createSuccessResponse(
        {
          ...result,
          platform,
          triggeredBy: 'admin_manual',
          triggeredAt: new Date()
        },
        `${platform} scan completed successfully`
      )

    } catch (scanError) {
      await logToDatabase(
        LogLevel.ERROR,
        'PLATFORM_SCAN_ERROR',
        `${platform} scan failed: ${scanError.message}`,
        { 
          platform, 
          error: scanError.message,
          maxPosts,
          options
        }
      )

      throw createApiError(
        `${platform} scan failed: ${scanError.message}`, 
        500, 
        'PLATFORM_SCAN_ERROR'
      )
    }

  } catch (error) {
    console.error('Platform scan request failed:', error)
    
    if (error instanceof Error && 
        (error.message.includes('UNAUTHORIZED') || 
         error.message.includes('MISSING_PLATFORM') ||
         error.message.includes('INVALID_PLATFORM') ||
         error.message.includes('PLATFORM_NOT_IMPLEMENTED'))) {
      throw error
    }
    
    throw createApiError('Failed to initiate platform scan', 500, 'SCAN_REQUEST_ERROR')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['POST'])
    return await scanPlatformHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/platforms/scan')
  }
}