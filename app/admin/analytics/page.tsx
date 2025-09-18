'use client'

import { useState, useEffect } from 'react'
import './admin-analytics.css'

interface AnalyticsData {
  filteringStats: {
    current: {
      total_processed: number
      auto_approved: number
      auto_rejected: number
      posted: number
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
      daily_accuracy: number
    }>
    platformBreakdown: Record<string, { total: number; approved: number; posted: number }>
    patternEffectiveness: Array<{
      pattern_type: string
      pattern: string
      description: string
      matches: number
      avg_confidence: number
    }>
  }
  processingStats: {
    queue: {
      total: number
      pending: number
      approved: number
      posted: number
      processing: number
    }
    throughput: {
      items_per_day: number
      total_processed_today: number
      avg_processing_time: string
      success_rate: string
    }
    current_batch: {
      size: number
      progress: number
      estimated_completion: string
    }
    daily_processing: Array<{
      date: string
      processed: number
      approved: number
      rejected: number
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
      
      // Get auth token for API calls
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const [filteringResponse, processingResponse] = await Promise.all([
        fetch('/api/admin/filtering/stats', { 
          credentials: 'include',
          headers
        }),
        fetch('/api/admin/content/process', { 
          credentials: 'include',
          headers
        })
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


  const getEffectivenessColor = (rate: number) => {
    if (rate >= 0.9) return 'text-green-600'
    if (rate >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPatternTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      spam: 'bg-red-100 text-red-800',
      inappropriate: 'bg-orange-100 text-orange-800',
      unrelated: 'bg-yellow-100 text-yellow-800',
      required: 'bg-green-100 text-green-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="analytics-admin-container">
        <div className="analytics-loading">
          <div className="analytics-spinner"></div>
          <span style={{ marginLeft: '0.5rem' }}>Loading analytics data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="analytics-admin-container">
        <div className="analytics-error">
          <h2>📊 Analytics Error</h2>
          <p>{error}</p>
          <button onClick={fetchAnalytics}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="analytics-admin-container">
        <div className="analytics-empty-state">
          <h3>📊 No Analytics Data</h3>
          <p>No analytics data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-admin-container">
      {/* Header */}
      <div className="analytics-admin-header">
        <div className="analytics-header-actions">
          <div>
            <h1>📊 Analytics Dashboard</h1>
            <p>Comprehensive filtering and processing metrics</p>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="analytics-btn analytics-btn-primary"
          >
            {loading && <span className="analytics-spinner"></span>}
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="analytics-metrics-grid">
        <div className="analytics-metric-card">
          <div className="analytics-metric-header">
            <span className="analytics-metric-title">Total Processed</span>
            <span className="analytics-metric-icon">📊</span>
          </div>
          <div className="analytics-metric-value">
            {data.filteringStats.current.total_processed.toLocaleString()}
          </div>
          <p className="analytics-metric-description">Items processed from all sources</p>
        </div>

        <div className="analytics-metric-card">
          <div className="analytics-metric-header">
            <span className="analytics-metric-title">Accuracy Rate</span>
            <span className="analytics-metric-icon">🎯</span>
          </div>
          <div className={`analytics-metric-value ${getEffectivenessColor(data.filteringStats.current.accuracy_rate)}`}>
            {formatPercentage(data.filteringStats.current.accuracy_rate)}
          </div>
          <p className="analytics-metric-description">Filter accuracy percentage</p>
        </div>

        <div className="analytics-metric-card">
          <div className="analytics-metric-header">
            <span className="analytics-metric-title">Auto-Processing</span>
            <span className="analytics-metric-icon">⚡</span>
          </div>
          <div className="analytics-metric-value status-healthy">
            {formatPercentage(
              (data.filteringStats.current.auto_approved + data.filteringStats.current.auto_rejected) / 
              Math.max(data.filteringStats.current.total_processed, 1)
            )}
          </div>
          <p className="analytics-metric-description">Automated processing rate</p>
        </div>

        <div className="analytics-metric-card">
          <div className="analytics-metric-header">
            <span className="analytics-metric-title">Avg Process Time</span>
            <span className="analytics-metric-icon">⏱️</span>
          </div>
          <div className="analytics-metric-value">
            {data.processingStats.throughput.avg_processing_time}
          </div>
          <p className="analytics-metric-description">Average processing duration</p>
        </div>
      </div>

      {/* Filter Detection Results */}
      <div className="analytics-admin-card">
        <div className="analytics-admin-card-header">
          <h2>🔍 Filter Detection Results</h2>
        </div>
        <div className="analytics-admin-card-body">
          <div className="analytics-detection-grid">
            <div className="analytics-detection-card bg-red-50 border-red-200">
              <div className="analytics-detection-header">
                <span className="text-lg">🚫</span>
                <div className="text-sm font-medium text-red-800">Spam Detected</div>
              </div>
              <div className="analytics-detection-value text-red-600">
                {data.filteringStats.current.spam_detected.toLocaleString()}
              </div>
              <div className="analytics-detection-percentage text-red-600">
                {formatPercentage(data.filteringStats.current.spam_detected / Math.max(data.filteringStats.current.total_processed, 1))}
              </div>
            </div>

            <div className="analytics-detection-card bg-orange-50 border-orange-200">
              <div className="analytics-detection-header">
                <span className="text-lg">⚠️</span>
                <div className="text-sm font-medium text-orange-800">Inappropriate</div>
              </div>
              <div className="analytics-detection-value text-orange-600">
                {data.filteringStats.current.inappropriate_detected.toLocaleString()}
              </div>
              <div className="analytics-detection-percentage text-orange-600">
                {formatPercentage(data.filteringStats.current.inappropriate_detected / Math.max(data.filteringStats.current.total_processed, 1))}
              </div>
            </div>

            <div className="analytics-detection-card bg-yellow-50 border-yellow-200">
              <div className="analytics-detection-header">
                <span className="text-lg">🔄</span>
                <div className="text-sm font-medium text-yellow-800">Unrelated</div>
              </div>
              <div className="analytics-detection-value text-yellow-600">
                {data.filteringStats.current.unrelated_detected.toLocaleString()}
              </div>
              <div className="analytics-detection-percentage text-yellow-600">
                {formatPercentage(data.filteringStats.current.unrelated_detected / Math.max(data.filteringStats.current.total_processed, 1))}
              </div>
            </div>

            <div className="analytics-detection-card bg-blue-50 border-blue-200">
              <div className="analytics-detection-header">
                <span className="text-lg">📄</span>
                <div className="text-sm font-medium text-blue-800">Duplicates</div>
              </div>
              <div className="analytics-detection-value text-blue-600">
                {data.filteringStats.current.duplicates_detected.toLocaleString()}
              </div>
              <div className="analytics-detection-percentage text-blue-600">
                {formatPercentage(data.filteringStats.current.duplicates_detected / Math.max(data.filteringStats.current.total_processed, 1))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pattern Effectiveness */}
      <div className="analytics-admin-card">
        <div className="analytics-admin-card-header">
          <h2>🎯 Top Performing Patterns</h2>
        </div>
        <div className="analytics-admin-card-body">
          <div className="analytics-pattern-list">
            {data.filteringStats.patternEffectiveness.slice(0, 10).map((pattern, index) => (
              <div key={index} className="analytics-pattern-item">
                <div className="analytics-pattern-content">
                  <div className="analytics-pattern-header">
                    <span className={`analytics-pattern-type ${getPatternTypeColor(pattern.pattern_type)}`}>
                      {pattern.pattern_type.toUpperCase()}
                    </span>
                    <code className="analytics-pattern-code">
                      {pattern.pattern}
                    </code>
                  </div>
                  {pattern.description && (
                    <p className="analytics-pattern-description">{pattern.description}</p>
                  )}
                </div>
                <div className="analytics-pattern-stats">
                  <div className="analytics-pattern-matches">
                    {pattern.matches.toLocaleString()}
                  </div>
                  <p className="analytics-pattern-confidence">
                    {formatPercentage(pattern.avg_confidence)} confidence
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Processing Pipeline Status */}
      <div className="analytics-admin-card">
        <div className="analytics-admin-card-header">
          <h2>⚙️ Processing Pipeline Status</h2>
        </div>
        <div className="analytics-admin-card-body">
          <div className="analytics-pipeline-grid">
            <div className="analytics-pipeline-status bg-yellow-50 border-yellow-200">
              <div className="analytics-pipeline-value text-yellow-600">
                {data.processingStats.queue.pending.toLocaleString()}
              </div>
              <div className="analytics-pipeline-label text-yellow-800">Pending</div>
            </div>

            <div className="analytics-pipeline-status bg-blue-50 border-blue-200">
              <div className="analytics-pipeline-value text-blue-600">
                {data.processingStats.queue.processing.toLocaleString()}
              </div>
              <div className="analytics-pipeline-label text-blue-800">Processing</div>
            </div>

            <div className="analytics-pipeline-status bg-green-50 border-green-200">
              <div className="analytics-pipeline-value text-green-600">
                {data.processingStats.queue.approved.toLocaleString()}
              </div>
              <div className="analytics-pipeline-label text-green-800">Approved</div>
            </div>

            <div className="analytics-pipeline-status bg-red-50 border-red-200">
              <div className="analytics-pipeline-value text-red-600">
                {(data.processingStats.queue.total - data.processingStats.queue.approved - data.processingStats.queue.posted).toLocaleString()}
              </div>
              <div className="analytics-pipeline-label text-red-800">Rejected</div>
            </div>

            <div className="analytics-pipeline-status bg-purple-50 border-purple-200">
              <div className="analytics-pipeline-value text-purple-600">
                {data.processingStats.queue.posted.toLocaleString()}
              </div>
              <div className="analytics-pipeline-label text-purple-800">Posted</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}