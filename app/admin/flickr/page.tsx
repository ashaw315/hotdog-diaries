'use client'

import { useState, useEffect } from 'react'

interface FlickrApiStatus {
  isAuthenticated: boolean
  requestsUsed: number
  requestsRemaining: number
  requestsResetTime: string
  lastError?: string
  lastRequest?: string
}

interface FlickrScanConfig {
  isEnabled: boolean
  scanInterval: number
  maxPhotosPerScan: number
  searchTerms: string[]
  license: string
  publishedWithin: number
  minViews: number
  contentType: 'photos' | 'screenshots' | 'other'
  safeSearch: 'safe' | 'moderate' | 'restricted'
  lastScanTime?: string
}

interface FlickrScanResult {
  scanId: string
  startTime: string
  endTime: string
  photosFound: number
  photosProcessed: number
  photosApproved: number
  photosRejected: number
  photosFlagged: number
  duplicatesFound: number
  requestsUsed: number
  searchTermsUsed: string[]
  highestViewedPhoto?: {
    id: string
    title: string
    views: number
    ownerName: string
  }
}

export default function FlickrAdminPage() {
  const [apiStatus, setApiStatus] = useState<FlickrApiStatus | null>(null)
  const [scanConfig, setScanConfig] = useState<FlickrScanConfig | null>(null)
  const [lastScanResult, setLastScanResult] = useState<FlickrScanResult | null>(null)
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
        fetch('/api/admin/flickr/status'),
        fetch('/api/admin/flickr/config'),
        fetch('/api/admin/flickr/scans?limit=1')
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
      setError('Failed to load Flickr data')
      console.error('Error loading Flickr data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleManualScan = async () => {
    try {
      setScanning(true)
      setError(null)

      const response = await fetch('/api/admin/flickr/scan', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Scan failed')
      }

      const result = await response.json()
      setLastScanResult(result.data)
      
      // Reload API status to get updated usage
      await loadData()

    } catch (err) {
      setError('Failed to perform scan')
      console.error('Scan error:', err)
    } finally {
      setScanning(false)
    }
  }

  const handleConfigUpdate = async (updates: Partial<FlickrScanConfig>) => {
    try {
      setError(null)

      const response = await fetch('/api/admin/flickr/config', {
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

      const response = await fetch('/api/admin/flickr/test')
      const result = await response.json()

      if (result.success) {
        alert('Flickr API connection successful!')
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Flickr data...</p>
        </div>
      </div>
    )
  }

  const requestUsagePercent = apiStatus ? (apiStatus.requestsUsed / (apiStatus.requestsUsed + apiStatus.requestsRemaining)) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="text-3xl mr-3">📸</span>
              Flickr Photo Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage Creative Commons licensed hotdog photography from Flickr
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
              className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  {apiStatus.requestsUsed.toLocaleString()} / {(apiStatus.requestsUsed + apiStatus.requestsRemaining).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Requests Used</p>
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${requestUsagePercent > 80 ? 'bg-red-500' : requestUsagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${requestUsagePercent}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {apiStatus.requestsRemaining.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Requests Remaining</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {apiStatus.requestsResetTime ? new Date(apiStatus.requestsResetTime).toLocaleTimeString() : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">Hourly Reset</p>
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 ${
                  scanConfig.isEnabled ? 'bg-pink-600' : 'bg-gray-200'
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  min="60"
                  max="1440"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Photos per Scan
                </label>
                <input
                  type="number"
                  value={scanConfig.maxPhotosPerScan}
                  onChange={(e) => handleConfigUpdate({ maxPhotosPerScan: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  min="5"
                  max="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content Type
                </label>
                <select
                  value={scanConfig.contentType}
                  onChange={(e) => handleConfigUpdate({ contentType: e.target.value as 'photos' | 'screenshots' | 'other' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="photos">Photos Only</option>
                  <option value="screenshots">Screenshots Only</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Views
                </label>
                <input
                  type="number"
                  value={scanConfig.minViews}
                  onChange={(e) => handleConfigUpdate({ minViews: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Safe Search
                </label>
                <select
                  value={scanConfig.safeSearch}
                  onChange={(e) => handleConfigUpdate({ safeSearch: e.target.value as 'safe' | 'moderate' | 'restricted' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="safe">Safe</option>
                  <option value="moderate">Moderate</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Published Within (days)
                </label>
                <input
                  type="number"
                  value={scanConfig.publishedWithin}
                  onChange={(e) => handleConfigUpdate({ publishedWithin: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  min="1"
                  max="365"
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
                    className="inline-flex items-center px-3 py-1 bg-pink-100 text-pink-800 text-sm rounded-full"
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-blue-400">ℹ</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <strong>Creative Commons:</strong> Only photos with Creative Commons licenses are scanned to ensure proper attribution and usage rights.
                  </p>
                </div>
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
              <p className="text-2xl font-bold text-blue-600">{lastScanResult.photosFound}</p>
              <p className="text-sm text-gray-600">Photos Found</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{lastScanResult.photosApproved}</p>
              <p className="text-sm text-gray-600">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{lastScanResult.photosRejected}</p>
              <p className="text-sm text-gray-600">Rejected</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{lastScanResult.requestsUsed}</p>
              <p className="text-sm text-gray-600">Requests Used</p>
            </div>
          </div>

          {lastScanResult.highestViewedPhoto && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Highest Viewed Photo</h3>
              <p className="text-sm text-gray-700">{lastScanResult.highestViewedPhoto.title}</p>
              <p className="text-xs text-gray-500 mt-1">
                by {lastScanResult.highestViewedPhoto.ownerName} • {lastScanResult.highestViewedPhoto.views.toLocaleString()} views
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