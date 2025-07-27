'use client'

import { useState } from 'react'

interface ReviewStatsData {
  total_flagged: number
  pending_review: number
  reviewed_today: number
  avg_review_time: number
  approval_rate: number
}

interface ReviewStatsProps {
  stats: ReviewStatsData
  onRefresh: () => Promise<void>
}

export function ReviewStats({ stats, onRefresh }: ReviewStatsProps) {
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    try {
      setLoading(true)
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  const getApprovalRateColor = (rate: number) => {
    if (rate >= 0.8) return 'text-green-600'
    if (rate >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getApprovalRateBadge = (rate: number) => {
    if (rate >= 0.8) return 'bg-green-100 text-green-800'
    if (rate >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getWorkloadStatus = (pending: number) => {
    if (pending === 0) return { color: 'text-green-600', badge: 'bg-green-100 text-green-800', status: 'Clear' }
    if (pending <= 10) return { color: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-800', status: 'Light' }
    if (pending <= 25) return { color: 'text-orange-600', badge: 'bg-orange-100 text-orange-800', status: 'Moderate' }
    return { color: 'text-red-600', badge: 'bg-red-100 text-red-800', status: 'Heavy' }
  }

  const workloadStatus = getWorkloadStatus(stats.pending_review)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Review Statistics</h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${workloadStatus.color}`}>
                {stats.pending_review}
              </div>
              <div className="text-sm text-gray-600 mb-2">Pending Review</div>
              <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${workloadStatus.badge}`}>
                {workloadStatus.status} Workload
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.reviewed_today}
              </div>
              <div className="text-sm text-gray-600">Reviewed Today</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.total_flagged}
              </div>
              <div className="text-sm text-gray-600">Total Flagged</div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Approval Rate</div>
              <div className="text-sm text-gray-600">
                Percentage of reviewed content approved
              </div>
            </div>
            <div className="text-right">
              <div className={`text-lg font-semibold ${getApprovalRateColor(stats.approval_rate)}`}>
                {(stats.approval_rate * 100).toFixed(1)}%
              </div>
              <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getApprovalRateBadge(stats.approval_rate)}`}>
                {stats.approval_rate >= 0.8 ? 'High' : stats.approval_rate >= 0.6 ? 'Medium' : 'Low'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Avg Review Time</div>
              <div className="text-sm text-gray-600">
                Average time per review
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">
                {formatTime(stats.avg_review_time)}
              </div>
              <div className="text-sm text-gray-600">
                per item
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Review Efficiency</div>
              <div className="text-sm text-gray-600">
                Items reviewed per hour
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">
                {stats.avg_review_time > 0 ? Math.round(3600 / stats.avg_review_time) : 0}
              </div>
              <div className="text-sm text-gray-600">
                items/hour
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workload Analysis */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Workload Analysis</h3>
        
        <div className="space-y-3">
          {stats.pending_review === 0 ? (
            <div className="text-center py-6">
              <span className="text-4xl mb-2 block">🎉</span>
              <p className="text-lg font-medium text-green-600">All caught up!</p>
              <p className="text-sm text-gray-600">No pending reviews</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Estimated completion:</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.avg_review_time > 0 ? 
                    formatTime(stats.pending_review * stats.avg_review_time) : 
                    'N/A'
                  }
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Review pace needed:</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.ceil(stats.pending_review / 8)} items/hour
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Workload priority:</span>
                <span className={`text-sm font-medium ${workloadStatus.color}`}>
                  {workloadStatus.status}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
          >
            🔄 Refresh Data
          </button>
          
          <button
            onClick={() => window.location.href = '/admin/filtering'}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
          >
            ⚙️ Adjust Filters
          </button>
        </div>
      </div>

      {/* Tips & Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-900 mb-2">💡 Tips</h3>
        <div className="space-y-2 text-sm text-blue-800">
          {stats.pending_review > 20 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                High review backlog. Consider using bulk actions for obvious cases.
              </span>
            </div>
          )}
          
          {stats.approval_rate < 0.5 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                Low approval rate suggests filters may be too strict. Review filter settings.
              </span>
            </div>
          )}
          
          {stats.approval_rate > 0.9 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                High approval rate suggests filters could be more selective to reduce review workload.
              </span>
            </div>
          )}
          
          {stats.avg_review_time > 300 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                Long review times. Consider improving filter accuracy to reduce complex cases.
              </span>
            </div>
          )}
          
          {stats.pending_review <= 5 && stats.approval_rate >= 0.6 && stats.approval_rate <= 0.8 && (
            <div className="flex items-start gap-2">
              <span>✅</span>
              <span>
                Good balance of automation and human review. System is working well.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}