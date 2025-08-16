'use client'

import { useState, useEffect } from 'react'
import './admin-monitoring.css'

interface MockHealthData {
  overallStatus: 'healthy' | 'warning' | 'critical'
  uptime: string
  responseTime: number
  activeAlerts: number
  database: {
    status: 'healthy' | 'warning' | 'critical'
    responseTime: number
    connections: { active: number; idle: number; total: number }
  }
  apis: {
    reddit: { status: 'healthy' | 'warning' | 'critical'; responseTime: number }
    bluesky: { status: 'healthy' | 'warning' | 'critical'; responseTime: number }
    youtube: { status: 'healthy' | 'warning' | 'critical'; responseTime: number }
  }
  system: {
    memory: { usage: number; status: 'healthy' | 'warning' | 'critical' }
    cpu: { usage: number; status: 'healthy' | 'warning' | 'critical' }
    disk: { usage: number; status: 'healthy' | 'warning' | 'critical' }
  }
  business: {
    contentProcessed: number
    postsCreated: number
    queueSize: number
    errorRate: number
  }
}

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isLoading, setIsLoading] = useState(false)

  // Mock data for demonstration - in real implementation this would come from APIs
  const mockData: MockHealthData = {
    overallStatus: 'healthy',
    uptime: '2d 14h 23m',
    responseTime: 125,
    activeAlerts: 1,
    database: {
      status: 'healthy',
      responseTime: 45,
      connections: { active: 3, idle: 7, total: 10 }
    },
    apis: {
      reddit: { status: 'healthy', responseTime: 180 },
      bluesky: { status: 'healthy', responseTime: 220 },
      youtube: { status: 'warning', responseTime: 450 }
    },
    system: {
      memory: { usage: 68, status: 'healthy' },
      cpu: { usage: 35, status: 'healthy' },
      disk: { usage: 42, status: 'healthy' }
    },
    business: {
      contentProcessed: 847,
      postsCreated: 18,
      queueSize: 23,
      errorRate: 2.1
    }
  }

  const refreshData = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setLastRefresh(new Date())
      setIsLoading(false)
    }, 1000)
  }

  const getStatusBadge = (status: string) => (
    <span className={`monitoring-status-badge ${status}`}>
      {status}
    </span>
  )

  const getStatusIcon = (status: string) => (
    <span className={`monitoring-status-dot ${status}`}></span>
  )

  const getProgressBarClass = (usage: number) => {
    if (usage < 70) return 'healthy'
    if (usage < 85) return 'warning'
    return 'critical'
  }

  return (
    <div className="monitoring-admin-container">
      {/* Header */}
      <div className="monitoring-admin-header">
        <div className="monitoring-header-actions">
          <div>
            <h1>🔍 System Monitoring</h1>
            <p>Real-time system health, performance metrics, and alerts</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span className="monitoring-last-updated">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <button 
              onClick={refreshData} 
              disabled={isLoading}
              className="monitoring-btn monitoring-btn-primary"
            >
              {isLoading && <span className="monitoring-spinner"></span>}
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* System Overview Metrics */}
      <div className="monitoring-metrics-grid">
        <div className="monitoring-metric-card">
          <div className="monitoring-metric-header">
            <span className="monitoring-metric-title">Overall Status</span>
            <span className="monitoring-metric-icon">🖥️</span>
          </div>
          <div className={`monitoring-metric-value status-${mockData.overallStatus}`}>
            {getStatusIcon(mockData.overallStatus)}
            {getStatusBadge(mockData.overallStatus)}
          </div>
          <p className="monitoring-metric-description">System health status</p>
        </div>

        <div className="monitoring-metric-card">
          <div className="monitoring-metric-header">
            <span className="monitoring-metric-title">Uptime</span>
            <span className="monitoring-metric-icon">⏰</span>
          </div>
          <div className="monitoring-metric-value">{mockData.uptime}</div>
          <p className="monitoring-metric-description">Since last restart</p>
        </div>

        <div className="monitoring-metric-card">
          <div className="monitoring-metric-header">
            <span className="monitoring-metric-title">Response Time</span>
            <span className="monitoring-metric-icon">⚡</span>
          </div>
          <div className="monitoring-metric-value">{mockData.responseTime}ms</div>
          <p className="monitoring-metric-description">Average API response</p>
        </div>

        <div className="monitoring-metric-card">
          <div className="monitoring-metric-header">
            <span className="monitoring-metric-title">Active Alerts</span>
            <span className="monitoring-metric-icon">⚠️</span>
          </div>
          <div className={`monitoring-metric-value ${mockData.activeAlerts > 0 ? 'status-warning' : 'status-healthy'}`}>
            {mockData.activeAlerts}
          </div>
          <p className="monitoring-metric-description">Require attention</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="monitoring-tabs">
        <nav className="monitoring-tab-nav">
          {[
            { key: 'overview', label: '📊 Overview' },
            { key: 'health', label: '💚 System Health' },
            { key: 'performance', label: '📈 Performance' },
            { key: 'alerts', label: '🚨 Alerts' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`monitoring-tab ${activeTab === tab.key ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Business Metrics */}
          <div className="monitoring-admin-card">
            <div className="monitoring-admin-card-header">
              <h2>📊 Business Metrics (Last 24h)</h2>
            </div>
            <div className="monitoring-admin-card-body">
              <div className="monitoring-health-grid">
                <div className="monitoring-health-item">
                  <div className="monitoring-health-item-header">
                    <span className="monitoring-health-item-title">Content Processed</span>
                  </div>
                  <div className="monitoring-metric-value">{mockData.business.contentProcessed}</div>
                  <p className="monitoring-health-item-description">Items processed from all sources</p>
                </div>
                <div className="monitoring-health-item">
                  <div className="monitoring-health-item-header">
                    <span className="monitoring-health-item-title">Posts Created</span>
                  </div>
                  <div className="monitoring-metric-value status-healthy">{mockData.business.postsCreated}</div>
                  <p className="monitoring-health-item-description">Successfully published posts</p>
                </div>
                <div className="monitoring-health-item">
                  <div className="monitoring-health-item-header">
                    <span className="monitoring-health-item-title">Queue Size</span>
                  </div>
                  <div className="monitoring-metric-value">{mockData.business.queueSize}</div>
                  <p className="monitoring-health-item-description">Items waiting for processing</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Health Summary */}
          <div className="monitoring-admin-card">
            <div className="monitoring-admin-card-header">
              <h2>🔗 External Services</h2>
            </div>
            <div className="monitoring-admin-card-body">
              <div className="monitoring-health-grid">
                {Object.entries(mockData.apis).map(([platform, data]) => (
                  <div key={platform} className="monitoring-health-item">
                    <div className="monitoring-health-item-header">
                      <span className="monitoring-health-item-title">{platform}</span>
                      {getStatusBadge(data.status)}
                    </div>
                    <p className="monitoring-health-item-description">Response: {data.responseTime}ms</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div>
          {/* Database Health */}
          <div className="monitoring-admin-card">
            <div className="monitoring-admin-card-header">
              <h2>🗄️ Database Health</h2>
            </div>
            <div className="monitoring-admin-card-body">
              <div className="monitoring-health-grid">
                <div className="monitoring-health-item">
                  <div className="monitoring-health-item-header">
                    <span className="monitoring-health-item-title">Connection Status</span>
                    {getStatusBadge(mockData.database.status)}
                  </div>
                  <p className="monitoring-health-item-description">Response time: {mockData.database.responseTime}ms</p>
                </div>
                <div className="monitoring-health-item">
                  <div className="monitoring-health-item-header">
                    <span className="monitoring-health-item-title">Connection Pool</span>
                  </div>
                  <p className="monitoring-health-item-description">
                    Active: {mockData.database.connections.active} | 
                    Idle: {mockData.database.connections.idle} | 
                    Total: {mockData.database.connections.total}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* System Resources */}
          <div className="monitoring-admin-card">
            <div className="monitoring-admin-card-header">
              <h2>💻 System Resources</h2>
            </div>
            <div className="monitoring-admin-card-body">
              <div className="monitoring-health-grid">
                {Object.entries(mockData.system).map(([resource, data]) => (
                  <div key={resource} className="monitoring-health-item">
                    <div className="monitoring-health-item-header">
                      <span className="monitoring-health-item-title">{resource}</span>
                      <span>{data.usage}%</span>
                    </div>
                    <div className="monitoring-progress">
                      <div 
                        className={`monitoring-progress-bar ${getProgressBarClass(data.usage)}`}
                        style={{ width: `${data.usage}%` }}
                      ></div>
                    </div>
                    <p className="monitoring-health-item-description">Status: {getStatusBadge(data.status)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div>
          {/* API Performance */}
          <div className="monitoring-admin-card">
            <div className="monitoring-admin-card-header">
              <h2>🌐 API Performance</h2>
            </div>
            <div className="monitoring-admin-card-body">
              <div className="monitoring-health-grid">
                {Object.entries(mockData.apis).map(([platform, data]) => (
                  <div key={platform} className="monitoring-health-item">
                    <div className="monitoring-health-item-header">
                      <span className="monitoring-health-item-title">{platform} API</span>
                      <span>{data.responseTime}ms</span>
                    </div>
                    <div className="monitoring-progress">
                      <div 
                        className={`monitoring-progress-bar ${data.responseTime < 200 ? 'healthy' : data.responseTime < 500 ? 'warning' : 'critical'}`}
                        style={{ width: `${Math.min((data.responseTime / 1000) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="monitoring-health-item-description">Status: {getStatusBadge(data.status)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Error Rate */}
          <div className="monitoring-admin-card">
            <div className="monitoring-admin-card-header">
              <h2>📉 Error Metrics</h2>
            </div>
            <div className="monitoring-admin-card-body">
              <div className="monitoring-health-item">
                <div className="monitoring-health-item-header">
                  <span className="monitoring-health-item-title">Error Rate (Last Hour)</span>
                  <span className={mockData.business.errorRate > 5 ? 'status-critical' : 'status-healthy'}>
                    {mockData.business.errorRate}%
                  </span>
                </div>
                <div className="monitoring-progress">
                  <div 
                    className={`monitoring-progress-bar ${mockData.business.errorRate > 5 ? 'critical' : mockData.business.errorRate > 2 ? 'warning' : 'healthy'}`}
                    style={{ width: `${Math.min(mockData.business.errorRate * 10, 100)}%` }}
                  ></div>
                </div>
                <p className="monitoring-health-item-description">Target: &lt; 2%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          {/* Active Alerts */}
          <div className="monitoring-admin-card">
            <div className="monitoring-admin-card-header">
              <h2>🚨 Recent Alerts</h2>
            </div>
            <div className="monitoring-admin-card-body">
              {mockData.activeAlerts > 0 ? (
                <div>
                  <div className="monitoring-alert warning">
                    <div>
                      <h3>YouTube API Slow Response</h3>
                      <p>YouTube API response times above 400ms threshold. Current: 450ms</p>
                      <div className="monitoring-health-item-details">
                        Created: {new Date(Date.now() - 1000 * 60 * 23).toLocaleString()} | 
                        Type: performance | 
                        Severity: warning
                      </div>
                    </div>
                    <div>
                      <span className="monitoring-status-badge warning">Unresolved</span>
                    </div>
                  </div>
                  <div className="monitoring-alert info">
                    <div>
                      <h3>System Backup Completed</h3>
                      <p>Daily backup completed successfully. Database backed up: 2.3GB</p>
                      <div className="monitoring-health-item-details">
                        Created: {new Date(Date.now() - 1000 * 60 * 60 * 2).toLocaleString()} | 
                        Type: info | 
                        Severity: low
                      </div>
                    </div>
                    <div>
                      <span className="monitoring-status-badge healthy">Resolved</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="monitoring-empty-state">
                  <h3>No Active Alerts</h3>
                  <p>All systems are running normally</p>
                </div>
              )}
            </div>
          </div>

          {/* Alert Summary */}
          <div className="monitoring-admin-card">
            <div className="monitoring-admin-card-header">
              <h2>📊 Alert Summary (Last 24h)</h2>
            </div>
            <div className="monitoring-admin-card-body">
              <div className="monitoring-health-grid">
                <div className="monitoring-health-item">
                  <div className="monitoring-health-item-header">
                    <span className="monitoring-health-item-title">Total Alerts</span>
                  </div>
                  <div className="monitoring-metric-value">7</div>
                </div>
                <div className="monitoring-health-item">
                  <div className="monitoring-health-item-header">
                    <span className="monitoring-health-item-title">Critical</span>
                  </div>
                  <div className="monitoring-metric-value status-critical">0</div>
                </div>
                <div className="monitoring-health-item">
                  <div className="monitoring-health-item-header">
                    <span className="monitoring-health-item-title">Resolved</span>
                  </div>
                  <div className="monitoring-metric-value status-healthy">6</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}