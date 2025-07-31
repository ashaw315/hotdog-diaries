'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Play, Pause, Settings, AlertTriangle, CheckCircle, Video, Clock, Users } from 'lucide-react'
import { ApiResponse } from '@/types'
import { TikTokScanConfig, TikTokScanStats, TikTokScanResult } from '@/lib/services/tiktok-scanning'

interface TikTokApiStatus {
  isAuthenticated: boolean
  rateLimits: {
    used: number
    remaining: number
    resetTime: Date
  }
  lastError?: string
  lastRequest?: Date
  tokenExpiresAt?: Date
  quota: {
    daily: { used: number; limit: number }
    hourly: { used: number; limit: number }
  }
}

export default function TikTokSettingsPage() {
  const [activeTab, setActiveTab] = useState('config')
  const [config, setConfig] = useState<TikTokScanConfig | null>(null)
  const [stats, setStats] = useState<TikTokScanStats | null>(null)
  const [status, setStatus] = useState<TikTokApiStatus | null>(null)
  const [scanHistory, setScanHistory] = useState<TikTokScanResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isRunningManualScan, setIsRunningManualScan] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
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
      console.error('Error loading TikTok data:', error)
      setMessage({ type: 'error', text: 'Failed to load TikTok data' })
    } finally {
      setIsLoading(false)
    }
  }

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/admin/tiktok/settings')
      const data: ApiResponse<TikTokScanConfig> = await response.json()
      if (data.success && data.data) {
        setConfig(data.data)
      }
    } catch (error) {
      console.error('Error loading TikTok config:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/tiktok/stats')
      const data: ApiResponse<TikTokScanStats> = await response.json()
      if (data.success && data.data) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error loading TikTok stats:', error)
    }
  }

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/admin/tiktok/status')
      const data: ApiResponse<TikTokApiStatus> = await response.json()
      if (data.success && data.data) {
        setStatus(data.data)
      }
    } catch (error) {
      console.error('Error loading TikTok status:', error)
    }
  }

  const loadScanHistory = async () => {
    try {
      const response = await fetch('/api/admin/tiktok/scan-history')
      const data: ApiResponse<TikTokScanResult[]> = await response.json()
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
      const response = await fetch('/api/admin/tiktok/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data: ApiResponse = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'TikTok configuration saved successfully' })
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
      const response = await fetch('/api/admin/tiktok/test-connection')
      const data: ApiResponse = await response.json()
      
      if (data.success) {
        setMessage({ type: 'success', text: 'TikTok API connection successful' })
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
      const response = await fetch('/api/admin/tiktok/scan', {
        method: 'POST'
      })
      
      const data: ApiResponse<TikTokScanResult> = await response.json()
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

  const startAuthentication = async () => {
    setIsAuthenticating(true)
    try {
      const response = await fetch('/api/admin/tiktok/authenticate', {
        method: 'POST'
      })
      
      const data: ApiResponse<{ authUrl: string }> = await response.json()
      if (data.success && data.data) {
        // Redirect to TikTok OAuth flow
        window.location.href = data.data.authUrl
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start authentication' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to start authentication' })
    } finally {
      setIsAuthenticating(false)
    }
  }

  const updateConfig = (field: keyof TikTokScanConfig, value: any) => {
    if (!config) return
    setConfig({ ...config, [field]: value })
  }

  const addKeyword = () => {
    if (!config) return
    const keyword = prompt('Enter keyword:')
    if (keyword && !config.targetKeywords.includes(keyword.toLowerCase())) {
      setConfig({
        ...config,
        targetKeywords: [...config.targetKeywords, keyword.toLowerCase()]
      })
    }
  }

  const removeKeyword = (keyword: string) => {
    if (!config) return
    setConfig({
      ...config,
      targetKeywords: config.targetKeywords.filter(k => k !== keyword)
    })
  }

  const addHashtag = () => {
    if (!config) return
    const hashtag = prompt('Enter hashtag (without #):')
    if (hashtag && !config.targetHashtags.includes(hashtag.toLowerCase())) {
      setConfig({
        ...config,
        targetHashtags: [...config.targetHashtags, hashtag.toLowerCase()]
      })
    }
  }

  const removeHashtag = (hashtag: string) => {
    if (!config) return
    setConfig({
      ...config,
      targetHashtags: config.targetHashtags.filter(h => h !== hashtag)
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading TikTok settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">TikTok Integration</h1>
          <p className="text-muted-foreground">
            Configure TikTok video scanning for hotdog content discovery
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{message.text}</AlertDescription>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setMessage(null)}
            className="absolute top-2 right-2"
          >
            ×
          </Button>
        </Alert>
      )}

      {/* Authentication Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Video className="h-5 w-5" />
                <span>TikTok Authentication Status</span>
              </CardTitle>
              <CardDescription className="flex items-center space-x-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${status?.isAuthenticated ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className={status?.isAuthenticated ? 'text-green-600' : 'text-red-600'}>
                  {status?.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                </span>
              </CardDescription>
              {status?.tokenExpiresAt && (
                <p className="text-sm text-muted-foreground mt-1">
                  Token expires: {new Date(status.tokenExpiresAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex space-x-2">
              {!status?.isAuthenticated && (
                <Button
                  onClick={startAuthentication}
                  disabled={isAuthenticating}
                  className="bg-pink-600 hover:bg-pink-700"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Authenticate with TikTok'
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {status?.quota && (
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium">Hourly Quota</div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(status.quota.hourly.used / status.quota.hourly.limit) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm">{status.quota.hourly.used}/{status.quota.hourly.limit}</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Daily Quota</div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${(status.quota.daily.used / status.quota.daily.limit) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm">{status.quota.daily.used}/{status.quota.daily.limit}</span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="history">Scan History</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          {config && (
            <>
              {/* Scanning Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Scanning Configuration</CardTitle>
                  <CardDescription>Configure TikTok video scanning parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Enable TikTok Scanning</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={config.isEnabled}
                          onChange={(e) => updateConfig('isEnabled', e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-muted-foreground">
                          {config.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Scan Interval (minutes)</label>
                      <input
                        type="number"
                        min="30"
                        max="1440"
                        value={config.scanInterval}
                        onChange={(e) => updateConfig('scanInterval', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="120"
                      />
                      <p className="text-xs text-muted-foreground">Minimum 30 minutes due to TikTok rate limits</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Videos Per Scan</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={config.maxVideosPerScan}
                        onChange={(e) => updateConfig('maxVideosPerScan', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Minimum Views</label>
                      <input
                        type="number"
                        min="0"
                        value={config.minViews}
                        onChange={(e) => updateConfig('minViews', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Duration (seconds)</label>
                      <input
                        type="number"
                        min="1"
                        max="600"
                        value={config.maxDuration}
                        onChange={(e) => updateConfig('maxDuration', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="180"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sort By</label>
                      <select
                        value={config.sortBy}
                        onChange={(e) => updateConfig('sortBy', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="create_time">Creation Time</option>
                        <option value="view_count">View Count</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Keywords Management */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Target Keywords</CardTitle>
                      <CardDescription>Keywords to search for in TikTok videos</CardDescription>
                    </div>
                    <Button onClick={addKeyword} variant="outline" size="sm">
                      Add Keyword
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {config.targetKeywords.map((keyword) => (
                      <div
                        key={keyword}
                        className="flex items-center justify-between bg-gray-100 rounded-md px-3 py-2"
                      >
                        <span className="text-sm">{keyword}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeKeyword(keyword)}
                          className="text-red-500 hover:text-red-700 h-auto p-0 ml-2"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Hashtags Management */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Target Hashtags</CardTitle>
                      <CardDescription>Hashtags to search for in TikTok videos</CardDescription>
                    </div>
                    <Button onClick={addHashtag} variant="outline" size="sm">
                      Add Hashtag
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {config.targetHashtags.map((hashtag) => (
                      <div
                        key={hashtag}
                        className="flex items-center justify-between bg-gray-100 rounded-md px-3 py-2"
                      >
                        <span className="text-sm">#{hashtag}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeHashtag(hashtag)}
                          className="text-red-500 hover:text-red-700 h-auto p-0 ml-2"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between">
                <Button
                  onClick={runManualScan}
                  disabled={isRunningManualScan || !config.isEnabled || !status?.isAuthenticated}
                  className="bg-pink-600 hover:bg-pink-700"
                >
                  {isRunningManualScan ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running Scan...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Manual Scan
                    </>
                  )}
                </Button>

                <Button onClick={saveConfig} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="stats">
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>TikTok Scanning Statistics</CardTitle>
                <CardDescription>Performance metrics and analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{stats.totalScans}</div>
                    <div className="text-sm text-muted-foreground">Total Scans</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{stats.totalVideosFound}</div>
                    <div className="text-sm text-muted-foreground">Videos Found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.totalVideosApproved}</div>
                    <div className="text-sm text-muted-foreground">Videos Approved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.successRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{stats.averageViews.toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">Avg Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{stats.averageDuration}s</div>
                    <div className="text-sm text-muted-foreground">Avg Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{stats.scanFrequency}min</div>
                    <div className="text-sm text-muted-foreground">Scan Frequency</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm">
                      <div className="font-medium">Last Scan</div>
                      <div className="text-muted-foreground">
                        {stats.lastScanTime ? new Date(stats.lastScanTime).toLocaleString() : 'Never'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Scan History</CardTitle>
              <CardDescription>History of TikTok video scans</CardDescription>
            </CardHeader>
            <CardContent>
              {scanHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Scan ID</th>
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">Found</th>
                        <th className="text-left p-2">Approved</th>
                        <th className="text-left p-2">Errors</th>
                        <th className="text-left p-2">Keywords</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanHistory.map((scan) => (
                        <tr key={scan.scanId} className="border-b">
                          <td className="p-2 font-mono text-sm">
                            {scan.scanId.split('_').pop()}
                          </td>
                          <td className="p-2 text-sm">
                            {new Date(scan.startTime).toLocaleString()}
                          </td>
                          <td className="p-2 text-sm">{scan.videosFound}</td>
                          <td className="p-2 text-sm text-green-600">{scan.videosApproved}</td>
                          <td className="p-2 text-sm text-red-600">{scan.errors.length}</td>
                          <td className="p-2 text-sm">
                            {scan.keywordsScanned.slice(0, 3).join(', ')}
                            {scan.keywordsScanned.length > 3 && '...'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No scan history available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}