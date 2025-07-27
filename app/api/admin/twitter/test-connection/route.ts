import { NextRequest, NextResponse } from 'next/server'
import { TwitterScanningService } from '@/lib/services/twitter-scanning'
import { 
  withErrorHandling, 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError 
} from '@/lib/api-middleware'

async function testConnectionHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    const scanningService = new TwitterScanningService()
    const result = await scanningService.testConnection()

    if (result.success) {
      return createSuccessResponse(result.details, result.message)
    } else {
      throw createApiError(result.message, 503, 'TWITTER_CONNECTION_FAILED')
    }

  } catch (error) {
    if (error.message.includes('Bearer Token is required')) {
      throw createApiError('Twitter API credentials not configured. Please add your Twitter API keys to environment variables.', 503, 'TWITTER_NOT_CONFIGURED')
    }

    throw createApiError(`Twitter connection test failed: ${error.message}`, 500, 'TWITTER_TEST_ERROR')
  }
}

export const POST = withErrorHandling(testConnectionHandler, '/api/admin/twitter/test-connection')