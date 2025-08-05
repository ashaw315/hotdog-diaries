'use client'

import { useState, useEffect } from 'react'

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

  const itemsPerPage = 20

  useEffect(() => {
    loadPostedContent()
  }, [page])

  const loadPostedContent = async () => {
    try {
      setError(null)

      const [contentResponse, statsResponse] = await Promise.allSettled([
        fetch(`/api/admin/content/posted?limit=${itemsPerPage}&offset=${(page - 1) * itemsPerPage}`),
        page === 1 ? fetch('/api/admin/posting/stats') : Promise.resolve({ ok: false })
      ])

      if (contentResponse.status === 'fulfilled' && contentResponse.value.ok) {
        const contentData = await contentResponse.value.json()
        const newContent = contentData.data || []
        
        if (page === 1) {
          setPostedContent(newContent)
        } else {
          setPostedContent(prev => [...prev, ...newContent])
        }
        
        setHasMore(newContent.length === itemsPerPage)
      } else {
        throw new Error('Failed to load posted content')
      }

      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
        const statsData = await statsResponse.value.json()
        setStats(statsData.data)
      }

    } catch (err) {
      setError('Failed to load posted content')
      console.error('Error loading posted content:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1)
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
      case 'mastodon': return '🐘'
      case 'instagram': return '📷'
      case 'tiktok': return '🎵'
      default: return '🌐'
    }
  }

  const getContentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'image': return '🖼️'
      case 'video': return '🎥'
      case 'text': return '📝'
      case 'mixed': return '📋'
      default: return '📄'
    }
  }

  if (loading && postedContent.length === 0) {
    return (
      <div className="container content-area">
        <div className="text-center">
          <div className="spinner mb-sm"></div>
          <p className="loading">Loading posted content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container content-area">
      <div className="grid gap-lg">
        {/* Header */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between align-center">
              <div>
                <h1 className="flex align-center gap-sm">
                  <span>📤</span>
                  Posted Content History
                </h1>
                <p className="text-muted">
                  View all content that has been posted to the public site
                </p>
              </div>
              <button onClick={() => { setPage(1); loadPostedContent(); }} className="btn">
                Refresh
              </button>
            </div>

            {error && (
              <div className="alert alert-danger mt-sm">
                <span>⚠ {error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="card">
            <div className="card-header">
              <h2>Posting Statistics</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-4 gap-md">
                <div className="text-center">
                  <h3>{stats.totalPosted}</h3>
                  <p className="text-muted">Total Posted</p>
                </div>
                <div className="text-center">
                  <h3 className="text-success">{stats.postedToday}</h3>
                  <p className="text-muted">Posted Today</p>
                </div>
                <div className="text-center">
                  <h3>{Math.round(stats.averageEngagement)}%</h3>
                  <p className="text-muted">Avg Engagement</p>
                </div>
                <div className="text-center">
                  <h3>{postedContent.length > 0 ? Math.round(stats.totalPosted / 30) : 0}</h3>
                  <p className="text-muted">Posts/Day (30d avg)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posted Content List */}
        <div className="card">
          <div className="card-header">
            <h2>Posted Content ({postedContent.length} items)</h2>
          </div>
          <div className="card-body">
            {postedContent.length === 0 ? (
              <div className="text-center p-lg">
                <div className="mb-sm">📭</div>
                <p className="text-muted">No content has been posted yet</p>
              </div>
            ) : (
              <div className="grid gap-md">
                {postedContent.map((item) => (
                  <div key={item.id} className="card">
                    <div className="card-header">
                      <div className="flex justify-between align-center">
                        <div className="flex align-center gap-sm">
                          <span>{getPlatformIcon(item.source_platform)}</span>
                          <span><strong>{item.source_platform}</strong></span>
                          <span>{getContentTypeIcon(item.content_type)}</span>
                          <span className="text-muted">{item.content_type}</span>
                        </div>
                        <div className="flex align-center gap-sm">
                          <span className="text-success">Posted</span>
                          <span className="text-muted">#{item.post_order}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-body">
                      {item.content_text && (
                        <p className="mb-sm">{item.content_text}</p>
                      )}

                      {item.content_image_url && (
                        <img 
                          src={item.content_image_url} 
                          alt="Posted content" 
                          style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'cover' }}
                          className="mb-sm"
                        />
                      )}

                      {item.content_video_url && (
                        <div className="mb-sm">
                          <a 
                            href={item.content_video_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="nav-link flex align-center gap-xs"
                          >
                            <span>🎥</span>
                            <span>View Video</span>
                          </a>
                        </div>
                      )}

                      <div className="grid grid-2 gap-sm text-muted">
                        <div>
                          <strong>Author:</strong> {item.original_author}
                        </div>
                        <div>
                          <strong>Posted:</strong> {formatDate(item.posted_at)}
                        </div>
                      </div>

                      {item.engagement_stats && (
                        <div className="grid grid-3 gap-sm mt-sm">
                          <div className="text-center p-xs card">
                            <strong>{item.engagement_stats.views}</strong>
                            <p className="text-muted">Views</p>
                          </div>
                          <div className="text-center p-xs card">
                            <strong>{item.engagement_stats.likes}</strong>
                            <p className="text-muted">Likes</p>
                          </div>
                          <div className="text-center p-xs card">
                            <strong>{item.engagement_stats.shares}</strong>
                            <p className="text-muted">Shares</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="card-footer">
                      <a 
                        href={item.original_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="nav-link flex align-center gap-xs"
                      >
                        <span>🔗</span>
                        <span>View Original</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load More Button */}
            {hasMore && postedContent.length > 0 && (
              <div className="text-center mt-lg">
                <button 
                  onClick={loadMore} 
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            {!hasMore && postedContent.length > 0 && (
              <div className="text-center mt-lg">
                <p className="text-muted">All posted content loaded ({postedContent.length} items)</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}