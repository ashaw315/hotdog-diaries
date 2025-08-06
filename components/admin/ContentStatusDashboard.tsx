'use client'

import { useState, useEffect } from 'react'

interface ContentStatusMetrics {
  statusCounts: {
    discovered: number
    pending_review: number
    approved: number
    scheduled: number
    posted: number
    rejected: number
    archived: number
  }
  flowMetrics: {
    processedToday: number
    processingRate: number // items per hour
    approvalRate: number // percentage
    averageReviewTime: number // minutes
  }
  queueHealth: {
    approvedAvailable: number
    scheduledUpcoming: number
    nextPostingGap: number // hours until next gap
    recommendedActions: string[]
  }
  platformPerformance: Array<{
    platform: string
    totalProcessed: number
    approvalRate: number
    averageConfidence: number
    topPerformer: boolean
  }>
}

interface ContentStatusDashboardProps {
  onRefresh?: () => void
}

export function ContentStatusDashboard({ onRefresh }: ContentStatusDashboardProps) {
  const [metrics, setMetrics] = useState<ContentStatusMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchMetrics()
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000)
    setRefreshInterval(interval)

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [])

  const fetchMetrics = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/content/metrics')
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
        setError(null)
      } else {
        throw new Error('Failed to fetch metrics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchMetrics()
    onRefresh?.()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'discovered': return 'text-blue-600 bg-blue-100'
      case 'pending_review': return 'text-yellow-600 bg-yellow-100'
      case 'approved': return 'text-green-600 bg-green-100'
      case 'scheduled': return 'text-purple-600 bg-purple-100'
      case 'posted': return 'text-gray-600 bg-gray-100'
      case 'rejected': return 'text-red-600 bg-red-100'
      case 'archived': return 'text-gray-500 bg-gray-50'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getHealthIndicator = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-600'
    if (value >= thresholds.warning) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading && !metrics) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-center py-12">
            <div className="spinner mr-3"></div>
            <span>Loading dashboard metrics...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">⚠️ Error loading metrics</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="btn btn-primary"
            >
              🔄 Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="grid gap-lg">
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <div className="flex justify-between align-center">
            <div>
              <h2 className="flex align-center gap-sm">
                <span>📊</span>
                Content Pipeline Dashboard
              </h2>
              <p className="text-muted">
                Real-time metrics and health monitoring
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="btn btn-sm"
              disabled={isLoading}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Status Counts */}
      <div className="card">
        <div className="card-header">
          <h3>Content Status Distribution</h3>
        </div>
        <div className="card-body">
          <div className="grid gap-md" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {Object.entries(metrics.statusCounts).map(([status, count]) => (
              <div key={status} className="text-center">
                <div className={`text-2xl font-bold p-3 rounded-lg ${getStatusColor(status)}`}>
                  {count}
                </div>
                <div className="text-sm mt-2 capitalize">
                  {status.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flow Metrics & Queue Health */}
      <div className="grid gap-lg" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Flow Metrics */}
        <div className="card">
          <div className="card-header">
            <h3>Content Flow Velocity</h3>
          </div>
          <div className="card-body">
            <div className="grid gap-md" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.flowMetrics.processedToday}
                </div>
                <div className="text-sm text-muted">Processed Today</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.flowMetrics.processingRate.toFixed(1)}
                </div>
                <div className="text-sm text-muted">Items/Hour</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getHealthIndicator(metrics.flowMetrics.approvalRate, { good: 70, warning: 50 })}`}>
                  {metrics.flowMetrics.approvalRate.toFixed(1)}%
                </div>
                <div className="text-sm text-muted">Approval Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.flowMetrics.averageReviewTime.toFixed(0)}m
                </div>
                <div className="text-sm text-muted">Avg Review Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Health */}
        <div className="card">
          <div className="card-header">
            <h3>Queue Health</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex justify-between align-center">
                <span>Approved & Ready</span>
                <span className={`font-bold ${getHealthIndicator(metrics.queueHealth.approvedAvailable, { good: 10, warning: 5 })}`}>
                  {metrics.queueHealth.approvedAvailable} items
                </span>
              </div>
              <div className="flex justify-between align-center">
                <span>Scheduled Upcoming</span>
                <span className="font-bold text-purple-600">
                  {metrics.queueHealth.scheduledUpcoming} items
                </span>
              </div>
              <div className="flex justify-between align-center">
                <span>Next Posting Gap</span>
                <span className={`font-bold ${getHealthIndicator(24 - metrics.queueHealth.nextPostingGap, { good: 18, warning: 12 })}`}>
                  {metrics.queueHealth.nextPostingGap.toFixed(1)}h
                </span>
              </div>
              
              {metrics.queueHealth.recommendedActions.length > 0 && (
                <div className="border-t pt-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Recommended Actions:</div>
                  <ul className="text-sm space-y-1">
                    {metrics.queueHealth.recommendedActions.map((action, index) => (
                      <li key={index} className="flex align-center gap-xs">
                        <span>💡</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Platform Performance */}
      <div className="card">
        <div className="card-header">
          <h3>Platform Performance Breakdown</h3>
        </div>
        <div className="card-body">
          <div className="grid gap-md">
            {metrics.platformPerformance.map((platform) => (
              <div key={platform.platform} className="flex justify-between align-center p-3 bg-gray-50 rounded">
                <div className="flex align-center gap-md">
                  <div className="flex align-center gap-sm">
                    <span className="text-lg">
                      {platform.platform === 'reddit' && '🤖'}
                      {platform.platform === 'instagram' && '📸'}
                      {platform.platform === 'tiktok' && '🎵'}
                      {platform.platform === 'twitter' && '🐦'}
                    </span>
                    <span className="font-medium capitalize">
                      {platform.platform}
                      {platform.topPerformer && <span className="ml-2 text-yellow-500">⭐</span>}
                    </span>
                  </div>
                  <div className="text-sm text-muted">
                    {platform.totalProcessed} processed
                  </div>
                </div>
                <div className="flex gap-md text-sm">
                  <div className={`font-medium ${getHealthIndicator(platform.approvalRate, { good: 70, warning: 50 })}`}>
                    {platform.approvalRate.toFixed(1)}% approved
                  </div>
                  <div className={`font-medium ${getHealthIndicator(platform.averageConfidence, { good: 0.8, warning: 0.6 })}`}>
                    {(platform.averageConfidence * 100).toFixed(0)}% confidence
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}