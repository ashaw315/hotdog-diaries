import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { 
  withErrorHandling, 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError 
} from '@/lib/api-middleware'
import { PostedContent } from '@/types'

async function contentHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '10')
  const order = url.searchParams.get('order') || 'desc'

  // Validate pagination parameters
  if (page < 1) {
    throw createApiError('Page number must be greater than 0', 400, 'INVALID_PAGE')
  }

  if (limit < 1 || limit > 100) {
    throw createApiError('Limit must be between 1 and 100', 400, 'INVALID_LIMIT')
  }

  if (!['asc', 'desc'].includes(order)) {
    throw createApiError('Order must be either "asc" or "desc"', 400, 'INVALID_ORDER')
  }

  const offset = (page - 1) * limit

  try {
    // Get total count for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) as total 
      FROM posted_content_with_details
    `)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get paginated content
    const contentResult = await db.query<PostedContent>(`
      SELECT 
        id,
        content_queue_id,
        posted_at,
        scheduled_time,
        post_order,
        content_text,
        content_image_url,
        content_video_url,
        content_type,
        source_platform,
        original_url,
        original_author,
        scraped_at
      FROM posted_content_with_details
      ORDER BY posted_at ${order.toUpperCase()}
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    const content = contentResult.rows

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    const response = {
      content,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : null,
        previousPage: hasPreviousPage ? page - 1 : null
      }
    }

    const message = content.length > 0 
      ? `Found ${content.length} content items` 
      : 'No content found'

    return createSuccessResponse(response, message)

  } catch (error) {
    if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
      // Database not initialized yet
      const emptyResponse = {
        content: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          nextPage: null,
          previousPage: null
        }
      }

      return createSuccessResponse(emptyResponse, 'Database not initialized - no content available')
    }

    throw error
  }
}

export const GET = withErrorHandling(contentHandler, '/api/content')