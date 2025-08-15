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
  const [isHovered, setIsHovered] = useState(false)

  // Detect touch device
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window

  const formatDate = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  }

  const formatCaption = (text: string) => {
    if (!text) return ''
    
    // Remove extra whitespace
    text = text.trim().replace(/\s+/g, ' ')
    
    // Truncate if too long
    const maxLength = 120
    if (text.length > maxLength) {
      return text.substring(0, maxLength).trim() + '...'
    }
    
    return text
  }

  const getOverlayStyle = (platform: SourcePlatform) => {
    const baseStyle = {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      padding: '12px 16px',
      fontSize: '13px',
      lineHeight: '1.4',
      color: 'white',
      maxWidth: '80%',
      opacity: (!isTouchDevice && isHovered) ? 1 : 0,
      transition: 'opacity 0.2s ease, transform 0.2s ease',
      transform: (!isTouchDevice && isHovered) ? 'translateY(0)' : 'translateY(10px)',
      pointerEvents: 'none' as const,
      zIndex: 10,
      display: isTouchDevice ? 'none' : 'block'
    }
    
    // Platform-specific backgrounds
    const platformStyles = {
      youtube: { background: 'linear-gradient(to top, rgba(255,0,0,0.9), transparent)' },
      reddit: { background: 'linear-gradient(to top, rgba(255,69,0,0.9), transparent)' },
      bluesky: { background: 'linear-gradient(to top, rgba(0,168,232,0.9), transparent)' },
      default: { background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }
    }
    
    return {
      ...baseStyle,
      ...(platformStyles[platform as keyof typeof platformStyles] || platformStyles.default)
    }
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
      case 'youtube' as SourcePlatform:
        return '📺'
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

  const renderHiddenMeta = () => (
    <>
      {/* Screen reader only */}
      <div 
        className="sr-only" 
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      >
        Posted by {original_author} on {source_platform}
      </div>
      
      {/* Data attributes for debugging */}
      <div 
        data-author={original_author}
        data-platform={source_platform}
        data-post-id={id}
        style={{ display: 'none' }}
      />
    </>
  )

  const renderCaptionOverlay = () => {
    if (!content_text) return null
    
    return (
      <div style={getOverlayStyle(source_platform)}>
        {formatCaption(content_text)}
      </div>
    )
  }

  return (
    <div 
      className="card"
      style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
          <div className="mb-sm" style={{ position: 'relative' }}>
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
          <div className="mb-sm" style={{ position: 'relative' }}>
            {/* YouTube embed */}
            {content_video_url.includes('youtube.com/watch') ? (
              (() => {
                const videoId = content_video_url.split('v=')[1]?.split('&')[0]
                if (videoId) {
                  <iframe
        src={`https://www.youtube.com/embed/${videoId}?controls=1&rel=0`}
        // NO autoplay - user must click play
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
                }
                return null
              })()
            ) : 
            /* Direct video files (MP4, etc.) */
            content_video_url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
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
            ) : 
            /* Fallback for other video URLs */
            (
              <div>
                <a
                  href={content_video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link flex align-center gap-xs"
                >
                  <span>🎥</span>
                  <span>Watch Video</span>
                </a>
              </div>
            )}
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
      
      {renderHiddenMeta()}
      
      {/* Caption overlay for entire card */}
      {renderCaptionOverlay()}
    </div>
  )
}