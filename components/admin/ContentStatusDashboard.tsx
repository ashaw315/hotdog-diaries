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
        const result = await response.json()
        // Handle the API response format: { success: true, data: ... }
        const data = result.success ? result.data : result
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
    <>
      <style jsx>{`
        .content-dashboard {
          display: grid;
          gap: 32px;
        }
        
        .dashboard-section {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .section-header {
          padding: 24px;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        }
        
        .section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .title-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .title-text {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }
        
        .title-description {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }
        
        .refresh-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .refresh-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        
        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .section-body {
          padding: 24px;
        }
        
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
        }
        
        .status-item {
          text-align: center;
          padding: 16px;
          border-radius: 12px;
          transition: transform 0.2s ease;
        }
        
        .status-item:hover {
          transform: translateY(-2px);
        }
        
        .status-value {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        
        .status-label {
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 500;
          letter-spacing: 0.5px;
          opacity: 0.8;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }
        
        .flow-metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        
        .metric-item {
          text-align: center;
          padding: 20px 16px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        
        .metric-value {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        
        .metric-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          font-weight: 500;
        }
        
        .health-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .health-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        
        .health-item:last-child {
          border-bottom: none;
        }
        
        .health-label {
          font-size: 14px;
          color: #374151;
        }
        
        .health-value {
          font-weight: 600;
          font-size: 14px;
        }
        
        .recommendations {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        
        .recommendations-title {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
        }
        
        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .recommendation-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 13px;
          color: #4b5563;
          line-height: 1.4;
        }
        
        .platform-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .platform-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        
        .platform-item:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        
        .platform-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .platform-identity {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .platform-icon {
          font-size: 20px;
        }
        
        .platform-name {
          font-weight: 600;
          text-transform: capitalize;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .top-performer {
          color: #f59e0b;
        }
        
        .platform-stats {
          font-size: 12px;
          color: #6b7280;
        }
        
        .platform-metrics {
          display: flex;
          gap: 16px;
          font-size: 13px;
        }
        
        .platform-metric {
          font-weight: 500;
        }
        
        /* Color classes for status items */
        .status-discovered {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #1d4ed8;
        }
        
        .status-pending_review {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #d97706;
        }
        
        .status-approved {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #059669;
        }
        
        .status-scheduled {
          background: linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%);
          color: #7c3aed;
        }
        
        .status-posted {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          color: #4b5563;
        }
        
        .status-rejected {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          color: #dc2626;
        }
        
        .status-archived {
          background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
          color: #6b7280;
        }
        
        /* Health indicator colors */
        .health-good {
          color: #059669;
        }
        
        .health-warning {
          color: #d97706;
        }
        
        .health-danger {
          color: #dc2626;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
          .metrics-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          
          .status-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .flow-metrics {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          
          .platform-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          
          .platform-metrics {
            align-self: stretch;
            justify-content: space-between;
          }
        }
      `}</style>
      
      <div className="content-dashboard">
        {/* Header */}
        <div className="dashboard-section">
          <div className="section-header">
            <div className="section-title">
              <div className="title-group">
                <h2 className="title-text">
                  <span>📊</span>
                  Content Pipeline Dashboard
                </h2>
                <p className="title-description">
                  Real-time metrics and health monitoring
                </p>
              </div>
              <button
                onClick={handleRefresh}
                className="refresh-btn"
                disabled={isLoading}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Status Counts */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3 className="title-text">Content Status Distribution</h3>
          </div>
          <div className="section-body">
            <div className="status-grid">
              {metrics?.statusCounts && Object.entries(metrics.statusCounts).map(([status, count]) => (
                <div key={status} className={`status-item status-${status}`}>
                  <div className="status-value">{count}</div>
                  <div className="status-label">
                    {status.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Flow Metrics & Queue Health */}
        <div className="metrics-grid">
          {/* Flow Metrics */}
          <div className="dashboard-section">
            <div className="section-header">
              <h3 className="title-text">Content Flow Velocity</h3>
            </div>
            <div className="section-body">
              <div className="flow-metrics">
                <div className="metric-item">
                  <div className="metric-value" style={{ color: '#3b82f6' }}>
                    {metrics?.flowMetrics?.processedToday || 0}
                  </div>
                  <div className="metric-label">Processed Today</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value" style={{ color: '#10b981' }}>
                    {metrics?.flowMetrics?.processingRate?.toFixed(1) || '0.0'}
                  </div>
                  <div className="metric-label">Items/Hour</div>
                </div>
                <div className="metric-item">
                  <div className={`metric-value ${getHealthIndicator(metrics?.flowMetrics?.approvalRate || 0, { good: 70, warning: 50 }).replace('text-', 'health-').replace('-600', '')}`}>
                    {metrics?.flowMetrics?.approvalRate?.toFixed(1) || '0.0'}%
                  </div>
                  <div className="metric-label">Approval Rate</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value" style={{ color: '#8b5cf6' }}>
                    {metrics?.flowMetrics?.averageReviewTime?.toFixed(0) || '0'}m
                  </div>
                  <div className="metric-label">Avg Review Time</div>
                </div>
              </div>
            </div>
          </div>

          {/* Queue Health */}
          <div className="dashboard-section">
            <div className="section-header">
              <h3 className="title-text">Queue Health</h3>
            </div>
            <div className="section-body">
              <div className="health-list">
                <div className="health-item">
                  <span className="health-label">Approved & Ready</span>
                  <span className={`health-value ${getHealthIndicator(metrics?.queueHealth?.approvedAvailable || 0, { good: 10, warning: 5 }).replace('text-', 'health-').replace('-600', '')}`}>
                    {metrics?.queueHealth?.approvedAvailable || 0} items
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Scheduled Upcoming</span>
                  <span className="health-value" style={{ color: '#8b5cf6' }}>
                    {metrics?.queueHealth?.scheduledUpcoming || 0} items
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Next Posting Gap</span>
                  <span className={`health-value ${getHealthIndicator(24 - (metrics?.queueHealth?.nextPostingGap || 0), { good: 18, warning: 12 }).replace('text-', 'health-').replace('-600', '')}`}>
                    {metrics?.queueHealth?.nextPostingGap?.toFixed(1) || '0.0'}h
                  </span>
                </div>
                
                {metrics?.queueHealth?.recommendedActions && metrics.queueHealth.recommendedActions.length > 0 && (
                  <div className="recommendations">
                    <div className="recommendations-title">Recommended Actions:</div>
                    <div className="recommendations-list">
                      {metrics.queueHealth.recommendedActions.map((action, index) => (
                        <div key={index} className="recommendation-item">
                          <span>💡</span>
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Platform Performance */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3 className="title-text">Platform Performance Breakdown</h3>
          </div>
          <div className="section-body">
            <div className="platform-list">
              {metrics?.platformPerformance && metrics.platformPerformance.map((platform) => (
                <div key={platform.platform} className="platform-item">
                  <div className="platform-info">
                    <div className="platform-identity">
                      <span className="platform-icon">
                        {platform.platform === 'reddit' && '🤖'}
                        {platform.platform === 'instagram' && '📸'}
                        {platform.platform === 'tiktok' && '🎵'}
                        {platform.platform === 'twitter' && '🐦'}
                        {platform.platform === 'pixabay' && '🖼️'}
                        {platform.platform === 'bluesky' && '🦋'}
                        {platform.platform === 'youtube' && '📺'}
                        {platform.platform === 'giphy' && '🎬'}
                      </span>
                      <span className="platform-name">
                        {platform.platform}
                        {platform.topPerformer && <span className="top-performer">⭐</span>}
                      </span>
                    </div>
                    <div className="platform-stats">
                      {platform.totalProcessed} processed
                    </div>
                  </div>
                  <div className="platform-metrics">
                    <div className={`platform-metric ${getHealthIndicator(platform.approvalRate, { good: 70, warning: 50 }).replace('text-', 'health-').replace('-600', '')}`}>
                      {platform.approvalRate.toFixed(1)}% approved
                    </div>
                    <div className={`platform-metric ${getHealthIndicator(platform.averageConfidence, { good: 0.8, warning: 0.6 }).replace('text-', 'health-').replace('-600', '')}`}>
                      {(platform.averageConfidence * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}