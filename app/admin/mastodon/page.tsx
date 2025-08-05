'use client'

import { useState, useEffect } from 'react'

interface MastodonInstance {
  domain: string
  name: string
  isActive: boolean
  rateLimitPerMinute: number
  lastScanTime?: Date
  errorCount: number
  successCount: number
}

interface MastodonConfig {
  instances: MastodonInstance[]
  searchTerms: string[]
  hashtagsToTrack: string[]
  enabledInstances: string[]
  scanIntervalMinutes: number
  maxPostsPerScan: number
  minEngagementThreshold: number
}

interface MastodonStats {
  totalScans: number
  totalPostsFound: number
  totalPostsProcessed: number
  totalPostsAdded: number
  averageScanDuration: number
  lastScanTime?: Date
  isScanning: boolean
  successRate: number
}

interface InstanceHealth {
  domain: string
  name: string
  isOnline: boolean
  responseTime: number
  lastChecked: Date
  uptime: number
}

export default function MastodonAdminPage() {
  const [config, setConfig] = useState<MastodonConfig | null>(null)
  const [stats, setStats] = useState<MastodonStats | null>(null)
  const [instanceHealth, setInstanceHealth] = useState<InstanceHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [testing, setTesting] = useState(false)

  // Form states
  const [newInstanceDomain, setNewInstanceDomain] = useState('')
  const [newInstanceName, setNewInstanceName] = useState('')
  const [newSearchTerm, setNewSearchTerm] = useState('')
  const [newHashtag, setNewHashtag] = useState('')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setError(null)
      
      const [configResponse, statsResponse, healthResponse] = await Promise.allSettled([
        fetch('/api/admin/mastodon/settings'),
        fetch('/api/admin/mastodon/stats'),
        fetch('/api/admin/mastodon/status')
      ])

      if (configResponse.status === 'fulfilled' && configResponse.value.ok) {
        const configData = await configResponse.value.json()
        setConfig(configData.data)
      }

      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
        const statsData = await statsResponse.value.json()
        setStats(statsData.data)
      }

      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        const healthData = await healthResponse.value.json()
        setInstanceHealth(healthData.data.instances || [])
      }

    } catch (err) {
      setError('Failed to load Mastodon data')
      console.error('Error loading Mastodon data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartScan = async () => {
    try {
      setScanning(true)
      setError(null)

      const response = await fetch('/api/admin/mastodon/scan', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to start scan')
      }

      const result = await response.json()
      
      if (result.success) {
        await loadData()
      } else {
        setError(result.message || 'Scan failed')
      }

    } catch (err) {
      setError('Failed to start Mastodon scan')
      console.error('Scan error:', err)
    } finally {
      setScanning(false)
    }
  }

  const handleTestScan = async () => {
    try {
      setTesting(true)
      setError(null)

      const response = await fetch('/api/admin/mastodon/scan?test=true', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Test scan failed')
      }

      const result = await response.json()
      
      if (result.success) {
        await loadData()
      } else {
        setError(result.message || 'Test scan failed')
      }

    } catch (err) {
      setError('Failed to run test scan')
      console.error('Test scan error:', err)
    } finally {
      setTesting(false)
    }
  }

  const handleUpdateConfig = async (updates: Partial<MastodonConfig>) => {
    try {
      setError(null)

      const response = await fetch('/api/admin/mastodon/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update configuration')
      }

      await loadData()
    } catch (err) {
      setError('Failed to update configuration')
      console.error('Config update error:', err)
    }
  }

  const handleAddInstance = async () => {
    if (!newInstanceDomain || !newInstanceName || !config) return

    const newInstance: MastodonInstance = {
      domain: newInstanceDomain,
      name: newInstanceName,
      isActive: true,
      rateLimitPerMinute: 60,
      errorCount: 0,
      successCount: 0
    }

    await handleUpdateConfig({
      instances: [...config.instances, newInstance]
    })

    setNewInstanceDomain('')
    setNewInstanceName('')
  }

  const handleRemoveInstance = async (domain: string) => {
    if (!config) return

    await handleUpdateConfig({
      instances: config.instances.filter(i => i.domain !== domain),
      enabledInstances: config.enabledInstances.filter(d => d !== domain)
    })
  }

  const handleToggleInstance = async (domain: string) => {
    if (!config) return

    const enabledInstances = config.enabledInstances.includes(domain)
      ? config.enabledInstances.filter(d => d !== domain)
      : [...config.enabledInstances, domain]

    await handleUpdateConfig({ enabledInstances })
  }

  const handleAddSearchTerm = async () => {
    if (!newSearchTerm || !config) return

    await handleUpdateConfig({
      searchTerms: [...config.searchTerms, newSearchTerm]
    })

    setNewSearchTerm('')
  }

  const handleRemoveSearchTerm = async (term: string) => {
    if (!config) return

    await handleUpdateConfig({
      searchTerms: config.searchTerms.filter(t => t !== term)
    })
  }

  const handleAddHashtag = async () => {
    if (!newHashtag || !config) return

    const hashtag = newHashtag.startsWith('#') ? newHashtag.slice(1) : newHashtag

    await handleUpdateConfig({
      hashtagsToTrack: [...config.hashtagsToTrack, hashtag]
    })

    setNewHashtag('')
  }

  const handleRemoveHashtag = async (hashtag: string) => {
    if (!config) return

    await handleUpdateConfig({
      hashtagsToTrack: config.hashtagsToTrack.filter(h => h !== hashtag)
    })
  }

  if (loading) {
    return (
      <div className="container content-area">
        <div className="text-center">
          <div className="spinner mb-sm"></div>
          <p className="loading">Loading Mastodon configuration...</p>
        </div>
      </div>
    )
  }

  const getHealthStatus = (domain: string) => {
    const health = instanceHealth.find(h => h.domain === domain)
    if (!health) return { status: 'unknown', color: 'text-muted' }
    
    if (health.isOnline && health.responseTime < 2000) {
      return { status: 'healthy', color: 'text-success' }
    } else if (health.isOnline) {
      return { status: 'slow', color: 'text-muted' }
    } else {
      return { status: 'offline', color: 'text-danger' }
    }
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
                  <span>🐘</span>
                  Mastodon Configuration
                </h1>
                <p className="text-muted">
                  Configure Mastodon instances and content scanning
                </p>
              </div>
              <div className="flex gap-sm">
                <button onClick={loadData} className="btn">
                  Refresh Data
                </button>
                <button 
                  onClick={handleTestScan} 
                  disabled={testing}
                  className="btn"
                >
                  {testing ? 'Testing...' : 'Test Scan'}
                </button>
                <button 
                  onClick={handleStartScan} 
                  disabled={scanning}
                  className="btn btn-primary"
                >
                  {scanning ? 'Scanning...' : 'Start Scan'}
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

        {/* Statistics */}
        {stats && (
          <div className="card">
            <div className="card-header">
              <h2>Scanning Statistics</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-4 gap-md">
                <div className="text-center">
                  <h3>{stats.totalScans}</h3>
                  <p className="text-muted">Total Scans</p>
                </div>
                <div className="text-center">
                  <h3>{stats.totalPostsFound}</h3>
                  <p className="text-muted">Posts Found</p>
                </div>
                <div className="text-center">
                  <h3>{stats.totalPostsProcessed}</h3>
                  <p className="text-muted">Posts Processed</p>
                </div>
                <div className="text-center">
                  <h3 className="text-success">{Math.round(stats.successRate * 100)}%</h3>
                  <p className="text-muted">Success Rate</p>
                </div>
              </div>
              
              {stats.lastScanTime && (
                <div className="mt-md text-center">
                  <p className="text-muted">
                    Last scan: {new Date(stats.lastScanTime).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instance Management */}
        <div className="card">
          <div className="card-header">
            <h2>Mastodon Instances</h2>
          </div>
          <div className="card-body">
            {config && (
              <>
                <div className="grid gap-sm mb-md">
                  {config.instances.map((instance) => {
                    const health = getHealthStatus(instance.domain)
                    const isEnabled = config.enabledInstances.includes(instance.domain)
                    
                    return (
                      <div key={instance.domain} className="card">
                        <div className="card-body">
                          <div className="flex justify-between align-center">
                            <div className="flex align-center gap-sm">
                              <span className={health.color}>●</span>
                              <div>
                                <strong>{instance.name}</strong>
                                <p className="text-muted">{instance.domain}</p>
                              </div>
                            </div>
                            <div className="flex align-center gap-sm">
                              <label className="flex align-center gap-xs">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => handleToggleInstance(instance.domain)}
                                />
                                Enabled
                              </label>
                              <button 
                                onClick={() => handleRemoveInstance(instance.domain)}
                                className="btn btn-danger"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-3 gap-sm mt-sm text-muted">
                            <div>Scans: {instance.successCount}</div>
                            <div>Errors: {instance.errorCount}</div>
                            <div>
                              Last scan: {instance.lastScanTime 
                                ? new Date(instance.lastScanTime).toLocaleDateString()
                                : 'Never'
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3>Add New Instance</h3>
                  </div>
                  <div className="card-body">
                    <div className="grid grid-2 gap-sm">
                      <div className="form-group">
                        <label className="form-label">Domain</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="mastodon.social"
                          value={newInstanceDomain}
                          onChange={(e) => setNewInstanceDomain(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Mastodon Social"
                          value={newInstanceName}
                          onChange={(e) => setNewInstanceName(e.target.value)}
                        />
                      </div>
                    </div>
                    <button onClick={handleAddInstance} className="btn btn-primary mt-sm">
                      Add Instance
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search Configuration */}
        <div className="grid grid-2 gap-md">
          <div className="card">
            <div className="card-header">
              <h2>Search Terms</h2>
            </div>
            <div className="card-body">
              {config && (
                <>
                  <div className="grid gap-xs mb-md">
                    {config.searchTerms.map((term) => (
                      <div key={term} className="flex justify-between align-center p-xs card">
                        <span>{term}</span>
                        <button 
                          onClick={() => handleRemoveSearchTerm(term)}
                          className="btn btn-danger"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-sm">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="hotdog"
                      value={newSearchTerm}
                      onChange={(e) => setNewSearchTerm(e.target.value)}
                    />
                    <button onClick={handleAddSearchTerm} className="btn btn-primary">
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Hashtags</h2>
            </div>
            <div className="card-body">
              {config && (
                <>
                  <div className="grid gap-xs mb-md">
                    {config.hashtagsToTrack.map((hashtag) => (
                      <div key={hashtag} className="flex justify-between align-center p-xs card">
                        <span>#{hashtag}</span>
                        <button 
                          onClick={() => handleRemoveHashtag(hashtag)}
                          className="btn btn-danger"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-sm">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="hotdog"
                      value={newHashtag}
                      onChange={(e) => setNewHashtag(e.target.value)}
                    />
                    <button onClick={handleAddHashtag} className="btn btn-primary">
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Scan Settings */}
        {config && (
          <div className="card">
            <div className="card-header">
              <h2>Scan Settings</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-3 gap-md">
                <div className="form-group">
                  <label className="form-label">Scan Interval (minutes)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config.scanIntervalMinutes}
                    onChange={(e) => handleUpdateConfig({ 
                      scanIntervalMinutes: parseInt(e.target.value) || 30 
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Posts Per Scan</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config.maxPostsPerScan}
                    onChange={(e) => handleUpdateConfig({ 
                      maxPostsPerScan: parseInt(e.target.value) || 50 
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Engagement Threshold</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config.minEngagementThreshold}
                    onChange={(e) => handleUpdateConfig({ 
                      minEngagementThreshold: parseInt(e.target.value) || 1 
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}