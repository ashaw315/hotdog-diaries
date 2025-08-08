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

export default function TikTokDesktopFeed() {
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
      <div className="page-container">
        <div className="feed-container">
          <div className="loading-content">
            <div className="loading-spinner">🌭</div>
            <p>Loading hotdog content...</p>
          </div>
        </div>
        <style jsx>{`
          .page-container {
            min-height: 100vh;
            background: #161823;
            display: flex;
            justify-content: center;
          }
          .feed-container {
            width: 100%;
            max-width: 650px;
            background: black;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .loading-content {
            text-align: center;
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
      <div className="page-container">
        <div className="feed-container">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <p>{error}</p>
            <button onClick={fetchPosts}>Try Again</button>
          </div>
        </div>
        <style jsx>{`
          .page-container {
            min-height: 100vh;
            background: #161823;
            display: flex;
            justify-content: center;
          }
          .feed-container {
            width: 100%;
            max-width: 650px;
            background: black;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .error-content {
            text-align: center;
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
        `}</style>
      </div>
    )
  }

  // Empty state
  if (posts.length === 0) {
    return (
      <div className="page-container">
        <div className="feed-container">
          <div className="empty-content">
            <div className="empty-icon">🌭</div>
            <p>No hotdog content found</p>
            <p className="empty-sub">Check back later!</p>
          </div>
        </div>
        <style jsx>{`
          .page-container {
            min-height: 100vh;
            background: #161823;
            display: flex;
            justify-content: center;
          }
          .feed-container {
            width: 100%;
            max-width: 650px;
            background: black;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .empty-content {
            text-align: center;
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
    <div className="page-container">
      <div 
        ref={containerRef}
        className="feed-container"
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

      {/* Navigation indicators */}
      <div className="nav-indicators">
        {posts.map((_, index) => (
          <div 
            key={index}
            className={`nav-dot ${index === currentIndex ? 'active' : ''}`}
            onClick={() => {
              setCurrentIndex(index)
              scrollToPost(index)
            }}
          />
        ))}
      </div>

      <style jsx>{`
        .page-container {
          min-height: 100vh;
          background: #161823;
          display: flex;
          justify-content: center;
          position: relative;
        }

        .feed-container {
          width: 100%;
          max-width: 650px;
          height: 100vh;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
          background: black;
        }

        .feed-container::-webkit-scrollbar {
          display: none;
        }

        .post-slide {
          width: 100%;
          height: 100vh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          position: relative;
        }

        .nav-indicators {
          position: fixed;
          right: max(calc((100vw - 650px) / 2 - 40px), 20px);
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 100;
        }

        .nav-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .nav-dot:hover {
          background: rgba(255, 255, 255, 0.5);
          transform: scale(1.2);
        }

        .nav-dot.active {
          background: white;
          height: 18px;
        }

        @media (max-width: 768px) {
          .page-container {
            background: black;
          }
          
          .feed-container {
            max-width: 100%;
          }
          
          .nav-indicators {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

// Post content component
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
      mastodon: '🐘',
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
              className="media-video"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=1&controls=1&loop=1&playlist=${videoId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        }
      }
      
      return (
        <video
          ref={videoRef}
          className="media-video"
          src={post.content_video_url}
          controls
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
          className="media-image"
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
          <h2 className="post-title">Hotdog Content</h2>
          <p className="post-text">{post.content_text || 'Delicious hotdog content from ' + post.source_platform}</p>
          <div className="platform-badge">
            {getPlatformIcon(post.source_platform)} {post.source_platform}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="post-content">
      {/* Main content area */}
      <div className="content-area">
        {renderMedia()}
      </div>

      {/* TikTok-style overlays */}
      <div className="bottom-overlay">
        <div className="creator-info">
          <div className="username">@{post.original_author?.replace(/^(u\/|r\/|@)/, '') || 'hotdog_lover'}</div>
          {post.content_text && post.content_type !== 'text' && (
            <div className="caption">{post.content_text.slice(0, 100)}{post.content_text.length > 100 ? '...' : ''}</div>
          )}
          <div className="sound-info">
            🎵 Original Sound - {post.source_platform}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="actions-sidebar">
        <button className="action-btn">
          <span className="action-icon">❤️</span>
          <span className="action-count">{formatNumber(likes)}</span>
        </button>
        <button className="action-btn">
          <span className="action-icon">💬</span>
          <span className="action-count">{formatNumber(comments)}</span>
        </button>
        <button className="action-btn">
          <span className="action-icon">↗️</span>
          <span className="action-count">{formatNumber(shares)}</span>
        </button>
        <button className="action-btn">
          <span className="action-icon">⭐</span>
        </button>
      </div>

      <style jsx>{`
        .post-content {
          width: 100%;
          height: 100%;
          position: relative;
          background: black;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .content-area {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        /* Media styles - preserve aspect ratio and center */
        .media-video,
        .media-image {
          max-width: 100%;
          max-height: 80vh;
          width: auto;
          height: auto;
          object-fit: contain;
        }

        .media-video {
          border: none;
        }

        /* Text content styling */
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
          max-width: 500px;
        }

        .hotdog-emoji {
          font-size: 80px;
          margin-bottom: 24px;
        }

        .post-title {
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .post-text {
          font-size: 18px;
          line-height: 1.6;
          margin-bottom: 24px;
          color: rgba(255, 255, 255, 0.9);
        }

        .platform-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          font-size: 14px;
          backdrop-filter: blur(10px);
        }

        /* Bottom overlay - TikTok style */
        .bottom-overlay {
          position: absolute;
          bottom: 20px;
          left: 20px;
          right: 80px;
          z-index: 10;
        }

        .creator-info {
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
        }

        .username {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .caption {
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 6px;
          max-width: 450px;
        }

        .sound-info {
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 4px;
          opacity: 0.9;
        }

        /* Action sidebar - TikTok style */
        .actions-sidebar {
          position: absolute;
          right: 12px;
          bottom: 80px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 10;
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          width: 48px;
          height: 48px;
          padding: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: white;
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .action-icon {
          font-size: 20px;
          line-height: 1;
        }

        .action-count {
          font-size: 11px;
          font-weight: 600;
          margin-top: 2px;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .bottom-overlay {
            bottom: 80px;
            left: 16px;
            right: 70px;
          }

          .username {
            font-size: 14px;
          }

          .caption {
            font-size: 13px;
          }

          .sound-info {
            font-size: 12px;
          }

          .actions-sidebar {
            right: 8px;
            bottom: 80px;
          }

          .action-btn {
            width: 40px;
            height: 40px;
          }

          .action-icon {
            font-size: 18px;
          }

          .post-text {
            font-size: 16px;
          }

          .hotdog-emoji {
            font-size: 60px;
          }

          .post-title {
            font-size: 24px;
          }
        }

        /* Ensure proper aspect ratio handling */
        @media (orientation: portrait) {
          .media-video,
          .media-image {
            max-height: 70vh;
          }
        }

        @media (orientation: landscape) {
          .media-video,
          .media-image {
            max-width: 90%;
            max-height: 70vh;
          }
        }
      `}</style>
    </div>
  )
}