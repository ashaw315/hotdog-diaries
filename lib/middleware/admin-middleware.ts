import { NextRequest, NextResponse } from 'next/server'
import { ulid } from 'ulid'

export interface AdminRequestContext {
  requestId: string
  startTime: number
  path: string
  method: string
}

export interface AdminMiddlewareOptions {
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number
  /** Whether to log requests (default: true) */
  enableLogging?: boolean
  /** Additional headers to add to responses */
  additionalHeaders?: Record<string, string>
}

export interface AdminErrorResponse {
  ok: false
  code: string
  message: string
  rid: string
  timestamp: string
}

export interface StructuredLogEntry {
  rid: string
  path: string
  method: string
  status: number
  duration_ms: number
  timestamp: string
  error?: string
  user_agent?: string
  ip?: string
}

/**
 * Creates structured log entry for admin requests
 */
export function createStructuredLog(
  context: AdminRequestContext,
  response: NextResponse | { status: number },
  error?: Error | string
): StructuredLogEntry {
  const duration_ms = Date.now() - context.startTime
  
  return {
    rid: context.requestId,
    path: context.path,
    method: context.method,
    status: response.status,
    duration_ms,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : error,
    // Note: user_agent and ip would be extracted from request headers in real implementation
  }
}

/**
 * Logs structured admin request data
 */
export function logAdminRequest(logEntry: StructuredLogEntry): void {
  const logLevel = logEntry.status >= 500 ? 'error' : 
                   logEntry.status >= 400 ? 'warn' : 
                   'info'
  
  const message = `[ADMIN] ${logEntry.method} ${logEntry.path} ${logEntry.status} ${logEntry.duration_ms}ms`
  
  if (logLevel === 'error') {
    console.error(message, logEntry)
  } else if (logLevel === 'warn') {
    console.warn(message, logEntry)
  } else {
    console.log(message, logEntry)
  }
}

/**
 * Creates timeout handler for admin requests
 */
export function createTimeoutHandler(
  requestId: string,
  timeoutMs: number
): { timeoutId: NodeJS.Timeout; clearTimeout: () => void } {
  let timeoutId: NodeJS.Timeout
  let isCleared = false
  
  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (!isCleared) {
        const error = new Error(`Request timeout after ${timeoutMs}ms`)
        error.name = 'RequestTimeoutError'
        reject(error)
      }
    }, timeoutMs)
  })
  
  const clearTimeoutFn = () => {
    isCleared = true
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
  
  return {
    timeoutId,
    clearTimeout: clearTimeoutFn
  }
}

/**
 * Creates standardized error response for admin endpoints
 */
export function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  status: number = 500
): NextResponse {
  const errorResponse: AdminErrorResponse = {
    ok: false,
    code,
    message,
    rid: requestId,
    timestamp: new Date().toISOString()
  }
  
  return NextResponse.json(errorResponse, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Main admin middleware wrapper for route handlers
 */
export function withAdminMiddleware<T extends any[]>(
  handler: (request: NextRequest, context: AdminRequestContext, ...args: T) => Promise<NextResponse>,
  options: AdminMiddlewareOptions = {}
) {
  const {
    timeoutMs = 10000,
    enableLogging = true,
    additionalHeaders = {}
  } = options
  
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Create request context
    const requestId = ulid()
    const startTime = Date.now()
    const path = new URL(request.url).pathname
    const method = request.method
    
    const context: AdminRequestContext = {
      requestId,
      startTime,
      path,
      method
    }
    
    // Set up timeout handling
    const { clearTimeout: clearTimeoutFn } = createTimeoutHandler(requestId, timeoutMs)
    
    try {
      // Create a race between the handler and timeout
      const handlerPromise = handler(request, context, ...args)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeoutMs}ms`))
        }, timeoutMs)
      })
      
      // Wait for either completion or timeout
      const response = await Promise.race([handlerPromise, timeoutPromise])
      
      // Clear timeout on successful completion
      clearTimeoutFn()
      
      // Add standard admin headers
      const headers = {
        'X-Request-ID': requestId,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        ...additionalHeaders
      }
      
      // Clone response to add headers
      const responseWithHeaders = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...headers
        }
      })
      
      // Log successful request
      if (enableLogging) {
        const logEntry = createStructuredLog(context, responseWithHeaders)
        logAdminRequest(logEntry)
      }
      
      return responseWithHeaders
      
    } catch (error) {
      clearTimeoutFn()
      
      // Handle timeout specifically
      if (error instanceof Error && 
          (error.message.includes('timeout') || error.name === 'RequestTimeoutError')) {
        
        const timeoutResponse = createErrorResponse(
          'TIMEOUT',
          `Request timed out after ${timeoutMs}ms`,
          requestId,
          504
        )
        
        if (enableLogging) {
          const logEntry = createStructuredLog(context, timeoutResponse, error)
          logAdminRequest(logEntry)
        }
        
        return timeoutResponse
      }
      
      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorResponse = createErrorResponse(
        'INTERNAL_ERROR',
        errorMessage,
        requestId,
        500
      )
      
      if (enableLogging) {
        const logEntry = createStructuredLog(context, errorResponse, error)
        logAdminRequest(logEntry)
      }
      
      return errorResponse
    }
  }
}

/**
 * Simpler middleware for basic request tracking without timeout handling
 */
export function withRequestTracking<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  options: Pick<AdminMiddlewareOptions, 'enableLogging' | 'additionalHeaders'> = {}
) {
  const { enableLogging = true, additionalHeaders = {} } = options
  
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const requestId = ulid()
    const startTime = Date.now()
    const path = new URL(request.url).pathname
    const method = request.method
    
    try {
      const response = await handler(request, ...args)
      
      // Add request ID header
      const responseWithHeaders = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'X-Request-ID': requestId,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          ...additionalHeaders
        }
      })
      
      // Log request
      if (enableLogging) {
        const context: AdminRequestContext = { requestId, startTime, path, method }
        const logEntry = createStructuredLog(context, responseWithHeaders)
        logAdminRequest(logEntry)
      }
      
      return responseWithHeaders
      
    } catch (error) {
      if (enableLogging) {
        const context: AdminRequestContext = { requestId, startTime, path, method }
        const errorResponse = { status: 500 }
        const logEntry = createStructuredLog(context, errorResponse, error)
        logAdminRequest(logEntry)
      }
      
      throw error
    }
  }
}