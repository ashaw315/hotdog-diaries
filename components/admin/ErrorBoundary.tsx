'use client'

import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class AdminErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Admin Error Boundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <>
          <style jsx>{`
            .error-boundary {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              padding: 40px;
              text-align: center;
              background: white;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              margin: 20px;
            }
            
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            
            .error-title {
              color: #dc2626;
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 12px;
            }
            
            .error-message {
              color: #6b7280;
              font-size: 16px;
              margin-bottom: 8px;
              max-width: 600px;
              line-height: 1.5;
            }
            
            .error-technical {
              color: #9ca3af;
              font-size: 14px;
              font-family: monospace;
              background: #f9fafb;
              padding: 12px;
              border-radius: 6px;
              margin: 16px 0;
              max-width: 600px;
              word-break: break-word;
            }
            
            .error-actions {
              display: flex;
              gap: 12px;
              margin-top: 20px;
            }
            
            .retry-btn {
              padding: 12px 24px;
              background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              transition: all 0.2s ease;
            }
            
            .retry-btn:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            
            .reload-btn {
              padding: 12px 24px;
              background: transparent;
              color: #6b7280;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              transition: all 0.2s ease;
            }
            
            .reload-btn:hover {
              background: #f9fafb;
              border-color: #9ca3af;
            }
          `}</style>
          
          <div className="error-boundary">
            <div className="error-icon">💥</div>
            <h2 className="error-title">Something went wrong</h2>
            <p className="error-message">
              The admin interface encountered an unexpected error. This has been logged for investigation.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="error-technical">
                <strong>Error:</strong> {this.state.error.message}
                <br />
                <strong>Stack:</strong> {this.state.error.stack?.split('\n').slice(0, 3).join('\n')}
              </div>
            )}
            
            <div className="error-actions">
              <button onClick={this.handleRetry} className="retry-btn">
                🔄 Try Again
              </button>
              <button onClick={() => window.location.reload()} className="reload-btn">
                🔃 Reload Page
              </button>
            </div>
          </div>
        </>
      )
    }

    return this.props.children
  }
}

// Functional component wrapper for easier use
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function ErrorBoundaryWrapper(props: P) {
    return (
      <AdminErrorBoundary fallback={fallback}>
        <Component {...props} />
      </AdminErrorBoundary>
    )
  }
}