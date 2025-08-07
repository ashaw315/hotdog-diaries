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
    if (!platform) return '🌐'
    
    switch (platform) {
      case SourcePlatform.REDDIT:
        return '🤖'
      case SourcePlatform.YOUTUBE:
        return '📺'
      case SourcePlatform.FLICKR:
        return '📸'
      case SourcePlatform.UNSPLASH:
        return '🎨'
      case SourcePlatform.NEWS:
        return '📰'
      case SourcePlatform.MASTODON:
        return '🐘'
      case 'pixabay' as SourcePlatform:
        return '📷'
      case 'imgur' as SourcePlatform:
        return '📸'
      case 'lemmy' as SourcePlatform:
        return '🔗'
      case 'tumblr' as SourcePlatform:
        return '📱'
      default:
        return '🌐'
    }
  }

  const getContentTypeIcon = (type: ContentType) => {
    if (!type) return '📄'
    
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
    <div className="card">
      <div className="card-header">
        <div className="flex justify-between align-center">
          <div className="flex align-center gap-sm">
            <span>{getPlatformIcon(source_platform)}</span>
            <span><strong>{source_platform?.replace('_', ' ') || 'Unknown'}</strong></span>
            <span>{getContentTypeIcon(content_type)}</span>
            <span className="text-muted">{content_type}</span>
          </div>
          
          <div className="flex align-center gap-xs">
            {is_posted && (
              <span className="text-success">Posted</span>
            )}
            {is_approved && !is_posted && (
              <span>Approved</span>
            )}
            {!is_approved && !is_posted && (
              <span className="text-muted">Pending</span>
            )}
          </div>
        </div>
      </div>

      <div className="card-body">
        {content_text && (
          <p className="mb-sm">
            {content_text}
          </p>
        )}

        {content_image_url && !imageError && (
          <div className="mb-sm">
            {imageLoading && (
              <div className="text-center p-md text-muted">
                Loading image...
              </div>
            )}
            <img
              src={content_image_url}
              alt="Content image"
              style={{ 
                width: '100%', 
                objectFit: 'cover',
                display: imageLoading ? 'none' : 'block'
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </div>
        )}

        {content_video_url && (
          <div className="mb-sm">
            <video 
              controls 
              loop 
              autoPlay 
              muted
              style={{ 
                width: '100%', 
                maxWidth: '480px',
                maxHeight: '300px',
                objectFit: 'contain'
              }}
            >
              <source src={content_video_url} type="video/mp4" />
              <p>
                Your browser doesn't support video playback. 
                <a href={content_video_url} target="_blank" rel="noopener noreferrer">
                  View video directly
                </a>
              </p>
            </video>
          </div>
        )}
      </div>

      <div className="card-body">
        <div className="text-muted grid gap-xs">
          {original_author && (
            <div>
              <strong>Author:</strong> {original_author}
            </div>
          )}
          <div>
            <strong>Scraped:</strong> {formatDate(scraped_at)}
          </div>
          {posted_at && (
            <div>
              <strong>Posted:</strong> {formatDate(posted_at)}
              {post_order && (
                <span className="text-muted"> #{post_order}</span>
              )}
            </div>
          )}
          {admin_notes && (
            <div>
              <strong>Notes:</strong> {admin_notes}
            </div>
          )}
        </div>
      </div>

      <div className="card-footer">
        <a
          href={original_url}
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link flex align-center gap-xs"
        >
          <span>🔗</span>
          <span>View Original</span>
        </a>
      </div>

      {showActions && (onEdit || onDelete || onPost) && (
        <div className="card-footer">
          <div className="flex gap-sm">
            {onEdit && (
              <button onClick={() => onEdit(id)} className="btn">
                Edit
              </button>
            )}
            
            {onPost && !is_posted && is_approved && (
              <button onClick={() => onPost(id)} className="btn btn-success">
                Mark as Posted
              </button>
            )}
            
            {onDelete && !is_posted && (
              <button onClick={() => onDelete(id)} className="btn btn-danger">
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}