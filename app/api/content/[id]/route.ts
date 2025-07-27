import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod, 
  createSuccessResponse,
  createApiError,
  validateJsonBody,
  handleApiError
} from '@/lib/api-middleware'
import { ContentService } from '@/lib/services/content'
import { validateContentUpdate, UpdateContentRequest } from '@/lib/validation/content'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function getContentHandler(
  request: NextRequest, 
  { params }: RouteContext
): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  const resolvedParams = await params
  const contentId = parseInt(resolvedParams.id)
  if (isNaN(contentId)) {
    throw createApiError('Invalid content ID', 400, 'INVALID_ID')
  }

  const content = await ContentService.findById(contentId)
  if (!content) {
    throw createApiError('Content not found', 404, 'CONTENT_NOT_FOUND')
  }

  return createSuccessResponse(content, 'Content retrieved successfully')
}

async function updateContentHandler(
  request: NextRequest, 
  { params }: RouteContext
): Promise<NextResponse> {
  validateRequestMethod(request, ['PUT', 'PATCH'])

  const resolvedParams = await params
  const contentId = parseInt(resolvedParams.id)
  if (isNaN(contentId)) {
    throw createApiError('Invalid content ID', 400, 'INVALID_ID')
  }

  const body = await validateJsonBody<UpdateContentRequest>(request)
  
  // Validate the update data
  const validation = validateContentUpdate(body)
  if (!validation.isValid) {
    const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')
    throw createApiError(`Validation failed: ${errorMessages}`, 400, 'VALIDATION_ERROR')
  }

  try {
    const updatedContent = await ContentService.updateContent(contentId, body)
    return createSuccessResponse(updatedContent, 'Content updated successfully')
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw createApiError(error.message, 404, 'CONTENT_NOT_FOUND')
      }
      if (error.message.includes('already posted')) {
        throw createApiError(error.message, 409, 'CONTENT_ALREADY_POSTED')
      }
      if (error.message.includes('Duplicate content')) {
        throw createApiError(error.message, 409, 'DUPLICATE_CONTENT')
      }
    }
    throw error
  }
}

async function deleteContentHandler(
  request: NextRequest, 
  { params }: RouteContext
): Promise<NextResponse> {
  validateRequestMethod(request, ['DELETE'])

  const resolvedParams = await params
  const contentId = parseInt(resolvedParams.id)
  if (isNaN(contentId)) {
    throw createApiError('Invalid content ID', 400, 'INVALID_ID')
  }

  try {
    const deletedContent = await ContentService.deleteContent(contentId)
    return createSuccessResponse(deletedContent, 'Content deleted successfully')
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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    return await getContentHandler(request, context)
  } catch (error) {
    return await handleApiError(error, request, '/api/content/[id]')
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    return await updateContentHandler(request, context)
  } catch (error) {
    return await handleApiError(error, request, '/api/content/[id]')
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    return await updateContentHandler(request, context)
  } catch (error) {
    return await handleApiError(error, request, '/api/content/[id]')
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    return await deleteContentHandler(request, context)
  } catch (error) {
    return await handleApiError(error, request, '/api/content/[id]')
  }
}