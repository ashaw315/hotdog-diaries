'use client'

import { useState, useEffect } from 'react'
import LazyImage from './LazyImage'
import { ContentType, SourcePlatform } from '@/types'

interface ContentItem {
  id: number
  content_text?: string
  content_type: ContentType
  source_platform: SourcePlatform
  original_url: string
  original_author?: string
  content_image_url?: string
  content_video_url?: string
  scraped_at: Date
  is_posted: boolean
  is_approved: boolean
  posted_at?: Date
}

export default function MobileFeedContent() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async (pageNum = 1) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/content?page=${pageNum}&limit=12`)
      
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
        
        setHasMore(newContent.length === 12)
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

  const getPlatformIcon = (platform: SourcePlatform) => {
    const platformMap = {
      'reddit': '🤖',
      'youtube': '📺',
      'pixabay': '📷',
      'imgur': '📸',
      'tumblr': '📱',
      'lemmy': '🔗',
      'mastodon': '🐘',
      'flickr': '📸',
      'unsplash': '🎨',
      'news': '📰'
    }
    return platformMap[platform as keyof typeof platformMap] || '🌐'
  }

  const formatCaption = (text?: string) => {
    if (!text) return ''
    // Remove common boilerplate text
    const cleaned = text
      .replace(/^(Posted by|By|From|Source:)/i, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim()
    
    return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned
  }

  const formatAuthor = (author?: string) => {
    if (!author) return ''
    // Clean up author names
    return author.replace(/^(@|u\/|r\/)/i, '').replace(/\s+on\s+\w+$/i, '')
  }

  if (loading && content.length === 0) {
    return (
      <div className="feed-loading">
        <div className="loading-shimmer">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer-card">
              <div className="shimmer-image"></div>
              <div className="shimmer-text">
                <div className="shimmer-line"></div>
                <div className="shimmer-line short"></div>
              </div>
            </div>
          ))}
        </div>
        
        <style jsx>{`
          .feed-loading {
            padding: 16px 0;
          }

          .loading-shimmer {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .shimmer-card {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .shimmer-image {
            width: 100%;
            height: 300px;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }

          .shimmer-text {
            padding: 8px 12px;
          }

          .shimmer-line {
            height: 12px;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
            margin-bottom: 6px;
          }

          .shimmer-line.short {
            width: 60%;
          }

          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }

          @media (max-width: 768px) {
            .feed-loading {
              padding: 12px 0;
            }

            .shimmer-image {
              height: 250px;
            }
          }
        `}</style>
      </div>
    )
  }

  if (error && content.length === 0) {
    return (
      <div className="feed-error">
        <div className="error-content">
          <div className="error-icon">⚠</div>
          <p className="error-message">{error}</p>
          <button onClick={() => loadContent(1)} className="retry-button">
            Try Again
          </button>
        </div>
        
        <style jsx>{`
          .feed-error {
            padding: 40px 20px;
            text-align: center;
          }

          .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }

          .error-message {
            color: #666;
            margin-bottom: 20px;
            font-size: 14px;
          }

          .retry-button {
            background: var(--bun-medium);
            color: var(--text-on-bun);
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s ease;
          }

          .retry-button:hover {
            background: var(--bun-dark);
          }
        `}</style>
      </div>
    )
  }

  if (content.length === 0) {
    return (
      <div className="feed-empty">
        <div className="empty-content">
          <div className="empty-icon">🌭</div>
          <p className="empty-message">No hotdog content found</p>
          <p className="empty-submessage">Check back later for fresh content!</p>
        </div>
        
        <style jsx>{`
          .feed-empty {
            padding: 60px 20px;
            text-align: center;
          }

          .empty-icon {
            font-size: 64px;
            margin-bottom: 20px;
            opacity: 0.5;
          }

          .empty-message {
            font-size: 16px;
            color: #333;
            margin-bottom: 8px;
          }

          .empty-submessage {
            font-size: 14px;
            color: #666;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="mobile-feed">
      <div className="feed-items">
        {content.map((item) => (
          <article key={item.id} className="feed-item">
            {/* Media Content - Takes up most space */}
            {item.content_type === 'video' && item.content_video_url && (
              <div className="feed-media">
                {item.content_video_url.includes('youtube.com/watch') ? (
                  (() => {
                    const videoId = item.content_video_url.split('v=')[1]?.split('&')[0]
                    if (videoId) {
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title="YouTube video"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="feed-video-iframe"
                        />
                      )
                    }
                    return null
                  })()
                ) : item.content_video_url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
                  <video 
                    className="feed-video" 
                    controls 
                    preload="metadata"
                    poster={item.content_image_url}
                  >
                    <source src={item.content_video_url} />
                  </video>
                ) : (
                  <a 
                    href={item.content_video_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="feed-video-link"
                  >
                    <div className="video-placeholder">
                      <span>🎥</span>
                      <span>Watch Video</span>
                    </div>
                  </a>
                )}
              </div>
            )}
            
            {item.content_type === 'image' && item.content_image_url && (
              <div className="feed-media">
                <LazyImage 
                  src={item.content_image_url} 
                  alt={formatCaption(item.content_text) || 'Hotdog content'}
                />
              </div>
            )}
            
            {item.content_type === 'mixed' && (
              <div className="feed-media">
                {item.content_image_url ? (
                  <LazyImage 
                    src={item.content_image_url} 
                    alt={formatCaption(item.content_text) || 'Hotdog content'}
                  />
                ) : (
                  <div className="mixed-content-text">
                    <p>{item.content_text}</p>
                  </div>
                )}
              </div>
            )}
            
            {item.content_type === 'text' && (
              <div className="feed-text-only">
                <p>{item.content_text}</p>
              </div>
            )}
            
            {/* Minimal Info Bar */}
            <div className="feed-info">
              {formatAuthor(item.original_author) && (
                <span className="feed-author">@{formatAuthor(item.original_author)}</span>
              )}
              {formatCaption(item.content_text) && (
                <span className="feed-caption">{formatCaption(item.content_text)}</span>
              )}
              <span className="feed-platform" title={item.source_platform}>
                {getPlatformIcon(item.source_platform)}
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="feed-load-more">
          <button
            onClick={loadMore}
            disabled={loading}
            className="load-more-button"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      <style jsx>{`
        .mobile-feed {
          padding: 0;
        }

        .feed-items {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px 0;
        }

        .feed-item {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .feed-media {
          width: 100%;
          position: relative;
        }

        .feed-media img {
          width: 100%;
          height: auto;
          display: block;
          aspect-ratio: 16/9;
          object-fit: cover;
        }

        .feed-video {
          width: 100%;
          height: auto;
          max-height: 80vh;
          display: block;
        }

        .feed-video-iframe {
          width: 100%;
          height: 300px;
          border: none;
        }

        .feed-video-link {
          display: block;
          text-decoration: none;
          color: inherit;
        }

        .video-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          background: #f5f5f5;
          color: #666;
          font-size: 14px;
          gap: 8px;
        }

        .mixed-content-text,
        .feed-text-only {
          padding: 20px;
          background: #f9f9f9;
          min-height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .feed-info {
          padding: 8px 12px;
          font-size: 13px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 8px;
          border-top: 1px solid #eee;
        }

        .feed-author {
          font-weight: 500;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 30%;
          flex-shrink: 0;
        }

        .feed-caption {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }

        .feed-platform {
          font-size: 16px;
          flex-shrink: 0;
          cursor: help;
        }

        .feed-load-more {
          text-align: center;
          padding: 20px;
        }

        .load-more-button {
          background: var(--bun-medium);
          color: var(--text-on-bun);
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          min-width: 120px;
        }

        .load-more-button:hover {
          background: var(--bun-dark);
        }

        .load-more-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .feed-items {
            gap: 0;
            padding: 0;
          }
          
          .feed-item {
            border-radius: 0;
            box-shadow: none;
            border-bottom: 1px solid #eee;
          }
          
          .feed-info {
            font-size: 12px;
            padding: 6px 10px;
          }

          .feed-video-iframe {
            height: 250px;
          }

          .video-placeholder {
            height: 150px;
          }

          .mixed-content-text,
          .feed-text-only {
            padding: 15px;
            min-height: 100px;
          }
        }

        /* Tablet and up */
        @media (min-width: 769px) {
          .mobile-feed {
            padding: 20px;
          }
          
          .feed-items {
            gap: 24px;
          }
        }
      `}</style>
    </div>
  )
}