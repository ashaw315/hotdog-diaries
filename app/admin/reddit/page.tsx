'use client'

import { useState, useEffect } from 'react'
import { ApiResponse } from '@/types'
import { RedditScanConfig, RedditScanStats, RedditScanResult } from '@/lib/services/reddit-scanning'

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
    if (subreddit && !config.targetSubreddits.includes(subreddit)) {
      setConfig({
        ...config,
        targetSubreddits: [...config.targetSubreddits, subreddit.toLowerCase()]
      })
    }
  }

  const removeSubreddit = (subreddit: string) => {
    if (!config) return
    setConfig({
      ...config,
      targetSubreddits: config.targetSubreddits.filter(s => s !== subreddit)
    })
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600">Loading Reddit settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reddit Integration</h1>
        <p className="mt-2 text-gray-600">
          Configure Reddit content scanning for hotdog discovery
        </p>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium">
                {message.type === 'success' ? 'Success' : 'Error'}
              </h3>
              <div className="mt-2 text-sm">
                {message.text}
              </div>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="mb-6 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                API Connection Status
              </h3>
              <div className="mt-2 flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  status?.isConnected ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                <span className={`text-sm ${
                  status?.isConnected ? 'text-green-600' : 'text-red-600'
                }`}>
                  {status?.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {status?.rateLimits && (
                <p className="mt-1 text-sm text-gray-500">
                  Rate limit: {status.rateLimits.used}/{status.rateLimits.used + status.rateLimits.remaining} requests used
                </p>
              )}
            </div>
            <button
              onClick={testConnection}
              disabled={isTestingConnection}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingConnection ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'config', label: 'Configuration' },
            { key: 'stats', label: 'Statistics' },
            { key: 'history', label: 'Scan History' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && config && (
        <div className="space-y-6">
          {/* Scanning Configuration */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Scanning Configuration
              </h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Enable Reddit Scanning
                  </label>
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      checked={config.isEnabled}
                      onChange={(e) => updateConfig('isEnabled', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Scan Interval (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={config.scanInterval}
                    onChange={(e) => updateConfig('scanInterval', parseInt(e.target.value))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Posts Per Scan
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.maxPostsPerScan}
                    onChange={(e) => updateConfig('maxPostsPerScan', parseInt(e.target.value))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Minimum Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={config.minScore}
                    onChange={(e) => updateConfig('minScore', parseInt(e.target.value))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Sort By
                  </label>
                  <select
                    value={config.sortBy}
                    onChange={(e) => updateConfig('sortBy', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="hot">Hot</option>
                    <option value="top">Top</option>
                    <option value="new">New</option>
                    <option value="relevance">Relevance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Time Range
                  </label>
                  <select
                    value={config.timeRange}
                    onChange={(e) => updateConfig('timeRange', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Target Subreddits
                </h3>
                <button
                  onClick={addSubreddit}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Add Subreddit
                </button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {config.targetSubreddits.map((subreddit) => (
                  <div
                    key={subreddit}
                    className="flex items-center justify-between bg-gray-100 rounded-md px-3 py-2"
                  >
                    <span className="text-sm text-gray-700">r/{subreddit}</span>
                    <button
                      onClick={() => removeSubreddit(subreddit)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={runManualScan}
              disabled={isRunningManualScan || !config.isEnabled}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunningManualScan ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Running Scan...
                </>
              ) : (
                'Run Manual Scan'
              )}
            </button>

            <button
              onClick={saveConfig}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Reddit Scanning Statistics
            </h3>
            
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Scans</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalScans}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Posts Found</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalPostsFound}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Posts Approved</dt>
                <dd className="mt-1 text-3xl font-semibold text-green-600">{stats.totalPostsApproved}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Success Rate</dt>
                <dd className="mt-1 text-3xl font-semibold text-indigo-600">{stats.successRate.toFixed(1)}%</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Average Score</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.averageScore.toFixed(1)}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Scan Frequency</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.scanFrequency}min</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Scan</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {stats.lastScanTime ? new Date(stats.lastScanTime).toLocaleString() : 'Never'}
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Next Scan</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {stats.nextScanTime ? new Date(stats.nextScanTime).toLocaleString() : 'Not scheduled'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Recent Scan History
            </h3>
            
            {scanHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scan ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Found
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Errors
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {scanHistory.map((scan) => (
                      <tr key={scan.scanId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {scan.scanId.split('_').pop()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(scan.startTime).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {scan.postsFound}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                          {scan.postsApproved}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {scan.errors.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No scan history available</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}