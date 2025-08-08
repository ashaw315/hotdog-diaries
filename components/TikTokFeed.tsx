'use client'

import { useState, useEffect, useRef } from 'react'
import FullScreenPost from './ui/FullScreenPost'
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

export default function TikTokFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState(0)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/content?limit=20')
      
      if (!response.ok) {
        throw new Error('Failed to load content')
      }

      const data = await response.json()
      
      if (data.success) {
        const newPosts = data.data?.content || []
        console.log('Loaded posts:', newPosts)
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const scrollPosition = container.scrollTop
    const postHeight = container.clientHeight
    const newIndex = Math.round(scrollPosition / postHeight)
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < posts.length) {
      setCurrentIndex(newIndex)
    }
  }

  const scrollToPost = (index: number) => {
    if (index >= 0 && index < posts.length && containerRef.current) {
      const postHeight = containerRef.current.clientHeight
      containerRef.current.scrollTo({
        top: index * postHeight,
        behavior: 'smooth'
      })
      setCurrentIndex(index)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        scrollToPost(currentIndex + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        scrollToPost(currentIndex - 1)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentIndex, posts.length])

  // Touch handling for mobile swipes
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientY
    const diff = touchStart - touchEnd
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0) {
        scrollToPost(currentIndex + 1) // Swipe up
      } else {
        scrollToPost(currentIndex - 1) // Swipe down
      }
    }
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="loading-spinner">🌭</div>
          <p>Loading hotdog content...</p>
        </div>
        
        <style jsx>{`
          .app-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            background: white;
            overflow: hidden;
          }

          .loading-screen {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: white;
          }

          .loading-spinner {
            font-size: 48px;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .loading-screen p {
            margin-top: 16px;
            color: #666;
            font-size: 16px;
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="error-screen">
          <div className="error-icon">⚠</div>
          <p className="error-message">{error}</p>
          <button onClick={fetchPosts} className="retry-button">
            Try Again
          </button>
        </div>
        
        <style jsx>{`
          .app-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            background: white;
            overflow: hidden;
          }

          .error-screen {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: white;
            padding: 20px;
          }

          .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }

          .error-message {
            color: #666;
            font-size: 16px;
            margin-bottom: 20px;
            text-align: center;
          }

          .retry-button {
            background: #333;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s ease;
          }

          .retry-button:hover {
            background: #555;
          }
        `}</style>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="app-container">
        <div className="empty-screen">
          <div className="empty-icon">🌭</div>
          <p>No hotdog content found</p>
          <p className="empty-submessage">Check back later for fresh content!</p>
        </div>
        
        <style jsx>{`
          .app-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            background: white;
            overflow: hidden;
          }

          .empty-screen {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: white;
          }

          .empty-icon {
            font-size: 64px;
            margin-bottom: 20px;
            opacity: 0.5;
          }

          .empty-screen p {
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
    <div className="app-container">
      {/* Full Screen Snap Scroll Container */}
      <div 
        ref={containerRef}
        className="feed-container"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {posts.map((post, index) => (
          <div key={post.id} className="post-container">
            <FullScreenPost 
              post={post} 
              isActive={index === currentIndex}
            />
          </div>
        ))}
      </div>

      {/* Minimal Navigation Overlay */}
      <div className="nav-overlay">
        <div className="logo-minimal">🌭</div>
      </div>

      {/* Desktop Navigation Buttons */}
      <div className="navigation-buttons">
        <button 
          className="nav-button nav-up" 
          onClick={() => scrollToPost(currentIndex - 1)}
          disabled={currentIndex === 0}
          title="Previous post"
        >
          ↑
        </button>
        <button 
          className="nav-button nav-down" 
          onClick={() => scrollToPost(currentIndex + 1)}
          disabled={currentIndex === posts.length - 1}
          title="Next post"
        >
          ↓
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="progress-dots">
        {posts.map((_, index) => (
          <div 
            key={index}
            className={`dot ${index === currentIndex ? 'active' : ''}`}
            onClick={() => scrollToPost(index)}
          />
        ))}
      </div>

      <style jsx>{`
        .app-container {
          position: relative;
          width: 100vw;
          height: 100vh;
          background: white;
          overflow: hidden;
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

        .post-container {
          width: 100vw;
          height: 100vh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          position: relative;
          background: white;
        }

        .nav-overlay {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 100;
        }

        .logo-minimal {
          font-size: 24px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
          user-select: none;
        }

        .navigation-buttons {
          position: fixed;
          right: 40px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 20px;
          z-index: 100;
        }

        .nav-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(0,0,0,0.1);
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(10px);
        }

        .nav-button:hover:not(:disabled) {
          background: white;
          transform: scale(1.1);
        }

        .nav-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .progress-dots {
          position: fixed;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 100;
          max-height: 60vh;
          overflow-y: auto;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.3s;
          flex-shrink: 0;
        }

        .dot.active {
          background: #333;
          transform: scale(1.5);
        }

        @media (max-width: 768px) {
          .navigation-buttons {
            display: none;
          }
          
          .progress-dots {
            flex-direction: row;
            bottom: 60px;
            top: auto;
            left: 50%;
            right: auto;
            transform: translateX(-50%);
            max-width: 80vw;
            max-height: none;
            overflow-x: auto;
          }

          .nav-overlay {
            top: 15px;
            left: 15px;
          }

          .logo-minimal {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  )
}