'use client'

import { useState, useEffect, useCallback } from 'react'
import './admin-posted.css'

interface PostedContent {
  id: number
  content_text: string
  content_type: string
  source_platform: string
  original_url: string
  original_author: string
  content_image_url?: string
  content_video_url?: string
  posted_at: Date
  post_order: number
  engagement_stats?: {
    views: number
    likes: number
    shares: number
  }
}

interface PostingStats {
  totalPosted: number
  postedToday: number
  averageEngagement: number
  topPerformingPost?: PostedContent
}

export default function PostedContentPage() {
  const [postedContent, setPostedContent] = useState<PostedContent[]>([])
  const [stats, setStats] = useState<PostingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [hidingPost, setHidingPost] = useState<number | null>(null)

  const itemsPerPage = 20

  const loadPostedContent = useCallback(async () => {
    try {
      setError(null)

      // Get auth token for API calls
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const [contentResponse, statsResponse] = await Promise.allSettled([
        fetch(`/api/admin/content?status=posted&limit=${itemsPerPage}&offset=${(page - 1) * itemsPerPage}`, {
          headers,
          credentials: 'include'
        }),
        page === 1 ? fetch('/api/admin/posting/stats', {
          headers,
          credentials: 'include'
        }) : Promise.resolve({ ok: false })
      ])

      if (contentResponse.status === 'fulfilled' && contentResponse.value.ok) {
        const contentData = await contentResponse.value.json()
        const newContent = contentData.data?.content || []
        
        if (page === 1) {
          setPostedContent(newContent)
        } else {
          setPostedContent(prev => [...prev, ...newContent])
        }
        
        setHasMore(newContent.length === itemsPerPage)
      } else {
        // Get more specific error message from response
        if (contentResponse.status === 'fulfilled') {
          try {
            const errorData = await contentResponse.value.json()
            throw new Error(errorData.error || 'Failed to load posted content')
          } catch {
            throw new Error(`HTTP ${contentResponse.value.status}: Failed to load posted content`)
          }
        } else {
          throw new Error('Network error: Unable to connect to server')
        }
      }

      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok && 'json' in statsResponse.value) {
        const statsData = await statsResponse.value.json()
        setStats(statsData.data)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load posted content'
      setError(errorMessage)
      console.error('Error loading posted content:', err)
    } finally {
      setLoading(false)
    }
  }, [page, itemsPerPage])

  useEffect(() => {
    loadPostedContent()
  }, [page, loadPostedContent])

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1)
    }
  }

  const hidePost = async (postId: number, contentText: string) => {
    if (!confirm(`Are you sure you want to remove this post from the public feed?\n\n"${contentText.substring(0, 100)}..."`)) {
      return
    }

    setHidingPost(postId)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
      const response = await fetch(`/api/admin/content/${postId}/hide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to hide post')
      }

      const result = await response.json()
      console.log('Hide result:', result)

      // Remove the post from the local state
      setPostedContent(prev => prev.filter(post => post.id !== postId))
      
      // Show success message
      alert(`✅ Post removed from public feed successfully!\n\nAction: ${result.action}\nDetails: ${result.details}`)

    } catch (err) {
      console.error('Error hiding post:', err)
      alert(`❌ Failed to hide post: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setHidingPost(null)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'reddit': return '🔴'
      case 'youtube': return '📺'
      case 'flickr': return '📸'
      case 'unsplash': return '🖼️'
      case 'instagram': return '📷'
      case 'tiktok': return '🎵'
      case 'bluesky': return '🦋'
      case 'tumblr': return '🎨'
      case 'lemmy': return '🌐'
      case 'imgur': return '🖼️'
      case 'pixabay': return '📷'
      case 'emergency': return '🚨'
      default: return '🌐'
    }
  }

  const getContentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'image': return '🖼️'
      case 'video': return '🎥'
      case 'text': return '📝'
      case 'gif': return '🎭'
      case 'mixed': return '📋'
      default: return '📄'
    }
  }

  if (loading && postedContent.length === 0) {
    return (
      <div className="posted-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading posted content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="posted-container">
      {/* Header */}
      <div className="posted-section">
        <div className="section-header">
          <div className="header-content">
            <div className="header-info">
              <h1>
                <span>📤</span>
                Posted Content History
              </h1>
              <p className="header-description">
                View all content that has been posted to the public site
              </p>
            </div>
            <button 
              onClick={() => { setPage(1); loadPostedContent(); }} 
              className="refresh-btn"
            >
              🔄 Refresh
            </button>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <div className="error-content">
                <h3>Error Loading Content</h3>
                <p className="error-text">{error}</p>
                {error.includes('Network error') && (
                  <p className="error-hint">
                    Please check your internet connection and try again.
                  </p>
                )}
                {error.includes('401') && (
                  <p className="error-hint">
                    Your session may have expired. Please log in again.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="posted-section">
          <div className="section-header">
            <div className="header-info">
              <h2>📊 Posting Statistics</h2>
            </div>
          </div>
          <div className="section-body">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-number primary">{stats.totalPosted}</div>
                <p className="stat-label">Total Posted</p>
              </div>
              <div className="stat-item">
                <div className="stat-number success">{stats.postedToday}</div>
                <p className="stat-label">Posted Today</p>
              </div>
              <div className="stat-item">
                <div className="stat-number primary">{Math.round(stats.averageEngagement)}%</div>
                <p className="stat-label">Avg Engagement</p>
              </div>
              <div className="stat-item">
                <div className="stat-number primary">{postedContent.length > 0 ? Math.round(stats.totalPosted / 30) : 0}</div>
                <p className="stat-label">Posts/Day (30d avg)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posted Content List */}
      <div className="posted-section">
        <div className="section-header">
          <div className="header-info">
            <h2>📝 Posted Content ({postedContent.length} items)</h2>
          </div>
        </div>
        
        {postedContent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3 className="empty-title">No content has been posted yet</h3>
            <p className="empty-description">Posted content will appear here once items are published</p>
          </div>
        ) : (
          <div className="posted-list">
            {postedContent.map((item) => (
              <div key={item.id} className="content-item">
                <div className="item-header">
                  <div className="item-meta">
                    <div className="meta-badge platform">
                      <span className="platform-icon">{getPlatformIcon(item.source_platform)}</span>
                      <span>{item.source_platform}</span>
                    </div>
                    <div className="meta-badge content-type">
                      <span className="content-type-icon">{getContentTypeIcon(item.content_type)}</span>
                      <span>{item.content_type}</span>
                    </div>
                  </div>
                  <div className="item-actions">
                    <span className="status-badge">Posted</span>
                    <span className="post-order">#{item.post_order}</span>
                    <button
                      onClick={() => hidePost(item.id, item.content_text)}
                      disabled={hidingPost === item.id}
                      className="remove-btn"
                      title="Remove this post from the public feed"
                    >
                      {hidingPost === item.id ? '⏳' : '🗑️'} 
                      {hidingPost === item.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
                
                <div className="item-body">
                  {item.content_text && (
                    <p className="content-text">{item.content_text}</p>
                  )}

                  {item.content_image_url && (
                    <div className="media-container">
                      {/* Check if the "image" URL is actually a video file */}
                      {item.content_image_url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
                        <video 
                          src={item.content_image_url}
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="content-video"
                        />
                      ) : (
                        <img 
                          src={item.content_image_url} 
                          alt="Posted content" 
                          className="content-image"
                        />
                      )}
                    </div>
                  )}

                  {item.content_video_url && (
                    <div className="media-container">
                      <a 
                        href={item.content_video_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="video-link"
                      >
                        <span>🎥</span>
                        <span>View Video</span>
                      </a>
                    </div>
                  )}

                  <div className="content-details">
                    <div className="detail-row">
                      <span className="detail-label">Author:</span>
                      <span className="detail-value">{item.original_author}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Posted:</span>
                      <span className="detail-value">{formatDate(item.posted_at)}</span>
                    </div>
                  </div>

                  {item.engagement_stats && (
                    <div className="engagement-stats">
                      <div className="engagement-card">
                        <div className="engagement-number">{item.engagement_stats.views}</div>
                        <p className="engagement-label">Views</p>
                      </div>
                      <div className="engagement-card">
                        <div className="engagement-number">{item.engagement_stats.likes}</div>
                        <p className="engagement-label">Likes</p>
                      </div>
                      <div className="engagement-card">
                        <div className="engagement-number">{item.engagement_stats.shares}</div>
                        <p className="engagement-label">Shares</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="item-footer">
                  <a 
                    href={item.original_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="view-original"
                  >
                    <span>🔗</span>
                    <span>View Original</span>
                  </a>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && postedContent.length > 0 && (
              <div className="load-more-container">
                <button 
                  onClick={loadMore} 
                  disabled={loading}
                  className="load-more-btn"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            {!hasMore && postedContent.length > 0 && (
              <div className="load-more-container">
                <p className="load-complete">All posted content loaded ({postedContent.length} items)</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}