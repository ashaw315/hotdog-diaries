import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { mastodonMonitoringService } from '@/lib/services/mastodon-monitoring'

async function getMastodonStatusHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  try {
    const systemHealth = await mastodonMonitoringService.getSystemHealth()
    const healthSummary = await mastodonMonitoringService.getHealthSummary()

    const statusData = {
      ...systemHealth,
      summary: healthSummary
    }

    return createSuccessResponse(statusData, 'Mastodon status retrieved successfully')

  } catch (error) {
    console.error('Failed to get Mastodon status:', error)
    throw createApiError('Failed to retrieve Mastodon status', 500, 'MASTODON_STATUS_ERROR')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await getMastodonStatusHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/mastodon/status')
  }
}