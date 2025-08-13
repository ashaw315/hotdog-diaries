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

// Enhanced test videos
const TEST_VIDEOS = [
  {
    id: -1,
    content_text: "Perfect hotdog grilling technique 🔥",
    content_type: 'video' as ContentType,
    content_video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    content_image_url: "https://images.unsplash.com/photo-1612392061787-2d078b2cb4b4?w=800&h=600&fit=crop",
    source_platform: 'youtube' as SourcePlatform,
    original_author: "chef_hotdog",
    original_url: "https://example.com/test1",
    scraped_at: new Date(),
    is_posted: false,
    is_approved: true,
    posted_at: new Date()
  },
  {
    id: -2,
    content_text: "Street vendor secrets revealed",
    content_type: 'video' as ContentType,
    content_video_url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
    content_image_url: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop",
    source_platform: 'pixabay' as SourcePlatform,
    original_author: "street_chef",
    original_url: "https://example.com/test2",
    scraped_at: new Date(),
    is_posted: false,
    is_approved: true,
    posted_at: new Date()
  }
]

// Fixed card dimensions
const CARD_HEIGHT = 600
const CARD_WIDTH = 450
const CARD_GAP = 20

export default function StandardizedTikTokFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef<{ [key: number]: HTMLVideoElement }>({})

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
        const apiPosts = data.data?.content || []
        
        const cleanedApiPosts = apiPosts.map(post => ({
          ...post,
          content_text: post.content_text && post.content_text.length > 150 
            ? post.content_text.substring(0, 150) + '...' 
            : post.content_text
        }))

        // Add welcome card for mobile
        const welcomeCard = {
          id: -999,
          content_text: "Welcome to Hotdog Diaries! Swipe up to explore delicious hotdog content from around the web.",
          content_type: 'text' as ContentType,
          content_image_url: null,
          content_video_url: null,
          source_platform: 'reddit' as SourcePlatform,
          original_author: "hotdog_diaries",
          original_url: "",
          scraped_at: new Date(),
          is_posted: false,
          is_approved: true,
          posted_at: new Date()
        }

        const allPosts = [
          ...(isMobile ? [welcomeCard] : []),
          ...TEST_VIDEOS,
          ...cleanedApiPosts.slice(0, 6)
        ]
        
        console.log(`Loaded ${allPosts.length} posts`)
        setPosts(allPosts)
      } else {
        throw new Error(data.error || 'Failed to load content')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  // Handle video play/pause
  useEffect(() => {
    Object.values(videosRef.current).forEach(video => {
      if (video) {
        video.pause()
        video.currentTime = 0
      }
    })

    const currentVideo = videosRef.current[currentIndex]
    if (currentVideo) {
      const playPromise = currentVideo.play()
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.log('Video autoplay failed:', err)
        })
      }
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
      const totalCardHeight = CARD_HEIGHT + CARD_GAP
      containerRef.current.scrollTo({
        top: index * totalCardHeight,
        behavior: 'smooth'
      })
    }
  }

  const handleScroll = () => {
    if (containerRef.current) {
      const scrollPosition = containerRef.current.scrollTop
      const totalCardHeight = CARD_HEIGHT + CARD_GAP
      const newIndex = Math.round(scrollPosition / totalCardHeight)
      
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < posts.length) {
        setCurrentIndex(newIndex)
      }
    }
  }

  // Touch support
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
        {!isMobile && (
          <>
            <div className="decorative-text left-text">HOTDOG</div>
            <div className="decorative-text right-text">DIARIES</div>
          </>
        )}
        <div className="loading-content">
          <div className="loading-spinner">🌭</div>
          <p>Loading hotdog content...</p>
        </div>
        <style jsx>{`
          .page-container {
            min-height: 100vh;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .loading-content {
            text-align: center;
            color: #333;
          }
          .loading-spinner {
            font-size: 48px;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          .decorative-text {
            position: fixed;
            font-size: 80px;
            font-weight: 900;
            color: #f5f5f5;
            z-index: 1;
            user-select: none;
            pointer-events: none;
          }
          .left-text {
            left: 40px;
            top: 50%;
            transform: translateY(-50%) rotate(-90deg);
            transform-origin: center;
          }
          .right-text {
            right: 40px;
            top: 50%;
            transform: translateY(-50%) rotate(90deg);
            transform-origin: center;
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
      <div className="page-container">
        {!isMobile && (
          <>
            <div className="decorative-text left-text">HOTDOG</div>
            <div className="decorative-text right-text">DIARIES</div>
          </>
        )}
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchPosts}>Try Again</button>
        </div>
        <style jsx>{`
          .page-container {
            min-height: 100vh;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .error-content {
            text-align: center;
            color: #333;
          }
          .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          button {
            margin-top: 16px;
            padding: 12px 24px;
            background: #333;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }
          .decorative-text {
            position: fixed;
            font-size: 80px;
            font-weight: 900;
            color: #f5f5f5;
            z-index: 1;
            user-select: none;
            pointer-events: none;
          }
          .left-text {
            left: 40px;
            top: 50%;
            transform: translateY(-50%) rotate(-90deg);
          }
          .right-text {
            right: 40px;
            top: 50%;
            transform: translateY(-50%) rotate(90deg);
          }
        `}</style>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="page-container">
        {!isMobile && (
          <>
            <div className="decorative-text left-text">HOTDOG</div>
            <div className="decorative-text right-text">DIARIES</div>
          </>
        )}
        <div className="empty-content">
          <div className="empty-icon">🌭</div>
          <p>No hotdog content found</p>
        </div>
        <style jsx>{`
          .page-container {
            min-height: 100vh;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .empty-content {
            text-align: center;
            color: #333;
          }
          .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
          }
          .decorative-text {
            position: fixed;
            font-size: 80px;
            font-weight: 900;
            color: #f5f5f5;
            z-index: 1;
            user-select: none;
            pointer-events: none;
          }
          .left-text {
            left: 40px;
            top: 50%;
            transform: translateY(-50%) rotate(-90deg);
          }
          .right-text {
            right: 40px;
            top: 50%;
            transform: translateY(-50%) rotate(90deg);
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Fixed decorative text - swapped sides */}
      {!isMobile && (
        <>
          <div className="decorative-text left-text">HOTDOG</div>
          <div className="decorative-text right-text">DIARIES</div>
        </>
      )}
      
      {/* Feed container */}
      <div 
        ref={containerRef}
        className="feed-container"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {posts.map((post, index) => (
          <div key={post.id} className="card-wrapper">
            <div className="post-card">
              <PostContent 
                post={post} 
                isActive={index === currentIndex}
                isWelcomeCard={post.id === -999}
                videoRef={(el) => {
                  if (el) videosRef.current[index] = el
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .page-container {
          min-height: 100vh;
          background: white;
          position: relative;
          overflow: hidden;
        }

        .decorative-text {
          position: fixed;
          font-size: 80px;
          font-weight: 900;
          color: #f5f5f5;
          z-index: 1;
          user-select: none;
          pointer-events: none;
          opacity: 0.4;
        }

        .left-text {
          left: 40px;
          top: 50%;
          transform: translateY(-50%) rotate(-90deg);
          transform-origin: center;
        }

        .right-text {
          right: 40px;
          top: 50%;
          transform: translateY(-50%) rotate(90deg);
          transform-origin: center;
        }

        .feed-container {
          height: 100vh;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: ${CARD_GAP}px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .feed-container::-webkit-scrollbar {
          display: none;
        }

        .card-wrapper {
          width: ${isMobile ? 'calc(100vw - 32px)' : `${CARD_WIDTH}px`};
          height: ${CARD_HEIGHT}px;
          margin-bottom: ${CARD_GAP}px;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          flex-shrink: 0;
        }

        .post-card {
          width: 100%;
          height: 100%;
          background: black;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        }

        @media (max-width: 768px) {
          .card-wrapper {
            margin: 0 16px ${CARD_GAP}px 16px;
          }
          
          .post-card {
            border-radius: 12px;
          }
        }
      `}</style>
    </div>
  )
}

function PostContent({ 
  post, 
  isActive, 
  isWelcomeCard = false,
  videoRef 
}: { 
  post: Post
  isActive: boolean
  isWelcomeCard?: boolean
  videoRef: (el: HTMLVideoElement | null) => void
}) {
  const [imageError, setImageError] = useState(false)
  const [videoError, setVideoError] = useState(false)

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

  const cleanAuthor = (author?: string) => {
    if (!author) return 'hotdog_lover'
    return author
      .replace(/^(u\/|r\/|@)/, '')
      .replace(/\s+\(via.*?\)$/i, '')
      .substring(0, 20)
  }

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&#?\n]+)/,
      /youtube\.com\/watch\?.*v=([^&#?\n]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const renderMedia = () => {
    // Welcome card special handling
    if (isWelcomeCard) {
      return (
        <div className="welcome-content">
          <div className="welcome-wrapper">
            <div className="hotdog-logo">🌭</div>
            <h1 className="welcome-title">Hotdog Diaries</h1>
            <p className="welcome-text">Discover the best hotdog content from around the web</p>
            <div className="welcome-instruction">Swipe up to explore →</div>
          </div>
        </div>
      )
    }

    // Video content with YouTube handling
    if (post.content_type === 'video' && post.content_video_url && !videoError) {
      // YouTube videos
      if (post.content_video_url.includes('youtube.com') || post.content_video_url.includes('youtu.be')) {
        const videoId = extractYouTubeId(post.content_video_url)
        if (videoId) {
          return (
            <div className="youtube-container">
              <iframe
                className="youtube-iframe"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=1&controls=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube video"
              />
            </div>
          )
        }
      }
      
      // Direct video files
      if (post.content_video_url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) || 
          post.content_video_url.includes('sample-videos.com')) {
        return (
          <video
            ref={videoRef}
            className="media-video"
            src={post.content_video_url}
            loop
            muted
            playsInline
            poster={post.content_image_url}
            onError={() => setVideoError(true)}
          />
        )
      }
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
      <div className="content-area">
        {renderMedia()}
      </div>

      {/* Info overlay - not for welcome card */}
      {!isWelcomeCard && (
        <div className="info-overlay">
          <div className="creator-info">
            <div className="username">@{cleanAuthor(post.original_author)}</div>
            {post.content_text && post.content_type !== 'text' && (
              <div className="caption">{post.content_text}</div>
            )}
            <div className="platform-info">
              {getPlatformIcon(post.source_platform)} {post.source_platform}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .post-content {
          width: 100%;
          height: 100%;
          position: relative;
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

        /* Welcome card styling */
        .welcome-content {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%);
        }

        .welcome-wrapper {
          text-align: center;
          color: white;
          padding: 40px;
        }

        .hotdog-logo {
          font-size: 100px;
          margin-bottom: 20px;
          animation: bounce 2s infinite;
        }

        .welcome-title {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 16px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .welcome-text {
          font-size: 18px;
          margin-bottom: 30px;
          opacity: 0.9;
          line-height: 1.5;
        }

        .welcome-instruction {
          font-size: 16px;
          background: rgba(255, 255, 255, 0.2);
          padding: 12px 24px;
          border-radius: 25px;
          backdrop-filter: blur(10px);
          display: inline-block;
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }

        /* YouTube container for proper sizing */
        .youtube-container {
          width: 100%;
          height: 100%;
          position: relative;
        }

        .youtube-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }

        /* Standard media sizing - fills card */
        .media-video,
        .media-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
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
          max-width: 400px;
        }

        .hotdog-emoji {
          font-size: 80px;
          margin-bottom: 24px;
        }

        .post-text {
          font-size: 18px;
          line-height: 1.5;
          margin-bottom: 24px;
          color: rgba(255, 255, 255, 0.95);
          font-weight: 500;
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

        /* Info overlay */
        .info-overlay {
          position: absolute;
          bottom: 20px;
          left: 20px;
          right: 20px;
          z-index: 10;
        }

        .creator-info {
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }

        .username {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .caption {
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 8px;
          max-width: 400px;
        }

        .platform-info {
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          opacity: 0.8;
        }

        @media (max-width: 768px) {
          .welcome-title {
            font-size: 28px;
          }
          
          .welcome-text {
            font-size: 16px;
          }
          
          .hotdog-logo {
            font-size: 80px;
          }

          .info-overlay {
            bottom: 16px;
            left: 16px;
            right: 16px;
          }

          .username {
            font-size: 14px;
          }

          .caption {
            font-size: 13px;
          }

          .platform-info {
            font-size: 12px;
          }

          .post-text {
            font-size: 16px;
          }

          .hotdog-emoji {
            font-size: 60px;
          }
        }
      `}</style>
    </div>
  )
}