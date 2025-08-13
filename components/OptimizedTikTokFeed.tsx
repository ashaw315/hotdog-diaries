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

// Test videos with different aspect ratios
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
    source_platform: 'tumblr' as SourcePlatform,
    original_author: "street_chef",
    original_url: "https://example.com/test2",
    scraped_at: new Date(),
    is_posted: false,
    is_approved: true,
    posted_at: new Date()
  },
  {
    id: -3,
    content_text: "Chicago vs New York style debate",
    content_type: 'video' as ContentType,
    content_video_url: "https://youtu.be/dQw4w9WgXcQ",
    content_image_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&h=600&fit=crop",
    source_platform: 'youtube' as SourcePlatform,
    original_author: "hotdog_expert",
    original_url: "https://example.com/test3",
    scraped_at: new Date(),
    is_posted: false,
    is_approved: true,
    posted_at: new Date()
  }
]

export default function OptimizedTikTokFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef<{ [key: number]: HTMLVideoElement }>({})

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

        // Welcome card for mobile
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
          ...cleanedApiPosts
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

  // Keyboard navigation + debug toggle
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
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setDebugMode(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentIndex, posts.length])

  const scrollToPost = (index: number) => {
    if (containerRef.current) {
      // Each card container is 100vh (85vh card + 7.5vh top + 7.5vh bottom padding)
      containerRef.current.scrollTo({
        top: index * window.innerHeight,
        behavior: 'smooth'
      })
    }
  }

  const handleScroll = () => {
    if (containerRef.current) {
      const scrollPosition = containerRef.current.scrollTop
      const newIndex = Math.round(scrollPosition / window.innerHeight)
      
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

  // Determine card width based on content aspect ratio
  const getCardWidth = (post: Post) => {
    if (isMobile) return 'calc(100vw - 32px)'
    
    // For video content, try to determine aspect ratio
    if (post.content_type === 'video' && post.content_video_url) {
      if (post.content_video_url.includes('youtube.com') || post.content_video_url.includes('youtu.be')) {
        return '700px' // YouTube videos are typically landscape
      }
      return '600px' // Other videos, assume landscape-ish
    }
    
    // For images, assume portrait/square for social media content
    if (post.content_image_url) {
      return '450px'
    }
    
    // Text posts
    return '500px'
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="header-title">
          <span className="hotdog-icon">🌭</span>
          <span className="title-text">Hotdog Diaries</span>
        </div>
        <div className="loading-content">
          <div className="loading-spinner">🌭</div>
          <p>Loading hotdog content...</p>
        </div>
        <style jsx>{`
          .page-container {
            height: 100vh;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
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
          }
          .hotdog-icon {
            font-size: 28px;
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
        <div className="header-title">
          <span className="hotdog-icon">🌭</span>
          <span className="title-text">Hotdog Diaries</span>
        </div>
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchPosts}>Try Again</button>
        </div>
        <style jsx>{`
          .page-container {
            height: 100vh;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
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
          }
          .hotdog-icon {
            font-size: 28px;
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
        `}</style>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="page-container">
        <div className="header-title">
          <span className="hotdog-icon">🌭</span>
          <span className="title-text">Hotdog Diaries</span>
        </div>
        <div className="empty-content">
          <div className="empty-icon">🌭</div>
          <p>No hotdog content found</p>
        </div>
        <style jsx>{`
          .page-container {
            height: 100vh;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
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
          }
          .hotdog-icon {
            font-size: 28px;
          }
          .empty-content {
            text-align: center;
            color: #333;
          }
          .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Fixed header title */}
      <div className="header-title">
        <span className="hotdog-icon">🌭</span>
        <span className="title-text">Hotdog Diaries</span>
      </div>
      
      {/* Feed container */}
      <div 
        ref={containerRef}
        className="feed-container"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {posts.map((post, index) => (
          <div key={post.id} className="card-slot">
            <div 
              className="post-card"
              style={{ width: getCardWidth(post) }}
            >
              <PostContent 
                post={post} 
                isActive={index === currentIndex}
                isWelcomeCard={post.id === -999}
                videoRef={(el) => {
                  if (el) videosRef.current[index] = el
                }}
                index={index}
                debugMode={debugMode}
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

        .hotdog-icon {
          font-size: 28px;
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

        .card-slot {
          width: 100vw;
          height: 100vh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 7.5vh 0;
        }

        .post-card {
          height: 85vh;
          background: black;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 768px) {
          .header-title {
            font-size: 20px;
            top: 15px;
            left: 15px;
          }
          
          .hotdog-icon {
            font-size: 24px;
          }
          
          .card-slot {
            padding: 5vh 16px;
          }
          
          .post-card {
            height: 90vh;
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
  videoRef,
  index,
  debugMode = false
}: { 
  post: Post
  isActive: boolean
  isWelcomeCard?: boolean
  videoRef: (el: HTMLVideoElement | null) => void
  index: number
  debugMode?: boolean
}) {
  const [imageError, setImageError] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [giphyPlaying, setGiphyPlaying] = useState(false)
  const postContentRef = useRef<HTMLDivElement>(null)
  const giphyVideoRef = useRef<HTMLVideoElement>(null)

  // Mobile detection and network awareness
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Check if on slow connection for Giphy optimization
  const isSlowConnection = () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.saveData
    }
    return false
  }

  // Handle Giphy tap-to-play on mobile
  const handleGiphyTap = () => {
    if (isMobile && post.source_platform === 'giphy' && giphyVideoRef.current) {
      if (giphyPlaying) {
        giphyVideoRef.current.pause()
        setGiphyPlaying(false)
      } else {
        giphyVideoRef.current.play().then(() => {
          setGiphyPlaying(true)
        }).catch(() => {
          // If play fails, fallback to showing static image
          setVideoError(true)
        })
      }
    }
  }

  // Intersection Observer for performance
  useEffect(() => {
    if (!postContentRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsIntersecting(entry.isIntersecting)
          
          // Pause Giphy GIFs when off-screen
          if (post.source_platform === 'giphy' && giphyVideoRef.current) {
            if (entry.isIntersecting && isActive) {
              giphyVideoRef.current.play().catch(() => {})
            } else {
              giphyVideoRef.current.pause()
            }
          }
        })
      },
      { threshold: 0.1 }
    )

    observer.observe(postContentRef.current)
    return () => observer.disconnect()
  }, [post.source_platform, isActive])

  // NUCLEAR OPTION: Force YouTube sizing after render
  useEffect(() => {
    if (postContentRef.current && isActive) {
      const forceYouTubeSize = () => {
        const youtubeIframes = postContentRef.current!.querySelectorAll('iframe')
        youtubeIframes.forEach((iframe) => {
          iframe.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          `
        })
      }
      
      // Force sizing immediately and after a delay
      forceYouTubeSize()
      setTimeout(forceYouTubeSize, 100)
    }
  }, [isActive, post.content_video_url])

  const getPlatformIcon = (platform: SourcePlatform) => {
    const icons: Record<string, string> = {
      reddit: '🤖',
      youtube: '📺',
      pixabay: '📷',
      imgur: '📸',
      tumblr: '📱',
      flickr: '📸',
      unsplash: '🎨',
      giphy: '🎭'
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
    // Welcome card
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

    // Giphy content - Optimized rendering with MP4 fallback and mobile optimization
    if (post.source_platform === 'giphy') {
      // Parse metadata for size options
      const metadata = post.content_metadata ? JSON.parse(post.content_metadata) : null
      const hasMP4 = post.content_video_url && post.content_video_url.includes('.mp4')
      const hasGIF = post.content_image_url && (post.content_image_url.includes('.gif') || post.content_image_url.includes('giphy.com'))
      
      // Select appropriate size based on device and metadata
      let imageUrl = post.content_image_url
      if (metadata?.sizes && isMobile) {
        // Use smaller size for mobile to save bandwidth
        imageUrl = metadata.sizes.fixed_width_small || metadata.sizes.preview || post.content_image_url
      }
      
      if (hasMP4 && !videoError && !isSlowConnection()) {
        return (
          <div className="giphy-container" onClick={handleGiphyTap}>
            <video
              ref={(el) => {
                videoRef(el)
                giphyVideoRef.current = el
              }}
              className="giphy-video"
              src={post.content_video_url}
              loop
              muted
              playsInline
              autoPlay={!isMobile && isActive && isIntersecting}
              poster={imageUrl}
              onError={() => setVideoError(true)}
              onPlay={() => setGiphyPlaying(true)}
              onPause={() => setGiphyPlaying(false)}
              style={{
                willChange: isActive ? 'transform' : 'auto'
              }}
              loading={index > 2 ? 'lazy' : 'eager'}
              preload={isMobile ? 'metadata' : 'auto'}
            />
            {isMobile && !giphyPlaying && (
              <div className="tap-to-play-overlay">
                <div className="play-button">▶️</div>
                <div className="tap-instruction">Tap to play</div>
              </div>
            )}
          </div>
        )
      } else if (hasGIF && !imageError) {
        // Fallback to GIF with mobile optimization
        return (
          <div className="giphy-container">
            <img 
              className="giphy-gif"
              src={imageUrl}
              alt={post.content_text || 'Giphy GIF'}
              onError={() => setImageError(true)}
              loading={index > 2 ? 'lazy' : 'eager'}
              style={{
                willChange: isActive ? 'transform' : 'auto'
              }}
            />
          </div>
        )
      }
    }

    // Video content - FORCED to fill entire card
    if (post.content_type === 'video' && post.content_video_url && !videoError) {
      // YouTube videos - Production-ready embed with autoplay
      if (post.content_video_url.includes('youtube.com') || post.content_video_url.includes('youtu.be')) {
        const videoId = extractYouTubeId(post.content_video_url);
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0`}
            className="content-image"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`YouTube video ${videoId}`}
          />
        );
      }
      
      // Direct video files - FORCED to fill
      let videoSrc = post.content_video_url;
      
      // Fix Imgur URLs: convert .gif to .mp4 for better playback
      if (post.source_platform === 'imgur' && videoSrc?.endsWith('.gif')) {
        videoSrc = videoSrc.replace('.gif', '.mp4');
      }
      
      return (
        <div className="video-container">
          <video
            ref={videoRef}
            className="direct-video"
            src={videoSrc}
            loop
            muted
            playsInline
            autoPlay
            poster={post.content_image_url}
            onError={() => setVideoError(true)}
          />
        </div>
      )
    }

    // Image content - FORCED to fill
    if (post.content_image_url && !imageError) {
      return (
        <div className="image-container">
          <img 
            className="content-image"
            src={post.content_image_url}
            alt={post.content_text || 'Hotdog content'}
            onError={() => setImageError(true)}
          />
        </div>
      )
    }

    // Text content
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
    <div 
      ref={postContentRef} 
      className="post-content" 
      data-platform={post.source_platform} 
      data-testid="content-card"
      data-id={post.id}
      data-type={post.content_type}
      data-video-url={post.content_video_url || ''}
      data-image-url={post.content_image_url || ''}
      data-author={post.original_author || ''}
    >
      {renderMedia()}
      
      {/* Debug overlay */}
      {debugMode && !isWelcomeCard && (
        <div className="debug-overlay">
          <div>Platform: {post.source_platform}</div>
          <div>ID: {post.id}</div>
          <div>Has Video: {post.content_video_url ? 'Yes' : 'No'}</div>
          <div>Has Image: {post.content_image_url ? 'Yes' : 'No'}</div>
          <div>Index: {index}</div>
          <div>Type: {post.content_type}</div>
          <div>Author: {post.original_author}</div>
          <div>Video URL: {post.content_video_url?.substring(0, 50)}...</div>
          <div>Image URL: {post.content_image_url?.substring(0, 50)}...</div>
        </div>
      )}

      <style jsx>{`
        .post-content {
          width: 100%;
          height: 100%;
          position: relative;
        }

        /* NUCLEAR OPTION - Force ALL children to full size */
        .post-content * {
          box-sizing: border-box !important;
        }

        .post-content > * {
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          max-height: none !important;
          min-width: 0 !important;
          min-height: 0 !important;
        }

        /* FORCE ALL MEDIA TO FILL CARD COMPLETELY */
        .video-container,
        .image-container,
        .giphy-container {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden;
        }

        .youtube-iframe-fullsize {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          outline: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background: black !important;
          z-index: 1;
          aspect-ratio: unset !important;
          object-fit: cover !important;
        }

        /* Override any potential aspect ratio containers */
        .post-content [class*="aspect"],
        .post-content [class*="ratio"],
        .post-content [class*="embed"],
        .post-content [class*="video"] {
          position: static !important;
          width: 100% !important;
          height: 100% !important;
          padding: 0 !important;
          aspect-ratio: unset !important;
        }

        .direct-video,
        .content-image,
        .giphy-video,
        .giphy-gif {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          object-fit: cover !important;
          min-width: 100% !important;
          min-height: 100% !important;
        }

        /* Giphy-specific optimizations */
        .giphy-video,
        .giphy-gif {
          transform: translateZ(0); /* Force hardware acceleration */
          image-rendering: optimizeQuality;
        }

        .giphy-video {
          background-color: transparent;
        }

        .giphy-gif {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }

        /* Tap-to-play overlay for mobile Giphy content */
        .tap-to-play-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.7);
          border-radius: 20px;
          padding: 16px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: white;
          font-size: 14px;
          z-index: 10;
          pointer-events: none;
          backdrop-filter: blur(10px);
        }

        .play-button {
          font-size: 32px;
          margin-bottom: 4px;
        }

        .tap-instruction {
          font-weight: 500;
          opacity: 0.9;
        }

        .debug-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px;
          font-size: 12px;
          font-family: monospace;
          z-index: 100;
          line-height: 1.3;
        }

        /* Welcome card */
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

        /* Text content */
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
          max-width: 350px;
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
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
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
          max-width: 350px;
        }

        .platform-info {
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 0, 0, 0.3);
          padding: 4px 8px;
          border-radius: 12px;
          opacity: 0.9;
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