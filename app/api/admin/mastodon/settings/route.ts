import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { mastodonService } from '@/lib/services/mastodon'

async function getMastodonSettingsHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  try {
    const config = await mastodonService.getConfig()
    return createSuccessResponse(config, 'Mastodon settings retrieved successfully')

  } catch (error) {
    console.error('Failed to get Mastodon settings:', error)
    throw createApiError('Failed to retrieve Mastodon settings', 500, 'MASTODON_SETTINGS_ERROR')
  }
}

async function updateMastodonSettingsHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['PUT'])

  try {
    const body = await request.json()
    
    // Validate the configuration updates
    if (body.scanIntervalMinutes && (body.scanIntervalMinutes < 5 || body.scanIntervalMinutes > 1440)) {
      throw createApiError('Scan interval must be between 5 and 1440 minutes', 400, 'INVALID_SCAN_INTERVAL')
    }

    if (body.maxPostsPerScan && (body.maxPostsPerScan < 1 || body.maxPostsPerScan > 200)) {
      throw createApiError('Max posts per scan must be between 1 and 200', 400, 'INVALID_MAX_POSTS')
    }

    if (body.minEngagementThreshold && body.minEngagementThreshold < 0) {
      throw createApiError('Min engagement threshold cannot be negative', 400, 'INVALID_ENGAGEMENT_THRESHOLD')
    }

    // Validate instances if provided
    if (body.instances) {
      for (const instance of body.instances) {
        if (!instance.domain || !instance.name) {
          throw createApiError('Each instance must have a domain and name', 400, 'INVALID_INSTANCE')
        }
        
        // Basic domain validation
        if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(instance.domain)) {
          throw createApiError(`Invalid domain format: ${instance.domain}`, 400, 'INVALID_DOMAIN')
        }
      }
    }

    // Validate search terms
    if (body.searchTerms) {
      if (!Array.isArray(body.searchTerms) || body.searchTerms.length === 0) {
        throw createApiError('Search terms must be a non-empty array', 400, 'INVALID_SEARCH_TERMS')
      }
      
      for (const term of body.searchTerms) {
        if (typeof term !== 'string' || term.trim().length === 0) {
          throw createApiError('Each search term must be a non-empty string', 400, 'INVALID_SEARCH_TERM')
        }
      }
    }

    // Validate hashtags
    if (body.hashtagsToTrack) {
      if (!Array.isArray(body.hashtagsToTrack)) {
        throw createApiError('Hashtags to track must be an array', 400, 'INVALID_HASHTAGS')
      }
      
      for (const hashtag of body.hashtagsToTrack) {
        if (typeof hashtag !== 'string' || hashtag.trim().length === 0) {
          throw createApiError('Each hashtag must be a non-empty string', 400, 'INVALID_HASHTAG')
        }
      }
    }

    await mastodonService.updateConfig(body)
    const updatedConfig = await mastodonService.getConfig()

    return createSuccessResponse(updatedConfig, 'Mastodon settings updated successfully')

  } catch (error) {
    if (error instanceof Error && error.message.includes('INVALID_')) {
      throw error
    }
    
    console.error('Failed to update Mastodon settings:', error)
    throw createApiError('Failed to update Mastodon settings', 500, 'MASTODON_SETTINGS_UPDATE_ERROR')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await getMastodonSettingsHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/mastodon/settings')
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    return await updateMastodonSettingsHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/mastodon/settings')
  }
}