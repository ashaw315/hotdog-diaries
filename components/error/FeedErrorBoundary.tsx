'use client'

import React from 'react'
import ErrorBoundary from './ErrorBoundary'
import { useComponentErrorHandler } from '@/hooks/useClientErrorHandler'

interface FeedErrorBoundaryProps {
  children: React.ReactNode
  name?: string
}

export default function FeedErrorBoundary({ children, name = 'Feed' }: FeedErrorBoundaryProps) {
  const { handleError } = useComponentErrorHandler(`FeedErrorBoundary_${name}`)

  return (
    <ErrorBoundary
      name={name}
      context="Feed Component"
      level="feed"
      enableRetry={true}
      maxRetries={3}
      onError={(error, errorInfo) => {
        handleError(error, `Component Stack: ${errorInfo.componentStack}`)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}