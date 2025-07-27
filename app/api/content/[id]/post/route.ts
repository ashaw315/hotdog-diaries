import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError,
  validateJsonBody,
  handleApiError
} from '@/lib/api-middleware'
import { ContentService } from '@/lib/services/content'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface PostContentRequest {
  scheduled_time?: string // ISO string
}

async function postContentHandler(
  request: NextRequest, 
  { params }: RouteContext
): Promise<NextResponse> {
  validateRequestMethod(request, ['PUT'])

  const resolvedParams = await params
  const contentId = parseInt(resolvedParams.id)
  if (isNaN(contentId)) {
    throw createApiError('Invalid content ID', 400, 'INVALID_ID')
  }

  let scheduledTime: Date | undefined
  
  // Parse request body if present
  if (request.headers.get('content-length') !== '0') {
    try {
      const body = await validateJsonBody<PostContentRequest>(request)
      
      if (body.scheduled_time) {
        scheduledTime = new Date(body.scheduled_time)
        if (isNaN(scheduledTime.getTime())) {
          throw createApiError('Invalid scheduled_time format. Use ISO string.', 400, 'INVALID_DATE')
        }
      }
    } catch (error) {
      // If JSON parsing fails, continue without scheduled time
      if (error instanceof Error && !error.message.includes('Invalid JSON')) {
        throw error
      }
    }
  }

  try {
    const result = await ContentService.markAsPosted(contentId, scheduledTime)
    
    return createSuccessResponse(
      {
        content: result.contentQueue,
        posted_content: result.postedContent
      },
      'Content marked as posted successfully'
    )
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw createApiError(error.message, 404, 'CONTENT_NOT_FOUND')
      }
      if (error.message.includes('already posted')) {
        throw createApiError(error.message, 409, 'CONTENT_ALREADY_POSTED')
      }
    }
    throw error
  }
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    return await postContentHandler(request, context)
  } catch (error) {
    return await handleApiError(error, request, '/api/content/[id]/post')
  }
}