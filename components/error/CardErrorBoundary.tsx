'use client'

import React from 'react'
import ErrorBoundary from './ErrorBoundary'
import { useComponentErrorHandler } from '@/hooks/useClientErrorHandler'

interface CardErrorBoundaryProps {
  children: React.ReactNode
  cardId?: number
  platform?: string
}

export default function CardErrorBoundary({ 
  children, 
  cardId, 
  platform 
}: CardErrorBoundaryProps) {
  const cardName = cardId ? `Card_${cardId}` : 'ContentCard'
  const context = platform ? `${platform} Content Card` : 'Content Card'
  const { handleError } = useComponentErrorHandler(`CardErrorBoundary_${cardName}`)

  return (
    <ErrorBoundary
      name={cardName}
      context={context}
      level="card"
      enableRetry={false} // Cards should skip on error, not retry
      maxRetries={0}
      onError={(error, errorInfo) => {
        handleError(error, `Card ID: ${cardId}, Platform: ${platform}`)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}