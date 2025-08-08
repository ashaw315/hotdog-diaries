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

// Test videos for development - replace with actual content later
const TEST_VIDEOS = [
  {
    id: -1,
    content_text: "Perfect hotdog grilling technique 🔥",
    content_type: 'video' as ContentType,
    content_video_url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
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
    content_video_url: "https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4",
    content_image_url: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop",
    source_platform: 'pixabay' as SourcePlatform,
    original_author: "street_chef",
    original_url: "https://example.com/test2",
    scraped_at: new Date(),
    is_posted: false,
    is_approved: true,
    posted_at: new Date()
  },
  {
    id: -3,
    content_text: "Chicago-style vs New York style debate 🗽",
    content_type: 'video' as ContentType,
    content_video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    content_image_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&h=600&fit=crop",
    source_platform: 'reddit' as SourcePlatform,
    original_author: "hotdog_expert",
    original_url: "https://example.com/test3",
    scraped_at: new Date(),
    is_posted: false,
    is_approved: true,
    posted_at: new Date()
  }
]

export default function CleanTikTokFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      
      if (data.success) {
        const apiPosts = data.data?.content || []
        
        // Process and clean API posts
        const cleanedApiPosts = apiPosts.map(post => ({
          ...post,
          content_text: post.content_text && post.content_text.length > 200 
            ? post.content_text.substring(0, 200) + '...' 
            : post.content_text
        }))

        // Add test videos and mix with real content for variety
        const mixedPosts = [
          ...TEST_VIDEOS,
          ...cleanedApiPosts.slice(0, 6) // Mix some real content
        ]
        
        console.log(`Loaded ${mixedPosts.length} posts (${TEST_VIDEOS.length} test videos)`)
        setPosts(mixedPosts)
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
            cursor: pointer;
          }
        `}</style>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="page-container">
        <div className="feed-container">
          <div className="empty-content">
            <div className="empty-icon">🌭</div>
            <p>No hotdog content found</p>
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

        @media (max-width: 768px) {
          .page-container {
            background: black;
          }
          
          .feed-container {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

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
  const [videoError, setVideoError] = useState(false)

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

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength).trim() + '...'
  }

  const cleanAuthor = (author?: string) => {
    if (!author) return 'hotdog_lover'
    return author
      .replace(/^(u\/|r\/|@)/, '')
      .replace(/\s+\(via.*?\)$/i, '')
      .substring(0, 20)
  }

  const renderMedia = () => {
    // Video content
    if (post.content_type === 'video' && post.content_video_url && !videoError) {
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
          <p className="post-text">{truncateText(post.content_text || 'Delicious hotdog content')}</p>
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

      {/* Clean bottom overlay - no fake buttons */}
      <div className="info-overlay">
        <div className="creator-info">
          <div className="username">@{cleanAuthor(post.original_author)}</div>
          {post.content_text && post.content_type !== 'text' && (
            <div className="caption">{truncateText(post.content_text, 100)}</div>
          )}
          <div className="platform-info">
            {getPlatformIcon(post.source_platform)} {post.source_platform}
          </div>
        </div>
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

        .media-video,
        .media-image {
          max-width: 100%;
          max-height: 80vh;
          width: auto;
          height: auto;
          object-fit: contain;
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
          max-width: 500px;
        }

        .hotdog-emoji {
          font-size: 80px;
          margin-bottom: 24px;
        }

        .post-text {
          font-size: 20px;
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

        /* Clean bottom overlay */
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
          max-width: 500px;
        }

        .platform-info {
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          opacity: 0.8;
        }

        @media (max-width: 768px) {
          .info-overlay {
            bottom: 60px;
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
            font-size: 18px;
          }

          .hotdog-emoji {
            font-size: 60px;
          }
        }
      `}</style>
    </div>
  )
}