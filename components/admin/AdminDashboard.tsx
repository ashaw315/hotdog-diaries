'use client'

import { useState, useEffect } from 'react'

interface DashboardStats {
  totalContent: number
  pendingContent: number
  postedToday: number
  totalViews: number
  lastPostTime?: Date
  nextPostTime?: Date
  avgEngagement: number
  systemStatus: 'online' | 'offline' | 'maintenance'
  platformStats: {
    reddit: { enabled: boolean; contentFound: number; lastScan?: string }
    youtube: { enabled: boolean; contentFound: number; lastScan?: string }
    flickr: { enabled: boolean; contentFound: number; lastScan?: string }
    unsplash: { enabled: boolean; contentFound: number; lastScan?: string }
  }
  contentPipeline: {
    queuedForReview: number
    autoApproved: number
    flaggedForManualReview: number
    rejected: number
  }
}

interface RecentActivity {
  id: string
  type: 'posted' | 'added' | 'error'
  description: string
  timestamp: Date
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalContent: 0,
    pendingContent: 0,
    postedToday: 0,
    totalViews: 0,
    avgEngagement: 0,
    systemStatus: 'online',
    platformStats: {
      reddit: { enabled: false, contentFound: 0 },
      youtube: { enabled: false, contentFound: 0 },
      flickr: { enabled: false, contentFound: 0 },
      unsplash: { enabled: false, contentFound: 0 }
    },
    contentPipeline: {
      queuedForReview: 0,
      autoApproved: 0,
      flaggedForManualReview: 0,
      rejected: 0
    }
  })
  
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch dashboard statistics
        const statsResponse = await fetch('/api/admin/dashboard/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        }

        // Fetch recent activity
        const activityResponse = await fetch('/api/admin/dashboard/activity')
        if (activityResponse.ok) {
          const activityData = await activityResponse.json()
          setRecentActivity(activityData)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (date?: Date) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100'
      case 'offline': return 'text-red-600 bg-red-100'
      case 'maintenance': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'posted': return '📤'
      case 'added': return '➕'
      case 'error': return '❌'
      default: return '📝'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back! Here&apos;s what&apos;s happening with your hotdog content.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Content */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="text-3xl mr-4">📊</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Content</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalContent}</p>
            </div>
          </div>
        </div>

        {/* Pending Content */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="text-3xl mr-4">⏳</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Content</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingContent}</p>
            </div>
          </div>
        </div>

        {/* Posted Today */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="text-3xl mr-4">📤</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Posted Today</p>
              <p className="text-2xl font-bold text-gray-900">{stats.postedToday}</p>
            </div>
          </div>
        </div>

        {/* Total Views */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="text-3xl mr-4">👀</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Views</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalViews.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status and Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Overall Status</span>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(stats.systemStatus)}`}>
                {stats.systemStatus.charAt(0).toUpperCase() + stats.systemStatus.slice(1)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg. Engagement</span>
              <span className="text-sm font-medium text-gray-900">{stats.avgEngagement}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Post</span>
              <span className="text-sm font-medium text-gray-900">{formatTime(stats.lastPostTime)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Next Post</span>
              <span className="text-sm font-medium text-gray-900">{formatTime(stats.nextPostTime)}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <span className="text-lg" role="img" aria-label={activity.type}>
                    {getActivityIcon(activity.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Platform Status Overview */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Reddit */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="text-xl mr-2">🔴</span>
                <span className="font-medium">Reddit</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${stats.platformStats.reddit.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            </div>
            <p className="text-sm text-gray-600">{stats.platformStats.reddit.contentFound} posts found</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.platformStats.reddit.lastScan ? 
                `Last scan: ${new Date(stats.platformStats.reddit.lastScan).toLocaleDateString()}` : 
                'Never scanned'
              }
            </p>
          </div>

          {/* YouTube */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="text-xl mr-2">📺</span>
                <span className="font-medium">YouTube</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${stats.platformStats.youtube.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            </div>
            <p className="text-sm text-gray-600">{stats.platformStats.youtube.contentFound} videos found</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.platformStats.youtube.lastScan ? 
                `Last scan: ${new Date(stats.platformStats.youtube.lastScan).toLocaleDateString()}` : 
                'Never scanned'
              }
            </p>
          </div>

          {/* Flickr */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="text-xl mr-2">📸</span>
                <span className="font-medium">Flickr</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${stats.platformStats.flickr.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            </div>
            <p className="text-sm text-gray-600">{stats.platformStats.flickr.contentFound} photos found</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.platformStats.flickr.lastScan ? 
                `Last scan: ${new Date(stats.platformStats.flickr.lastScan).toLocaleDateString()}` : 
                'Never scanned'
              }
            </p>
          </div>

          {/* Unsplash */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="text-xl mr-2">🖼️</span>
                <span className="font-medium">Unsplash</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${stats.platformStats.unsplash.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            </div>
            <p className="text-sm text-gray-600">{stats.platformStats.unsplash.contentFound} photos found</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.platformStats.unsplash.lastScan ? 
                `Last scan: ${new Date(stats.platformStats.unsplash.lastScan).toLocaleDateString()}` : 
                'Never scanned'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Content Pipeline Status */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Content Pipeline</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.contentPipeline.queuedForReview}</div>
            <div className="text-sm text-gray-600">Queued for Review</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.contentPipeline.autoApproved}</div>
            <div className="text-sm text-gray-600">Auto Approved</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.contentPipeline.flaggedForManualReview}</div>
            <div className="text-sm text-gray-600">Manual Review</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.contentPipeline.rejected}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/admin/social"
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="text-lg mr-2">🌐</span>
            Manage Platforms
          </a>
          <a
            href="/admin/queue"
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="text-lg mr-2">📝</span>
            Review Queue
          </a>
          <a
            href="/admin/analytics"
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="text-lg mr-2">📊</span>
            View Analytics
          </a>
          <a
            href="/admin/settings"
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="text-lg mr-2">⚙️</span>
            Settings
          </a>
        </div>
      </div>
    </div>
  )
}