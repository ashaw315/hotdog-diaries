'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'

interface AnalyticsData {
  filteringStats: {
    current: {
      total_processed: number
      auto_approved: number
      auto_rejected: number
      flagged_for_review: number
      spam_detected: number
      inappropriate_detected: number
      unrelated_detected: number
      duplicates_detected: number
      false_positives: number
      false_negatives: number
      accuracy_rate: number
    }
    daily: Array<{
      date: string
      daily_processed: number
      daily_approved: number
      daily_rejected: number
      daily_flagged: number
      daily_accuracy: number
    }>
    patternEffectiveness: Array<{
      pattern_type: string
      pattern: string
      description: string
      matches: number
      avg_confidence: number
    }>
  }
  processingStats: {
    stats: {
      pending: number
      processing: number
      approved: number
      rejected: number
      flagged: number
      avg_processing_time: number
    }
    recentActivity: Array<{
      status: string
      count: number
      hour: string
    }>
  }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      const [filteringResponse, processingResponse] = await Promise.all([
        fetch('/api/admin/filtering/stats'),
        fetch('/api/content/process')
      ])

      if (!filteringResponse.ok || !processingResponse.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const [filteringStats, processingStats] = await Promise.all([
        filteringResponse.json(),
        processingResponse.json()
      ])

      setData({
        filteringStats,
        processingStats
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  const getEffectivenessColor = (rate: number) => {
    if (rate >= 0.9) return 'text-green-600'
    if (rate >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPatternTypeColor = (type: string) => {
    const colors = {
      spam: 'bg-red-100 text-red-800',
      inappropriate: 'bg-orange-100 text-orange-800',
      unrelated: 'bg-yellow-100 text-yellow-800',
      required: 'bg-green-100 text-green-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!data) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-500">No analytics data available</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">
              Comprehensive filtering and processing metrics
            </p>
          </div>
          <button
            onClick={fetchAnalytics}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">📊</div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Total Processed</div>
                <div className="text-2xl font-bold text-gray-900">
                  {data.filteringStats.current.total_processed.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">🎯</div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Accuracy Rate</div>
                <div className={`text-2xl font-bold ${getEffectivenessColor(data.filteringStats.current.accuracy_rate)}`}>
                  {formatPercentage(data.filteringStats.current.accuracy_rate)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">⚡</div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Auto-Processing</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(
                    (data.filteringStats.current.auto_approved + data.filteringStats.current.auto_rejected) / 
                    Math.max(data.filteringStats.current.total_processed, 1)
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">⏱️</div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Avg Process Time</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatTime(data.processingStats.stats.avg_processing_time)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Detection Results */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Filter Detection Results</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🚫</span>
                <div className="text-sm font-medium text-red-800">Spam Detected</div>
              </div>
              <div className="text-xl font-bold text-red-600">
                {data.filteringStats.current.spam_detected.toLocaleString()}
              </div>
              <div className="text-xs text-red-600 mt-1">
                {formatPercentage(data.filteringStats.current.spam_detected / Math.max(data.filteringStats.current.total_processed, 1))}
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⚠️</span>
                <div className="text-sm font-medium text-orange-800">Inappropriate</div>
              </div>
              <div className="text-xl font-bold text-orange-600">
                {data.filteringStats.current.inappropriate_detected.toLocaleString()}
              </div>
              <div className="text-xs text-orange-600 mt-1">
                {formatPercentage(data.filteringStats.current.inappropriate_detected / Math.max(data.filteringStats.current.total_processed, 1))}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔄</span>
                <div className="text-sm font-medium text-yellow-800">Unrelated</div>
              </div>
              <div className="text-xl font-bold text-yellow-600">
                {data.filteringStats.current.unrelated_detected.toLocaleString()}
              </div>
              <div className="text-xs text-yellow-600 mt-1">
                {formatPercentage(data.filteringStats.current.unrelated_detected / Math.max(data.filteringStats.current.total_processed, 1))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📄</span>
                <div className="text-sm font-medium text-blue-800">Duplicates</div>
              </div>
              <div className="text-xl font-bold text-blue-600">
                {data.filteringStats.current.duplicates_detected.toLocaleString()}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {formatPercentage(data.filteringStats.current.duplicates_detected / Math.max(data.filteringStats.current.total_processed, 1))}
              </div>
            </div>
          </div>
        </div>

        {/* Pattern Effectiveness */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Top Performing Patterns</h2>
          
          <div className="space-y-4">
            {data.filteringStats.patternEffectiveness.slice(0, 10).map((pattern, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPatternTypeColor(pattern.pattern_type)}`}>
                      {pattern.pattern_type.toUpperCase()}
                    </span>
                    <code className="bg-white px-2 py-1 rounded text-sm font-mono">
                      {pattern.pattern}
                    </code>
                  </div>
                  {pattern.description && (
                    <p className="text-sm text-gray-600">{pattern.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {pattern.matches.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatPercentage(pattern.avg_confidence)} confidence
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Processing Pipeline Status */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Processing Pipeline Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {data.processingStats.stats.pending.toLocaleString()}
              </div>
              <div className="text-sm text-yellow-800">Pending</div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data.processingStats.stats.processing.toLocaleString()}
              </div>
              <div className="text-sm text-blue-800">Processing</div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.processingStats.stats.approved.toLocaleString()}
              </div>
              <div className="text-sm text-green-800">Approved</div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {data.processingStats.stats.rejected.toLocaleString()}
              </div>
              <div className="text-sm text-red-800">Rejected</div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {data.processingStats.stats.flagged.toLocaleString()}
              </div>
              <div className="text-sm text-orange-800">Flagged</div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}