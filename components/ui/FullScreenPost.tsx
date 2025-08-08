'use client'

import { useEffect, useRef, useState } from 'react'
import { ContentType, SourcePlatform } from '@/types'

interface Post {
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

interface FullScreenPostProps {
  post: Post
  isActive: boolean
}

export default function FullScreenPost({ post, isActive }: FullScreenPostProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [imageError, setImageError] = useState(false)
  const [videoError, setVideoError] = useState(false)
  
  console.log('Rendering post:', {
    id: post.id,
    type: post.content_type,
    hasImage: !!post.content_image_url,
    hasVideo: !!post.content_video_url,
    imageError,
    videoError
  })

  // Auto-play video when active, pause when not
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => {
          setVideoError(true)
        })
      } else {
        videoRef.current.pause()
      }
    }
  }, [isActive])

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
    // Clean up text and limit length
    const cleaned = text
      .replace(/^(Posted by|By|From|Source:)/i, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim()
    
    return cleaned.length > 150 ? cleaned.substring(0, 150) + '...' : cleaned
  }

  const formatAuthor = (author?: string) => {
    if (!author) return 'anonymous'
    return author
      .replace(/^(@|u\/|r\/)/i, '')
      .replace(/\s+on\s+\w+$/i, '')
      .substring(0, 20)
  }

  const renderMedia = () => {
    // Video content
    if (post.content_type === 'video' && post.content_video_url && !videoError) {
      // YouTube videos
      if (post.content_video_url.includes('youtube.com/watch')) {
        const videoId = post.content_video_url.split('v=')[1]?.split('&')[0]
        if (videoId) {
          return (
            <iframe
              className="post-video-iframe"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=1&loop=1&playlist=${videoId}`}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        }
      }
      
      // Direct video files
      if (post.content_video_url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) {
        return (
          <video
            ref={videoRef}
            className="post-video"
            loop
            muted
            playsInline
            poster={post.content_image_url}
            onError={() => setVideoError(true)}
          >
            <source src={post.content_video_url} type="video/mp4" />
          </video>
        )
      }
    }

    // Image content or fallback for failed videos
    if (post.content_image_url && !imageError) {
      return (
        <img 
          className="post-image"
          src={post.content_image_url}
          alt={post.content_text || 'Hotdog content'}
          crossOrigin="anonymous"
          onError={(e) => {
            console.error('Image failed to load:', post.content_image_url)
            setImageError(true)
          }}
          onLoad={() => console.log('Image loaded successfully:', post.content_image_url)}
        />
      )
    }

    // Text content or fallback
    return (
      <div className="post-text-container">
        <div className="post-text-content">
          <div className="hotdog-icon">🌭</div>
          <p className="post-text">
            {post.content_text || 'Hotdog content from ' + post.source_platform}
          </p>
          <div className="platform-badge">
            {getPlatformIcon(post.source_platform)} {post.source_platform}
          </div>
        </div>
      </div>
    )
  }

  const isTextOnlyPost = !post.content_image_url && !post.content_video_url
  const hasVisualContent = post.content_image_url || post.content_video_url

  return (
    <div className="full-screen-post">
      <div className="media-container">
        {renderMedia()}
      </div>

      {/* Info Overlay - TikTok style bottom overlay */}
      <div className={`post-info-overlay ${isTextOnlyPost ? 'text-overlay' : ''}`}>
        <div className="post-author">
          @{formatAuthor(post.original_author)}
        </div>
        
        {post.content_text && hasVisualContent && (
          <div className="post-caption">
            {formatCaption(post.content_text)}
          </div>
        )}
        
        <div className="post-platform-info">
          <span className="platform-icon">{getPlatformIcon(post.source_platform)}</span>
          <span className="platform-name">{post.source_platform}</span>
        </div>
      </div>

      <style jsx>{`
        .full-screen-post {
          width: 100%;
          height: 100%;
          position: relative;
          background: white;
        }

        .media-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Video styles */
        .post-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: white;
        }

        .post-video-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }

        /* Image styles */
        .post-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background-color: white;
        }

        /* Text post styles */
        .post-text-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          background: white;
        }

        .post-text-content {
          max-width: 600px;
          text-align: center;
          color: #333;
        }

        .hotdog-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .post-text {
          font-size: 24px;
          line-height: 1.6;
          margin-bottom: 30px;
          word-wrap: break-word;
        }

        .platform-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #f0f0f0;
          border-radius: 20px;
          font-size: 14px;
          color: #666;
        }

        /* Info overlay - TikTok style */
        .post-info-overlay {
          position: absolute;
          bottom: 20px;
          left: 20px;
          right: 80px;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          z-index: 10;
        }

        .post-info-overlay.text-overlay {
          color: #333;
          text-shadow: 0 1px 2px rgba(255,255,255,0.8);
        }

        .post-author {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 8px;
        }

        .post-caption {
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 8px;
          max-width: 500px;
          word-wrap: break-word;
        }

        .post-platform-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          opacity: 0.8;
        }

        .platform-icon {
          font-size: 16px;
        }

        .platform-name {
          text-transform: capitalize;
          padding: 2px 8px;
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
          backdrop-filter: blur(10px);
        }

        .post-info-overlay.text-overlay .platform-name {
          background: rgba(0,0,0,0.1);
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .post-info-overlay {
            bottom: 80px;
            left: 15px;
            right: 15px;
          }

          .post-author {
            font-size: 14px;
          }

          .post-caption {
            font-size: 13px;
            margin-bottom: 6px;
          }

          .post-platform-info {
            font-size: 11px;
          }

          .post-text-container {
            padding: 20px;
          }

          .post-text {
            font-size: 20px;
          }

          .hotdog-icon {
            font-size: 48px;
          }
        }

        /* Ensure content is accessible */
        @media (max-height: 600px) {
          .post-text {
            font-size: 18px;
          }

          .hotdog-icon {
            font-size: 40px;
            margin-bottom: 15px;
          }
        }
      `}</style>
    </div>
  )
}