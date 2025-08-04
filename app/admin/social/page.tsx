'use client'

import { useState, useEffect } from 'react'

interface PlatformStatus {
  platform: string
  isEnabled: boolean
  isAuthenticated: boolean
  lastScanTime?: string
  nextScanTime?: string
  totalContent: number
  errorRate: number
  healthStatus: 'healthy' | 'warning' | 'error'
}

interface SocialMediaStats {
  totalPlatforms: number
  activePlatforms: number
  totalContentScanned: number
  totalContentApproved: number
  overallHealthScore: number
  platformStats: PlatformStatus[]
}

interface PlatformDetails {
  reddit?: {
    subreddits: number
    postsScanned: number
    commentsScanned: number
    avgScore: number
  }
  youtube?: {
    videosScanned: number
    channelsFollowed: number
    quotaUsed: number
    quotaRemaining: number
  }
  flickr?: {
    photosScanned: number
    requestsUsed: number
    requestsRemaining: number
    avgViews: number
  }
  unsplash?: {
    photosScanned: number
    requestsUsed: number
    requestsRemaining: number
    avgLikes: number
  }
}

export default function SocialPlatformsPage() {
  const [stats, setStats] = useState<SocialMediaStats | null>(null)
  const [platformDetails, setPlatformDetails] = useState<PlatformDetails>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    loadData()
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setError(null)

      // Load platform statistics
      const [socialResponse, redditResponse, youtubeResponse, flickrResponse, unsplashResponse] = await Promise.allSettled([
        fetch('/api/admin/social/stats'),
        fetch('/api/admin/reddit/stats'),
        fetch('/api/admin/youtube/status'),
        fetch('/api/admin/flickr/status'),
        fetch('/api/admin/unsplash/status')
      ])

      // Process social media stats
      if (socialResponse.status === 'fulfilled' && socialResponse.value.ok) {
        const socialData = await socialResponse.value.json()
        setStats(socialData.data)
      }

      // Process platform details
      const details: PlatformDetails = {}

      if (redditResponse.status === 'fulfilled' && redditResponse.value.ok) {
        const redditData = await redditResponse.value.json()
        details.reddit = redditData.data
      }

      if (youtubeResponse.status === 'fulfilled' && youtubeResponse.value.ok) {
        const youtubeData = await youtubeResponse.value.json()
        details.youtube = youtubeData.data
      }

      if (flickrResponse.status === 'fulfilled' && flickrResponse.value.ok) {
        const flickrData = await flickrResponse.value.json()
        details.flickr = flickrData.data
      }

      if (unsplashResponse.status === 'fulfilled' && unsplashResponse.value.ok) {
        const unsplashData = await unsplashResponse.value.json()
        details.unsplash = unsplashData.data
      }

      setPlatformDetails(details)

    } catch (err) {
      setError('Failed to load social media data')
      console.error('Error loading social data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartAllScanning = async () => {
    try {
      setScanning(true)
      setError(null)

      const response = await fetch('/api/admin/social/scan', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to start scanning')
      }

      const result = await response.json()
      
      if (result.success) {
        await loadData()
      } else {
        setError(result.message || 'Failed to start some scanning services')
      }

    } catch (err) {
      setError('Failed to start scanning services')
      console.error('Scanning error:', err)
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return (
      <div className="container content-area">
        <div className="text-center">
          <div className="spinner mb-sm"></div>
          <p className="loading">Loading social media data...</p>
        </div>
      </div>
    )
  }

  const healthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-success'
      case 'warning': return 'text-muted'
      case 'error': return 'text-danger'
      default: return 'text-muted'
    }
  }

  const healthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      default: return '❓'
    }
  }

  return (
    <div className="container content-area">
      <div className="grid gap-lg">
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between align-center">
              <div>
                <h1 className="flex align-center gap-sm">
                  <span>🌐</span>
                  Social Media Platforms
                </h1>
                <p className="text-muted">
                  Unified dashboard for all content aggregation platforms
                </p>
              </div>
              <div className="flex gap-sm">
                <button onClick={loadData} className="btn">
                  Refresh Data
                </button>
                <button
                  onClick={handleStartAllScanning}
                  disabled={scanning}
                  className="btn btn-primary"
                >
                  {scanning ? 'Starting...' : 'Start All Scanning'}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger mt-sm">
                <span>⚠ {error}</span>
              </div>
            )}
          </div>
        </div>

        {stats && (
          <div className="card">
            <div className="card-header">
              <h2>Platform Overview</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-4 gap-md mb-lg">
                <div className="card text-center">
                  <div className="card-body">
                    <h2>{stats.totalPlatforms || 0}</h2>
                    <p className="text-muted">Total Platforms</p>
                  </div>
                </div>
                <div className="card text-center">
                  <div className="card-body">
                    <h2 className="text-success">{stats.activePlatforms || 0}</h2>
                    <p className="text-muted">Active Platforms</p>
                  </div>
                </div>
                <div className="card text-center">
                  <div className="card-body">
                    <h2>{(stats.totalContentScanned || 0).toLocaleString()}</h2>
                    <p className="text-muted">Content Scanned</p>
                  </div>
                </div>
                <div className="card text-center">
                  <div className="card-body">
                    <h2>{(stats.totalContentApproved || 0).toLocaleString()}</h2>
                    <p className="text-muted">Content Approved</p>
                  </div>
                </div>
              </div>

              <div className="mb-sm">
                <div className="flex justify-between mb-xs">
                  <span>Overall System Health</span>
                  <span>{Math.round(stats.overallHealthScore || 0)}%</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'var(--color-gray-light)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div 
                    style={{
                      height: '100%',
                      width: `${stats.overallHealthScore || 0}%`,
                      backgroundColor: (stats.overallHealthScore || 0) >= 80 ? 'var(--color-green)' : 
                                     (stats.overallHealthScore || 0) >= 60 ? '#cccc00' : 'var(--color-red)',
                      transition: 'width 0.3s ease'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {stats?.platformStats && (
          <div className="grid grid-2 gap-md">
            {stats.platformStats.map((platform) => (
              <div key={platform.platform} className="card">
                <div className="card-header">
                  <div className="flex justify-between align-center">
                    <div className="flex align-center gap-sm">
                      <span>
                        {platform.platform === 'reddit' ? '🔴' :
                         platform.platform === 'youtube' ? '📺' :
                         platform.platform === 'flickr' ? '📸' :
                         platform.platform === 'unsplash' ? '🖼️' : '🌐'}
                      </span>
                      <div>
                        <h3>{platform.platform}</h3>
                        <p className="text-muted">
                          {platform.isEnabled ? 'Active' : 'Disabled'}
                        </p>
                      </div>
                    </div>
                    <span className={healthColor(platform.healthStatus)}>
                      {healthIcon(platform.healthStatus)} {platform.healthStatus}
                    </span>
                  </div>
                </div>

                <div className="card-body">
                  <div className="grid grid-2 gap-sm">
                    <div>
                      <p className="text-muted">Authentication</p>
                      <p className={platform.isAuthenticated ? 'text-success' : 'text-danger'}>
                        {platform.isAuthenticated ? 'Connected' : 'Disconnected'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted">Content Found</p>
                      <p><strong>{(platform.totalContent || 0).toLocaleString()}</strong></p>
                    </div>
                    <div>
                      <p className="text-muted">Error Rate</p>
                      <p className={(platform.errorRate || 0) > 0.1 ? 'text-danger' : 'text-success'}>
                        {Math.round((platform.errorRate || 0) * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted">Last Scan</p>
                      <p>
                        {platform.lastScanTime ? new Date(platform.lastScanTime).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                {platform.platform === 'reddit' && platformDetails.reddit && (
                  <div className="card-body">
                    <div className="grid grid-2 gap-xs text-muted">
                      <div>Subreddits: {platformDetails.reddit.subreddits || 0}</div>
                      <div>Avg Score: {platformDetails.reddit.avgScore || 0}</div>
                      <div>Posts: {(platformDetails.reddit.postsScanned || 0).toLocaleString()}</div>
                      <div>Comments: {(platformDetails.reddit.commentsScanned || 0).toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {platform.platform === 'youtube' && platformDetails.youtube && (
                  <div className="card-body">
                    <div className="grid grid-2 gap-xs text-muted">
                      <div>Videos: {(platformDetails.youtube.videosScanned || 0).toLocaleString()}</div>
                      <div>Channels: {platformDetails.youtube.channelsFollowed || 0}</div>
                      <div>Quota Used: {(platformDetails.youtube.quotaUsed || 0).toLocaleString()}</div>
                      <div>Remaining: {(platformDetails.youtube.quotaRemaining || 0).toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {platform.platform === 'flickr' && platformDetails.flickr && (
                  <div className="card-body">
                    <div className="grid grid-2 gap-xs text-muted">
                      <div>Photos: {(platformDetails.flickr.photosScanned || 0).toLocaleString()}</div>
                      <div>Avg Views: {(platformDetails.flickr.avgViews || 0).toLocaleString()}</div>
                      <div>Requests: {platformDetails.flickr.requestsUsed || 0}</div>
                      <div>Remaining: {platformDetails.flickr.requestsRemaining || 0}</div>
                    </div>
                  </div>
                )}

                {platform.platform === 'unsplash' && platformDetails.unsplash && (
                  <div className="card-body">
                    <div className="grid grid-2 gap-xs text-muted">
                      <div>Photos: {(platformDetails.unsplash.photosScanned || 0).toLocaleString()}</div>
                      <div>Avg Likes: {platformDetails.unsplash.avgLikes || 0}</div>
                      <div>Requests: {platformDetails.unsplash.requestsUsed || 0}</div>
                      <div>Remaining: {platformDetails.unsplash.requestsRemaining || 0}</div>
                    </div>
                  </div>
                )}

                <div className="card-footer">
                  <div className="flex gap-sm">
                    <a href={`/admin/${platform.platform}`} className="btn flex-1 text-center">
                      Manage
                    </a>
                    {platform.nextScanTime && (
                      <div className="text-muted text-center">
                        Next: {new Date(platform.nextScanTime).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="card-body">
            <div className="grid gap-sm">
              <div className="flex justify-between align-center p-sm" style={{ borderBottom: '1px solid var(--color-gray-light)' }}>
                <div className="flex align-center gap-sm">
                  <span className="text-success">●</span>
                  <div>
                    <p><strong>All platforms initialized</strong></p>
                    <p className="text-muted">System startup completed</p>
                  </div>
                </div>
                <span className="text-muted">Just now</span>
              </div>
              
              <div className="flex justify-between align-center p-sm" style={{ borderBottom: '1px solid var(--color-gray-light)' }}>
                <div className="flex align-center gap-sm">
                  <span>●</span>
                  <div>
                    <p><strong>Content scanning in progress</strong></p>
                    <p className="text-muted">Multiple platforms active</p>
                  </div>
                </div>
                <span className="text-muted">5 min ago</span>
              </div>
              
              <div className="flex justify-between align-center p-sm">
                <div className="flex align-center gap-sm">
                  <span>●</span>
                  <div>
                    <p><strong>System ready for content aggregation</strong></p>
                    <p className="text-muted">All services configured</p>
                  </div>
                </div>
                <span className="text-muted">1 hour ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}