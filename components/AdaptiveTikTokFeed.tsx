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
  content_metadata?: string
  scraped_at: Date
  is_posted: boolean
  is_approved: boolean
  posted_at?: Date
}

// Helper to determine card class based on content
function getCardClass(post: Post): string {
  if (post.content_type === 'video' && post.source_platform === 'youtube') return 'card-youtube'
  if (post.content_type === 'gif' || post.source_platform === 'giphy') return 'card-gif'
  if (post.content_type === 'image' && !post.content_text) return 'card-image'
  if (post.content_type === 'text' || (!post.content_image_url && !post.content_video_url)) return 'card-text'
  if (post.content_image_url && post.content_text) return 'card-mixed'
  return 'card-default'
}

// Helper to determine if content is portrait/tall
function isPortraitContent(url: string): boolean {
  // Common portrait platforms/patterns
  return url.includes('tiktok') || url.includes('instagram') || url.includes('stories')
}

export default function AdaptiveTikTokFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDebugBorders, setShowDebugBorders] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef<{ [key: number]: HTMLVideoElement }>({})

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
      
      // Add welcome card
      const welcomeCard: Post = {
        id: -999,
        content_text: "Welcome to Hotdog Diaries! Swipe up to see the best hotdog content from around the internet.",
        content_type: 'text' as ContentType,
        source_platform: 'reddit' as SourcePlatform,
        original_url: '',
        original_author: 'Hotdog Diaries',
        scraped_at: new Date(),
        is_posted: false,
        is_approved: true
      }
      
      setPosts([welcomeCard, ...data.items])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  const handleScroll = () => {
    if (!containerRef.current) return
    
    const scrollTop = containerRef.current.scrollTop
    const viewportHeight = window.innerHeight
    const newIndex = Math.round(scrollTop / viewportHeight)
    
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex)
      
      // Pause previous video
      if (videosRef.current[currentIndex]) {
        videosRef.current[currentIndex].pause()
      }
      
      // Play new video if exists
      if (videosRef.current[newIndex]) {
        videosRef.current[newIndex].play().catch(() => {})
      }
    }
  }

  // Toggle debug borders with 'D' key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebugBorders(prev => !prev)
      }
    }
    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [])

  const getPlatformIcon = (platform: SourcePlatform) => {
    const icons: Record<SourcePlatform, string> = {
      reddit: '🟠',
      youtube: '🔴',
      tumblr: '💙',
      giphy: '🎬',
      bluesky: '🦋',
      imgur: '🟢',
      pixabay: '🖼️',
      lemmy: '🐭'
    }
    return icons[platform] || '🌐'
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner">🌭</div>
          <p>Loading hotdog content...</p>
        </div>
        <style jsx>{`
          .loading-container {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f0f0f0;
          }
          .loading-content {
            text-align: center;
          }
          .spinner {
            font-size: 48px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
        <style jsx>{`
          .error-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
          }
          button {
            padding: 8px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Fixed header */}
      <div className="header-title">
        <span className="hotdog-icon">🌭</span>
        <span className="title-text">Hotdog Diaries</span>
        {showDebugBorders && <span className="debug-indicator">DEBUG</span>}
      </div>
      
      {/* Feed container */}
      <div 
        ref={containerRef}
        className="feed-container"
        onScroll={handleScroll}
      >
        {posts.map((post, index) => (
          <div 
            key={post.id} 
            className={`card-wrapper ${showDebugBorders ? 'debug-borders' : ''}`}
          >
            <div className={`content-card ${getCardClass(post)}`}>
              <PostContent 
                post={post} 
                isActive={index === currentIndex}
                videoRef={(el) => {
                  if (el) videosRef.current[index] = el
                }}
                getPlatformIcon={getPlatformIcon}
              />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .page-container {
          height: 100vh;
          background: white;
          position: relative;
          overflow: hidden;
        }

        .header-title {
          position: fixed;
          top: 20px;
          left: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 24px;
          font-weight: 700;
          color: black;
          z-index: 100;
          background: rgba(255, 255, 255, 0.9);
          padding: 8px 12px;
          border-radius: 8px;
          backdrop-filter: blur(10px);
        }

        .debug-indicator {
          font-size: 12px;
          background: red;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
        }

        .feed-container {
          height: 100vh;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .feed-container::-webkit-scrollbar {
          display: none;
        }

        .card-wrapper {
          width: 100vw;
          min-height: 100vh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          box-sizing: border-box;
        }

        .card-wrapper.debug-borders {
          border: 3px solid red;
          background: rgba(255, 0, 0, 0.05);
        }

        /* Base card - perfect fit sizing */
        .content-card {
          width: 100%;
          max-width: 500px;
          height: fit-content; /* Perfect content fit */
          min-height: unset; /* No minimum height */
          max-height: 85vh;
          background: black;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
        }

        /* Platform-specific card types - perfect fit */
        .card-youtube {
          aspect-ratio: 16/9;
          height: fit-content;
        }

        .card-gif {
          height: fit-content;
          max-height: 70vh;
        }

        .card-image {
          height: fit-content;
          max-height: 80vh;
        }

        .card-text {
          height: fit-content; /* No minimum height */
          max-height: 60vh;
          background: #f8f8f8;
        }

        .card-mixed {
          height: fit-content;
          max-height: 80vh;
        }

        /* Mobile adjustments */
        @media (max-width: 768px) {
          .header-title {
            font-size: 20px;
            top: 15px;
            left: 15px;
          }
          
          .card-wrapper {
            padding: 20px 16px;
          }
          
          .content-card {
            max-width: 100%;
            max-height: 90vh;
            border-radius: 12px;
          }

          .card-youtube {
            max-width: 100%;
          }
        }

        /* Large screens */
        @media (min-width: 1200px) {
          .content-card {
            max-width: 600px;
          }
        }
      `}</style>
    </div>
  )
}

function PostContent({ 
  post, 
  isActive, 
  videoRef,
  getPlatformIcon
}: { 
  post: Post
  isActive: boolean
  videoRef?: (el: HTMLVideoElement | null) => void
  getPlatformIcon: (platform: SourcePlatform) => string
}) {
  const [imageError, setImageError] = useState(false)
  const [videoError, setVideoError] = useState(false)

  const isWelcomeCard = post.id === -999

  if (isWelcomeCard) {
    return (
      <div className="welcome-card">
        <div className="welcome-content">
          <div className="welcome-emoji">🌭</div>
          <h1>Welcome to Hotdog Diaries</h1>
          <p>{post.content_text}</p>
          <div className="swipe-hint">
            <div className="arrow">↑</div>
            <p>Swipe up to begin</p>
          </div>
        </div>
        <style jsx>{`
          .welcome-card {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
            color: white;
            text-align: center;
            padding: 32px;
          }
          .welcome-emoji {
            font-size: 72px;
            margin-bottom: 24px;
          }
          h1 {
            font-size: 32px;
            margin-bottom: 16px;
          }
          .swipe-hint {
            margin-top: 48px;
            opacity: 0.8;
          }
          .arrow {
            font-size: 24px;
            animation: bounce 2s infinite;
          }
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
          }
        `}</style>
      </div>
    )
  }

  const renderMedia = () => {
    // YouTube videos - maintain 16:9 aspect ratio
    if (post.source_platform === 'youtube' && post.content_video_url && !videoError) {
      const videoId = post.content_video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      if (videoId) {
        return (
          <div className="youtube-container">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=1&loop=1&playlist=${videoId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )
      }
    }

    // Giphy content - preserve aspect ratio
    if (post.source_platform === 'giphy') {
      if (post.content_video_url && !videoError) {
        return (
          <div className="giphy-container">
            <video
              ref={videoRef}
              src={post.content_video_url}
              autoPlay={isActive}
              loop
              muted
              playsInline
              poster={post.content_image_url}
              onError={() => setVideoError(true)}
            />
          </div>
        )
      } else if (post.content_image_url && !imageError) {
        return (
          <div className="giphy-container">
            <img 
              src={post.content_image_url}
              alt={post.content_text || 'Giphy content'}
              onError={() => setImageError(true)}
            />
          </div>
        )
      }
    }

    // Direct videos
    if (post.content_video_url && !videoError) {
      return (
        <div className="video-container">
          <video
            ref={videoRef}
            src={post.content_video_url}
            autoPlay={isActive}
            loop
            muted
            playsInline
            controls={false}
            poster={post.content_image_url}
            onError={() => setVideoError(true)}
          />
        </div>
      )
    }

    // Images - contain instead of cover
    if (post.content_image_url && !imageError) {
      return (
        <div className="image-container">
          <img 
            src={post.content_image_url}
            alt={post.content_text || 'Content'}
            onError={() => setImageError(true)}
          />
        </div>
      )
    }

    // Text content
    return (
      <div className="text-container">
        <div className="platform-badge">
          {getPlatformIcon(post.source_platform)} {post.source_platform}
        </div>
        <div className="text-content">
          <p>{post.content_text || 'No content available'}</p>
        </div>
        {post.original_author && (
          <div className="author">by {post.original_author}</div>
        )}
      </div>
    )
  }

  return (
    <div className="post-content">
      {renderMedia()}
      
      <style jsx>{`
        .post-content {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* YouTube 16:9 container */
        .youtube-container {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          background: black;
        }

        .youtube-container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }

        /* Giphy - maintain aspect ratio, no padding */
        .giphy-container {
          width: 100%;
          height: fit-content; /* Fit content height */
          display: block; /* Block instead of flex to eliminate spacing */
          background: black;
          padding: 0; /* Remove all padding */
          margin: 0;
          line-height: 0; /* Remove line-height spacing */
        }

        .giphy-container video,
        .giphy-container img {
          width: 100%;
          height: auto; /* Natural height */
          object-fit: contain; /* Preserve aspect ratio */
          display: block; /* Remove inline spacing */
          margin: 0;
          padding: 0;
          border: 0; /* Remove any border */
          outline: 0; /* Remove any outline */
          vertical-align: top; /* Remove baseline spacing */
        }

        /* Video container - no padding */
        .video-container {
          width: 100%;
          height: fit-content; /* Fit video height */
          display: block; /* Block instead of flex */
          background: black;
          padding: 0; /* Remove padding */
          margin: 0;
          line-height: 0; /* Remove line-height spacing */
        }

        .video-container video {
          width: 100%;
          height: auto; /* Natural video height */
          object-fit: contain; /* Preserve aspect ratio */
          display: block; /* Remove inline spacing */
          margin: 0;
          padding: 0;
          border: 0; /* Remove any border */
          outline: 0; /* Remove any outline */
          vertical-align: top; /* Remove baseline spacing */
        }

        /* Image container - edge to edge */
        .image-container {
          width: 100%;
          height: fit-content; /* Fit image height */
          display: block; /* Block instead of flex */
          background: black;
          padding: 0; /* Remove padding - edge to edge */
          margin: 0;
          box-sizing: border-box;
          line-height: 0; /* Remove line-height spacing */
        }

        .image-container img {
          width: 100%;
          height: auto; /* Natural image height */
          object-fit: contain; /* Preserve aspect ratio */
          display: block; /* Remove inline spacing */
          margin: 0;
          padding: 0;
          border: 0; /* Remove any border */
          outline: 0; /* Remove any outline */
          vertical-align: top; /* Remove baseline spacing */
        }

        /* Text content - minimal padding */
        .text-container {
          width: 100%;
          height: fit-content; /* Fit text content */
          padding: 12px; /* Minimal padding for readability */
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          background: white;
          color: #333;
          min-height: unset; /* No minimum height */
        }

        .platform-badge {
          background: #f0f0f0;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .text-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
          max-height: 400px;
          width: 100%;
        }

        .text-content p {
          font-size: 18px;
          line-height: 1.4; /* Tighter line height */
          margin: 0; /* Remove margins */
          padding: 0; /* No padding */
        }

        .author {
          font-size: 14px;
          color: #666;
          margin-top: 16px;
        }

        /* Mobile adjustments */
        @media (max-width: 768px) {
          .text-container {
            padding: 20px;
          }
          
          .text-content p {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  )
}