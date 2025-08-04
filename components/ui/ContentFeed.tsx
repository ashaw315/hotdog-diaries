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
  post_order?: number
}

interface ContentFeedProps {
  type?: 'all' | 'pending' | 'posted' | 'approved'
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

      let endpoint = '/api/admin/content'
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString()
      })

      if (type !== 'all') {
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
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading content...</p>
        </div>
      </div>
    )
  }

  if (error && content.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">⚠</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadContent(1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (content.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">📄</div>
          <p className="text-gray-600">No content found</p>
          <p className="text-gray-500 text-sm mt-2">
            {type === 'pending' ? 'No content pending approval' :
             type === 'posted' ? 'No content has been posted yet' :
             type === 'approved' ? 'No content has been approved yet' :
             'No content available'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {content.map((item) => (
          <ContentCard
            key={item.id}
            {...item}
            showActions={showActions}
            onEdit={showActions ? () => handleAction('edit', item.id) : undefined}
            onDelete={showActions ? () => handleAction('delete', item.id) : undefined}
            onPost={showActions && !item.is_posted ? () => handleAction('post', item.id) : undefined}
            onApprove={showActions && !item.is_approved ? () => handleAction('approve', item.id) : undefined}
            onReject={showActions && !item.is_approved ? () => handleAction('reject', item.id) : undefined}
          />
        ))}
      </div>

      {hasMore && (
        <div className="text-center py-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {!hasMore && content.length > 0 && (
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">All content loaded ({content.length} items)</p>
        </div>
      )}
    </div>
  )
}