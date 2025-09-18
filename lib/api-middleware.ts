import { NextRequest, NextResponse } from 'next/server'
import { logToDatabase } from './db'
import { LogLevel } from '@/types'
import { EdgeAuthUtils, JWTPayload } from './auth-edge'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
}

export class HttpError extends Error implements ApiError {
  statusCode: number
  code?: string

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function createApiError(message: string, statusCode: number = 500, code?: string): HttpError {
  return new HttpError(message, statusCode, code)
}

export async function handleApiError(
  error: unknown,
  request: NextRequest,
  endpoint: string
): Promise<NextResponse> {
  let statusCode = 500
  let message = 'Internal Server Error'
  let code = 'INTERNAL_ERROR'

  if (error instanceof HttpError) {
    statusCode = error.statusCode
    message = error.message
    code = error.code || 'HTTP_ERROR'
  } else if (error instanceof Error) {
    message = error.message
    code = 'APPLICATION_ERROR'
  }

  // Log error to database
  try {
    await logToDatabase(
      LogLevel.ERROR,
      `API Error in ${endpoint}: ${message}`,
      'api',
      {
        endpoint,
        statusCode,
        code,
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        stack: error instanceof Error ? error.stack : undefined
      }
    )
  } catch (logError) {
    console.error('Failed to log error to database:', logError)
  }

  // Log to console for development
  if (process.env.NODE_ENV === 'development') {
    console.error(`API Error [${endpoint}]:`, error)
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString()
    },
    { status: statusCode }
  )
}

export function withErrorHandling(
  handler: (request: NextRequest) => Promise<NextResponse>,
  endpoint: string
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request)
    } catch (error) {
      return await handleApiError(error, request, endpoint)
    }
  }
}

export function validateRequestMethod(
  request: NextRequest,
  allowedMethods: string[]
): void {
  if (!allowedMethods.includes(request.method)) {
    throw createApiError(
      `Method ${request.method} not allowed`,
      405,
      'METHOD_NOT_ALLOWED'
    )
  }
}

export function validateContentType(
  request: NextRequest,
  expectedType: string = 'application/json'
): void {
  const contentType = request.headers.get('content-type')
  if (contentType && !contentType.includes(expectedType)) {
    throw createApiError(
      `Invalid content type. Expected ${expectedType}`,
      400,
      'INVALID_CONTENT_TYPE'
    )
  }
}

export async function validateJsonBody<T = any>(request: NextRequest): Promise<T> {
  try {
    const body = await request.json()
    return body as T
  } catch {
    throw createApiError(
      'Invalid JSON in request body',
      400,
      'INVALID_JSON'
    )
  }
}

export function addCorsHeaders(response: NextResponse, origin?: string): NextResponse {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://hotdog-diaries.vercel.app',
    process.env.CORS_ORIGIN
  ].filter(Boolean)

  const requestOrigin = origin || 'http://localhost:3000'
  
  if (allowedOrigins.includes(requestOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin)
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400')

  return response
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export function createSuccessResponse<T = any>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(
    {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    },
    { status }
  )

  return addSecurityHeaders(response)
}

/**
 * Verify admin authentication from request
 */
export async function verifyAdminAuth(request: NextRequest): Promise<{
  success: boolean
  payload?: JWTPayload
  error?: string
}> {
  try {
    const authResult = await EdgeAuthUtils.verifyRequestAuth(request)
    
    if (!authResult.isValid) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    return {
      success: true,
      payload: authResult.payload
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }
  }
}