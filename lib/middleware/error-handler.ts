import { NextRequest, NextResponse } from 'next/server'
import { loggingService, LogLevel } from '@/lib/services/logging'
import { v4 as uuidv4 } from 'uuid'

export interface ErrorContext {
  requestId: string
  userId?: string
  sessionId?: string
  path: string
  method: string
  userAgent?: string
  ip?: string
  timestamp: Date
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  DATABASE = 'database',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  EXTERNAL_API = 'external_api',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  INTERNAL = 'internal',
  NOT_FOUND = 'not_found'
}

export interface ApplicationError extends Error {
  category: ErrorCategory
  statusCode: number
  isOperational: boolean
  context?: Record<string, any>
  userId?: string
  requestId?: string
}

export class CustomError extends Error implements ApplicationError {
  public readonly category: ErrorCategory
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, any>
  public readonly userId?: string
  public readonly requestId?: string

  constructor(
    message: string,
    category: ErrorCategory,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>,
    userId?: string,
    requestId?: string
  ) {
    super(message)
    this.name = 'CustomError'
    this.category = category
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    this.userId = userId
    this.requestId = requestId

    // Maintain proper stack trace
    Error.captureStackTrace(this, CustomError)
  }
}

// Specific error classes
export class ValidationError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.VALIDATION, 400, true, context, undefined, requestId)
    this.name = 'ValidationError'
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.DATABASE, 500, true, context, undefined, requestId)
    this.name = 'DatabaseError'
  }
}

export class NetworkError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.NETWORK, 503, true, context, undefined, requestId)
    this.name = 'NetworkError'
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.AUTHENTICATION, 401, true, context, undefined, requestId)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.AUTHORIZATION, 403, true, context, undefined, requestId)
    this.name = 'AuthorizationError'
  }
}

export class ExternalAPIError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.EXTERNAL_API, 502, true, context, undefined, requestId)
    this.name = 'ExternalAPIError'
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.RATE_LIMIT, 429, true, context, undefined, requestId)
    this.name = 'RateLimitError'
  }
}

export class TimeoutError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.TIMEOUT, 504, true, context, undefined, requestId)
    this.name = 'TimeoutError'
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, ErrorCategory.NOT_FOUND, 404, true, context, undefined, requestId)
    this.name = 'NotFoundError'
  }
}

export class ErrorHandlingMiddleware {
  private static instance: ErrorHandlingMiddleware
  private readonly sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'cookie', 'session', 'jwt', 'auth', 'credentials'
  ]

  static getInstance(): ErrorHandlingMiddleware {
    if (!ErrorHandlingMiddleware.instance) {
      ErrorHandlingMiddleware.instance = new ErrorHandlingMiddleware()
    }
    return ErrorHandlingMiddleware.instance
  }

  /**
   * Main error handling middleware for API routes
   */
  async handleError(
    error: Error,
    request: NextRequest,
    context?: Partial<ErrorContext>
  ): Promise<NextResponse> {
    const errorContext = this.buildErrorContext(request, context)
    const categorizedError = this.categorizeError(error, errorContext)

    // Log the error
    await this.logError(categorizedError, errorContext)

    // Generate appropriate response
    return this.generateErrorResponse(categorizedError, errorContext)
  }

  /**
   * Wrapper for API route handlers with automatic error handling
   */
  withErrorHandling<T = any>(
    handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
  ) {
    return async (req: NextRequest, context?: any): Promise<NextResponse<T>> => {
      try {
        return await handler(req, context)
      } catch (error) {
        return this.handleError(error as Error, req, context) as Promise<NextResponse<T>>
      }
    }
  }

  /**
   * Circuit breaker for external API calls
   */
  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    serviceName: string,
    maxFailures: number = 5,
    timeoutMs: number = 30000,
    resetTimeoutMs: number = 60000
  ): Promise<T> {
    const circuitKey = `circuit_${serviceName}`
    const failureKey = `failures_${serviceName}`
    
    // Check circuit state (simplified - in production, use Redis or similar)
    const failures = this.getCircuitFailures(failureKey)
    const lastFailureTime = this.getLastFailureTime(circuitKey)

    // If circuit is open, check if reset timeout has passed
    if (failures >= maxFailures) {
      const timeSinceLastFailure = Date.now() - lastFailureTime
      if (timeSinceLastFailure < resetTimeoutMs) {
        throw new ExternalAPIError(`Circuit breaker open for ${serviceName}`, {
          serviceName,
          failures,
          timeSinceLastFailure,
          resetTimeoutMs
        })
      } else {
        // Reset circuit
        this.resetCircuitBreaker(failureKey, circuitKey)
      }
    }

    try {
      // Add timeout to operation
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
        )
      ])

      // Success - reset failure count
      this.resetCircuitBreaker(failureKey, circuitKey)
      return result

    } catch (error) {
      // Record failure
      this.recordCircuitFailure(failureKey, circuitKey)
      
      if (error instanceof TimeoutError) {
        throw error
      }
      
      throw new ExternalAPIError(`${serviceName} operation failed`, {
        serviceName,
        originalError: error.message
      })
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 10000,
    backoffMultiplier: number = 2
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry for certain error types
        if (error instanceof ValidationError || 
            error instanceof AuthenticationError || 
            error instanceof AuthorizationError ||
            error instanceof NotFoundError) {
          throw error
        }

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(backoffMultiplier, attempt),
          maxDelayMs
        )
        const jitter = Math.random() * 0.1 * delay
        const finalDelay = delay + jitter

        await loggingService.logWarning('ErrorHandlingMiddleware', 
          `Retrying operation (attempt ${attempt + 1}/${maxRetries + 1})`, {
          attempt,
          delay: finalDelay,
          error: error.message
        })

        await new Promise(resolve => setTimeout(resolve, finalDelay))
      }
    }

    throw lastError!
  }

  /**
   * Build error context from request
   */
  private buildErrorContext(request: NextRequest, context?: Partial<ErrorContext>): ErrorContext {
    return {
      requestId: context?.requestId || uuidv4(),
      userId: context?.userId,
      sessionId: context?.sessionId,
      path: request.nextUrl.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.ip || request.headers.get('x-forwarded-for') || undefined,
      timestamp: new Date(),
      ...context
    }
  }

  /**
   * Categorize error based on type and context
   */
  private categorizeError(error: Error, context: ErrorContext): ApplicationError {
    // If already categorized, return as is
    if (error instanceof CustomError) {
      return {
        ...error,
        requestId: context.requestId,
        userId: context.userId
      }
    }

    // Categorize based on error message and type
    const message = error.message.toLowerCase()
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return new TimeoutError(error.message, { originalError: error.name }, context.requestId)
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('econnrefused')) {
      return new NetworkError(error.message, { originalError: error.name }, context.requestId)
    }
    
    if (message.includes('database') || message.includes('query') || message.includes('sql')) {
      return new DatabaseError(error.message, { originalError: error.name }, context.requestId)
    }
    
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return new ValidationError(error.message, { originalError: error.name }, context.requestId)
    }
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return new AuthenticationError(error.message, { originalError: error.name }, context.requestId)
    }
    
    if (message.includes('forbidden') || message.includes('permission')) {
      return new AuthorizationError(error.message, { originalError: error.name }, context.requestId)
    }
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return new RateLimitError(error.message, { originalError: error.name }, context.requestId)
    }
    
    if (message.includes('not found') || message.includes('404')) {
      return new NotFoundError(error.message, { originalError: error.name }, context.requestId)
    }

    // Default to internal error
    return new CustomError(
      error.message,
      ErrorCategory.INTERNAL,
      500,
      false,
      { originalError: error.name, stack: error.stack },
      context.userId,
      context.requestId
    )
  }

  /**
   * Log error with appropriate level and context
   */
  private async logError(error: ApplicationError, context: ErrorContext): Promise<void> {
    const sanitizedContext = this.sanitizeContext(context)
    const metadata = {
      category: error.category,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context,
      requestContext: sanitizedContext,
      userAgent: context.userAgent,
      ip: context.ip
    }

    if (error.statusCode >= 500) {
      await loggingService.logError(
        'ErrorHandlingMiddleware',
        error.message,
        metadata,
        error,
        {
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId
        }
      )
    } else if (error.statusCode >= 400) {
      await loggingService.logWarning(
        'ErrorHandlingMiddleware',
        error.message,
        metadata,
        {
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId
        }
      )
    }
  }

  /**
   * Generate appropriate HTTP error response
   */
  private generateErrorResponse(error: ApplicationError, context: ErrorContext): NextResponse {
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    const errorResponse = {
      error: {
        message: error.message,
        category: error.category,
        requestId: context.requestId,
        timestamp: context.timestamp.toISOString(),
        ...(isDevelopment && {
          stack: error.stack,
          context: error.context
        })
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Request-ID': context.requestId
    }

    // Add rate limit headers if applicable
    if (error instanceof RateLimitError) {
      headers['Retry-After'] = '60'
      headers['X-RateLimit-Remaining'] = '0'
    }

    return NextResponse.json(errorResponse, {
      status: error.statusCode,
      headers
    })
  }

  /**
   * Remove sensitive information from context
   */
  private sanitizeContext(context: any): any {
    if (!context || typeof context !== 'object') {
      return context
    }

    const sanitized = { ...context }
    
    for (const key in sanitized) {
      const lowerKey = key.toLowerCase()
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeContext(sanitized[key])
      }
    }

    return sanitized
  }

  // Simplified circuit breaker state management (in production, use Redis)
  private circuitState = new Map<string, number>()
  private circuitTimestamps = new Map<string, number>()

  private getCircuitFailures(key: string): number {
    return this.circuitState.get(key) || 0
  }

  private getLastFailureTime(key: string): number {
    return this.circuitTimestamps.get(key) || 0
  }

  private recordCircuitFailure(failureKey: string, timestampKey: string): void {
    const current = this.circuitState.get(failureKey) || 0
    this.circuitState.set(failureKey, current + 1)
    this.circuitTimestamps.set(timestampKey, Date.now())
  }

  private resetCircuitBreaker(failureKey: string, timestampKey: string): void {
    this.circuitState.delete(failureKey)
    this.circuitTimestamps.delete(timestampKey)
  }
}

// Export singleton instance
export const errorHandler = ErrorHandlingMiddleware.getInstance()

// Utility function for wrapping async functions
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  component: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      await loggingService.logError(component, `Function ${fn.name} failed`, {
        args: args.length,
        error: error.message
      }, error as Error)
      throw error
    }
  }
}