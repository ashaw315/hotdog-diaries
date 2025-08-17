import { useCallback } from 'react'

interface ErrorHandlerOptions {
  context?: string
  level?: 'info' | 'warn' | 'error'
  silent?: boolean
  retryable?: boolean
}

interface ErrorReport {
  errorId: string
  timestamp: string
  context: string
  message: string
  stack?: string
  userAgent: string
  url: string
  userId?: string
  sessionId?: string
}

export function useClientErrorHandler() {
  const handleError = useCallback(async (
    error: Error,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      context = 'Unknown Context',
      level = 'error',
      silent = false,
      retryable = false
    } = options

    // Generate unique error ID
    const errorId = `client_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create error report
    const errorReport: ErrorReport = {
      errorId,
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    }

    try {
      // Send to logging endpoint instead of direct database access
      await fetch('/api/client-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          message: `Client Error: ${context}`,
          errorReport
        })
      })
    } catch (logError) {
      if (!silent) {
        console.error('Failed to log error:', logError)
      }
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development' && !silent) {
      console.group(`🚨 Client Error Handler: ${context}`)
      console.error('Error:', error)
      console.error('Error Report:', errorReport)
      console.error('Options:', options)
      console.groupEnd()
    }

    return errorReport
  }, [])

  const handleAsyncError = useCallback(async (
    asyncFn: () => Promise<any>,
    options: ErrorHandlerOptions = {}
  ) => {
    try {
      return await asyncFn()
    } catch (error) {
      const errorReport = await handleError(error as Error, options)
      
      if (options.retryable) {
        // Return a retry function
        return {
          error: error as Error,
          errorReport,
          retry: () => handleAsyncError(asyncFn, { ...options, retryable: false })
        }
      }
      
      throw error
    }
  }, [handleError])

  const safeExecute = useCallback(async <T>(
    fn: () => Promise<T>,
    fallback: T,
    options: ErrorHandlerOptions = {}
  ): Promise<T> => {
    try {
      return await fn()
    } catch (error) {
      await handleError(error as Error, { ...options, silent: true })
      return fallback
    }
  }, [handleError])

  return {
    handleError,
    handleAsyncError,
    safeExecute
  }
}

// Hook for component-level error handling
export function useComponentErrorHandler(componentName: string) {
  const { handleError, handleAsyncError, safeExecute } = useClientErrorHandler()

  const handleComponentError = useCallback((error: Error, additionalContext?: string) => {
    const context = additionalContext 
      ? `${componentName} - ${additionalContext}`
      : componentName

    return handleError(error, { context, level: 'error' })
  }, [handleError, componentName])

  const handleComponentAsyncError = useCallback((
    asyncFn: () => Promise<any>,
    additionalContext?: string
  ) => {
    const context = additionalContext 
      ? `${componentName} - ${additionalContext}`
      : componentName

    return handleAsyncError(asyncFn, { context, level: 'error', retryable: true })
  }, [handleAsyncError, componentName])

  const safeComponentExecute = useCallback(<T>(
    fn: () => Promise<T>,
    fallback: T,
    additionalContext?: string
  ) => {
    const context = additionalContext 
      ? `${componentName} - ${additionalContext}`
      : componentName

    return safeExecute(fn, fallback, { context, level: 'error' })
  }, [safeExecute, componentName])

  return {
    handleError: handleComponentError,
    handleAsyncError: handleComponentAsyncError,
    safeExecute: safeComponentExecute
  }
}