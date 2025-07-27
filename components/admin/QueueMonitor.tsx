'use client'

import { useState } from 'react'

interface QueueStatus {
  totalApproved: number
  totalPending: number
  totalPosted: number
  isHealthy: boolean
  alertLevel: 'none' | 'low' | 'critical'
  message: string
}

interface PostingStats {
  todaysPosts: number
  thisWeeksPosts: number
  thisMonthsPosts: number
  totalPosts: number
  avgPostsPerDay: number
}

interface QueueMonitorProps {
  queueStatus: QueueStatus
  stats: PostingStats
  onRefresh: () => Promise<void>
}

export function QueueMonitor({ queueStatus, stats, onRefresh }: QueueMonitorProps) {
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    try {
      setLoading(true)
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const getAlertColor = (level: QueueStatus['alertLevel']) => {
    switch (level) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'low':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default:
        return 'bg-green-50 border-green-200 text-green-800'
    }
  }

  const getAlertIcon = (level: QueueStatus['alertLevel']) => {
    switch (level) {
      case 'critical':
        return '🚨'
      case 'low':
        return '⚠️'
      default:
        return '✅'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Queue Monitor</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Queue Status Alert */}
        <div className={`border rounded-lg p-4 ${getAlertColor(queueStatus.alertLevel)}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{getAlertIcon(queueStatus.alertLevel)}</span>
            <span className="font-medium">{queueStatus.message}</span>
          </div>
        </div>

        {/* Queue Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {queueStatus.totalApproved}
              </div>
              <div className="text-sm text-blue-800">Approved</div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {queueStatus.totalPending}
              </div>
              <div className="text-sm text-yellow-800">Pending</div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {queueStatus.totalPosted}
              </div>
              <div className="text-sm text-green-800">Posted</div>
            </div>
          </div>
        </div>

        {/* Health Indicator */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Queue Health</span>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${queueStatus.isHealthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-sm font-medium ${queueStatus.isHealthy ? 'text-green-700' : 'text-red-700'}`}>
                {queueStatus.isHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
          </div>
        </div>

        {/* Posting Statistics */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Posting Statistics</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Today</div>
              <div className="text-lg font-semibold text-gray-900">
                {stats.todaysPosts} posts
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">This Week</div>
              <div className="text-lg font-semibold text-gray-900">
                {stats.thisWeeksPosts} posts
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">This Month</div>
              <div className="text-lg font-semibold text-gray-900">
                {stats.thisMonthsPosts} posts
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-lg font-semibold text-gray-900">
                {stats.totalPosts} posts
              </div>
            </div>
          </div>

          <div className="mt-4 bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-blue-600">Average per Day</div>
            <div className="text-lg font-semibold text-blue-900">
              {stats.avgPostsPerDay} posts/day
            </div>
          </div>
        </div>

        {/* Queue Recommendations */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Recommendations</h3>
          <div className="space-y-2">
            {queueStatus.totalApproved === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">
                  ⚠️ No approved content available. Review and approve pending content to resume posting.
                </p>
              </div>
            )}
            
            {queueStatus.totalApproved > 0 && queueStatus.totalApproved <= 5 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-sm">
                  💡 Queue is running low. Consider approving more content to maintain consistent posting.
                </p>
              </div>
            )}
            
            {queueStatus.totalPending > 20 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  📝 Large number of pending items. Review and approve content to keep the queue flowing.
                </p>
              </div>
            )}
            
            {queueStatus.isHealthy && queueStatus.totalApproved > 10 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm">
                  ✅ Queue is healthy with sufficient approved content for consistent posting.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}