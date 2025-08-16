'use client'

import { useState, useEffect } from 'react'
import { ApiResponse } from '@/types'
import { RedditScanConfig, RedditScanStats, RedditScanResult } from '@/lib/services/reddit-scanning'
import './reddit-admin.css'

interface RedditApiStatus {
  isConnected: boolean
  rateLimits: {
    used: number
    remaining: number
    resetTime: Date
  }
  lastError?: string
  lastRequest?: Date
  userAgent: string
}

export default function RedditSettingsPage() {
  const [activeTab, setActiveTab] = useState('config')
  const [config, setConfig] = useState<RedditScanConfig | null>(null)
  const [stats, setStats] = useState<RedditScanStats | null>(null)
  const [status, setStatus] = useState<RedditApiStatus | null>(null)
  const [scanHistory, setScanHistory] = useState<RedditScanResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isRunningManualScan, setIsRunningManualScan] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadConfig(),
        loadStats(),
        loadStatus(),
        loadScanHistory()
      ])
    } catch (error) {
      console.error('Error loading Reddit data:', error)
      setMessage({ type: 'error', text: 'Failed to load Reddit data' })
    } finally {
      setIsLoading(false)
    }
  }

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/admin/reddit/settings')
      const data: ApiResponse<RedditScanConfig> = await response.json()
      if (data.success && data.data) {
        setConfig(data.data)
      }
    } catch (error) {
      console.error('Error loading Reddit config:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/reddit/stats', { credentials: 'include' })
      const data: ApiResponse<RedditScanStats> = await response.json()
      if (data.success && data.data) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error loading Reddit stats:', error)
    }
  }

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/admin/reddit/status', { credentials: 'include' })
      const data: ApiResponse<RedditApiStatus> = await response.json()
      if (data.success && data.data) {
        setStatus(data.data)
      }
    } catch (error) {
      console.error('Error loading Reddit status:', error)
    }
  }

  const loadScanHistory = async () => {
    try {
      const response = await fetch('/api/admin/reddit/scan-history')
      const data: ApiResponse<RedditScanResult[]> = await response.json()
      if (data.success && data.data) {
        setScanHistory(data.data)
      }
    } catch (error) {
      console.error('Error loading scan history:', error)
    }
  }

  const saveConfig = async () => {
    if (!config) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/reddit/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data: ApiResponse = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Reddit configuration saved successfully' })
        await loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save configuration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save configuration' })
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    setIsTestingConnection(true)
    try {
      const response = await fetch('/api/admin/reddit/test-connection', { credentials: 'include' })
      const data: ApiResponse = await response.json()
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Reddit API connection successful' })
        await loadStatus()
      } else {
        setMessage({ type: 'error', text: data.error || 'Connection test failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection test failed' })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const runManualScan = async () => {
    setIsRunningManualScan(true)
    try {
      const response = await fetch('/api/admin/reddit/scan', {
        method: 'POST',
        credentials: 'include'
      })
      
      const data: ApiResponse<RedditScanResult> = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Manual scan completed successfully' })
        await loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Manual scan failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Manual scan failed' })
    } finally {
      setIsRunningManualScan(false)
    }
  }

  const updateConfig = (field: keyof RedditScanConfig, value: any) => {
    if (!config) return
    setConfig({ ...config, [field]: value })
  }

  const addSubreddit = () => {
    if (!config) return
    const subreddit = prompt('Enter subreddit name (without r/):')
    if (subreddit && !(config.targetSubreddits || []).includes(subreddit)) {
      setConfig({
        ...config,
        targetSubreddits: [...(config.targetSubreddits || []), subreddit.toLowerCase()]
      })
    }
  }

  const removeSubreddit = (subreddit: string) => {
    if (!config) return
    setConfig({
      ...config,
      targetSubreddits: (config.targetSubreddits || []).filter(s => s !== subreddit)
    })
  }

  if (isLoading) {
    return (
      <div className="reddit-admin-container">
        <div className="reddit-loading-container">
          <span className="reddit-spinner"></span>
          <span className="reddit-text-muted" style={{ marginLeft: 'var(--spacing-sm)' }}>Loading Reddit settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="reddit-admin-container">
      {/* Header */}
      <div className="reddit-admin-header">
        <h1>Reddit Integration</h1>
        <p>Configure Reddit content scanning for hotdog discovery</p>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`reddit-alert ${message.type === 'success' ? 'reddit-alert-success' : 'reddit-alert-danger'}`}>
          <div>
            <h3>{message.type === 'success' ? 'Success' : 'Error'}</h3>
            <p>{message.text}</p>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="reddit-btn"
          >
            ×
          </button>
        </div>
      )}

      {/* Connection Status */}
      <div className="reddit-admin-card">
        <div className="reddit-admin-card-header">
          <h3>API Connection Status</h3>
        </div>
        <div className="reddit-admin-card-body">
          <div className="reddit-flex reddit-flex-between reddit-flex-center">
            <div>
              <div className="reddit-flex reddit-flex-center reddit-gap-sm">
                <span 
                  className={`reddit-status-dot ${status?.isConnected ? 'reddit-status-connected' : 'reddit-status-disconnected'}`}
                ></span>
                <span className={status?.isConnected ? 'reddit-text-success' : 'reddit-text-danger'}>
                  {status?.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {status?.rateLimits && (
                <p className="reddit-text-muted">
                  Rate limit: {status.rateLimits.used}/{status.rateLimits.used + status.rateLimits.remaining} requests used
                </p>
              )}
            </div>
            <button
              onClick={testConnection}
              disabled={isTestingConnection}
              className="reddit-btn reddit-btn-primary"
            >
              {isTestingConnection ? (
                <>
                  <span className="reddit-spinner"></span>
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="reddit-admin-tabs">
        <nav className="reddit-admin-tab-nav">
          {[
            { key: 'config', label: 'Configuration' },
            { key: 'stats', label: 'Statistics' },
            { key: 'history', label: 'Scan History' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`reddit-admin-tab ${activeTab === tab.key ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && config && (
        <div>
          {/* Scanning Configuration */}
          <div className="reddit-admin-card reddit-mb-md">
            <div className="reddit-admin-card-header">
              <h3>Scanning Configuration</h3>
            </div>
            <div className="reddit-admin-card-body">
              <div className="reddit-form-grid">
                <div className="reddit-form-group">
                  <label className="reddit-form-label">
                    Enable Reddit Scanning
                  </label>
                  <input
                    type="checkbox"
                    checked={config.isEnabled}
                    onChange={(e) => updateConfig('isEnabled', e.target.checked)}
                    className="reddit-form-input reddit-form-checkbox"
                  />
                </div>

                <div className="reddit-form-group">
                  <label className="reddit-form-label">
                    Scan Interval (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={config.scanInterval}
                    onChange={(e) => updateConfig('scanInterval', parseInt(e.target.value))}
                    className="reddit-form-input"
                  />
                </div>

                <div className="reddit-form-group">
                  <label className="reddit-form-label">
                    Max Posts Per Scan
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.maxPostsPerScan}
                    onChange={(e) => updateConfig('maxPostsPerScan', parseInt(e.target.value))}
                    className="reddit-form-input"
                  />
                </div>

                <div className="reddit-form-group">
                  <label className="reddit-form-label">
                    Minimum Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={config.minScore}
                    onChange={(e) => updateConfig('minScore', parseInt(e.target.value))}
                    className="reddit-form-input"
                  />
                </div>

                <div className="reddit-form-group">
                  <label className="reddit-form-label">
                    Sort By
                  </label>
                  <select
                    value={config.sortBy}
                    onChange={(e) => updateConfig('sortBy', e.target.value)}
                    className="reddit-form-select"
                  >
                    <option value="hot">Hot</option>
                    <option value="top">Top</option>
                    <option value="new">New</option>
                    <option value="relevance">Relevance</option>
                  </select>
                </div>

                <div className="reddit-form-group">
                  <label className="reddit-form-label">
                    Time Range
                  </label>
                  <select
                    value={config.timeRange}
                    onChange={(e) => updateConfig('timeRange', e.target.value)}
                    className="reddit-form-select"
                  >
                    <option value="hour">Past Hour</option>
                    <option value="day">Past Day</option>
                    <option value="week">Past Week</option>
                    <option value="month">Past Month</option>
                    <option value="year">Past Year</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Subreddit Management */}
          <div className="reddit-admin-card reddit-mb-md">
            <div className="reddit-admin-card-header">
              <div className="reddit-flex reddit-flex-between reddit-flex-center">
                <h3>Target Subreddits</h3>
                <button
                  onClick={addSubreddit}
                  className="reddit-btn reddit-btn-primary"
                >
                  Add Subreddit
                </button>
              </div>
            </div>
            <div className="reddit-admin-card-body">
              <div className="reddit-subreddit-grid">
                {(config.targetSubreddits || []).map((subreddit) => (
                  <div key={subreddit} className="reddit-subreddit-tag">
                    <span>r/{subreddit}</span>
                    <button
                      onClick={() => removeSubreddit(subreddit)}
                      className="reddit-subreddit-remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="reddit-flex reddit-flex-between">
            <button
              onClick={runManualScan}
              disabled={isRunningManualScan || !config.isEnabled}
              className="reddit-btn reddit-btn-success"
            >
              {isRunningManualScan ? (
                <>
                  <span className="reddit-spinner"></span>
                  Running Scan...
                </>
              ) : (
                'Run Manual Scan'
              )}
            </button>

            <button
              onClick={saveConfig}
              disabled={isSaving}
              className="reddit-btn reddit-btn-primary"
            >
              {isSaving ? (
                <>
                  <span className="reddit-spinner"></span>
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'stats' && stats && (
        <div className="reddit-admin-card">
          <div className="reddit-admin-card-header">
            <h3>Reddit Scanning Statistics</h3>
          </div>
          <div className="reddit-admin-card-body">
            <div className="reddit-stats-grid">
              <div className="reddit-stat-item">
                <div className="reddit-stat-label">Total Scans</div>
                <div className="reddit-stat-value">{stats.totalScans}</div>
              </div>
              
              <div className="reddit-stat-item">
                <div className="reddit-stat-label">Posts Found</div>
                <div className="reddit-stat-value">{stats.totalPostsFound}</div>
              </div>
              
              <div className="reddit-stat-item">
                <div className="reddit-stat-label">Posts Approved</div>
                <div className="reddit-stat-value success">{stats.totalPostsApproved}</div>
              </div>
              
              <div className="reddit-stat-item">
                <div className="reddit-stat-label">Success Rate</div>
                <div className="reddit-stat-value primary">{stats.successRate.toFixed(1)}%</div>
              </div>
              
              <div className="reddit-stat-item">
                <div className="reddit-stat-label">Average Score</div>
                <div className="reddit-stat-value">{stats.averageScore.toFixed(1)}</div>
              </div>
              
              <div className="reddit-stat-item">
                <div className="reddit-stat-label">Scan Frequency</div>
                <div className="reddit-stat-value">{stats.scanFrequency}min</div>
              </div>
              
              <div className="reddit-stat-item">
                <div className="reddit-stat-label">Last Scan</div>
                <div className="reddit-stat-value" style={{ fontSize: '1rem' }}>
                  {stats.lastScanTime ? new Date(stats.lastScanTime).toLocaleString() : 'Never'}
                </div>
              </div>
              
              <div className="reddit-stat-item">
                <div className="reddit-stat-label">Next Scan</div>
                <div className="reddit-stat-value" style={{ fontSize: '1rem' }}>
                  {stats.nextScanTime ? new Date(stats.nextScanTime).toLocaleString() : 'Not scheduled'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="reddit-admin-card">
          <div className="reddit-admin-card-header">
            <h3>Recent Scan History</h3>
          </div>
          <div className="reddit-admin-card-body">
            {scanHistory.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="reddit-table">
                  <thead>
                    <tr>
                      <th>Scan ID</th>
                      <th>Time</th>
                      <th>Found</th>
                      <th>Approved</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanHistory.map((scan) => (
                      <tr key={scan.scanId}>
                        <td style={{ fontFamily: 'monospace' }}>
                          {scan.scanId.split('_').pop()}
                        </td>
                        <td>
                          {new Date(scan.startTime).toLocaleString()}
                        </td>
                        <td>{scan.postsFound}</td>
                        <td className="reddit-text-success">{scan.postsApproved}</td>
                        <td className="reddit-text-danger">{scan.errors.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="reddit-empty-state">
                <p>No scan history available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}