'use client'

import { useState, useEffect } from 'react'

interface ReviewContent {
  id: number
  content_text: string | null
  content_image_url: string | null
  content_video_url: string | null
  content_type: string
  source_platform: string
  original_url: string
  original_author: string | null
  scraped_at: string
  content_status: 'pending_review'
  created_at: string
  confidence_score: number | null
  is_spam: boolean | null
  is_inappropriate: boolean | null
  is_unrelated: boolean | null
  is_valid_hotdog: boolean | null
}

export default function ReviewPage() {
  const [reviewContent, setReviewContent] = useState<ReviewContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewStats, setReviewStats] = useState({
    totalPending: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0
  })

  useEffect(() => {
    fetchReviewContent()
  }, [])

  const fetchReviewContent = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/content?status=pending_review&limit=100&order=desc')
      if (response.ok) {
        const data = await response.json()
        setReviewContent(data.content || [])
        setReviewStats(prev => ({
          ...prev,
          totalPending: data.content?.length || 0
        }))
      }
    } catch (error) {
      console.error('Error fetching review content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReviewAction = async (contentId: number, action: 'approved' | 'rejected', reason?: string) => {
    try {
      const response = await fetch(`/api/admin/content/${contentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content_status: action,
          reviewed_by: 'admin',
          rejection_reason: action === 'rejected' ? (reason || 'Manual review rejection') : undefined
        })
      })

      if (response.ok) {
        // Update stats
        setReviewStats(prev => ({
          ...prev,
          reviewed: prev.reviewed + 1,
          [action]: prev[action] + 1
        }))

        // Remove from review list
        setReviewContent(prev => prev.filter(item => item.id !== contentId))
        
        // Adjust current index if needed
        if (currentIndex >= reviewContent.length - 1) {
          setCurrentIndex(Math.max(0, reviewContent.length - 2))
        }
      }
    } catch (error) {
      console.error(`Error ${action} content:`, error)
    }
  }

  const handleBulkApprove = async () => {
    const remaining = reviewContent.slice(currentIndex)
    const updates = remaining.map(content => 
      handleReviewAction(content.id, 'approved')
    )
    await Promise.all(updates)
  }

  const handleBulkReject = async () => {
    const remaining = reviewContent.slice(currentIndex)
    const updates = remaining.map(content => 
      handleReviewAction(content.id, 'rejected', 'Bulk rejection')
    )
    await Promise.all(updates)
  }

  const goToNext = () => {
    if (currentIndex < reviewContent.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return '🖼️'
      case 'video': return '🎥'
      case 'text': return '📝'
      case 'mixed': return '🎭'
      default: return '📄'
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'reddit': return '🤖'
      case 'instagram': return '📸'
      case 'tiktok': return '🎵'
      default: return '🌐'
    }
  }

  const getConfidenceColor = (score: number | null) => {
    if (!score) return 'text-muted'
    if (score >= 0.8) return 'text-success'
    if (score >= 0.6) return 'text-warning'
    return 'text-danger'
  }

  if (isLoading) {
    return (
      <div className="container content-area">
        <div className="text-center">
          <div className="spinner mb-sm"></div>
          <p className="loading">Loading review queue...</p>
        </div>
      </div>
    )
  }

  if (reviewContent.length === 0) {
    return (
      <div className="container content-area">
        <div className="card">
          <div className="card-body text-center">
            <div style={{ fontSize: '4rem' }}>🎉</div>
            <h2 className="mb-sm">All caught up!</h2>
            <p className="text-muted">
              No content awaiting review. Great job keeping up with the queue!
            </p>
            <button 
              onClick={fetchReviewContent}
              className="btn btn-primary mt-md"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentContent = reviewContent[currentIndex]

  return (
    <div className="container content-area">
      {/* Header with Stats */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="flex justify-between align-center">
            <div>
              <h1 className="flex align-center gap-sm">
                <span>📋</span>
                Content Review
              </h1>
              <p className="text-muted">
                Review and approve hotdog content for posting
              </p>
            </div>
            <div className="flex gap-md">
              <div className="text-center">
                <div className="text-2xl font-bold">{reviewStats.totalPending}</div>
                <div className="text-sm text-muted">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{reviewStats.approved}</div>
                <div className="text-sm text-muted">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-danger">{reviewStats.rejected}</div>
                <div className="text-sm text-muted">Rejected</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Interface */}
      <div className="grid gap-lg" style={{ gridTemplateColumns: '1fr 300px' }}>
        {/* Main Content */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between align-center">
              <div className="flex align-center gap-sm">
                <span className="text-lg">{getContentTypeIcon(currentContent.content_type)}</span>
                <span className="text-lg">{getPlatformIcon(currentContent.source_platform)}</span>
                <span className="tag">{currentContent.source_platform}</span>
                <span className={`tag ${getConfidenceColor(currentContent.confidence_score)}`}>
                  {currentContent.confidence_score ? Math.round(currentContent.confidence_score * 100) + '% confidence' : 'No score'}
                </span>
              </div>
              <div className="text-muted">
                {currentIndex + 1} of {reviewContent.length}
              </div>
            </div>
          </div>

          <div className="card-body">
            {/* Media Preview */}
            {currentContent.content_image_url && (
              <div className="mb-lg">
                <img
                  src={currentContent.content_image_url}
                  alt="Content preview"
                  className="w-full rounded"
                  style={{ maxHeight: '400px', objectFit: 'contain' }}
                />
              </div>
            )}

            {/* Content Text */}
            <div className="mb-lg">
              <h3 className="mb-sm">Content</h3>
              <div className="p-md bg-gray-50 rounded">
                <p className="text-lg leading-relaxed">
                  {currentContent.content_text || 'No text content'}
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid gap-md" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div>
                <h4 className="text-sm font-semibold text-muted mb-xs">Author</h4>
                <p>{currentContent.original_author || 'Unknown'}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted mb-xs">Created</h4>
                <p>{new Date(currentContent.created_at).toLocaleString()}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted mb-xs">Source</h4>
                <a 
                  href={currentContent.original_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  View Original
                </a>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted mb-xs">Type</h4>
                <p className="capitalize">{currentContent.content_type}</p>
              </div>
            </div>

            {/* Analysis Results */}
            {(currentContent.is_spam || currentContent.is_inappropriate || currentContent.is_unrelated) && (
              <div className="mt-lg">
                <h4 className="text-sm font-semibold text-muted mb-xs">Analysis Flags</h4>
                <div className="flex gap-xs flex-wrap">
                  {currentContent.is_spam && (
                    <span className="tag text-danger">🚫 Spam Detected</span>
                  )}
                  {currentContent.is_inappropriate && (
                    <span className="tag text-warning">⚠️ Inappropriate Content</span>
                  )}
                  {currentContent.is_unrelated && (
                    <span className="tag text-info">🔄 Possibly Unrelated</span>
                  )}
                  {currentContent.is_valid_hotdog === false && (
                    <span className="tag text-danger">❌ Not Hotdog Content</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Sidebar */}
        <div className="grid gap-md" style={{ gridTemplateRows: 'min-content min-content 1fr' }}>
          {/* Navigation */}
          <div className="card">
            <div className="card-body">
              <h3 className="mb-sm">Navigation</h3>
              <div className="grid gap-xs" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                  className="btn btn-sm"
                >
                  ← Previous
                </button>
                <button
                  onClick={goToNext}
                  disabled={currentIndex >= reviewContent.length - 1}
                  className="btn btn-sm"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          {/* Review Actions */}
          <div className="card">
            <div className="card-body">
              <h3 className="mb-sm">Review Decision</h3>
              <div className="grid gap-sm">
                <button
                  onClick={() => handleReviewAction(currentContent.id, 'approved')}
                  className="btn btn-success btn-lg"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={() => handleReviewAction(currentContent.id, 'rejected')}
                  className="btn btn-danger btn-lg"
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="card">
            <div className="card-body">
              <h3 className="mb-sm">Bulk Actions</h3>
              <p className="text-sm text-muted mb-sm">
                Apply to remaining {reviewContent.length - currentIndex} items
              </p>
              <div className="grid gap-xs">
                <button
                  onClick={handleBulkApprove}
                  className="btn btn-success btn-sm"
                  disabled={reviewContent.length - currentIndex <= 1}
                >
                  ✅ Approve All
                </button>
                <button
                  onClick={handleBulkReject}
                  className="btn btn-danger btn-sm"
                  disabled={reviewContent.length - currentIndex <= 1}
                >
                  ❌ Reject All
                </button>
                <button
                  onClick={fetchReviewContent}
                  className="btn btn-sm"
                >
                  🔄 Refresh Queue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}