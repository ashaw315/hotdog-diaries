'use client'

import { useState, useEffect } from 'react'
import ContentCard from './ContentCard'
import { ContentType, SourcePlatform } from '@/types'

interface ContentItem {
  id: number
  content_text: string
  content_type: ContentType
  source_platform: SourcePlatform
  original_url: string
  original_author: string
  content_image_url?: string
  content_video_url?: string
  scraped_at: Date
  is_posted: boolean
  is_approved: boolean
  posted_at?: Date
}

interface ContentFeedProps {
  type?: 'all' | 'pending' | 'posted' | 'approved' | 'rejected'
  limit?: number
  showActions?: boolean
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  onPost?: (id: number) => void
  onApprove?: (id: number) => void
  onReject?: (id: number) => void
}

export default function ContentFeed({ 
  type = 'all', 
  limit = 50, 
  showActions = false,
  onEdit,
  onDelete,
  onPost,
  onApprove,
  onReject
}: ContentFeedProps) {
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    loadContent()
  }, [type, limit])

  const loadContent = async (pageNum = 1) => {
    try {
      setLoading(true)
      setError(null)

      // Use public API for posted content, admin API for others
      let endpoint = type === 'posted' ? '/api/content' : '/api/admin/content'
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString()
      })

      // Only add type param for admin API
      if (type !== 'all' && type !== 'posted') {
        params.append('type', type)
      }

      const response = await fetch(`${endpoint}?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load content')
      }

      const data = await response.json()
      
      if (data.success) {
        const newContent = data.data?.content || []
        
        if (pageNum === 1) {
          setContent(newContent)
        } else {
          setContent(prev => [...prev, ...newContent])
        }
        
        setHasMore(newContent.length === limit)
        setPage(pageNum)
      } else {
        throw new Error(data.error || 'Failed to load content')
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content')
      if (pageNum === 1) {
        setContent([])
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      loadContent(page + 1)
    }
  }

  const handleAction = async (action: string, id: number) => {
    try {
      let endpoint = ''
      let method = 'POST'
      
      switch (action) {
        case 'edit':
          onEdit?.(id)
          return
        case 'delete':
          endpoint = `/api/admin/content/${id}`
          method = 'DELETE'
          break
        case 'post':
          endpoint = `/api/admin/content/${id}/post`
          break
        case 'approve':
          endpoint = `/api/admin/content/${id}/approve`
          break
        case 'reject':
          endpoint = `/api/admin/content/${id}/reject`
          break
        default:
          return
      }

      const response = await fetch(endpoint, { method })
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} content`)
      }

      // Reload content after action
      await loadContent(1)
      
      // Call the callback if provided
      switch (action) {
        case 'delete':
          onDelete?.(id)
          break
        case 'post':
          onPost?.(id)
          break
        case 'approve':
          onApprove?.(id)
          break
        case 'reject':
          onReject?.(id)
          break
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} content`)
    }
  }

  if (loading && content.length === 0) {
    return (
      <div className="text-center p-lg">
        <div className="spinner mb-sm"></div>
        <p className="loading">Loading content...</p>
      </div>
    )
  }

  if (error && content.length === 0) {
    return (
      <div className="text-center p-lg">
        <div className="text-danger mb-sm">⚠</div>
        <p className="text-danger mb-sm">{error}</p>
        <button onClick={() => loadContent(1)} className="btn btn-primary">
          Retry
        </button>
      </div>
    )
  }

  if (content.length === 0) {
    return (
      <div className="text-center p-lg">
        <div className="mb-sm">📄</div>
        <p>No content found</p>
        <p className="text-muted">
          {type === 'pending' ? 'No content pending approval' :
           type === 'posted' ? 'No content has been posted yet' :
           type === 'approved' ? 'No content has been approved yet' :
           'No content available'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-md">
      {error && (
        <div className="alert alert-danger">
          <span>⚠ {error}</span>
        </div>
      )}

      <div className="grid grid-3 gap-md">
        {content.map((item) => (
          <ContentCard
            key={item.id}
            {...item}
            showActions={showActions}
            onEdit={showActions ? () => handleAction('edit', item.id) : undefined}
            onDelete={showActions ? () => handleAction('delete', item.id) : undefined}
            onPost={showActions && !item.is_posted ? () => handleAction('post', item.id) : undefined}
          />
        ))}
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {!hasMore && content.length > 0 && (
        <div className="text-center">
          <p className="text-muted">All content loaded ({content.length} items)</p>
        </div>
      )}
    </div>
  )
}