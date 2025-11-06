'use client'

import { useState, useEffect } from 'react'
import { useMetrics } from '@/hooks/useAdminData'

interface ContentStatusMetrics {
  statusCounts: {
    pending_review: number
    approved: number
    posted: number
  }
  flowMetrics: {
    processedToday: number
    approvalRate: number // percentage
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
  const { data: metricsData, loading: isLoading, error, refresh } = useMetrics()
  
  // Map the metrics data to the expected format - only include metrics with real data
  const metrics: ContentStatusMetrics | null = metricsData ? {
    statusCounts: {
      pending_review: metricsData.overview?.pendingContent || 0,
      approved: metricsData.overview?.approvedContent || 0,
      posted: metricsData.overview?.postedContent || 0,
    },
    flowMetrics: {
      processedToday: metricsData.overview?.contentToday || 0,
      approvalRate: metricsData.overview?.approvedContent && metricsData.overview?.totalContent
        ? (metricsData.overview.approvedContent / metricsData.overview.totalContent) * 100
        : 0,
    },
    platformPerformance: metricsData.platforms?.map(platform => ({
      platform: platform.platform,
      totalProcessed: platform.totalCount,
      approvalRate: platform.totalCount > 0 ? (platform.approvedCount / platform.totalCount) * 100 : 0,
      averageConfidence: platform.avgConfidence,
      topPerformer: false,
    })) || []
  } : null

  const handleRefresh = () => {
    refresh()
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
        
        .flow-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
        .status-pending_review {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #d97706;
        }

        .status-approved {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #059669;
        }

        .status-posted {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          color: #4b5563;
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

        {/* Flow Metrics */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3 className="title-text">Content Flow Metrics</h3>
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
                <div className={`metric-value ${getHealthIndicator(metrics?.flowMetrics?.approvalRate || 0, { good: 70, warning: 50 }).replace('text-', 'health-').replace('-600', '')}`}>
                  {metrics?.flowMetrics?.approvalRate?.toFixed(1) || '0.0'}%
                </div>
                <div className="metric-label">Approval Rate</div>
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
                    <div className={`platform-metric ${getHealthIndicator(platform.averageConfidence * 100, { good: 80, warning: 60 }).replace('text-', 'health-').replace('-600', '')}`}>
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