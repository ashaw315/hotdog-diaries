'use client'

import { ContentType, SourcePlatform } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

export interface ContentCardProps {
  id: number
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  content_type: ContentType
  source_platform: SourcePlatform
  original_url: string
  original_author?: string
  scraped_at: Date
  posted_at?: Date
  post_order?: number
  is_posted?: boolean
  is_approved?: boolean
  admin_notes?: string
  showActions?: boolean
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  onPost?: (id: number) => void
}

export default function ContentCard({
  id,
  content_text,
  content_image_url,
  content_video_url,
  content_type,
  source_platform,
  original_url,
  original_author,
  scraped_at,
  posted_at,
  post_order,
  is_posted = false,
  is_approved = false,
  admin_notes,
  showActions = false,
  onEdit,
  onDelete,
  onPost
}: ContentCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  const formatDate = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  }

  const getPlatformIcon = (platform: SourcePlatform) => {
    switch (platform) {
      case SourcePlatform.TWITTER:
        return '🐦'
      case SourcePlatform.INSTAGRAM:
        return '📷'
      case SourcePlatform.FACEBOOK:
        return '👥'
      case SourcePlatform.REDDIT:
        return '🤖'
      case SourcePlatform.TIKTOK:
        return '🎵'
      default:
        return '🌐'
    }
  }

  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case ContentType.TEXT:
        return '📝'
      case ContentType.IMAGE:
        return '🖼️'
      case ContentType.VIDEO:
        return '🎥'
      case ContentType.MIXED:
        return '📋'
      default:
        return '📄'
    }
  }

  const handleImageLoad = () => {
    setImageLoading(false)
  }

  const handleImageError = () => {
    setImageError(true)
    setImageLoading(false)
  }

  return (
    <div className="bg-white border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getPlatformIcon(source_platform)}</span>
          <span className="text-sm font-medium text-primary capitalize">
            {source_platform.replace('_', ' ')}
          </span>
          <span className="text-lg">{getContentTypeIcon(content_type)}</span>
          <span className="text-sm text-text opacity-60 capitalize">
            {content_type}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {is_posted && (
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
              Posted
            </span>
          )}
          {is_approved && !is_posted && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
              Approved
            </span>
          )}
          {!is_approved && !is_posted && (
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        {content_text && (
          <p className="text-text mb-3 line-clamp-3">
            {content_text}
          </p>
        )}

        {content_image_url && !imageError && (
          <div className="relative mb-3">
            {imageLoading && (
              <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">
                <span className="text-gray-500">Loading image...</span>
              </div>
            )}
            <img
              src={content_image_url}
              alt="Content image"
              className={`w-full max-h-48 object-cover rounded ${imageLoading ? 'hidden' : 'block'}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </div>
        )}

        {content_video_url && (
          <div className="mb-3">
            <a
              href={content_video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center space-x-2"
            >
              <span>🎥</span>
              <span>View Video</span>
            </a>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-sm text-text opacity-60 space-y-1">
        {original_author && (
          <div>
            <span className="font-medium">Author:</span> {original_author}
          </div>
        )}
        <div>
          <span className="font-medium">Scraped:</span> {formatDate(scraped_at)}
        </div>
        {posted_at && (
          <div>
            <span className="font-medium">Posted:</span> {formatDate(posted_at)}
            {post_order && (
              <span className="ml-2 bg-gray-100 text-gray-800 text-xs px-1 py-0.5 rounded">
                #{post_order}
              </span>
            )}
          </div>
        )}
        {admin_notes && (
          <div>
            <span className="font-medium">Notes:</span> {admin_notes}
          </div>
        )}
      </div>

      {/* Original Link */}
      <div className="mt-3 pt-3 border-t border-border">
        <a
          href={original_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm flex items-center space-x-1"
        >
          <span>🔗</span>
          <span>View Original</span>
        </a>
      </div>

      {/* Actions */}
      {showActions && (onEdit || onDelete || onPost) && (
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(id)}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
            >
              Edit
            </button>
          )}
          
          {onPost && !is_posted && is_approved && (
            <button
              onClick={() => onPost(id)}
              className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
            >
              Mark as Posted
            </button>
          )}
          
          {onDelete && !is_posted && (
            <button
              onClick={() => onDelete(id)}
              className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}