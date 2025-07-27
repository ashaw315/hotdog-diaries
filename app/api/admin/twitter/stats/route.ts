import { NextRequest, NextResponse } from 'next/server'
import { TwitterScanningService } from '@/lib/services/twitter-scanning'
import { 
  withErrorHandling, 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError 
} from '@/lib/api-middleware'

async function statsHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  try {
    const scanningService = new TwitterScanningService()
    const stats = await scanningService.getScanStats()

    return createSuccessResponse(stats, 'Twitter statistics retrieved successfully')

  } catch (error) {
    throw createApiError(`Failed to get Twitter statistics: ${error.message}`, 500, 'TWITTER_STATS_ERROR')
  }
}

export const GET = withErrorHandling(statsHandler, '/api/admin/twitter/stats')