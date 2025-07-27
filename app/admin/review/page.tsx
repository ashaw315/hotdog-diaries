'use client'

import { useState, useEffect } from 'react'
import { ReviewQueue } from '@/components/admin/ReviewQueue'
import { ReviewStats } from '@/components/admin/ReviewStats'

interface ReviewData {
  flaggedContent: Array<{
    id: number
    content_text?: string
    content_image_url?: string
    content_video_url?: string
    content_type: string
    source_platform: string
    original_url: string
    original_author?: string
    is_spam: boolean
    is_inappropriate: boolean
    is_unrelated: boolean
    confidence_score: number
    flagged_patterns: string[]
    flagged_reason: string
    processing_notes: string[]
    created_at: string
    flagged_at: string
  }>
  stats: {
    total_flagged: number
    pending_review: number
    reviewed_today: number
    avg_review_time: number
    approval_rate: number
  }
}

export default function ReviewPage() {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReviewData = async () => {
    try {
      const response = await fetch('/api/admin/review-queue')
      if (!response.ok) {
        throw new Error('Failed to fetch review data')
      }
      const data = await response.json()
      setReviewData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviewData()
  }, [])

  const handleReviewAction = async (contentId: number, action: 'approve' | 'reject', reason?: string, notes?: string) => {
    try {
      const response = await fetch(`/api/admin/content/${contentId}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reason,
          notes
        })
      })

      if (!response.ok) {
        throw new Error('Failed to process review action')
      }

      // Refresh data after successful action
      await fetchReviewData()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleBulkAction = async (contentIds: number[], action: 'approve' | 'reject', reason?: string) => {
    try {
      const response = await fetch('/api/admin/content/bulk-review', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentIds,
          action,
          reason
        })
      })

      if (!response.ok) {
        throw new Error('Failed to process bulk action')
      }

      // Refresh data after successful action
      await fetchReviewData()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchReviewData}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!reviewData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">No review data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Content Review</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Review Queue */}
        <div className="lg:col-span-2">
          <ReviewQueue
            flaggedContent={reviewData.flaggedContent}
            onReviewAction={handleReviewAction}
            onBulkAction={handleBulkAction}
            onRefresh={fetchReviewData}
          />
        </div>
        
        {/* Review Stats */}
        <div>
          <ReviewStats
            stats={reviewData.stats}
            onRefresh={fetchReviewData}
          />
        </div>
      </div>
    </div>
  )
}