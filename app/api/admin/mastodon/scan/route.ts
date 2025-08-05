import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { mastodonScanningService } from '@/lib/services/mastodon-scanning'

async function startMastodonScanHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  try {
    const { searchParams } = new URL(request.url)
    const isTestScan = searchParams.get('test') === 'true'

    let scanResult
    
    if (isTestScan) {
      console.log('Starting Mastodon test scan...')
      scanResult = await mastodonScanningService.testScan()
    } else {
      console.log('Starting Mastodon full scan...')
      scanResult = await mastodonScanningService.performScan()
    }

    const message = isTestScan 
      ? `Test scan completed: ${scanResult.postsProcessed}/${scanResult.postsFound} posts processed`
      : `Scan completed: ${scanResult.postsProcessed}/${scanResult.postsFound} posts processed`

    return createSuccessResponse(scanResult, message)

  } catch (error) {
    console.error('Mastodon scan failed:', error)
    
    if (error instanceof Error && error.message.includes('already in progress')) {
      throw createApiError('Scan already in progress', 409, 'SCAN_IN_PROGRESS')
    }
    
    throw createApiError('Failed to start Mastodon scan', 500, 'MASTODON_SCAN_ERROR')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await startMastodonScanHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/mastodon/scan')
  }
}