/**
 * API Deprecation Utilities
 * Provides deprecation warnings, logging, and redirection for legacy endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface DeprecationConfig {
  endpoint: string
  replacementEndpoint: string
  replacementMethod?: string
  deprecatedSince: string
  removalDate: string
  redirectHandler?: (request: NextRequest) => Promise<NextResponse>
}

/**
 * Mapping of deprecated endpoints to their new consolidated replacements
 */
export const DEPRECATED_ENDPOINTS: Record<string, DeprecationConfig> = {
  // Authentication endpoints
  '/api/admin/login': {
    endpoint: '/api/admin/login',
    replacementEndpoint: '/api/admin/auth',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/simple-login': {
    endpoint: '/api/admin/simple-login',
    replacementEndpoint: '/api/admin/auth',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/test-login': {
    endpoint: '/api/admin/test-login',
    replacementEndpoint: '/api/admin/auth',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/logout': {
    endpoint: '/api/admin/logout',
    replacementEndpoint: '/api/admin/auth',
    replacementMethod: 'DELETE',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/refresh': {
    endpoint: '/api/admin/refresh',
    replacementEndpoint: '/api/admin/auth/refresh',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/me': {
    endpoint: '/api/admin/me',
    replacementEndpoint: '/api/admin/auth/me',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },

  // Content management endpoints
  '/api/admin/content/queue': {
    endpoint: '/api/admin/content/queue',
    replacementEndpoint: '/api/admin/content?status=pending',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/content/simple-queue': {
    endpoint: '/api/admin/content/simple-queue',
    replacementEndpoint: '/api/admin/content?simple=true',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/content/posted': {
    endpoint: '/api/admin/content/posted',
    replacementEndpoint: '/api/admin/content?status=posted',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/content/bulk-review': {
    endpoint: '/api/admin/content/bulk-review',
    replacementEndpoint: '/api/admin/content/bulk',
    replacementMethod: 'PATCH',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/content/bulk-schedule': {
    endpoint: '/api/admin/content/bulk-schedule',
    replacementEndpoint: '/api/admin/content/bulk',
    replacementMethod: 'PATCH',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },

  // Platform scanning endpoints
  '/api/admin/reddit/scan': {
    endpoint: '/api/admin/reddit/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/youtube/scan': {
    endpoint: '/api/admin/youtube/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/bluesky/scan': {
    endpoint: '/api/admin/bluesky/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/giphy/scan': {
    endpoint: '/api/admin/giphy/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/pixabay/scan': {
    endpoint: '/api/admin/pixabay/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/imgur/scan': {
    endpoint: '/api/admin/imgur/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/lemmy/scan': {
    endpoint: '/api/admin/lemmy/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/tumblr/scan': {
    endpoint: '/api/admin/tumblr/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-all': {
    endpoint: '/api/admin/scan-all',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-reddit-now': {
    endpoint: '/api/admin/scan-reddit-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-youtube-now': {
    endpoint: '/api/admin/scan-youtube-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-bluesky-now': {
    endpoint: '/api/admin/scan-bluesky-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-giphy-now': {
    endpoint: '/api/admin/scan-giphy-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-pixabay-now': {
    endpoint: '/api/admin/scan-pixabay-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/social/scan-all': {
    endpoint: '/api/admin/social/scan-all',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/youtube/scan': {
    endpoint: '/api/admin/youtube/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/bluesky/scan': {
    endpoint: '/api/admin/bluesky/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/imgur/scan': {
    endpoint: '/api/admin/imgur/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/giphy/scan': {
    endpoint: '/api/admin/giphy/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/pixabay/scan': {
    endpoint: '/api/admin/pixabay/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/unsplash/scan': {
    endpoint: '/api/admin/unsplash/scan',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-reddit-now': {
    endpoint: '/api/admin/scan-reddit-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-youtube-now': {
    endpoint: '/api/admin/scan-youtube-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-bluesky-now': {
    endpoint: '/api/admin/scan-bluesky-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-imgur-now': {
    endpoint: '/api/admin/scan-imgur-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-giphy-now': {
    endpoint: '/api/admin/scan-giphy-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-pixabay-now': {
    endpoint: '/api/admin/scan-pixabay-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-lemmy-now': {
    endpoint: '/api/admin/scan-lemmy-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-tumblr-now': {
    endpoint: '/api/admin/scan-tumblr-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-mastodon-now': {
    endpoint: '/api/admin/scan-mastodon-now',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/social/scan-all': {
    endpoint: '/api/admin/social/scan-all',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/scan-all': {
    endpoint: '/api/admin/scan-all',
    replacementEndpoint: '/api/admin/platforms/scan',
    replacementMethod: 'POST',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },

  // Dashboard and analytics endpoints
  '/api/admin/dashboard/stats': {
    endpoint: '/api/admin/dashboard/stats',
    replacementEndpoint: '/api/admin/dashboard',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/dashboard/activity': {
    endpoint: '/api/admin/dashboard/activity',
    replacementEndpoint: '/api/admin/dashboard?view=activity',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/metrics/performance': {
    endpoint: '/api/admin/metrics/performance',
    replacementEndpoint: '/api/admin/analytics?type=performance',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  },
  '/api/admin/metrics/summary': {
    endpoint: '/api/admin/metrics/summary',
    replacementEndpoint: '/api/admin/analytics?type=summary',
    replacementMethod: 'GET',
    deprecatedSince: '2025-09-17',
    removalDate: '2025-10-15'
  }
}

/**
 * Add deprecation headers and warnings to a response
 */
export function addDeprecationHeaders(
  response: NextResponse,
  config: DeprecationConfig
): NextResponse {
  const deprecationMessage = `Endpoint deprecated since ${config.deprecatedSince}. Use ${config.replacementMethod} ${config.replacementEndpoint} instead. Will be removed on ${config.removalDate}.`
  
  // Add standard deprecation headers
  response.headers.set('Deprecated', 'true')
  response.headers.set('Sunset', config.removalDate)
  response.headers.set('Warning', `299 - "Deprecated API" "${deprecationMessage}"`)
  response.headers.set('X-API-Deprecation-Info', JSON.stringify({
    deprecated: true,
    deprecatedSince: config.deprecatedSince,
    removalDate: config.removalDate,
    replacement: {
      endpoint: config.replacementEndpoint,
      method: config.replacementMethod
    }
  }))

  return response
}

/**
 * Log deprecation usage for monitoring
 */
export async function logDeprecationUsage(
  request: NextRequest,
  config: DeprecationConfig
): Promise<void> {
  try {
    const userAgent = request.headers.get('user-agent') || 'Unknown'
    const referer = request.headers.get('referer') || 'Direct'
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'Unknown'

    await logToDatabase(
      LogLevel.WARNING,
      'DEPRECATED_ENDPOINT_USAGE',
      `Deprecated endpoint ${config.endpoint} was accessed`,
      {
        deprecatedEndpoint: config.endpoint,
        replacementEndpoint: config.replacementEndpoint,
        replacementMethod: config.replacementMethod,
        deprecatedSince: config.deprecatedSince,
        removalDate: config.removalDate,
        userAgent,
        referer,
        clientIP,
        timestamp: new Date().toISOString()
      }
    )
  } catch (error) {
    console.error('Failed to log deprecation usage:', error)
  }
}

/**
 * Main deprecation middleware function
 */
export async function handleDeprecatedEndpoint(
  request: NextRequest,
  endpoint: string,
  originalHandler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const config = DEPRECATED_ENDPOINTS[endpoint]
  
  if (!config) {
    // Not a tracked deprecated endpoint, just run original handler
    return await originalHandler(request)
  }

  // Log the deprecation usage
  await logDeprecationUsage(request, config)

  // Console warning for development
  if (process.env.NODE_ENV === 'development') {
    console.warn(`🚨 DEPRECATED API USAGE: ${endpoint}`)
    console.warn(`   ↳ Use ${config.replacementMethod} ${config.replacementEndpoint} instead`)
    console.warn(`   ↳ Will be removed on ${config.removalDate}`)
  }

  // If there's a custom redirect handler, use it
  if (config.redirectHandler) {
    const response = await config.redirectHandler(request)
    return addDeprecationHeaders(response, config)
  }

  // Otherwise, run the original handler and add deprecation headers
  const response = await originalHandler(request)
  return addDeprecationHeaders(response, config)
}

/**
 * Create a wrapped handler for deprecated endpoints
 */
export function createDeprecatedHandler(
  endpoint: string,
  originalHandler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    return await handleDeprecatedEndpoint(request, endpoint, originalHandler)
  }
}

/**
 * Extract platform from legacy platform scan endpoints
 */
export function extractPlatformFromLegacyEndpoint(endpoint: string): string | null {
  const platformMatches = {
    '/api/admin/reddit/scan': 'reddit',
    '/api/admin/youtube/scan': 'youtube', 
    '/api/admin/bluesky/scan': 'bluesky',
    '/api/admin/imgur/scan': 'imgur',
    '/api/admin/giphy/scan': 'giphy',
    '/api/admin/pixabay/scan': 'pixabay',
    '/api/admin/unsplash/scan': 'unsplash',
    '/api/admin/scan-reddit-now': 'reddit',
    '/api/admin/scan-youtube-now': 'youtube',
    '/api/admin/scan-bluesky-now': 'bluesky',
    '/api/admin/scan-imgur-now': 'imgur',
    '/api/admin/scan-giphy-now': 'giphy',
    '/api/admin/scan-pixabay-now': 'pixabay',
    '/api/admin/scan-lemmy-now': 'lemmy',
    '/api/admin/scan-tumblr-now': 'tumblr',
    '/api/admin/scan-mastodon-now': 'mastodon',
    '/api/admin/social/scan-all': 'all',
    '/api/admin/scan-all': 'all'
  }
  
  return platformMatches[endpoint] || null
}

/**
 * Create redirect handler for platform scan endpoints
 */
export function createPlatformScanRedirectHandler(platform: string) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Extract request body for POST requests
      let body: any = {}
      if (request.method === 'POST') {
        try {
          body = await request.json()
        } catch {
          body = {}
        }
      }

      // Create new request to consolidated endpoint
      const consolidatedEndpoint = '/api/admin/platforms/scan'
      const newBody = {
        platform,
        maxPosts: body.maxPosts || 25,
        options: body.options || {}
      }

      // Forward to consolidated handler
      const { POST } = await import('@/app/api/admin/platforms/scan/route')
      const newRequest = new NextRequest(
        new URL(consolidatedEndpoint, request.url),
        {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify(newBody)
        }
      )

      return await POST(newRequest)
    } catch (error) {
      console.error(`Error redirecting ${platform} scan:`, error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to redirect to consolidated endpoint',
          deprecated: true 
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Get deprecation statistics
 */
export async function getDeprecationStats(): Promise<{
  totalDeprecatedEndpoints: number
  endpointsByCategory: Record<string, number>
  removalDate: string
}> {
  const endpoints = Object.values(DEPRECATED_ENDPOINTS)
  
  const categories = endpoints.reduce((acc, config) => {
    let category = 'Other'
    
    if (config.endpoint.includes('/auth') || config.endpoint.includes('/login')) {
      category = 'Authentication'
    } else if (config.endpoint.includes('/content')) {
      category = 'Content Management' 
    } else if (config.endpoint.includes('/scan') || config.endpoint.includes('/platform')) {
      category = 'Platform Scanning'
    } else if (config.endpoint.includes('/dashboard') || config.endpoint.includes('/metrics')) {
      category = 'Analytics'
    }
    
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalDeprecatedEndpoints: endpoints.length,
    endpointsByCategory: categories,
    removalDate: endpoints[0]?.removalDate || '2025-10-15'
  }
}