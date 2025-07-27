import { NextRequest, NextResponse } from 'next/server'
import { 
  withErrorHandling, 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError 
} from '@/lib/api-middleware'
import { ContentService } from '@/lib/services/content'
import { ContentType, SourcePlatform } from '@/types'

async function queueHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '10')
  const orderBy = url.searchParams.get('orderBy') || 'scraped_at'
  const orderDirection = (url.searchParams.get('orderDirection') || 'DESC').toUpperCase() as 'ASC' | 'DESC'

  // Validate pagination parameters
  if (page < 1) {
    throw createApiError('Page number must be greater than 0', 400, 'INVALID_PAGE')
  }

  if (limit < 1 || limit > 100) {
    throw createApiError('Limit must be between 1 and 100', 400, 'INVALID_LIMIT')
  }

  if (!['ASC', 'DESC'].includes(orderDirection)) {
    throw createApiError('Order direction must be either "ASC" or "DESC"', 400, 'INVALID_ORDER')
  }

  // Parse filters
  const filters: any = {}
  
  const contentType = url.searchParams.get('content_type')
  if (contentType && Object.values(ContentType).includes(contentType as ContentType)) {
    filters.content_type = contentType as ContentType
  }

  const sourcePlatform = url.searchParams.get('source_platform')
  if (sourcePlatform && Object.values(SourcePlatform).includes(sourcePlatform as SourcePlatform)) {
    filters.source_platform = sourcePlatform as SourcePlatform
  }

  const isApproved = url.searchParams.get('is_approved')
  if (isApproved !== null) {
    filters.is_approved = isApproved === 'true'
  }

  const author = url.searchParams.get('author')
  if (author) {
    filters.author = author
  }

  try {
    const result = await ContentService.getQueuedContent(
      { page, limit, orderBy, orderDirection },
      filters
    )

    return createSuccessResponse(result, `Found ${result.items.length} queued content items`)
  } catch (error) {
    if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
      // Database not initialized yet
      const emptyResult = {
        items: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      }

      return createSuccessResponse(emptyResult, 'Database not initialized - no content available')
    }

    throw error
  }
}

export const GET = withErrorHandling(queueHandler, '/api/content/queue')