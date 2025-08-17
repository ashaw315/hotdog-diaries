'use client'

import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorId: string | null
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: React.ComponentType<ErrorFallbackProps>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  enableRetry?: boolean
  maxRetries?: number
  name?: string
  context?: string
  level?: 'feed' | 'card' | 'admin' | 'component'
  showDetails?: boolean
}

export interface ErrorFallbackProps {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  resetError: () => void
  retryCount: number
  maxRetries: number
  enableRetry: boolean
  name?: string
  context?: string
  level: string
  showDetails: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError, name = 'Unknown', context = 'React Component', level = 'component' } = this.props
    
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.setState({
      error,
      errorInfo,
      errorId
    })

    // Log error details
    this.logError(error, errorInfo, errorId)
    
    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Report to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Boundary Caught Error: ${name}`)
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Component Stack:', errorInfo.componentStack)
      console.error('Context:', context)
      console.error('Level:', level)
      console.error('Error ID:', errorId)
      console.groupEnd()
    }
  }

  private async logError(error: Error, errorInfo: React.ErrorInfo, errorId: string) {
    const { name = 'Unknown', context = 'React Component', level = 'component' } = this.props
    
    try {
      const errorDetails = {
        errorId,
        name,
        context,
        level,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        retryCount: this.state.retryCount
      }

      // Send to client error logging endpoint
      await fetch('/api/client-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: `Error Boundary: ${name}`,
          errorReport: errorDetails
        })
      })
    } catch (logError) {
      console.error('Failed to log error to database:', logError)
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: this.state.retryCount + 1
    })
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props
    
    if (this.state.retryCount < maxRetries) {
      // Add a small delay before retrying
      this.retryTimeoutId = setTimeout(() => {
        this.resetError()
      }, 1000)
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    if (this.state.hasError) {
      const { 
        fallback: FallbackComponent, 
        enableRetry = true, 
        maxRetries = 3,
        name,
        context,
        level = 'component',
        showDetails = false
      } = this.props

      const fallbackProps: ErrorFallbackProps = {
        error: this.state.error,
        errorInfo: this.state.errorInfo,
        resetError: this.resetError,
        retryCount: this.state.retryCount,
        maxRetries,
        enableRetry,
        name,
        context,
        level,
        showDetails
      }

      if (FallbackComponent) {
        return <FallbackComponent {...fallbackProps} />
      }

      // Default fallback based on level
      return this.renderDefaultFallback(fallbackProps)
    }

    return this.props.children
  }

  private renderDefaultFallback(props: ErrorFallbackProps) {
    const { level, name, error, retryCount, maxRetries, enableRetry, showDetails } = props

    switch (level) {
      case 'feed':
        return <FeedErrorFallback {...props} />
      case 'card':
        return <CardErrorFallback {...props} />
      case 'admin':
        return <AdminErrorFallback {...props} />
      default:
        return <ComponentErrorFallback {...props} />
    }
  }
}

// Feed-level error fallback
function FeedErrorFallback({ 
  error, 
  resetError, 
  retryCount, 
  maxRetries, 
  enableRetry 
}: ErrorFallbackProps) {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '32px'
    }}>
      <div style={{ maxWidth: '400px' }}>
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>🌭💔</div>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>
          Oops! Our hotdog feed is having issues
        </h1>
        <p style={{ marginBottom: '24px', opacity: 0.9 }}>
          We're having trouble loading the delicious hotdog content. 
          Don't worry, we're working on it!
        </p>
        
        {enableRetry && retryCount < maxRetries && (
          <button
            onClick={resetError}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid white',
              borderRadius: '8px',
              color: 'white',
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              marginRight: '12px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            🔄 Try Again ({retryCount + 1}/{maxRetries})
          </button>
        )}
        
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'white',
            border: 'none',
            borderRadius: '8px',
            color: '#ff6b6b',
            padding: '12px 24px',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)'
          }}
        >
          🔄 Reload Page
        </button>
        
        {retryCount >= maxRetries && (
          <p style={{ marginTop: '16px', fontSize: '14px', opacity: 0.7 }}>
            Maximum retry attempts reached. Please reload the page or try again later.
          </p>
        )}
      </div>
    </div>
  )
}

// Card-level error fallback (minimal, skippable)
function CardErrorFallback({ error, name }: ErrorFallbackProps) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)',
      borderRadius: '12px',
      padding: '40px 20px',
      textAlign: 'center',
      color: '#666',
      minHeight: '200px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px dashed #ccc'
    }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌭❓</div>
      <p style={{ margin: 0, fontSize: '14px' }}>
        Unable to load this hotdog content
      </p>
      <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
        Skipping to next delicious item...
      </p>
    </div>
  )
}

// Admin-level error fallback (detailed for debugging)
function AdminErrorFallback({ 
  error, 
  errorInfo, 
  resetError, 
  retryCount, 
  maxRetries, 
  enableRetry,
  name,
  showDetails = true
}: ErrorFallbackProps) {
  return (
    <div style={{
      background: '#fff3cd',
      border: '1px solid #ffeaa7',
      borderRadius: '8px',
      padding: '20px',
      margin: '16px 0',
      color: '#856404'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '20px', marginRight: '8px' }}>⚠️</span>
        <h3 style={{ margin: 0, color: '#721c24' }}>
          Component Error: {name || 'Unknown Component'}
        </h3>
      </div>
      
      <p style={{ marginBottom: '16px' }}>
        An error occurred while rendering this component. The error has been logged for investigation.
      </p>

      {showDetails && error && (
        <details style={{ marginBottom: '16px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Error Details (Click to expand)
          </summary>
          <div style={{
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            padding: '12px',
            marginTop: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            <strong>Message:</strong> {error.message}
            {error.stack && (
              <>
                <br /><br />
                <strong>Stack Trace:</strong>
                <br />
                {error.stack}
              </>
            )}
            {errorInfo?.componentStack && (
              <>
                <br /><br />
                <strong>Component Stack:</strong>
                <br />
                {errorInfo.componentStack}
              </>
            )}
          </div>
        </details>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {enableRetry && retryCount < maxRetries && (
          <button
            onClick={resetError}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Retry ({retryCount + 1}/{maxRetries})
          </button>
        )}
        
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🔄 Reload Page
        </button>
        
        <span style={{ fontSize: '12px', color: '#6c757d' }}>
          Error ID: {Math.random().toString(36).substr(2, 9)}
        </span>
      </div>
    </div>
  )
}

// Generic component error fallback
function ComponentErrorFallback({ 
  error, 
  resetError, 
  name, 
  retryCount, 
  maxRetries, 
  enableRetry 
}: ErrorFallbackProps) {
  return (
    <div style={{
      background: '#f8d7da',
      border: '1px solid #f5c6cb',
      borderRadius: '8px',
      padding: '16px',
      margin: '8px 0',
      color: '#721c24'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px', marginRight: '8px' }}>❌</span>
        <strong>Component Error</strong>
        {name && <span style={{ marginLeft: '8px', opacity: 0.7 }}>({name})</span>}
      </div>
      
      <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
        This component encountered an error and couldn't render properly.
      </p>
      
      {enableRetry && retryCount < maxRetries && (
        <button
          onClick={resetError}
          style={{
            background: '#721c24',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🔄 Try Again ({retryCount + 1}/{maxRetries})
        </button>
      )}
    </div>
  )
}

export default ErrorBoundary