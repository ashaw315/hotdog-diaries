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
  displayMetadata?: {
    hasVideo: boolean
    hasImage: boolean
    hasText: boolean
    contentLength: number
    isGif: boolean
    estimatedLoadTime: string
    renderingComplexity: 'simple' | 'medium' | 'complex'
  }
}

interface PlatformStatus {
  platform: string
  contentDisplaying: boolean
  videosPlaying: boolean
  imagesLoading: boolean
  textFormatted: boolean
  errors: string[]
}

const PLATFORM_COLORS = {
  reddit: '#FF4500',
  youtube: '#FF0000', 
  giphy: '#00CC99',
  pixabay: '#2EC66D',
  bluesky: '#00D4FF',
  imgur: '#1BB76E',
  tumblr: '#001935',
  lemmy: '#FFD700'
}

const PLATFORM_ICONS = {
  reddit: '🤖',
  youtube: '📺',
  giphy: '🎭',
  pixabay: '📷',
  bluesky: '☁️',
  imgur: '📸',
  tumblr: '📱',
  lemmy: '🦔'
}

export default function PlatformDisplayTest() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [platformStats, setPlatformStats] = useState<any>(null)
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([])
  const [loadTimes, setLoadTimes] = useState<{[key: number]: number}>({})
  const containerRef = useRef<HTMLDivElement>(null)

  // Ensure page is scrollable
  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.documentElement.style.overflow = 'auto'
    return () => {
      // Cleanup - restore original styles
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    fetchTestContent()
  }, [])

  const fetchTestContent = async () => {
    try {
      setLoading(true)
      const startTime = Date.now()
      const response = await fetch('/api/test/platform-display')
      
      if (!response.ok) {
        throw new Error('Failed to load test content')
      }

      const data = await response.json()
      const loadTime = Date.now() - startTime
      
      if (data.success) {
        setPosts(data.items || [])
        setPlatformStats(data.testMetadata)
        
        // Initialize platform status tracking
        const platforms = Object.keys(data.platformCounts || {})
        const initialStatus: PlatformStatus[] = platforms.map(platform => ({
          platform,
          contentDisplaying: false,
          videosPlaying: false,
          imagesLoading: true,
          textFormatted: false,
          errors: []
        }))
        setPlatformStatus(initialStatus)
        
        console.log(`Platform display test loaded in ${loadTime}ms:`, data)
      } else {
        throw new Error(data.error || 'Failed to load test content')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test content')
    } finally {
      setLoading(false)
    }
  }

  const trackItemLoad = (itemId: number) => {
    const loadTime = Date.now()
    setLoadTimes(prev => ({ ...prev, [itemId]: loadTime }))
  }

  const updatePlatformStatus = (platform: string, updates: Partial<PlatformStatus>) => {
    setPlatformStatus(prev => prev.map(status => 
      status.platform === platform ? { ...status, ...updates } : status
    ))
  }

  const getPlatformBorderColor = (platform: string) => {
    return PLATFORM_COLORS[platform] || '#666666'
  }

  const getPlatformIcon = (platform: string) => {
    return PLATFORM_ICONS[platform] || '🌐'
  }

  const renderContentItem = (post: Post, index: number) => {
    const isVideo = post.content_type === 'video' || post.content_video_url
    const isGif = post.content_type === 'gif' || (post.content_image_url && post.content_image_url.includes('.gif'))
    const hasImage = post.content_image_url && !isGif
    const hasText = post.content_text && post.content_text.length > 0

    return (
      <div 
        key={post.id}
        className="content-item"
        style={{ 
          borderLeft: `6px solid ${getPlatformBorderColor(post.source_platform)}`,
          backgroundColor: `${getPlatformBorderColor(post.source_platform)}10`
        }}
        onLoad={() => trackItemLoad(post.id)}
      >
        {/* Platform Header */}
        <div className="platform-header">
          <div className="platform-badge">
            <span className="platform-icon">{getPlatformIcon(post.source_platform)}</span>
            <span className="platform-name">{post.source_platform.toUpperCase()}</span>
            <span className="item-number">#{(index % 2) + 1}</span>
          </div>
          <div className="content-type-labels">
            {isVideo && <span className="content-type video">VIDEO</span>}
            {isGif && <span className="content-type gif">GIF</span>}
            {hasImage && !isGif && <span className="content-type image">IMAGE</span>}
            {hasText && <span className="content-type text">TEXT</span>}
          </div>
        </div>

        {/* Content Display */}
        <div className="content-display">
          {renderContent(post)}
        </div>

        {/* Debug Information */}
        <div className="debug-info">
          <div className="debug-row">
            <strong>ID:</strong> {post.id}
            <strong>Author:</strong> {post.original_author || 'N/A'}
          </div>
          <div className="debug-row">
            <strong>Type:</strong> {post.content_type}
            <strong>Complexity:</strong> {post.displayMetadata?.renderingComplexity}
            <strong>Est. Load:</strong> {post.displayMetadata?.estimatedLoadTime}
          </div>
          <div className="debug-row">
            <strong>Text Length:</strong> {post.displayMetadata?.contentLength || 0} chars
            <strong>Has Video:</strong> {post.displayMetadata?.hasVideo ? 'Yes' : 'No'}
            <strong>Has Image:</strong> {post.displayMetadata?.hasImage ? 'Yes' : 'No'}
          </div>
          {post.content_text && (
            <div className="content-preview">
              <strong>Content:</strong> "{post.content_text.substring(0, 100)}{post.content_text.length > 100 ? '...' : ''}"
            </div>
          )}
          <div className="url-info">
            {post.content_video_url && (
              <div><strong>Video:</strong> {post.content_video_url.substring(0, 60)}...</div>
            )}
            {post.content_image_url && (
              <div><strong>Image:</strong> {post.content_image_url.substring(0, 60)}...</div>
            )}
          </div>
        </div>

        <style jsx>{`
          .content-item {
            margin-bottom: 32px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            background: white;
          }

          .platform-header {
            padding: 16px 20px;
            background: rgba(0, 0, 0, 0.03);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          }

          .platform-badge {
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 700;
            font-size: 16px;
          }

          .platform-icon {
            font-size: 20px;
          }

          .platform-name {
            color: ${getPlatformBorderColor(post.source_platform)};
            letter-spacing: 0.5px;
          }

          .item-number {
            background: ${getPlatformBorderColor(post.source_platform)};
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          }

          .content-type-labels {
            display: flex;
            gap: 8px;
          }

          .content-type {
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .content-type.video {
            background: #ff4757;
            color: white;
          }

          .content-type.gif {
            background: #00d2d3;
            color: white;
          }

          .content-type.image {
            background: #5f27cd;
            color: white;
          }

          .content-type.text {
            background: #222f3e;
            color: white;
          }

          .content-display {
            padding: 20px;
            min-height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .debug-info {
            padding: 16px 20px;
            background: rgba(0, 0, 0, 0.03);
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
          }

          .debug-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 8px;
          }

          .content-preview {
            margin: 8px 0;
            padding: 8px;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 4px;
            font-style: italic;
          }

          .url-info {
            margin-top: 8px;
            font-size: 11px;
            color: #666;
          }

          .url-info div {
            margin-bottom: 4px;
            word-break: break-all;
          }
        `}</style>
      </div>
    )
  }

  const renderContent = (post: Post) => {
    // YouTube video
    if (post.content_video_url && (post.content_video_url.includes('youtube.com') || post.content_video_url.includes('youtu.be'))) {
      const videoId = extractYouTubeId(post.content_video_url)
      return (
        <div style={{ width: '100%', maxWidth: '560px', aspectRatio: '16/9' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?controls=1&modestbranding=1&rel=0`}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`YouTube video ${videoId}`}
          />
        </div>
      )
    }

    // Giphy GIF/Video
    if (post.source_platform === 'giphy') {
      if (post.content_video_url && post.content_video_url.includes('.mp4')) {
        return (
          <video
            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
            src={post.content_video_url}
            loop
            muted
            autoPlay
            controls
          />
        )
      }
      if (post.content_image_url) {
        return (
          <img 
            src={post.content_image_url}
            alt={post.content_text || 'Giphy content'}
            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
            onError={(e) => {
              updatePlatformStatus(post.source_platform, { 
                errors: [...(platformStatus.find(p => p.platform === post.source_platform)?.errors || []), 'Image failed to load'] 
              })
            }}
          />
        )
      }
    }

    // Regular video
    if (post.content_video_url) {
      return (
        <video
          style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
          src={post.content_video_url}
          loop
          muted
          controls
          onError={(e) => {
            updatePlatformStatus(post.source_platform, { 
              errors: [...(platformStatus.find(p => p.platform === post.source_platform)?.errors || []), 'Video failed to load'] 
            })
          }}
        />
      )
    }

    // Image
    if (post.content_image_url) {
      return (
        <img 
          src={post.content_image_url}
          alt={post.content_text || 'Content image'}
          style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'contain' }}
          onError={(e) => {
            updatePlatformStatus(post.source_platform, { 
              errors: [...(platformStatus.find(p => p.platform === post.source_platform)?.errors || []), 'Image failed to load'] 
            })
          }}
        />
      )
    }

    // Text content
    if (post.content_text) {
      return (
        <div style={{ 
          padding: '20px', 
          background: 'rgba(0,0,0,0.05)', 
          borderRadius: '8px', 
          maxWidth: '500px',
          lineHeight: '1.6',
          fontSize: '16px'
        }}>
          {post.content_text}
        </div>
      )
    }

    return <div style={{ color: '#999', fontStyle: 'italic' }}>No content to display</div>
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

  if (loading) {
    return (
      <div className="test-container">
        <h1>🌭 Platform Display Test - Loading...</h1>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌭</div>
          <p>Loading platform display test...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="test-container">
        <h1>🌭 Platform Display Test - Error</h1>
        <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>
          <p>Error: {error}</p>
          <button onClick={fetchTestContent} style={{ marginTop: '16px', padding: '8px 16px' }}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="test-container" ref={containerRef}>
      <header className="test-header">
        <h1>🌭 Platform Display Test</h1>
        <div className="test-stats">
          <div>Total Items: <strong>{posts.length}</strong></div>
          <div>Expected: <strong>{platformStats?.expectedTotalItems || 16}</strong></div>
          <div>Platforms: <strong>{platformStats?.platforms?.length || 0}/8</strong></div>
          {platformStats?.missingPlatforms?.length > 0 && (
            <div style={{ color: 'red' }}>
              Missing: {platformStats.missingPlatforms.join(', ')}
            </div>
          )}
        </div>
      </header>

      {/* Platform Status Checklist */}
      <div className="status-checklist">
        <h2>Visual Test Checklist</h2>
        <div className="checklist-grid">
          {['reddit', 'youtube', 'giphy', 'pixabay', 'bluesky', 'imgur', 'tumblr', 'lemmy'].map(platform => {
            const platformPosts = posts.filter(p => p.source_platform === platform)
            const hasContent = platformPosts.length > 0
            const status = platformStatus.find(p => p.platform === platform)
            
            return (
              <div key={platform} className="checklist-item">
                <div className="platform-check">
                  <span className={`checkbox ${hasContent ? 'checked' : ''}`}>
                    {hasContent ? '✅' : '❌'}
                  </span>
                  <span className="platform-icon">{getPlatformIcon(platform)}</span>
                  <span className="platform-name">{platform}</span>
                  <span className="item-count">({platformPosts.length}/2)</span>
                </div>
                {status?.errors.length > 0 && (
                  <div className="error-list">
                    {status.errors.map((error, i) => (
                      <div key={i} style={{ color: 'red', fontSize: '12px' }}>⚠️ {error}</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content Display */}
      <div className="content-section">
        <h2>Platform Content Display ({posts.length} items)</h2>
        <div className="content-grid">
          {posts.map((post, index) => renderContentItem(post, index))}
        </div>
      </div>

      <style jsx>{`
        .test-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
          overflow-y: auto;
        }

        .test-header {
          text-align: center;
          margin-bottom: 32px;
          padding: 24px;
          background: linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%);
          border-radius: 16px;
          color: white;
        }

        .test-header h1 {
          margin: 0 0 16px 0;
          font-size: 32px;
          font-weight: 900;
        }

        .test-stats {
          display: flex;
          justify-content: center;
          gap: 24px;
          font-size: 16px;
        }

        .status-checklist {
          background: white;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 32px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .status-checklist h2 {
          margin: 0 0 20px 0;
          color: #333;
          font-size: 24px;
        }

        .checklist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .checklist-item {
          padding: 16px;
          border: 2px solid #f0f0f0;
          border-radius: 8px;
          background: #fafafa;
        }

        .platform-check {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
        }

        .checkbox {
          font-size: 18px;
        }

        .checkbox.checked {
          color: #4caf50;
        }

        .platform-icon {
          font-size: 20px;
        }

        .platform-name {
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .item-count {
          color: #666;
          font-size: 14px;
        }

        .error-list {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #ddd;
        }

        .content-section {
          background: white;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .content-section h2 {
          margin: 0 0 24px 0;
          color: #333;
          font-size: 24px;
        }

        .content-grid {
          /* Single column layout for better testing visibility */
        }

        @media (max-width: 768px) {
          .test-container {
            padding: 16px;
          }

          .test-header h1 {
            font-size: 24px;
          }

          .test-stats {
            flex-direction: column;
            gap: 8px;
            font-size: 14px;
          }

          .checklist-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}