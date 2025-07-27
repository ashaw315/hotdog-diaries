import { NextRequest, NextResponse } from 'next/server'
import { TwitterScanningService } from '@/lib/services/twitter-scanning'
import { 
  withErrorHandling, 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError,
  validateJsonBody 
} from '@/lib/api-middleware'

interface TwitterConfigRequest {
  isEnabled: boolean
  scanInterval: number
  maxTweetsPerScan: number
  searchQueries: string[]
  excludeRetweets: boolean
  excludeReplies: boolean
  minEngagementThreshold: number
}

async function getSettingsHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  try {
    const scanningService = new TwitterScanningService()
    const config = await scanningService.getScanConfig()

    return createSuccessResponse(config, 'Twitter settings retrieved successfully')

  } catch (error) {
    throw createApiError(`Failed to get Twitter settings: ${error.message}`, 500, 'TWITTER_SETTINGS_GET_ERROR')
  }
}

async function updateSettingsHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['PUT'])

  const body = await validateJsonBody<TwitterConfigRequest>(request)

  // Validate configuration
  if (body.scanInterval < 5 || body.scanInterval > 1440) {
    throw createApiError('Scan interval must be between 5 and 1440 minutes', 400, 'INVALID_SCAN_INTERVAL')
  }

  if (body.maxTweetsPerScan < 10 || body.maxTweetsPerScan > 100) {
    throw createApiError('Max tweets per scan must be between 10 and 100', 400, 'INVALID_MAX_TWEETS')
  }

  if (body.minEngagementThreshold < 0) {
    throw createApiError('Minimum engagement threshold cannot be negative', 400, 'INVALID_ENGAGEMENT_THRESHOLD')
  }

  if (!Array.isArray(body.searchQueries) || body.searchQueries.length === 0) {
    throw createApiError('At least one search query is required', 400, 'INVALID_SEARCH_QUERIES')
  }

  // Validate search queries
  for (const query of body.searchQueries) {
    if (!query.trim()) {
      throw createApiError('Search queries cannot be empty', 400, 'EMPTY_SEARCH_QUERY')
    }
    if (query.length > 500) {
      throw createApiError('Search queries cannot exceed 500 characters', 400, 'QUERY_TOO_LONG')
    }
  }

  try {
    const scanningService = new TwitterScanningService()
    await scanningService.updateScanConfig(body)

    // If scanning was enabled, start automated scanning
    if (body.isEnabled) {
      await scanningService.startAutomatedScanning()
    } else {
      await scanningService.stopAutomatedScanning()
    }

    return createSuccessResponse(body, 'Twitter settings updated successfully')

  } catch (error) {
    throw createApiError(`Failed to update Twitter settings: ${error.message}`, 500, 'TWITTER_SETTINGS_UPDATE_ERROR')
  }
}

export const GET = withErrorHandling(getSettingsHandler, '/api/admin/twitter/settings')
export const PUT = withErrorHandling(updateSettingsHandler, '/api/admin/twitter/settings')