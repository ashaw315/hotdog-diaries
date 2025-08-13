'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function TikTokFeedV2() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef<{ [key: number]: HTMLVideoElement }>({})

  // Fetch posts on mount
  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/content?limit=20')
      
      if (!response.ok) {
        throw new Error('Failed to load content')
      }

      const data = await response.json()
      
      if (data.success) {
        const newPosts = data.data?.content || []
        console.log(`Loaded ${newPosts.length} posts`)
        setPosts(newPosts)
      } else {
        throw new Error(data.error || 'Failed to load content')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  // Handle video play/pause based on current index
  useEffect(() => {
    // Pause all videos
    Object.values(videosRef.current).forEach(video => {
      if (video) {
        video.pause()
        video.currentTime = 0
      }
    })

    // Play current video
    const currentVideo = videosRef.current[currentIndex]
    if (currentVideo) {
      currentVideo.play().catch(err => {
        console.log('Video autoplay failed:', err)
      })
    }
  }, [currentIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && currentIndex < posts.length - 1) {
        e.preventDefault()
        setCurrentIndex(currentIndex + 1)
        scrollToPost(currentIndex + 1)
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault()
        setCurrentIndex(currentIndex - 1)
        scrollToPost(currentIndex - 1)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentIndex, posts.length])

  const scrollToPost = (index: number) => {
    if (containerRef.current) {
      const postHeight = window.innerHeight
      containerRef.current.scrollTo({
        top: index * postHeight,
        behavior: 'smooth'
      })
    }
  }

  const handleScroll = () => {
    if (containerRef.current) {
      const scrollPosition = containerRef.current.scrollTop
      const postHeight = window.innerHeight
      const newIndex = Math.round(scrollPosition / postHeight)
      
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < posts.length) {
        setCurrentIndex(newIndex)
      }
    }
  }

  // Touch support for mobile
  let touchStartY = 0
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY
    const diff = touchStartY - touchEndY

    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < posts.length - 1) {
        setCurrentIndex(currentIndex + 1)
        scrollToPost(currentIndex + 1)
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1)
        scrollToPost(currentIndex - 1)
      }
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">🌭</div>
        <p>Loading hotdog content...</p>
        <style jsx>{`
          .loading-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: black;
            color: white;
          }
          .loading-spinner {
            font-size: 48px;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <p>{error}</p>
        <button onClick={fetchPosts}>Try Again</button>
        <style jsx>{`
          .error-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: black;
            color: white;
          }
          .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          button {
            margin-top: 16px;
            padding: 12px 24px;
            background: white;
            color: black;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
          }
          button:hover {
            background: #f0f0f0;
          }
        `}</style>
      </div>
    )
  }

  // Empty state
  if (posts.length === 0) {
    return (
      <div className="empty-container">
        <div className="empty-icon">🌭</div>
        <p>No hotdog content found</p>
        <p className="empty-sub">Check back later!</p>
        <style jsx>{`
          .empty-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: black;
            color: white;
          }
          .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
            opacity: 0.5;
          }
          .empty-sub {
            font-size: 14px;
            opacity: 0.7;
            margin-top: 8px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <>
      <div 
        ref={containerRef}
        className="tiktok-container"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {posts.map((post, index) => (
          <div key={post.id} className="post-slide">
            <PostContent 
              post={post} 
              isActive={index === currentIndex}
              videoRef={(el) => {
                if (el) videosRef.current[index] = el
              }}
            />
          </div>
        ))}
      </div>

      {/* Progress dots */}
      <div className="progress-dots">
        {posts.map((_, index) => (
          <div 
            key={index}
            className={`dot ${index === currentIndex ? 'active' : ''}`}
            onClick={() => {
              setCurrentIndex(index)
              scrollToPost(index)
            }}
          />
        ))}
      </div>

      <style jsx>{`
        .tiktok-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .tiktok-container::-webkit-scrollbar {
          display: none;
        }

        .post-slide {
          width: 100vw;
          height: 100vh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          position: relative;
        }

        .progress-dots {
          position: fixed;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 100;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .dot:hover {
          background: rgba(255, 255, 255, 0.5);
          transform: scale(1.2);
        }

        .dot.active {
          background: white;
          height: 18px;
        }

        @media (max-width: 768px) {
          .progress-dots {
            display: none;
          }
        }
      `}</style>
    </>
  )
}

// Separate component for post content
function PostContent({ 
  post, 
  isActive, 
  videoRef 
}: { 
  post: Post
  isActive: boolean
  videoRef: (el: HTMLVideoElement | null) => void
}) {
  const [imageError, setImageError] = useState(false)
  const [likes] = useState(Math.floor(Math.random() * 10000) + 1000)
  const [comments] = useState(Math.floor(Math.random() * 1000) + 100)
  const [shares] = useState(Math.floor(Math.random() * 500) + 50)

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getPlatformIcon = (platform: SourcePlatform) => {
    const icons: Record<string, string> = {
      reddit: '🤖',
      youtube: '📺',
      pixabay: '📷',
      imgur: '📸',
      tumblr: '📱',
      flickr: '📸',
      unsplash: '🎨'
    }
    return icons[platform] || '🌐'
  }

  const renderMedia = () => {
    // Video content
    if (post.content_type === 'video' && post.content_video_url) {
      if (post.content_video_url.includes('youtube.com')) {
        const videoId = new URL(post.content_video_url).searchParams.get('v')
        if (videoId) {
          return (
            <iframe
              className="media-content"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=1&controls=0&loop=1&playlist=${videoId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        }
      }
      
      return (
        <video
          ref={videoRef}
          className="media-content"
          src={post.content_video_url}
          loop
          muted
          playsInline
          poster={post.content_image_url}
        />
      )
    }

    // Image content
    if (post.content_image_url && !imageError) {
      return (
        <img 
          className="media-content"
          src={post.content_image_url}
          alt={post.content_text || 'Hotdog content'}
          onError={() => setImageError(true)}
        />
      )
    }

    // Text-only or fallback
    return (
      <div className="text-content">
        <div className="text-wrapper">
          <div className="hotdog-emoji">🌭</div>
          <p className="post-text">{post.content_text || 'Delicious hotdog content'}</p>
          <div className="platform-badge">
            {getPlatformIcon(post.source_platform)} {post.source_platform}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="post-content">
      {/* Media background */}
      <div className="media-container">
        {renderMedia()}
      </div>

      {/* TikTok-style bottom-left info */}
      <div className="info-overlay">
        <div className="creator-info">
          <div className="username">@{post.original_author || 'hotdog_lover'}</div>
          {post.content_text && (
            <div className="caption">{post.content_text.slice(0, 100)}{post.content_text.length > 100 ? '...' : ''}</div>
          )}
          <div className="sound-info">
            🎵 Original Sound - {post.source_platform}
          </div>
        </div>
      </div>

      {/* TikTok-style right-side actions */}
      <div className="actions-overlay">
        <button className="action-button">
          <span className="action-icon">❤️</span>
          <span className="action-count">{formatNumber(likes)}</span>
        </button>
        <button className="action-button">
          <span className="action-icon">💬</span>
          <span className="action-count">{formatNumber(comments)}</span>
        </button>
        <button className="action-button">
          <span className="action-icon">↗️</span>
          <span className="action-count">{formatNumber(shares)}</span>
        </button>
        <button className="action-button">
          <span className="action-icon">⭐</span>
        </button>
      </div>

      <style jsx>{`
        .post-content {
          width: 100%;
          height: 100%;
          position: relative;
          background: black;
        }

        .media-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .media-content {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        iframe.media-content {
          border: none;
        }

        .text-content {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .text-wrapper {
          text-align: center;
          color: white;
          padding: 40px;
          max-width: 600px;
        }

        .hotdog-emoji {
          font-size: 80px;
          margin-bottom: 24px;
        }

        .post-text {
          font-size: 24px;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .platform-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          font-size: 14px;
        }

        /* TikTok-style bottom-left info */
        .info-overlay {
          position: absolute;
          bottom: 80px;
          left: 20px;
          right: 100px;
          z-index: 10;
        }

        .creator-info {
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        }

        .username {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .caption {
          font-size: 15px;
          line-height: 1.4;
          margin-bottom: 8px;
          max-width: 500px;
        }

        .sound-info {
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* TikTok-style right-side actions */
        .actions-overlay {
          position: absolute;
          right: 16px;
          bottom: 80px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 10;
        }

        .action-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          width: 48px;
          height: 48px;
          padding: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: white;
        }

        .action-button:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        .action-icon {
          font-size: 24px;
          line-height: 1;
        }

        .action-count {
          font-size: 12px;
          font-weight: 600;
          margin-top: 4px;
        }

        @media (max-width: 768px) {
          .info-overlay {
            bottom: 60px;
            left: 16px;
            right: 80px;
          }

          .username {
            font-size: 16px;
          }

          .caption {
            font-size: 14px;
          }

          .actions-overlay {
            right: 12px;
            bottom: 60px;
          }

          .action-button {
            width: 40px;
            height: 40px;
          }

          .action-icon {
            font-size: 20px;
          }

          .post-text {
            font-size: 20px;
          }

          .hotdog-emoji {
            font-size: 60px;
          }
        }
      `}</style>
    </div>
  )
}