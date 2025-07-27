import { NextRequest, NextResponse } from 'next/server'
import { TwitterScanningService } from '@/lib/services/twitter-scanning'
import { 
  withErrorHandling, 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError 
} from '@/lib/api-middleware'

async function scanHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    const scanningService = new TwitterScanningService()
    
    // Check if scanning is enabled
    const config = await scanningService.getScanConfig()
    if (!config.isEnabled) {
      throw createApiError('Twitter scanning is disabled', 400, 'TWITTER_SCANNING_DISABLED')
    }

    // Test connection first
    const connectionTest = await scanningService.testConnection()
    if (!connectionTest.success) {
      throw createApiError(`Twitter API connection failed: ${connectionTest.message}`, 503, 'TWITTER_CONNECTION_FAILED')
    }

    // Perform scan
    const result = await scanningService.performScan()

    return createSuccessResponse(result, 'Twitter scan completed successfully')

  } catch (error) {
    if (error.message.includes('Scan already in progress')) {
      throw createApiError('A scan is already in progress', 409, 'SCAN_IN_PROGRESS')
    }

    if (error.message.includes('Rate limit')) {
      throw createApiError('Twitter API rate limit exceeded. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    throw createApiError(`Twitter scan failed: ${error.message}`, 500, 'TWITTER_SCAN_ERROR')
  }
}

export const POST = withErrorHandling(scanHandler, '/api/admin/twitter/scan')