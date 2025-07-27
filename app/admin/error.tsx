'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Admin panel error:', error)
  }, [error])

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-6xl mb-6">⚠️</div>
        
        <h2 className="text-2xl font-bold text-primary mb-4">
          Admin Panel Error
        </h2>
        
        <p className="text-text opacity-75 mb-6">
          We encountered an error while loading the admin panel. 
          Please try again or contact support if the problem persists.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:opacity-80 transition-opacity max-w-xs mx-auto"
          >
            Retry Admin Panel
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-6 py-3 border border-border text-text rounded-lg hover:bg-gray-50 transition-colors max-w-xs mx-auto"
          >
            Go to Homepage
          </button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left max-w-lg mx-auto">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Error Details (Development)
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
              {error.message}
              {error.stack && (
                <>
                  {'\n\n'}
                  {error.stack}
                </>
              )}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}