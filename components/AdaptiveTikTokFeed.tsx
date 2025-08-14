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
  const [showSizeDebug, setShowSizeDebug] = useState(false)
  const [cardSizes, setCardSizes] = useState<{[key: number]: any}>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef<{ [key: number]: HTMLVideoElement }>({})

  useEffect(() => {
    fetchPosts()
  }, [])

  // Apply critical platform-specific fixes via JavaScript
  useEffect(() => {
    if (posts.length > 0) {
      const timer = setTimeout(() => {
        try {
          // SAFETY GUARD: Process only first 16 cards to prevent performance issues
          const postsToProcess = posts.slice(0, 16)
          
          // Batch DOM operations using requestAnimationFrame for better performance
          requestAnimationFrame(() => {
            postsToProcess.forEach((post) => {
              const cardElement = document.querySelector(`[data-card-id="${post.id}"]`) as HTMLElement
              if (!cardElement) return

              // Fix YouTube iframe - enforce strict containment
              if (post.source_platform === 'youtube') {
                const iframe = cardElement.querySelector('iframe') as HTMLIFrameElement
                const container = cardElement.querySelector('.youtube-container') as HTMLElement
                if (iframe && container) {
                  // Force fixed dimensions - NO dynamic sizing
                  iframe.style.cssText = `position: absolute !important; top: 0 !important; left: 0 !important; width: 400px !important; height: 225px !important; border: none !important; max-width: 400px !important; max-height: 225px !important;`
                  container.style.cssText = `position: relative !important; width: 400px !important; height: 225px !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; line-height: 0 !important; font-size: 0 !important;`
                  console.log(`🎥 YouTube enforced containment: ${post.id} (400x225 fixed)`)
                }
              }

              // Fix Bluesky text visibility with optimized styling
              if (post.source_platform === 'bluesky') {
                const textContainer = cardElement.querySelector('.text-container') as HTMLElement
                if (textContainer) {
                  // Batch style updates for better performance
                  textContainer.style.cssText = 'color: #000000 !important; background-color: white !important; width: 100%; font-size: 16px;'
                  
                  const pElement = textContainer.querySelector('p') as HTMLElement
                  if (pElement) {
                    pElement.style.cssText = 'color: #000000 !important; font-size: 16px; line-height: 1.4; white-space: normal; word-wrap: break-word;'
                  }
                  console.log(`📝 Fixed Bluesky text color: ${post.id}`)
                }
              }
            })
          })
        } catch (error) {
          console.error('❌ Error applying style fixes:', error)
        }
      }, 200) // Small delay to ensure elements are rendered

      return () => clearTimeout(timer)
    }
  }, [posts])

  // EMERGENCY: Clean up any expanded YouTube players  
  useEffect(() => {
    const cleanupYouTubePlayers = () => {
      // Remove any full YouTube players that might have expanded
      const players = document.querySelectorAll('.html5-video-player, .ytp-player')
      players.forEach(player => {
        const card = player.closest('[data-card-id]')
        if (card) {
          console.log(`🚨 Removing expanded YouTube player from card ${card.getAttribute('data-card-id')}`)
          // Don't remove the player, just force it to be contained
          const playerElement = player as HTMLElement
          playerElement.style.maxWidth = '400px'
          playerElement.style.maxHeight = '225px' 
          playerElement.style.overflow = 'hidden'
        }
      })

      // Also ensure all YouTube containers are properly contained
      const containers = document.querySelectorAll('.youtube-container')
      containers.forEach(container => {
        const containerElement = container as HTMLElement
        containerElement.style.width = '400px'
        containerElement.style.height = '225px'
        containerElement.style.overflow = 'hidden'
      })
    }

    const timer = setTimeout(cleanupYouTubePlayers, 500)
    return () => clearTimeout(timer)
  }, [posts])

  // Measure cards when size debug is enabled
  useEffect(() => {
    if (!showSizeDebug || posts.length === 0) return

    const measureCards = () => {
      const newSizes: {[key: number]: any} = {}
      
      posts.forEach((post) => {
        const cardElement = document.querySelector(`[data-card-id="${post.id}"]`) as HTMLElement
        if (!cardElement) return
        
        const contentElement = cardElement.querySelector('.content-card') as HTMLElement
        const mediaElement = cardElement.querySelector('img, video, iframe, .text-container') as HTMLElement
        
        if (contentElement && mediaElement) {
          const cardBounds = contentElement.getBoundingClientRect()
          const mediaBounds = mediaElement.getBoundingClientRect()
          
          newSizes[post.id] = {
            card: {
              width: cardBounds.width,
              height: cardBounds.height
            },
            content: {
              width: mediaBounds.width,
              height: mediaBounds.height,
              type: mediaElement.tagName.toLowerCase()
            },
            diff: {
              width: cardBounds.width - mediaBounds.width,
              height: cardBounds.height - mediaBounds.height
            },
            platform: post.source_platform
          }
        }
      })
      
      setCardSizes(newSizes)
      console.log('📏 Card measurements:', newSizes)
    }

    const timer = setTimeout(measureCards, 500)
    return () => clearTimeout(timer)
  }, [showSizeDebug, posts, currentIndex])

  // Auto-fit cards to content size
  useEffect(() => {
    if (posts.length === 0) return

    const autoFitCards = () => {
      posts.forEach((post) => {
        const cardElement = document.querySelector(`[data-card-id="${post.id}"]`) as HTMLElement
        if (!cardElement) return
        
        const contentCard = cardElement.querySelector('.content-card') as HTMLElement
        const postContent = cardElement.querySelector('.post-content') as HTMLElement
        const mediaElement = cardElement.querySelector('img, video, iframe, .text-container') as HTMLElement
        
        if (contentCard && postContent && mediaElement) {
          // Get the actual content dimensions
          const mediaBounds = mediaElement.getBoundingClientRect()
          
          // Set card to match content exactly
          contentCard.style.width = `${mediaBounds.width}px`
          contentCard.style.height = `${mediaBounds.height}px`
          postContent.style.width = `${mediaBounds.width}px`
          postContent.style.height = `${mediaBounds.height}px`
          
          console.log(`✨ Auto-fit ${post.source_platform}: ${mediaBounds.width}×${mediaBounds.height}`)
        }
      })
    }

    const timer = setTimeout(autoFitCards, 600)
    return () => clearTimeout(timer)
  }, [posts])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/content?limit=50')
      
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
      
      // Transform API response to match Post interface
      const transformedContent = data.data.content.map((item: any) => ({
        ...item,
        is_posted: !!item.is_posted,
        is_approved: !!item.is_approved,
        scraped_at: new Date(item.scraped_at),
        posted_at: item.posted_at ? new Date(item.posted_at) : undefined
      }))
      
      setPosts([welcomeCard, ...transformedContent])
      console.log(`✅ Loaded ${transformedContent.length} posts with proxy fixes applied`)
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

  // Toggle debug features with keyboard
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebugBorders(prev => !prev)
      } else if (e.key === 's' || e.key === 'S') {
        setShowSizeDebug(prev => !prev)
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
      pixabay: '📸',
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
        {showSizeDebug && <span className="debug-indicator" style={{ background: 'blue' }}>SIZE</span>}
      </div>
      
      {/* Debug controls - temporary */}
      <div className="debug-controls" style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 100,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '8px',
        borderRadius: '8px',
        display: 'flex',
        gap: '8px',
        fontSize: '12px'
      }}>
        <button 
          onClick={() => setShowDebugBorders(!showDebugBorders)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Borders (D)
        </button>
        <button 
          onClick={() => setShowSizeDebug(!showSizeDebug)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Sizes (S)
        </button>
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
            data-card-id={post.id}
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
              {showSizeDebug && cardSizes[post.id] && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  zIndex: 10,
                  lineHeight: '1.4'
                }}>
                  <div>{post.source_platform} ({cardSizes[post.id].content.type})</div>
                  <div>Card: {Math.round(cardSizes[post.id].card.width)}×{Math.round(cardSizes[post.id].card.height)}</div>
                  <div>Content: {Math.round(cardSizes[post.id].content.width)}×{Math.round(cardSizes[post.id].content.height)}</div>
                  <div style={{ color: cardSizes[post.id].diff.height > 0 ? '#ff6666' : '#66ff66' }}>
                    Diff: {Math.round(cardSizes[post.id].diff.width)}×{Math.round(cardSizes[post.id].diff.height)}
                  </div>
                </div>
              )}
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
          width: fit-content;
          max-width: 500px;
          height: fit-content !important; /* Perfect content fit */
          min-height: unset !important; /* No minimum height */
          max-height: 85vh;
          background: black;
          border-radius: 0; /* Remove radius to prevent visual gaps */
          overflow: hidden;
          position: relative;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          display: block; /* Block instead of flex for tighter fit */
          margin: 0 !important;
          padding: 0 !important;
          line-height: 0 !important;
          font-size: 0 !important;
          box-sizing: border-box !important;
        }

        /* Platform-specific card types - exact fit */
        .card-youtube {
          width: 400px !important;
          height: 225px !important;
        }

        .card-gif {
          width: fit-content !important;
          height: fit-content !important;
          max-height: 70vh;
        }

        .card-image {
          width: fit-content !important;
          height: fit-content !important;
          max-height: 80vh;
        }

        .card-text {
          width: fit-content !important;
          height: fit-content !important;
          max-height: 60vh;
          background: #f8f8f8;
          line-height: normal !important; /* Allow text line height */
          font-size: inherit !important; /* Allow text font size */
        }

        .card-mixed {
          width: fit-content !important;
          height: fit-content !important;
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
    // YouTube videos - STRICT iframe containment (no expansion allowed)
    if (post.source_platform === 'youtube' && post.content_video_url && !videoError) {
      const videoId = post.content_video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      console.log(`🎥 YouTube rendering: ID=${post.id}, videoId=${videoId}, isActive=${isActive}`)
      
      if (videoId) {
        return (
          <div className="youtube-container" data-youtube-id={videoId}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=0&mute=1&rel=0&modestbranding=1&playsinline=1&controls=1&showinfo=0&iv_load_policy=3`}
              frameBorder="0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen={false}
              sandbox="allow-scripts allow-same-origin allow-presentation"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '400px',
                height: '225px',
                border: 'none',
                pointerEvents: 'all',
                maxWidth: '400px',
                maxHeight: '225px'
              }}
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
      let imageSrc = post.content_image_url
      
      // Apply proxy for platforms that need it
      if (post.source_platform === 'pixabay') {
        const pageUrl = post.original_url
        imageSrc = `/api/proxy/pixabay-image?url=${encodeURIComponent(post.content_image_url)}&page=${encodeURIComponent(pageUrl)}`
      } else if (post.source_platform === 'bluesky') {
        imageSrc = `/api/proxy/bluesky-image?url=${encodeURIComponent(post.content_image_url)}`
      }
      
      return (
        <div className="image-container">
          <img 
            src={imageSrc}
            alt={post.content_text || 'Content image'}
            loading="lazy"
            onError={() => {
              console.log(`❌ Image failed to load: ${post.source_platform} ${post.id}`)
              setImageError(true)
            }}
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
          width: fit-content !important;
          height: fit-content !important;
          position: relative;
          display: block !important; /* Block for tight fit */
          margin: 0 !important;
          padding: 0 !important;
          line-height: 0 !important;
          font-size: 0 !important;
        }

        /* YouTube container - STRICT containment (match test-adaptive exactly) */
        .youtube-container {
          position: relative;
          width: 400px !important; /* Fixed width - no expansion */
          height: 225px !important; /* Fixed height - no expansion */
          background: black;
          overflow: hidden !important; /* CRITICAL: prevent any expansion */
          margin: 0 !important;
          padding: 0 !important;
          line-height: 0 !important;
          font-size: 0 !important;
          box-sizing: border-box !important;
        }

        .youtube-container iframe {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 400px !important; /* Fixed - no dynamic sizing */
          height: 225px !important; /* Fixed - no dynamic sizing */
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          pointer-events: all !important;
          box-sizing: border-box !important;
        }

        /* EMERGENCY: Prevent ANY YouTube player expansion */
        .html5-video-player {
          display: none !important;
          max-width: 400px !important;
          max-height: 225px !important;
          overflow: hidden !important;
        }

        /* Prevent YouTube API expansion */
        .ytp-player {
          max-width: 400px !important;
          max-height: 225px !important;
          overflow: hidden !important;
        }

        /* Giphy - exact match to test-adaptive (no whitespace) */
        .giphy-container {
          width: fit-content; /* Let container size to content */
          height: fit-content; /* Fit content height */
          display: block; /* Block to eliminate spacing */
          background: black;
          padding: 0 !important; /* Force no padding */
          margin: 0 !important; /* Force no margins */
          border: 0 !important; /* Force no border */
          box-sizing: border-box;
          line-height: 0 !important; /* Remove line-height spacing */
          font-size: 0 !important; /* Remove font-based spacing */
          position: relative; /* Prevent margin collapse */
        }

        .giphy-container video,
        .giphy-container img {
          width: auto; /* Natural width - no forcing */
          height: auto; /* Natural height - no forcing */
          object-fit: contain; /* Preserve aspect ratio */
          max-width: 500px; /* Reasonable maximum */
          display: block !important; /* Force block display */
          margin: 0 !important; /* Force no margins */
          padding: 0 !important; /* Force no padding */
          border: 0 !important; /* Force no border */
          outline: 0 !important; /* Force no outline */
          vertical-align: top !important; /* Remove baseline spacing */
          box-sizing: border-box !important; /* Consistent box model */
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

        /* Image container - exact match to test-adaptive (no whitespace) */
        .image-container {
          width: fit-content; /* Let container size to content */
          height: fit-content; /* Fit content height */
          display: block; /* Block to eliminate spacing */
          background: black;
          padding: 0 !important; /* Force no padding */
          margin: 0 !important; /* Force no margins */
          border: 0 !important; /* Force no border */
          box-sizing: border-box;
          line-height: 0 !important; /* Remove line-height spacing */
          font-size: 0 !important; /* Remove font-based spacing */
          position: relative; /* Prevent margin collapse */
        }

        .image-container img {
          width: auto; /* Natural width - no forcing */
          height: auto; /* Natural height - no forcing */
          object-fit: contain; /* Preserve aspect ratio */
          max-width: 500px; /* Reasonable maximum */
          display: block !important; /* Force block display */
          margin: 0 !important; /* Force no margins */
          padding: 0 !important; /* Force no padding */
          border: 0 !important; /* Force no border */
          outline: 0 !important; /* Force no outline */
          vertical-align: top !important; /* Remove baseline spacing */
          box-sizing: border-box !important; /* Consistent box model */
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
          color: #000000; /* Ensure black text for readability */
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
          color: #000000; /* Ensure black text for all platforms */
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