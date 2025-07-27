import { NextRequest, NextResponse } from 'next/server'
import { TwitterService } from '@/lib/services/twitter'
import { 
  withErrorHandling, 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError 
} from '@/lib/api-middleware'

async function statusHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  try {
    const twitterService = new TwitterService()
    const status = await twitterService.getApiStatus()

    return createSuccessResponse(status, 'Twitter API status retrieved successfully')

  } catch (error) {
    if (error.message.includes('Bearer Token is required')) {
      throw createApiError('Twitter API credentials not configured', 503, 'TWITTER_NOT_CONFIGURED')
    }

    throw createApiError(`Failed to get Twitter API status: ${error.message}`, 500, 'TWITTER_STATUS_ERROR')
  }
}

export const GET = withErrorHandling(statusHandler, '/api/admin/twitter/status')