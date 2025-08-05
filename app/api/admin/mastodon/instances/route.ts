import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { mastodonService } from '@/lib/services/mastodon'
import { mastodonMonitoringService } from '@/lib/services/mastodon-monitoring'

async function getMastodonInstancesHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  try {
    const instanceStats = await mastodonService.getInstanceStats()
    return createSuccessResponse(instanceStats, 'Mastodon instances retrieved successfully')

  } catch (error) {
    console.error('Failed to get Mastodon instances:', error)
    throw createApiError('Failed to retrieve Mastodon instances', 500, 'MASTODON_INSTANCES_ERROR')
  }
}

async function testMastodonInstanceHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    const body = await request.json()
    const { domain } = body

    if (!domain) {
      throw createApiError('Domain is required', 400, 'MISSING_DOMAIN')
    }

    // Basic domain validation
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      throw createApiError('Invalid domain format', 400, 'INVALID_DOMAIN')
    }

    const testResult = await mastodonMonitoringService.testInstanceConnection(domain)

    return createSuccessResponse(testResult, `Instance connection test completed for ${domain}`)

  } catch (error) {
    if (error instanceof Error && error.message.includes('INVALID_DOMAIN')) {
      throw error
    }
    
    console.error('Failed to test Mastodon instance:', error)
    throw createApiError('Failed to test instance connection', 500, 'MASTODON_INSTANCE_TEST_ERROR')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await getMastodonInstancesHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/mastodon/instances')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await testMastodonInstanceHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/mastodon/instances')
  }
}