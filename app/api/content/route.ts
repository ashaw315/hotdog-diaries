import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { 
  withErrorHandling, 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError,
  validateJsonBody
} from '@/lib/api-middleware'
import { PostedContent } from '@/types'
import { ContentService } from '@/lib/services/content'
import { validateContent, CreateContentRequest } from '@/lib/validation/content'

async function getContentHandler(request: NextRequest): Promise<NextResponse> {
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
    // Get total count for pagination - include both posted and discovered content
    const countResult = await db.query(`
      SELECT COUNT(*) as total 
      FROM content_queue
      WHERE content_status IN ('posted', 'discovered')
    `)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get paginated content with diverse platform mixing to prevent clustering
    const contentResult = await db.query(`
      WITH ranked_content AS (
        SELECT 
          id,
          content_text,
          content_image_url,
          content_video_url,
          content_type,
          source_platform,
          original_url,
          original_author,
          posted_at,
          scraped_at,
          is_posted,
          is_approved,
          ROW_NUMBER() OVER (PARTITION BY source_platform ORDER BY posted_at ${order.toUpperCase()}) as platform_rank
        FROM content_queue
        WHERE content_status IN ('posted', 'discovered')
        AND (content_text IS NULL OR LENGTH(content_text) <= 200)
      ),
      diverse_content AS (
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY platform_rank, source_platform) as diverse_order
        FROM ranked_content
      )
      SELECT 
        id, content_text, content_image_url, content_video_url, content_type,
        source_platform, original_url, original_author, posted_at, scraped_at,
        is_posted, is_approved
      FROM diverse_content
      ORDER BY diverse_order
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

async function postContentHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['POST'])

  const body = await validateJsonBody<CreateContentRequest>(request)
  
  // Validate the content data
  const validation = validateContent(body)
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')
    throw createApiError(`Validation failed: ${errorMessages}`, 400, 'VALIDATION_ERROR')
  }

  try {
    const newContent = await ContentService.createContent(body)
    return createSuccessResponse(newContent, 'Content created successfully', 201)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Duplicate content')) {
      throw createApiError(error.message, 409, 'DUPLICATE_CONTENT')
    }
    throw error
  }
}

export const GET = withErrorHandling(getContentHandler, '/api/content')
export const POST = withErrorHandling(postContentHandler, '/api/content')