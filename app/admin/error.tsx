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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg px-6 py-8">
        <div className="text-center">
          <div className="text-6xl mb-6">⚠️</div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Admin Panel Error
          </h2>
          
          <p className="text-gray-600 mb-6">
            We encountered an error while loading the admin panel. 
            Please try again or contact support if the problem persists.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.href = '/admin'}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Back to Dashboard
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Go to Homepage
            </button>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 font-medium">
                Error Details (Development)
              </summary>
              <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-md">
                <pre className="text-xs text-red-800 overflow-auto whitespace-pre-wrap">
                  <strong>Error:</strong> {error.message}
                  {error.digest && (
                    <>
                      {'\n\n'}<strong>Digest:</strong> {error.digest}
                    </>
                  )}
                  {error.stack && (
                    <>
                      {'\n\n'}<strong>Stack Trace:</strong>
                      {'\n'}{error.stack}
                    </>
                  )}
                </pre>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}