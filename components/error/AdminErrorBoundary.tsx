'use client'

import React from 'react'
import ErrorBoundary from './ErrorBoundary'
import { useComponentErrorHandler } from '@/hooks/useClientErrorHandler'

interface AdminErrorBoundaryProps {
  children: React.ReactNode
  section?: string
  showDetails?: boolean
}

export default function AdminErrorBoundary({ 
  children, 
  section = 'Admin Component',
  showDetails = true
}: AdminErrorBoundaryProps) {
  const { handleError } = useComponentErrorHandler(`AdminErrorBoundary_${section}`)

  return (
    <ErrorBoundary
      name={section}
      context="Admin Dashboard"
      level="admin"
      enableRetry={true}
      maxRetries={2}
      showDetails={showDetails}
      onError={(error, errorInfo) => {
        handleError(error, `Admin Section: ${section}, Component Stack: ${errorInfo.componentStack}`)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}