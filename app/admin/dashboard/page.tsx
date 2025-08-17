'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

interface ContentItem {
  id: number
  source_platform: string
  content_text: string | null
  content_image_url: string | null
  content_video_url: string | null
}

interface DashboardData {
  queueStats: {
    totalApproved: number
    daysOfContent: number
    needsScanning: boolean
    contentBalance: {
      video: number
      gif: number
      image: number
      text: number
    }
  }
  postingSchedule: {
    todaysPosts: number
    nextPost: Date | null
    upcomingPosts: Array<{
      time: string
      content: ContentItem | null
      type: string
      platform: string
    }>
  }
  platformStatus: Record<string, {
    operational: boolean
    itemCount: number
    lastScan: Date | null
    status: string
  }>
  apiSavings: {
    callsSavedToday: number
    estimatedMonthlySavings: number
    nextScanDate: Date | null
  }
  alerts: Array<{
    type: 'critical' | 'warning' | 'info'
    message: string
    action?: string
  }>
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/dashboard')
      if (!response.ok) throw new Error('Failed to fetch dashboard data')
      const result = await response.json()
      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const calculateNextScanDate = () => {
    if (!data) return 'Unknown'
    const daysUntilScan = Math.max(0, data.queueStats.daysOfContent - 14)
    const nextScanDate = new Date()
    nextScanDate.setDate(nextScanDate.getDate() + daysUntilScan)
    return nextScanDate.toLocaleDateString()
  }

  const getContentBalanceStatus = (type: string, current: number) => {
    const targets = { video: 30, gif: 25, image: 40, text: 5 }
    const target = targets[type as keyof typeof targets] || 0
    const diff = Math.abs(current - target)
    
    if (diff < 5) return 'text-green-600'
    if (diff < 15) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Dashboard Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🌭 Hotdog Diaries Dashboard</h1>
              <p className="text-gray-600 mt-2">Production monitoring and content management</p>
            </div>
            <div className="flex space-x-4">
              <Link href="/admin/queue/analytics" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Queue Analytics
              </Link>
              <button 
                onClick={fetchDashboardData}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {data?.alerts && data.alerts.length > 0 && (
          <div className="mb-8 space-y-4">
            {data.alerts.map((alert, index) => (
              <div key={index} className={`p-4 rounded-lg border-l-4 ${
                alert.type === 'critical' ? 'bg-red-50 border-red-400 text-red-800' :
                alert.type === 'warning' ? 'bg-yellow-50 border-yellow-400 text-yellow-800' :
                'bg-blue-50 border-blue-400 text-blue-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{alert.message}</span>
                  {alert.action && (
                    <button className="text-sm underline hover:no-underline">
                      {alert.action}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Queue Health */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-3xl text-orange-500 mr-4">📋</div>
              <div>
                <p className="text-sm text-gray-600">Queue Health</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data?.queueStats.totalApproved || 0}
                </p>
                <p className="text-xs text-gray-500">
                  {data?.queueStats.daysOfContent.toFixed(1) || 0} days
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className={`text-sm font-medium ${
                (data?.queueStats.daysOfContent || 0) > 14 ? 'text-green-600' :
                (data?.queueStats.daysOfContent || 0) > 7 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {(data?.queueStats.daysOfContent || 0) > 14 ? '✅ Well Stocked' :
                 (data?.queueStats.daysOfContent || 0) > 7 ? '⚠️ Moderate' :
                 '🚨 Low Stock'}
              </div>
            </div>
          </div>

          {/* Today's Posts */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-3xl text-green-500 mr-4">📱</div>
              <div>
                <p className="text-sm text-gray-600">Today's Posts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data?.postingSchedule.todaysPosts || 0}/6
                </p>
                <p className="text-xs text-gray-500">
                  Next: {data?.postingSchedule.nextPost ? 
                    new Date(data.postingSchedule.nextPost).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
                    'No posts scheduled'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Platform Status */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-3xl text-blue-500 mr-4">🌐</div>
              <div>
                <p className="text-sm text-gray-600">Platforms</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data?.platformStatus ? Object.values(data.platformStatus).filter(p => p.operational).length : 0}/8
                </p>
                <p className="text-xs text-gray-500">operational</p>
              </div>
            </div>
          </div>

          {/* API Savings */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-3xl text-purple-500 mr-4">💰</div>
              <div>
                <p className="text-sm text-gray-600">API Savings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data?.apiSavings.callsSavedToday || 0}
                </p>
                <p className="text-xs text-gray-500">calls saved today</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Content Balance Alert */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Balance</h3>
            <div className="space-y-3">
              {data?.queueStats.contentBalance && Object.entries(data.queueStats.contentBalance).map(([type, percentage]) => {
                const targets = { video: 30, gif: 25, image: 40, text: 5 }
                const target = targets[type as keyof typeof targets] || 0
                const status = Math.abs(percentage - target) < 5 ? 'OK' : 
                              percentage < target * 0.5 ? 'CRITICAL' : 
                              percentage < target * 0.8 ? 'LOW' : 
                              percentage > target * 1.5 ? 'HIGH' : 'OK'
                
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="capitalize text-gray-700 w-16">{type}:</span>
                      <div className="flex items-center ml-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className={`h-2 rounded-full ${getContentBalanceStatus(type, percentage) === 'text-green-600' ? 'bg-green-500' :
                                                                getContentBalanceStatus(type, percentage) === 'text-yellow-600' ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm font-medium ${getContentBalanceStatus(type, percentage)}`}>
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">target: {target}%</span>
                      <div className={`text-xs font-medium ${
                        status === 'OK' ? 'text-green-600' :
                        status === 'CRITICAL' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {status}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Action Needed:</strong> Content imbalance detected. 
                {(data?.queueStats.contentBalance.video || 0) === 0 && ' Add videos immediately.'}
                {(data?.queueStats.contentBalance.gif || 0) < 15 && ' Need more GIFs.'}
              </p>
            </div>
          </div>

          {/* Today's Posting Schedule */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Schedule</h3>
            <div className="space-y-3">
              {data?.postingSchedule.upcomingPosts?.slice(0, 6).map((post, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900 w-16">{post.time}</span>
                    <div className="ml-3">
                      <div className="text-sm text-gray-700">{post.platform} • {post.type}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {post.content?.content_text?.substring(0, 50) || 'Preview not available'}...
                      </div>
                    </div>
                  </div>
                  <button className="text-sm text-orange-600 hover:text-orange-800">
                    Override
                  </button>
                </div>
              )) || [
                <div key="loading" className="text-center text-gray-500 py-4">
                  Loading schedule...
                </div>
              ]}
            </div>
          </div>
        </div>

        {/* Platform Status Grid */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data?.platformStatus && Object.entries(data.platformStatus).map(([platform, status]) => (
              <div key={platform} className={`p-3 rounded-lg border ${status.operational ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{platform}</span>
                  <span className={`text-sm ${status.operational ? 'text-green-600' : 'text-red-600'}`}>
                    {status.operational ? '✅' : '❌'}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  {status.itemCount} items
                </div>
                <div className="text-xs text-gray-500">
                  {status.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Scanning Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Smart Scanning Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl text-orange-500 mb-2">⏸️</div>
              <div className="text-sm font-medium text-gray-900">Scanning Paused</div>
              <div className="text-xs text-gray-500">Queue over capacity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-green-500 mb-2">💰</div>
              <div className="text-sm font-medium text-gray-900">
                ~{data?.apiSavings.estimatedMonthlySavings || 0} calls/month saved
              </div>
              <div className="text-xs text-gray-500">Smart conservation active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-blue-500 mb-2">📅</div>
              <div className="text-sm font-medium text-gray-900">
                Resume: {calculateNextScanDate()}
              </div>
              <div className="text-xs text-gray-500">When queue reaches 14 days</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link 
              href="/admin/content/preview"
              className="bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 text-center"
            >
              Preview Next Posts
            </Link>
            <Link 
              href="/admin/content/add-manual"
              className="bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 text-center"
            >
              Add Content Manually
            </Link>
            <Link 
              href="/admin/queue"
              className="bg-orange-500 text-white px-4 py-3 rounded-lg hover:bg-orange-600 text-center"
            >
              Manage Queue
            </Link>
            <button 
              onClick={() => window.confirm('Force scan all platforms?') && fetch('/api/cron/scan-content', {method: 'POST', headers: {'Authorization': 'Bearer hotdog-cron-secret-2025', 'Content-Type': 'application/json'}, body: JSON.stringify({force: true})})}
              className="bg-red-500 text-white px-4 py-3 rounded-lg hover:bg-red-600 text-center"
            >
              Force Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}