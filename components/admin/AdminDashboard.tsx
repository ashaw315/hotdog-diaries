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
      <div className="grid gap-md">
        <div className="grid grid-4 gap-md">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="loading">Loading...</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-md">
      <div>
        <h1>Dashboard</h1>
        <p className="text-muted">
          Welcome back! Here&apos;s what&apos;s happening with your hotdog content.
        </p>
      </div>

      <div className="grid grid-4 gap-md">
        <div className="card">
          <div className="card-body">
            <div className="flex align-center gap-sm">
              <div>📊</div>
              <div>
                <p className="text-muted">Total Content</p>
                <h2>{stats.totalContent}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex align-center gap-sm">
              <div>⏳</div>
              <div>
                <p className="text-muted">Pending Content</p>
                <h2>{stats.pendingContent}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex align-center gap-sm">
              <div>📤</div>
              <div>
                <p className="text-muted">Posted Today</p>
                <h2>{stats.postedToday}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex align-center gap-sm">
              <div>👀</div>
              <div>
                <p className="text-muted">Total Views</p>
                <h2>{stats.totalViews.toLocaleString()}</h2>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2 gap-md">
        <div className="card">
          <div className="card-header">
            <h2>System Status</h2>
          </div>
          <div className="card-body">
            <div className="grid gap-sm">
              <div className="flex justify-between">
                <span className="text-muted">Overall Status</span>
                <span className={getStatusColor(stats.systemStatus).includes('green') ? 'text-success' : getStatusColor(stats.systemStatus).includes('red') ? 'text-danger' : 'text-muted'}>
                  {stats.systemStatus.charAt(0).toUpperCase() + stats.systemStatus.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Avg. Engagement</span>
                <span>{stats.avgEngagement}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Last Post</span>
                <span>{formatTime(stats.lastPostTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Next Post</span>
                <span>{formatTime(stats.nextPostTime)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="card-body">
            <div className="grid gap-sm">
              {recentActivity.length > 0 ? (
                recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex gap-sm">
                    <span role="img" aria-label={activity.type}>
                      {getActivityIcon(activity.type)}
                    </span>
                    <div>
                      <p>{activity.description}</p>
                      <p className="text-muted">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Platform Status</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-4 gap-md">
            <div className="card">
              <div className="card-body">
                <div className="flex justify-between align-center mb-xs">
                  <div className="flex align-center gap-sm">
                    <span>🔴</span>
                    <strong>Reddit</strong>
                  </div>
                  <span className={stats.platformStats.reddit.enabled ? 'text-success' : 'text-muted'}>●</span>
                </div>
                <p className="text-muted">{stats.platformStats.reddit.contentFound} posts found</p>
                <p className="text-muted">
                  {stats.platformStats.reddit.lastScan ? 
                    `Last scan: ${new Date(stats.platformStats.reddit.lastScan).toLocaleDateString()}` : 
                    'Never scanned'
                  }
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex justify-between align-center mb-xs">
                  <div className="flex align-center gap-sm">
                    <span>📺</span>
                    <strong>YouTube</strong>
                  </div>
                  <span className={stats.platformStats.youtube.enabled ? 'text-success' : 'text-muted'}>●</span>
                </div>
                <p className="text-muted">{stats.platformStats.youtube.contentFound} videos found</p>
                <p className="text-muted">
                  {stats.platformStats.youtube.lastScan ? 
                    `Last scan: ${new Date(stats.platformStats.youtube.lastScan).toLocaleDateString()}` : 
                    'Never scanned'
                  }
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex justify-between align-center mb-xs">
                  <div className="flex align-center gap-sm">
                    <span>📸</span>
                    <strong>Flickr</strong>
                  </div>
                  <span className={stats.platformStats.flickr.enabled ? 'text-success' : 'text-muted'}>●</span>
                </div>
                <p className="text-muted">{stats.platformStats.flickr.contentFound} photos found</p>
                <p className="text-muted">
                  {stats.platformStats.flickr.lastScan ? 
                    `Last scan: ${new Date(stats.platformStats.flickr.lastScan).toLocaleDateString()}` : 
                    'Never scanned'
                  }
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex justify-between align-center mb-xs">
                  <div className="flex align-center gap-sm">
                    <span>🖼️</span>
                    <strong>Unsplash</strong>
                  </div>
                  <span className={stats.platformStats.unsplash.enabled ? 'text-success' : 'text-muted'}>●</span>
                </div>
                <p className="text-muted">{stats.platformStats.unsplash.contentFound} photos found</p>
                <p className="text-muted">
                  {stats.platformStats.unsplash.lastScan ? 
                    `Last scan: ${new Date(stats.platformStats.unsplash.lastScan).toLocaleDateString()}` : 
                    'Never scanned'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Content Pipeline</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-4 gap-md">
            <div className="text-center p-sm card">
              <div><h2>{stats.contentPipeline.queuedForReview}</h2></div>
              <div className="text-muted">Queued for Review</div>
            </div>
            <div className="text-center p-sm card">
              <div><h2 className="text-success">{stats.contentPipeline.autoApproved}</h2></div>
              <div className="text-muted">Auto Approved</div>
            </div>
            <div className="text-center p-sm card">
              <div><h2>{stats.contentPipeline.flaggedForManualReview}</h2></div>
              <div className="text-muted">Manual Review</div>
            </div>
            <div className="text-center p-sm card">
              <div><h2 className="text-danger">{stats.contentPipeline.rejected}</h2></div>
              <div className="text-muted">Rejected</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Quick Actions</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-4 gap-md">
            <a href="/admin/social" className="btn nav-link text-center">
              <span>🌐</span>
              Manage Platforms
            </a>
            <a href="/admin/queue" className="btn nav-link text-center">
              <span>📝</span>
              Review Queue
            </a>
            <a href="/admin/analytics" className="btn nav-link text-center">
              <span>📊</span>
              View Analytics
            </a>
            <a href="/admin/settings" className="btn nav-link text-center">
              <span>⚙️</span>
              Settings
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}