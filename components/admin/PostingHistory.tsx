'use client'

import { useState, useEffect } from 'react'

interface PostedContent {
  id: number
  content_queue_id: number
  posted_at: string
  post_order: number
  content_type: string
  source_platform: string
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  original_author?: string
  original_url: string
}

interface PostingHistoryProps {
  onManualTrigger: (contentId?: number) => Promise<void>
}

export function PostingHistory({ onManualTrigger }: PostingHistoryProps) {
  const [history, setHistory] = useState<PostedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/admin/content/posted?limit=20')
      if (!response.ok) {
        throw new Error('Failed to fetch posting history')
      }
      const data = await response.json()
      setHistory(data.content || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handleRepost = async (contentId: number) => {
    try {
      await onManualTrigger(contentId)
      await fetchHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getContentPreview = (content: PostedContent) => {
    if (content.content_text) {
      return content.content_text.length > 100 
        ? content.content_text.substring(0, 100) + '...'
        : content.content_text
    }
    
    if (content.content_image_url) {
      return 'Image content'
    }
    
    if (content.content_video_url) {
      return 'Video content'
    }
    
    return 'Mixed content'
  }

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return '🖼️'
      case 'video':
        return '🎥'
      case 'text':
        return '📝'
      default:
        return '📄'
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'twitter':
        return '🐦'
      case 'instagram':
        return '📸'
      case 'facebook':
        return '📘'
      case 'reddit':
        return '🤖'
      case 'tiktok':
        return '🎵'
      default:
        return '🌐'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Posting History</h2>
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Posting History</h2>
        <button
          onClick={fetchHistory}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No posting history available
          </div>
        ) : (
          history.map((post) => (
            <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {getContentTypeIcon(post.content_type)}
                    </span>
                    <span className="text-lg">
                      {getPlatformIcon(post.source_platform)}
                    </span>
                    <span className="text-sm text-gray-500">
                      Post #{post.post_order}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(post.posted_at)}
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <p className="text-gray-900 text-sm">
                      {getContentPreview(post)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {post.original_author && (
                      <span>By: {post.original_author}</span>
                    )}
                    <span>From: {post.source_platform}</span>
                    <a
                      href={post.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Original
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleRepost(post.content_queue_id)}
                    className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded border border-blue-300 hover:border-blue-400"
                  >
                    Repost
                  </button>
                </div>
              </div>
              
              {post.content_image_url && (
                <div className="mt-3">
                  <img
                    src={post.content_image_url}
                    alt="Content preview"
                    className="w-full max-w-xs rounded-lg border"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {history.length > 0 && (
        <div className="mt-4 text-center">
          <button
            onClick={fetchHistory}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
}