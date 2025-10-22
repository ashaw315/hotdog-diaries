'use client'

import { useState, useEffect } from 'react'

interface DiversityAlert {
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'platform_dominance' | 'consecutive_posts' | 'poor_spacing' | 'type_imbalance' | 'score_drop'
  message: string
  affectedSlots?: number[]
  threshold?: number
  actual?: number
}

interface DiversityMetrics {
  date: string
  overallScore: number
  platformBalance: {
    distribution: Record<string, number>
    variance: number
    dominantPlatform: string
    dominantPercentage: number
  }
  temporalAnalysis: {
    consecutivePlatforms: number
    averageSpacing: number
    maxSpacing: number
    minSpacing: number
  }
  contentTypes: {
    distribution: Record<string, number>
    alternationScore: number
  }
  alerts: DiversityAlert[]
  recommendations: string[]
  historical: {
    currentScore: number
    yesterdayScore: number
    weekAverageScore: number
    scoreTrend: 'improving' | 'stable' | 'declining'
    dropPercentage: number
  }
  summary: {
    status: 'healthy' | 'attention' | 'warning' | 'critical'
    score: number
    trend: 'improving' | 'stable' | 'declining'
    totalPosts: number
    alertCount: number
  }
}

interface DiversityAlertsProps {
  date?: string
  refreshInterval?: number
  showRecommendations?: boolean
  compact?: boolean
}

export default function DiversityAlerts({ 
  date, 
  refreshInterval = 60000, // 1 minute default
  showRecommendations = true,
  compact = false 
}: DiversityAlertsProps) {
  const [metrics, setMetrics] = useState<DiversityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchDiversityMetrics = async () => {
    try {
      setError(null)
      const targetDate = date || new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/admin/diversity-summary?date=${targetDate}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        
        // Handle structured error responses gracefully
        if (data.status === 'error') {
          setError(data.issues?.join('; ') || 'Diversity metrics unavailable')
          // Still try to render any partial data we might have
          if (data.summary) {
            setMetrics({
              date: data.date || targetDate,
              overallScore: data.summary.diversity_score || 0,
              platformBalance: {
                distribution: data.summary.platforms || {},
                variance: 0,
                dominantPlatform: '',
                dominantPercentage: 0
              },
              temporalAnalysis: {
                consecutivePlatforms: 0,
                averageSpacing: 0,
                maxSpacing: 0,
                minSpacing: 0
              },
              contentTypes: {
                distribution: data.summary.content_types || {},
                alternationScore: 100
              },
              alerts: [],
              recommendations: data.recommendations || [],
              historical: {
                currentScore: data.summary.diversity_score || 0,
                yesterdayScore: 0,
                weekAverageScore: 0,
                scoreTrend: 'stable' as const,
                dropPercentage: 0
              },
              summary: {
                status: 'warning' as const,
                score: data.summary.diversity_score || 0,
                trend: 'stable' as const,
                totalPosts: data.summary.filled_slots || 0,
                alertCount: 0
              }
            })
          }
        } else {
          // Transform the simplified API response to match the expected interface
          setMetrics({
            date: data.date || targetDate,
            overallScore: data.summary?.diversity_score || 0,
            platformBalance: {
              distribution: data.summary?.platforms || {},
              variance: 0,
              dominantPlatform: '',
              dominantPercentage: 0
            },
            temporalAnalysis: {
              consecutivePlatforms: 0,
              averageSpacing: 0,
              maxSpacing: 0,
              minSpacing: 0
            },
            contentTypes: {
              distribution: data.summary?.content_types || {},
              alternationScore: 100
            },
            alerts: [],
            recommendations: data.recommendations || [],
            historical: {
              currentScore: data.summary?.diversity_score || 0,
              yesterdayScore: 0,
              weekAverageScore: 0,
              scoreTrend: 'stable' as const,
              dropPercentage: 0
            },
            summary: {
              status: 'healthy' as const,
              score: data.summary?.diversity_score || 0,
              trend: 'stable' as const,
              totalPosts: data.summary?.filled_slots || 0,
              alertCount: 0
            }
          })
        }
        setLastUpdate(new Date())
      } else {
        setError(`Failed to load diversity metrics (${response.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch diversity metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiversityMetrics()
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchDiversityMetrics, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [date, refreshInterval])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' }
      case 'high': return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }
      case 'medium': return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }
      case 'low': return { bg: '#f0f9ff', border: '#3b82f6', text: '#1e40af' }
      default: return { bg: '#f9fafb', border: '#6b7280', text: '#374151' }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return { bg: '#d1fae5', border: '#10b981', text: '#065f46' }
      case 'attention': return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }
      case 'warning': return { bg: '#fed7aa', border: '#ea580c', text: '#9a3412' }
      case 'critical': return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' }
      default: return { bg: '#f9fafb', border: '#6b7280', text: '#374151' }
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈'
      case 'declining': return '📉'
      default: return '➡️'
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'platform_dominance': return '⚖️'
      case 'consecutive_posts': return '🔁'
      case 'poor_spacing': return '📏'
      case 'type_imbalance': return '🎭'
      case 'score_drop': return '📉'
      default: return '⚠️'
    }
  }

  if (loading) {
    return (
      <div className={`diversity-alerts ${compact ? 'compact' : ''}`} data-testid="diversity-alerts-loading">
        <div className="alert-header">
          <h3>Diversity Health</h3>
          <div className="loading-spinner"></div>
        </div>
        <div className="loading-content">
          <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
            Loading diversity metrics...
          </div>
        </div>
        
        <style jsx>{`
          .loading-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #e5e7eb;
            border-top: 2px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`diversity-alerts ${compact ? 'compact' : ''}`} data-testid="diversity-alerts-error">
        <div className="alert-header">
          <h3>Diversity Health</h3>
          <button onClick={fetchDiversityMetrics} className="refresh-btn" title="Retry">
            🔄
          </button>
        </div>
        <div className="error-content">
          <div style={{ color: '#dc2626', textAlign: 'center', padding: '20px' }}>
            ⚠️ {error}
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  const statusColors = getStatusColor(metrics.summary.status)

  return (
    <>
      <style jsx>{`
        .diversity-alerts {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          margin-bottom: 24px;
        }
        
        .diversity-alerts.compact {
          margin-bottom: 16px;
        }
        
        .alert-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 0 24px;
          margin-bottom: 16px;
        }
        
        .alert-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }
        
        .diversity-alerts.compact .alert-header h3 {
          font-size: 16px;
        }
        
        .refresh-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        
        .refresh-btn:hover {
          opacity: 1;
        }
        
        .status-overview {
          padding: 0 24px;
          margin-bottom: 20px;
        }
        
        .status-card {
          padding: 16px;
          border-radius: 6px;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .status-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .status-score {
          font-size: 24px;
          font-weight: 700;
        }
        
        .diversity-alerts.compact .status-score {
          font-size: 20px;
        }
        
        .status-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .status-label {
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-subtitle {
          font-size: 12px;
          opacity: 0.8;
        }
        
        .status-trend {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .alerts-section {
          padding: 0 24px;
        }
        
        .alerts-title {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .alert-item {
          padding: 12px 16px;
          border-radius: 6px;
          border: 1px solid;
          margin-bottom: 8px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        
        .diversity-alerts.compact .alert-item {
          padding: 8px 12px;
          margin-bottom: 6px;
        }
        
        .alert-icon {
          font-size: 16px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        
        .alert-content {
          flex: 1;
          min-width: 0;
        }
        
        .alert-message {
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 4px;
        }
        
        .diversity-alerts.compact .alert-message {
          font-size: 13px;
        }
        
        .alert-details {
          font-size: 12px;
          opacity: 0.8;
        }
        
        .no-alerts {
          padding: 16px;
          text-align: center;
          color: #10b981;
          background: #d1fae5;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        
        .recommendations-section {
          padding: 0 24px 24px 24px;
        }
        
        .recommendations-title {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .recommendation-item {
          padding: 8px 12px;
          background: #f8fafc;
          border-left: 3px solid #3b82f6;
          margin-bottom: 6px;
          font-size: 13px;
          color: #374151;
          line-height: 1.4;
        }
        
        .diversity-alerts.compact .recommendation-item {
          font-size: 12px;
          padding: 6px 10px;
        }
        
        .metrics-footer {
          padding: 16px 24px 20px 24px;
          border-top: 1px solid #f3f4f6;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        
        @media (max-width: 768px) {
          .alert-header, .status-overview, .alerts-section, .recommendations-section {
            padding-left: 16px;
            padding-right: 16px;
          }
          
          .status-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          
          .status-trend {
            align-self: flex-end;
          }
          
          .alert-item {
            padding: 10px 12px;
          }
          
          .metrics-footer {
            padding: 12px 16px 16px 16px;
          }
        }
      `}</style>
      
      <div className={`diversity-alerts ${compact ? 'compact' : ''}`} data-testid="diversity-alerts">
        <div className="alert-header">
          <h3>Diversity Health</h3>
          <button onClick={fetchDiversityMetrics} className="refresh-btn" title="Refresh">
            🔄
          </button>
        </div>
        
        {/* Status Overview */}
        <div className="status-overview">
          <div 
            className="status-card" 
            style={{
              backgroundColor: statusColors.bg,
              borderColor: statusColors.border,
              color: statusColors.text
            }}
          >
            <div className="status-left">
              <div className="status-score">{metrics.summary.score}</div>
              <div className="status-details">
                <div className="status-label">{metrics.summary.status}</div>
                <div className="status-subtitle">
                  {metrics.summary.totalPosts} posts • {metrics.summary.alertCount} alerts
                </div>
              </div>
            </div>
            <div className="status-trend">
              {getTrendIcon(metrics.summary.trend)}
              <span>{metrics.summary.trend}</span>
            </div>
          </div>
        </div>
        
        {/* Alerts Section */}
        <div className="alerts-section">
          <div className="alerts-title">Active Alerts</div>
          
          {metrics.alerts.length === 0 ? (
            <div className="no-alerts">
              ✅ No diversity issues detected
            </div>
          ) : (
            metrics.alerts.map((alert, index) => {
              const colors = getSeverityColor(alert.severity)
              return (
                <div
                  key={index}
                  className="alert-item"
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    color: colors.text
                  }}
                  data-testid={`diversity-alert-${alert.type}`}
                >
                  <div className="alert-icon">{getAlertIcon(alert.type)}</div>
                  <div className="alert-content">
                    <div className="alert-message">{alert.message}</div>
                    {(alert.threshold !== undefined && alert.actual !== undefined) && (
                      <div className="alert-details">
                        Threshold: {alert.threshold}% • Actual: {alert.actual.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
        
        {/* Recommendations */}
        {showRecommendations && metrics.recommendations.length > 0 && !compact && (
          <div className="recommendations-section">
            <div className="recommendations-title">Recommendations</div>
            {metrics.recommendations.map((rec, index) => (
              <div key={index} className="recommendation-item">
                💡 {rec}
              </div>
            ))}
          </div>
        )}
        
        {/* Footer */}
        <div className="metrics-footer">
          Last updated: {lastUpdate?.toLocaleTimeString() || 'Never'} • 
          Date: {metrics.date} • 
          Historical: {metrics.historical.dropPercentage > 0 ? 
            `${metrics.historical.dropPercentage.toFixed(1)}% drop from yesterday` : 
            'stable vs yesterday'
          }
        </div>
      </div>
    </>
  )
}