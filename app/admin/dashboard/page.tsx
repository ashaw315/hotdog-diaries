'use client'

import React from 'react'
import Link from 'next/link'
import { DailyCronStatus } from '@/components/admin/DailyCronStatus'
import { useDashboardData } from '@/hooks/useAdminData'
import { useRequireAuth } from '@/components/providers/AuthProvider'
import ApiDemo from '@/components/admin/ApiDemo'


export default function AdminDashboard() {
  // Ensure user is authenticated
  useRequireAuth()
  
  // Use the new dashboard data hook
  const { data, loading, error, refresh } = useDashboardData(5 * 60 * 1000) // 5 minutes

  // 🔍 Dashboard Component Data Diagnostics
  React.useEffect(() => {
    console.group('🔍 Dashboard Component State')
    console.log('Loading state:', loading)
    console.log('Error state:', error)
    console.log('Data present:', !!data)
    if (data) {
      console.log('Data structure check:', {
        queueStats: !!data.queueStats,
        totalApproved: data.queueStats?.totalApproved,
        daysOfContent: data.queueStats?.daysOfContent,
        todaysPosts: data.postingSchedule?.todaysPosts,
        platformStatus: !!data.platformStatus,
        alerts: data.alerts?.length ?? 0
      })
    }
    console.groupEnd()
  }, [data, loading, error])

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
            onClick={refresh}
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
                onClick={refresh}
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
                  {(() => {
                    const value = data?.queueStats.totalApproved || 0
                    console.log('🔍 UI Render - totalApproved:', {
                      rawValue: data?.queueStats?.totalApproved,
                      fallbackValue: value,
                      dataExists: !!data,
                      queueStatsExists: !!data?.queueStats
                    })
                    return value
                  })()}
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

          {/* Today&apos;s Posts */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-3xl text-green-500 mr-4">📱</div>
              <div>
                <p className="text-sm text-gray-600">Today&apos;s Posts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(() => {
                    const value = data?.postingSchedule.todaysPosts || 0
                    console.log('🔍 UI Render - todaysPosts:', {
                      rawValue: data?.postingSchedule?.todaysPosts,
                      fallbackValue: value,
                      postingScheduleExists: !!data?.postingSchedule
                    })
                    return `${value}/3`
                  })()}
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

          {/* Today&apos;s Posting Schedule */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Schedule</h3>
            <div className="space-y-3">
              {data?.postingSchedule.upcomingPosts?.slice(0, 3).map((post, index) => (
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

        {/* API Integration Demo */}
        <ApiDemo />

        {/* Daily Cron Status */}
        <div className="mt-8">
          <DailyCronStatus />
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
              onClick={() => {
                if (window.confirm('Force scan all platforms?')) {
                  // This would trigger a platform scan via the new API
                  console.log('Force scan triggered - implement via new API')
                }
              }}
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