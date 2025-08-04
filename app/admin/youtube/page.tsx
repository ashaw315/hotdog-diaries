'use client'

import { useState, useEffect } from 'react'

interface YouTubeApiStatus {
  isAuthenticated: boolean
  quotaUsed: number
  quotaRemaining: number
  quotaResetTime: string
  lastError?: string
  lastRequest?: string
}

interface YouTubeScanConfig {
  isEnabled: boolean
  scanInterval: number
  maxVideosPerScan: number
  searchTerms: string[]
  videoDuration: 'any' | 'short' | 'medium' | 'long'
  publishedWithin: number
  minViewCount: number
  includeChannelIds?: string[]
  excludeChannelIds?: string[]
  lastScanTime?: string
}

interface YouTubeScanResult {
  scanId: string
  startTime: string
  endTime: string
  videosFound: number
  videosProcessed: number
  videosApproved: number
  videosRejected: number
  videosFlagged: number
  duplicatesFound: number
  quotaUsed: number
  searchTermsUsed: string[]
  highestViewedVideo?: {
    id: string
    title: string
    viewCount: number
    channelTitle: string
  }
}

export default function YouTubeAdminPage() {
  const [apiStatus, setApiStatus] = useState<YouTubeApiStatus | null>(null)
  const [scanConfig, setScanConfig] = useState<YouTubeScanConfig | null>(null)
  const [lastScanResult, setLastScanResult] = useState<YouTubeScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load API status, config, and recent scan results
      const [statusResponse, configResponse, scanResponse] = await Promise.all([
        fetch('/api/admin/youtube/status'),
        fetch('/api/admin/youtube/config'),
        fetch('/api/admin/youtube/scans?limit=1')
      ])

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setApiStatus(statusData.data)
      }

      if (configResponse.ok) {
        const configData = await configResponse.json()
        setScanConfig(configData.data)
      }

      if (scanResponse.ok) {
        const scanData = await scanResponse.json()
        if (scanData.data?.scans?.length > 0) {
          setLastScanResult(scanData.data.scans[0])
        }
      }

    } catch (err) {
      setError('Failed to load YouTube data')
      console.error('Error loading YouTube data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleManualScan = async () => {
    try {
      setScanning(true)
      setError(null)

      const response = await fetch('/api/admin/youtube/scan', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Scan failed')
      }

      const result = await response.json()
      setLastScanResult(result.data)
      
      // Reload API status to get updated quota
      await loadData()

    } catch (err) {
      setError('Failed to perform scan')
      console.error('Scan error:', err)
    } finally {
      setScanning(false)
    }
  }

  const handleConfigUpdate = async (updates: Partial<YouTubeScanConfig>) => {
    try {
      setError(null)

      const response = await fetch('/api/admin/youtube/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Config update failed')
      }

      const result = await response.json()
      setScanConfig(result.data)

    } catch (err) {
      setError('Failed to update configuration')
      console.error('Config update error:', err)
    }
  }

  const handleTestConnection = async () => {
    try {
      setError(null)

      const response = await fetch('/api/admin/youtube/test')
      const result = await response.json()

      if (result.success) {
        alert('YouTube API connection successful!')
        await loadData()
      } else {
        alert(`Connection failed: ${result.message}`)
      }

    } catch (err) {
      setError('Connection test failed')
      console.error('Connection test error:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading YouTube data...</p>
        </div>
      </div>
    )
  }

  const quotaUsagePercent = apiStatus ? (apiStatus.quotaUsed / (apiStatus.quotaUsed + apiStatus.quotaRemaining)) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="text-3xl mr-3">📺</span>
              YouTube Content Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage YouTube video content discovery and processing
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleTestConnection}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Test Connection
            </button>
            <button
              onClick={handleManualScan}
              disabled={scanning || !apiStatus?.isAuthenticated}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {scanning ? 'Scanning...' : 'Manual Scan'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">API Status</h2>
        
        {apiStatus ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className={`h-3 w-3 rounded-full mr-2 ${apiStatus.isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {apiStatus.isAuthenticated ? 'Connected' : 'Disconnected'}
                  </p>
                  <p className="text-xs text-gray-500">API Status</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {apiStatus.quotaUsed.toLocaleString()} / {(apiStatus.quotaUsed + apiStatus.quotaRemaining).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Quota Used</p>
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${quotaUsagePercent > 80 ? 'bg-red-500' : quotaUsagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${quotaUsagePercent}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {apiStatus.quotaRemaining.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Quota Remaining</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {apiStatus.quotaResetTime ? new Date(apiStatus.quotaResetTime).toLocaleDateString() : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">Quota Reset</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Unable to load API status</p>
          </div>
        )}

        {apiStatus?.lastError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">
              <strong>Last Error:</strong> {apiStatus.lastError}
            </p>
          </div>
        )}
      </div>

      {/* Scan Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Scan Configuration</h2>
        
        {scanConfig && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Enable Scanning</label>
              <button
                onClick={() => handleConfigUpdate({ isEnabled: !scanConfig.isEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  scanConfig.isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    scanConfig.isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scan Interval (minutes)
                </label>
                <input
                  type="number"
                  value={scanConfig.scanInterval}
                  onChange={(e) => handleConfigUpdate({ scanInterval: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="30"
                  max="1440"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Videos per Scan
                </label>
                <input
                  type="number"
                  value={scanConfig.maxVideosPerScan}
                  onChange={(e) => handleConfigUpdate({ maxVideosPerScan: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="5"
                  max="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video Duration
                </label>
                <select
                  value={scanConfig.videoDuration}
                  onChange={(e) => handleConfigUpdate({ videoDuration: e.target.value as 'any' | 'short' | 'medium' | 'long' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="any">Any Duration</option>
                  <option value="short">Short (&lt; 4 min)</option>
                  <option value="medium">Medium (4-20 min)</option>
                  <option value="long">Long (&gt; 20 min)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min View Count
                </label>
                <input
                  type="number"
                  value={scanConfig.minViewCount}
                  onChange={(e) => handleConfigUpdate({ minViewCount: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Terms
              </label>
              <div className="flex flex-wrap gap-2">
                {scanConfig.searchTerms.map((term, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full"
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>

            {scanConfig.lastScanTime && (
              <div>
                <p className="text-sm text-gray-600">
                  <strong>Last Scan:</strong> {new Date(scanConfig.lastScanTime).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last Scan Results */}
      {lastScanResult && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Last Scan Results</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{lastScanResult.videosFound}</p>
              <p className="text-sm text-gray-600">Videos Found</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{lastScanResult.videosApproved}</p>
              <p className="text-sm text-gray-600">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{lastScanResult.videosRejected}</p>
              <p className="text-sm text-gray-600">Rejected</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{lastScanResult.quotaUsed}</p>
              <p className="text-sm text-gray-600">Quota Used</p>
            </div>
          </div>

          {lastScanResult.highestViewedVideo && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Highest Viewed Video</h3>
              <p className="text-sm text-gray-700">{lastScanResult.highestViewedVideo.title}</p>
              <p className="text-xs text-gray-500 mt-1">
                {lastScanResult.highestViewedVideo.channelTitle} • {lastScanResult.highestViewedVideo.viewCount.toLocaleString()} views
              </p>
            </div>
          )}

          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Scan Duration:</strong> {
                Math.round((new Date(lastScanResult.endTime).getTime() - new Date(lastScanResult.startTime).getTime()) / 1000)
              }s
            </p>
            <p>
              <strong>Search Terms:</strong> {lastScanResult.searchTermsUsed.join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}