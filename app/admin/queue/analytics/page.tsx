'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

interface QueueStats {
  totalApproved: number
  totalPending: number
  daysOfContent: number
  platforms: Record<string, number>
  contentTypes: Record<string, number>
  needsScanning: boolean
  platformPercentages: Record<string, number>
  contentTypePercentages: Record<string, number>
}

interface ScanRecommendation {
  platform: string
  priority: 'high' | 'medium' | 'low' | 'skip'
  reason: string
  contentType: string
}

interface WeeklySchedule {
  day: string
  date: string
  shouldScan: boolean
  estimatedItems: number
  priority: string[]
  reason: string
}

export default function QueueAnalyticsPage() {
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [recommendations, setRecommendations] = useState<ScanRecommendation[]>([])
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule[]>([])
  const [health, setHealth] = useState<{ healthy: boolean; issues: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      // Fetch queue stats
      const statsResponse = await fetch('/api/admin/queue/stats')
      if (!statsResponse.ok) throw new Error('Failed to fetch stats')
      const statsData = await statsResponse.json()
      setStats(statsData.data)

      // Fetch scan recommendations
      const recommendationsResponse = await fetch('/api/admin/queue/recommendations')
      if (!recommendationsResponse.ok) throw new Error('Failed to fetch recommendations')
      const recommendationsData = await recommendationsResponse.json()
      setRecommendations(recommendationsData.data)

      // Fetch weekly schedule
      const scheduleResponse = await fetch('/api/admin/queue/schedule')
      if (!scheduleResponse.ok) throw new Error('Failed to fetch schedule')
      const scheduleData = await scheduleResponse.json()
      setWeeklySchedule(scheduleData.data)

      // Fetch queue health
      const healthResponse = await fetch('/api/admin/queue/health')
      if (!healthResponse.ok) throw new Error('Failed to fetch health')
      const healthData = await healthResponse.json()
      setHealth(healthData.data)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-blue-600 bg-blue-50'
      case 'skip': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-purple-100 text-purple-800'
      case 'gif': return 'bg-pink-100 text-pink-800'
      case 'image': return 'bg-blue-100 text-blue-800'
      case 'text': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading queue analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error Loading Analytics</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchAnalytics}
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
              <h1 className="text-3xl font-bold text-gray-900">Queue Analytics</h1>
              <p className="text-gray-600 mt-2">Smart content balancing and scanning insights</p>
            </div>
            <div className="flex space-x-4">
              <Link href="/admin/queue" className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                Back to Queue
              </Link>
              <button 
                onClick={fetchAnalytics}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Queue Health Status */}
        {health && (
          <div className={`mb-8 p-6 rounded-lg border-l-4 ${health.healthy ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
            <div className="flex items-center">
              <div className={`text-2xl mr-3 ${health.healthy ? 'text-green-600' : 'text-red-600'}`}>
                {health.healthy ? '✅' : '⚠️'}
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${health.healthy ? 'text-green-800' : 'text-red-800'}`}>
                  Queue Health: {health.healthy ? 'Healthy' : 'Issues Found'}
                </h3>
                {health.issues.length > 0 && (
                  <ul className="mt-2 text-sm text-red-700">
                    {health.issues.map((issue, index) => (
                      <li key={index} className="flex items-center">
                        <span className="mr-2">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="text-3xl text-orange-500 mr-4">📋</div>
                <div>
                  <p className="text-sm text-gray-600">Total Queue</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalApproved}</p>
                  <p className="text-xs text-gray-500">{stats.totalPending} pending</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="text-3xl text-blue-500 mr-4">📅</div>
                <div>
                  <p className="text-sm text-gray-600">Days of Content</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.daysOfContent.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">@ 6 posts/day</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="text-3xl text-green-500 mr-4">🎯</div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className={`text-lg font-bold ${stats.needsScanning ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.needsScanning ? 'Needs Scanning' : 'Well Stocked'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.daysOfContent > 14 ? 'Over capacity' : stats.daysOfContent > 7 ? 'Healthy' : 'Low'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="text-3xl text-purple-500 mr-4">⚡</div>
                <div>
                  <p className="text-sm text-gray-600">Depletion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">6/day</p>
                  <p className="text-xs text-gray-500">
                    {stats.daysOfContent > 0 ? `Empty in ${Math.ceil(stats.daysOfContent)} days` : 'Queue empty'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Content Type Distribution */}
          {stats && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Type Distribution</h3>
              <div className="space-y-4">
                {Object.entries(stats.contentTypePercentages).map(([type, percentage]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={`inline-block w-3 h-3 rounded-full mr-3 ${getContentTypeColor(type)}`}></span>
                      <span className="capitalize text-gray-700">{type}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                        <div 
                          className={`h-2 rounded-full ${getContentTypeColor(type)}`}
                          style={{ width: `${Math.min(percentage * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">
                        {(percentage * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-500 w-8 text-right ml-2">
                        ({stats.contentTypes[type]})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-gray-500">
                Target: Video 30%, GIF 25%, Image 40%, Text 5%
              </div>
            </div>
          )}

          {/* Platform Distribution */}
          {stats && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Distribution</h3>
              <div className="space-y-3">
                {Object.entries(stats.platforms)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <span className="capitalize text-gray-700">{platform}</span>
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: `${Math.min((stats.platformPercentages[platform] || 0) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {((stats.platformPercentages[platform] || 0) * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500 w-8 text-right ml-2">
                          ({count})
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Scan Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Recommendations</h3>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div key={index} className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{rec.platform}</span>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getContentTypeColor(rec.contentType)}`}>
                        {rec.contentType}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                        {rec.priority}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{rec.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Schedule Preview */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">7-Day Scan Schedule</h3>
            <div className="space-y-3">
              {weeklySchedule.map((day, index) => (
                <div key={index} className={`p-3 rounded-lg border ${day.shouldScan ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{day.day}</span>
                    <span className="text-sm text-gray-500">{day.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${day.shouldScan ? 'text-orange-700' : 'text-gray-600'}`}>
                      {day.shouldScan ? `Scan ${day.priority.join(', ')}` : 'No scanning needed'}
                    </span>
                    {day.shouldScan && (
                      <span className="text-xs text-orange-600">
                        ~{day.estimatedItems} items
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{day.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => window.open('/api/cron/scan-content', '_blank')}
              className="bg-orange-500 text-white px-4 py-3 rounded-lg hover:bg-orange-600 flex items-center justify-center"
            >
              <span className="mr-2">🔍</span>
              Trigger Smart Scan
            </button>
            
            <Link 
              href="/admin/queue"
              className="bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 flex items-center justify-center"
            >
              <span className="mr-2">📋</span>
              View Full Queue
            </Link>
            
            <Link 
              href="/admin/schedule"
              className="bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 flex items-center justify-center"
            >
              <span className="mr-2">⏰</span>
              Posting Schedule
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}