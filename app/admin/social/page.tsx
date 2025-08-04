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
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading social media data...</p>
        </div>
      </div>
    )
  }

  const healthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="text-3xl mr-3">🌐</span>
              Social Media Platforms
            </h1>
            <p className="text-gray-600 mt-1">
              Unified dashboard for all content aggregation platforms
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Refresh Data
            </button>
            <button
              onClick={handleStartAllScanning}
              disabled={scanning}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {scanning ? 'Starting...' : 'Start All Scanning'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overall Statistics */}
      {stats && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Platform Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.totalPlatforms}</p>
                <p className="text-sm text-gray-600">Total Platforms</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.activePlatforms}</p>
                <p className="text-sm text-gray-600">Active Platforms</p>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.totalContentScanned.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Content Scanned</p>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.totalContentApproved.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Content Approved</p>
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{Math.round(stats.overallHealthScore)}%</p>
                <p className="text-sm text-gray-600">Health Score</p>
              </div>
            </div>
          </div>

          {/* Health Score Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall System Health</span>
              <span className="text-sm text-gray-500">{Math.round(stats.overallHealthScore)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  stats.overallHealthScore >= 80 ? 'bg-green-500' : 
                  stats.overallHealthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${stats.overallHealthScore}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Platform Status Cards */}
      {stats?.platformStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {stats.platformStats.map((platform) => (
            <div key={platform.platform} className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">
                    {platform.platform === 'reddit' ? '🔴' :
                     platform.platform === 'youtube' ? '📺' :
                     platform.platform === 'flickr' ? '📸' :
                     platform.platform === 'unsplash' ? '🖼️' : '🌐'}
                  </span>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 capitalize">
                      {platform.platform}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {platform.isEnabled ? 'Active' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${healthColor(platform.healthStatus)}`}>
                    {healthIcon(platform.healthStatus)} {platform.healthStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Authentication</p>
                  <p className={`text-sm font-medium ${platform.isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                    {platform.isAuthenticated ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Content Found</p>
                  <p className="text-sm font-medium text-gray-900">{platform.totalContent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className={`text-sm font-medium ${platform.errorRate > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.round(platform.errorRate * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Last Scan</p>
                  <p className="text-sm font-medium text-gray-900">
                    {platform.lastScanTime ? new Date(platform.lastScanTime).toLocaleDateString() : 'Never'}
                  </p>
                </div>
              </div>

              {/* Platform-specific details */}
              {platform.platform === 'reddit' && platformDetails.reddit && (
                <div className="border-t pt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>Subreddits: {platformDetails.reddit.subreddits}</div>
                  <div>Avg Score: {platformDetails.reddit.avgScore}</div>
                  <div>Posts: {platformDetails.reddit.postsScanned.toLocaleString()}</div>
                  <div>Comments: {platformDetails.reddit.commentsScanned.toLocaleString()}</div>
                </div>
              )}

              {platform.platform === 'youtube' && platformDetails.youtube && (
                <div className="border-t pt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>Videos: {platformDetails.youtube.videosScanned.toLocaleString()}</div>
                  <div>Channels: {platformDetails.youtube.channelsFollowed}</div>
                  <div>Quota Used: {platformDetails.youtube.quotaUsed.toLocaleString()}</div>
                  <div>Remaining: {platformDetails.youtube.quotaRemaining.toLocaleString()}</div>
                </div>
              )}

              {platform.platform === 'flickr' && platformDetails.flickr && (
                <div className="border-t pt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>Photos: {platformDetails.flickr.photosScanned.toLocaleString()}</div>
                  <div>Avg Views: {platformDetails.flickr.avgViews.toLocaleString()}</div>
                  <div>Requests: {platformDetails.flickr.requestsUsed}</div>
                  <div>Remaining: {platformDetails.flickr.requestsRemaining}</div>
                </div>
              )}

              {platform.platform === 'unsplash' && platformDetails.unsplash && (
                <div className="border-t pt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>Photos: {platformDetails.unsplash.photosScanned.toLocaleString()}</div>
                  <div>Avg Likes: {platformDetails.unsplash.avgLikes}</div>
                  <div>Requests: {platformDetails.unsplash.requestsUsed}</div>
                  <div>Remaining: {platformDetails.unsplash.requestsRemaining}</div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-4 flex space-x-2">
                <a
                  href={`/admin/${platform.platform}`}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors text-center"
                >
                  Manage
                </a>
                {platform.nextScanTime && (
                  <div className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 text-xs rounded-md text-center">
                    Next: {new Date(platform.nextScanTime).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System Activity */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-3"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">All platforms initialized</p>
                <p className="text-xs text-gray-500">System startup completed</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">Just now</span>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center">
              <div className="h-2 w-2 bg-blue-500 rounded-full mr-3"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Content scanning in progress</p>
                <p className="text-xs text-gray-500">Multiple platforms active</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">5 min ago</span>
          </div>
          
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center">
              <div className="h-2 w-2 bg-yellow-500 rounded-full mr-3"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">System ready for content aggregation</p>
                <p className="text-xs text-gray-500">All services configured</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">1 hour ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}