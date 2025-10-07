import { NextResponse } from 'next/server';

/**
 * Shared Error Handler for API Routes
 * 
 * This module provides a simple, standardized error handling function
 * that works in both Edge and Node runtimes. It ensures all API routes
 * have consistent error response structure and logging.
 */

/**
 * Standard error handler for API routes
 * @param error - The error that occurred (Error object, string, or unknown)
 * @param status - HTTP status code (default: 500)
 * @param context - Additional context for debugging (optional)
 * @returns NextResponse with structured JSON error
 */
export function errorHandler(
  error: unknown, 
  status: number = 500,
  context?: Record<string, any>
): NextResponse {
  // Extract error message safely
  const message = error instanceof Error 
    ? error.message 
    : typeof error === 'string'
    ? error
    : 'An unexpected error occurred';

  // Log error with context
  const logMessage = `[API ERROR] ${message}`;
  const logContext = {
    status,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    } : error,
    context,
    timestamp: new Date().toISOString()
  };

  console.error(logMessage, logContext);

  // Return structured error response
  const errorResponse = {
    error: message,
    status,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      details: error instanceof Error ? {
        name: error.name,
        stack: error.stack
      } : error,
      context
    })
  };

  return NextResponse.json(errorResponse, { status });
}

/**
 * Validation error handler for 400 Bad Request responses
 * @param message - Validation error message
 * @param details - Specific validation details (optional)
 * @returns NextResponse with 400 status
 */
export function validationError(message: string, details?: Record<string, any>): NextResponse {
  return errorHandler(message, 400, { validationDetails: details });
}

/**
 * Authentication error handler for 401 Unauthorized responses
 * @param message - Authentication error message (default provided)
 * @returns NextResponse with 401 status
 */
export function authenticationError(message: string = 'Authentication required'): NextResponse {
  return errorHandler(message, 401);
}

/**
 * Authorization error handler for 403 Forbidden responses
 * @param message - Authorization error message (default provided)
 * @returns NextResponse with 403 status
 */
export function authorizationError(message: string = 'Insufficient permissions'): NextResponse {
  return errorHandler(message, 403);
}

/**
 * Not found error handler for 404 responses
 * @param resource - The resource that was not found (optional)
 * @returns NextResponse with 404 status
 */
export function notFoundError(resource?: string): NextResponse {
  const message = resource ? `${resource} not found` : 'Resource not found';
  return errorHandler(message, 404);
}

/**
 * Database error handler for database-related errors
 * @param error - The database error
 * @param operation - The operation that failed (optional)
 * @returns NextResponse with 500 status
 */
export function databaseError(error: unknown, operation?: string): NextResponse {
  const context = operation ? { operation } : undefined;
  return errorHandler(error, 500, context);
}

/**
 * External API error handler for third-party service failures
 * @param error - The external API error
 * @param service - The external service name (optional)
 * @returns NextResponse with 502 status
 */
export function externalApiError(error: unknown, service?: string): NextResponse {
  const context = service ? { externalService: service } : undefined;
  return errorHandler(error, 502, context);
}

/**
 * Wrapper function to automatically handle errors in async API route handlers
 * @param handler - The async route handler function
 * @returns Wrapped handler with automatic error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>
) {
  return async (...args: T): Promise<NextResponse<R>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorHandler(error) as NextResponse<R>;
    }
  };
}

/**
 * Safe async wrapper that catches and handles any thrown errors
 * @param operation - The async operation to execute
 * @param fallbackStatus - HTTP status for unexpected errors (default: 500)
 * @returns Promise that resolves to NextResponse (either success or error)
 */
export async function safeAsync<T>(
  operation: () => Promise<NextResponse<T>>,
  fallbackStatus: number = 500
): Promise<NextResponse<T>> {
  try {
    return await operation();
  } catch (error) {
    return errorHandler(error, fallbackStatus) as NextResponse<T>;
  }
}

// Default export for convenience
export default errorHandler;