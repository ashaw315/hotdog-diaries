'use client'

import { useState, useEffect } from 'react'
import ContentFeed from '@/components/ui/ContentFeed'

interface ContentStats {
  totalContent: number
  pendingContent: number
  approvedContent: number
  rejectedContent: number
  postedContent: number
  contentByPlatform: {
    [platform: string]: number
  }
  contentByType: {
    [type: string]: number
  }
  recentActivity: Array<{
    id: string
    action: string
    content_id: number
    timestamp: Date
    details: string
  }>
}

export default function ContentManagementPage() {
  const [stats, setStats] = useState<ContentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

  useEffect(() => {
    loadContentStats()
  }, [])

  const loadContentStats = async () => {
    try {
      setError(null)
      const response = await fetch('/api/admin/content/stats')
      
      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      } else {
        throw new Error('Failed to load content statistics')
      }
    } catch (err) {
      setError('Failed to load content data')
      console.error('Error loading content stats:', err)
    } finally {
      setLoading(false)
    }
  }

  // Commented out unused function to fix build errors
  // const handleBulkAction = async (action: string, contentIds: number[]) => {
  //   try {
  //     setError(null)
  //     const response = await fetch('/api/admin/content/bulk', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ action, contentIds })
  //     })

  //     if (response.ok) {
  //       await loadContentStats()
  //     } else {
  //       throw new Error(`Failed to perform bulk ${action}`)
  //     }
  //   } catch (err) {
  //     setError(`Failed to perform bulk ${action}`)
  //     console.error(`Bulk ${action} error:`, err)
  //   }
  // }

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'reddit': return '🔴'
      case 'youtube': return '📺'
      case 'flickr': return '📸'
      case 'unsplash': return '🖼️'
      case 'instagram': return '📷'
      case 'tiktok': return '🎵'
      default: return '🌐'
    }
  }

  if (loading) {
    return (
      <div className="container content-area">
        <div className="text-center">
          <div className="spinner mb-sm"></div>
          <p className="loading">Loading content management...</p>
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
                  <span>📋</span>
                  Content Management
                </h1>
                <p className="text-muted">
                  Manage all content across platforms - review, approve, and organize
                </p>
              </div>
              <button onClick={loadContentStats} className="btn">
                Refresh Data
              </button>
            </div>

            {error && (
              <div className="alert alert-danger mt-sm">
                <span>⚠ {error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content Statistics */}
        {stats && (
          <div className="card">
            <div className="card-header">
              <h2>Content Overview</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-4 gap-md mb-lg">
                <div className="text-center card">
                  <div className="card-body">
                    <h3>{stats.totalContent}</h3>
                    <p className="text-muted">Total Content</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <h3 className="text-muted">{stats.pendingContent}</h3>
                    <p className="text-muted">Pending Review</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <h3 className="text-success">{stats.approvedContent}</h3>
                    <p className="text-muted">Approved</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <h3 className="text-success">{stats.postedContent}</h3>
                    <p className="text-muted">Posted</p>
                  </div>
                </div>
              </div>

              {/* Platform Breakdown */}
              <div className="grid grid-2 gap-md">
                <div className="card">
                  <div className="card-header">
                    <h3>Content by Platform</h3>
                  </div>
                  <div className="card-body">
                    <div className="grid gap-xs">
                      {Object.entries(stats.contentByPlatform).map(([platform, count]) => (
                        <div key={platform} className="flex justify-between align-center">
                          <div className="flex align-center gap-xs">
                            <span>{getPlatformIcon(platform)}</span>
                            <span>{platform}</span>
                          </div>
                          <span><strong>{count}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3>Content by Type</h3>
                  </div>
                  <div className="card-body">
                    <div className="grid gap-xs">
                      {Object.entries(stats.contentByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between align-center">
                          <span>{type}</span>
                          <span><strong>{count}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-4 gap-sm">
              <a href="/admin/queue" className="btn text-center">
                📝 Review Queue
              </a>
              <a href="/admin/posted" className="btn text-center">
                📤 Posted Content
              </a>
              <a href="/admin/analytics" className="btn text-center">
                📊 Analytics
              </a>
              <a href="/admin/settings" className="btn text-center">
                ⚙️ Settings
              </a>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between align-center">
              <h2>Content Feed</h2>
              <div className="flex gap-xs">
                <button 
                  onClick={() => setActiveTab('pending')}
                  className={`btn ${activeTab === 'pending' ? 'btn-primary' : ''}`}
                >
                  Pending ({stats?.pendingContent || 0})
                </button>
                <button 
                  onClick={() => setActiveTab('approved')}
                  className={`btn ${activeTab === 'approved' ? 'btn-primary' : ''}`}
                >
                  Approved ({stats?.approvedContent || 0})
                </button>
                <button 
                  onClick={() => setActiveTab('all')}
                  className={`btn ${activeTab === 'all' ? 'btn-primary' : ''}`}
                >
                  All ({stats?.totalContent || 0})
                </button>
                <button 
                  onClick={() => setActiveTab('rejected')}
                  className={`btn ${activeTab === 'rejected' ? 'btn-primary' : ''}`}
                >
                  Rejected ({stats?.rejectedContent || 0})
                </button>
              </div>
            </div>
          </div>
          <div className="card-body">
            <ContentFeed 
              type={activeTab === 'all' ? undefined : activeTab}
              showActions={true}
              onEdit={(id) => console.log('Edit content:', id)}
              onDelete={(id) => console.log('Delete content:', id)}
              onPost={(id) => console.log('Post content:', id)}
              onApprove={(id) => console.log('Approve content:', id)}
              onReject={(id) => console.log('Reject content:', id)}
            />
          </div>
        </div>

        {/* Recent Activity */}
        {stats?.recentActivity && (
          <div className="card">
            <div className="card-header">
              <h2>Recent Activity</h2>
            </div>
            <div className="card-body">
              <div className="grid gap-sm">
                {stats.recentActivity.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex justify-between align-center p-sm card">
                    <div>
                      <strong>{activity.action}</strong>
                      <p className="text-muted">{activity.details}</p>
                    </div>
                    <span className="text-muted">
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              
              {stats.recentActivity.length === 0 && (
                <div className="text-center p-md">
                  <p className="text-muted">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}