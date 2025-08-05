'use client'

import { useState, useEffect } from 'react'

interface UnsplashApiStatus {
  isAuthenticated: boolean
  requestsUsed: number
  requestsRemaining: number
  requestsResetTime: string
  lastError?: string
  lastRequest?: string
}

interface UnsplashScanConfig {
  isEnabled: boolean
  scanInterval: number
  maxPhotosPerScan: number
  searchTerms: string[]
  minDownloads: number
  minLikes: number
  publishedWithin: number
  orientation: 'landscape' | 'portrait' | 'squarish' | 'all'
  contentFilter: 'low' | 'high' | 'all'
  lastScanTime?: string
}

interface UnsplashScanResult {
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
  highestRatedPhoto?: {
    id: string
    description: string
    likes: number
    downloads: number
    photographerName: string
  }
}

export default function UnsplashAdminPage() {
  const [apiStatus, setApiStatus] = useState<UnsplashApiStatus | null>(null)
  const [scanConfig, setScanConfig] = useState<UnsplashScanConfig | null>(null)
  const [lastScanResult, setLastScanResult] = useState<UnsplashScanResult | null>(null)
  const [recentScans, setRecentScans] = useState<UnsplashScanResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    loadUnsplashData()
  }, [])

  const loadUnsplashData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [statusResponse, configResponse, scanResponse] = await Promise.all([
        fetch('/api/admin/unsplash/status'),
        fetch('/api/admin/unsplash/config'),
        fetch('/api/admin/unsplash/scans?limit=5')
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
        setRecentScans(scanData.data.scans)
        if (scanData.data.scans.length > 0) {
          setLastScanResult(scanData.data.scans[0])
        }
      }

    } catch (err) {
      setError('Failed to load Unsplash data')
      console.error('Error loading Unsplash data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleScanStart = async () => {
    try {
      setIsScanning(true)
      setError(null)
      
      const response = await fetch('/api/admin/unsplash/scan', {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          await loadUnsplashData()
        } else {
          setError(result.message || 'Scan failed')
        }
      } else {
        throw new Error('Failed to start scan')
      }
    } catch (err) {
      setError('Failed to start Unsplash scan')
      console.error('Scan error:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handleTestScan = async () => {
    try {
      setIsTesting(true)
      setError(null)
      
      const response = await fetch('/api/admin/unsplash/scan?test=true', {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          await loadUnsplashData()
        } else {
          setError(result.message || 'Test scan failed')
        }
      } else {
        throw new Error('Test scan failed')
      }
    } catch (err) {
      setError('Failed to run test scan')
      console.error('Test scan error:', err)
    } finally {
      setIsTesting(false)
    }
  }

  const handleConfigUpdate = async (updates: Partial<UnsplashScanConfig>) => {
    try {
      setError(null)
      
      const response = await fetch('/api/admin/unsplash/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setScanConfig(result.data)
        } else {
          setError(result.message || 'Failed to update configuration')
        }
      } else {
        throw new Error('Failed to update configuration')
      }
    } catch (err) {
      setError('Failed to update Unsplash configuration')
      console.error('Config update error:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="container content-area">
        <div className="text-center">
          <div className="spinner mb-sm"></div>
          <p className="loading">Loading Unsplash configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container content-area">
      <div className="grid gap-lg">
        {/* Header */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between align-center">
              <div>
                <h1 className="flex align-center gap-sm">
                  <span>📸</span>
                  Unsplash Integration
                </h1>
                <p className="text-muted">
                  High-quality stock photos of hotdogs and related food imagery
                </p>
              </div>
              <div className="flex gap-sm">
                <button 
                  onClick={handleTestScan}
                  disabled={isTesting || isScanning}
                  className="btn"
                >
                  {isTesting ? 'Testing...' : '🧪 Test Scan'}
                </button>
                <button 
                  onClick={handleScanStart}
                  disabled={isScanning || isTesting}
                  className="btn btn-primary"
                >
                  {isScanning ? 'Scanning...' : '▶️ Start Scan'}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger mt-sm">
                <span>⚠ {error}</span>
              </div>
            )}
          </div>
        </div>

        {/* API Status */}
        {apiStatus && (
          <div className="card">
            <div className="card-header">
              <h2>API Status</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-4 gap-md">
                <div className="text-center card">
                  <div className="card-body">
                    <div className={`status-indicator ${apiStatus.isAuthenticated ? 'status-success' : 'status-danger'}`}>
                      {apiStatus.isAuthenticated ? '✅' : '❌'}
                    </div>
                    <p className="text-muted">Authentication</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <h3>{apiStatus.requestsUsed}</h3>
                    <p className="text-muted">Requests Used</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <h3>{apiStatus.requestsRemaining}</h3>
                    <p className="text-muted">Requests Remaining</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <p className="text-sm">{apiStatus.requestsResetTime}</p>
                    <p className="text-muted">Reset Time</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scan Configuration */}
        {scanConfig && (
          <div className="card">
            <div className="card-header">
              <h2>Scan Configuration</h2>
            </div>
            <div className="card-body">
              <div className="grid gap-md">
                <div className="flex align-center gap-md">
                  <label className="flex align-center gap-xs">
                    <input
                      type="checkbox"
                      checked={scanConfig.isEnabled}
                      onChange={(e) => handleConfigUpdate({ isEnabled: e.target.checked })}
                      className="form-checkbox"
                    />
                    Enable Unsplash Scanning
                  </label>
                </div>

                <div className="grid grid-3 gap-md">
                  <div>
                    <label className="text-muted">Scan Interval (minutes)</label>
                    <input
                      type="number"
                      value={scanConfig.scanInterval}
                      onChange={(e) => handleConfigUpdate({ scanInterval: parseInt(e.target.value) })}
                      className="form-input"
                      min="5"
                      max="1440"
                    />
                  </div>
                  <div>
                    <label className="text-muted">Max Photos per Scan</label>
                    <input
                      type="number"
                      value={scanConfig.maxPhotosPerScan}
                      onChange={(e) => handleConfigUpdate({ maxPhotosPerScan: parseInt(e.target.value) })}
                      className="form-input"
                      min="1"
                      max="50"
                    />
                  </div>
                  <div>
                    <label className="text-muted">Orientation</label>
                    <select
                      value={scanConfig.orientation}
                      onChange={(e) => handleConfigUpdate({ orientation: e.target.value as any })}
                      className="form-select"
                    >
                      <option value="all">All</option>
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                      <option value="squarish">Square</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-muted">Search Terms</label>
                  <div className="flex flex-wrap gap-xs">
                    {scanConfig.searchTerms.map((term, index) => (
                      <span key={index} className="tag">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Last Scan Result */}
        {lastScanResult && (
          <div className="card">
            <div className="card-header">
              <h2>Last Scan Results</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-4 gap-md mb-md">
                <div className="text-center card">
                  <div className="card-body">
                    <h3>{lastScanResult.photosFound}</h3>
                    <p className="text-muted">Photos Found</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <h3 className="text-success">{lastScanResult.photosProcessed}</h3>
                    <p className="text-muted">Processed</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <h3 className="text-success">{lastScanResult.photosApproved}</h3>
                    <p className="text-muted">Approved</p>
                  </div>
                </div>
                <div className="text-center card">
                  <div className="card-body">
                    <h3>{lastScanResult.requestsUsed}</h3>
                    <p className="text-muted">API Requests</p>
                  </div>
                </div>
              </div>

              {lastScanResult.highestRatedPhoto && (
                <div className="card">
                  <div className="card-header">
                    <h3>Top Photo from Last Scan</h3>
                  </div>
                  <div className="card-body">
                    <p><strong>Description:</strong> {lastScanResult.highestRatedPhoto.description}</p>
                    <p><strong>Photographer:</strong> {lastScanResult.highestRatedPhoto.photographerName}</p>
                    <p><strong>Likes:</strong> {lastScanResult.highestRatedPhoto.likes} | <strong>Downloads:</strong> {lastScanResult.highestRatedPhoto.downloads}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2>Recent Scans</h2>
            </div>
            <div className="card-body">
              <div className="grid gap-sm">
                {recentScans.map((scan, index) => (
                  <div key={scan.scanId} className="card">
                    <div className="card-body">
                      <div className="flex justify-between align-center">
                        <div>
                          <p><strong>Scan #{scan.scanId}</strong></p>
                          <p className="text-muted">{new Date(scan.startTime).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p>{scan.photosFound} found, {scan.photosProcessed} processed</p>
                          <p className="text-muted">{scan.requestsUsed} API requests</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!apiStatus && !scanConfig && !lastScanResult && !isLoading && (
          <div className="card">
            <div className="card-body text-center">
              <div className="mb-md" style={{ fontSize: '3rem' }}>📸</div>
              <h3 className="mb-sm">Unsplash Integration Not Configured</h3>
              <p className="text-muted mb-md">
                Set up your Unsplash API credentials to start scanning for hotdog photos.
              </p>
              <button onClick={loadUnsplashData} className="btn btn-primary">
                Reload Configuration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}