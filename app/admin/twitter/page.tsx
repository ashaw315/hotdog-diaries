'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import TwitterConfigForm from '@/components/admin/TwitterConfigForm'
import TwitterStats from '@/components/admin/TwitterStats'

interface TwitterStatus {
  isConnected: boolean
  rateLimits: {
    search: {
      limit: number
      remaining: number
      resetTime: Date
    }
    users: {
      limit: number
      remaining: number
      resetTime: Date
    }
  }
  lastError?: string
  lastRequest?: Date
}

interface TwitterConfig {
  isEnabled: boolean
  scanInterval: number
  maxTweetsPerScan: number
  searchQueries: string[]
  excludeRetweets: boolean
  excludeReplies: boolean
  minEngagementThreshold: number
}

interface TwitterScanStats {
  totalScans: number
  totalTweetsFound: number
  totalTweetsProcessed: number
  totalTweetsApproved: number
  averageEngagement: number
  topHashtags: Array<{ hashtag: string; count: number }>
  topAuthors: Array<{ username: string; count: number }>
  scanFrequency: number
  lastScanTime?: Date
  nextScanTime?: Date
}

export default function TwitterPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'stats' | 'status'>('settings')
  const [twitterStatus, setTwitterStatus] = useState<TwitterStatus | null>(null)
  const [twitterConfig, setTwitterConfig] = useState<TwitterConfig | null>(null)
  const [twitterStats, setTwitterStats] = useState<TwitterScanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTwitterData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [statusRes, configRes, statsRes] = await Promise.all([
        fetch('/api/admin/twitter/status'),
        fetch('/api/admin/twitter/settings'),
        fetch('/api/admin/twitter/stats')
      ])

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setTwitterStatus(statusData.data || statusData)
      }

      if (configRes.ok) {
        const configData = await configRes.json()
        setTwitterConfig(configData.data || configData)
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setTwitterStats(statsData.data || statsData)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Twitter data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTwitterData()
  }, [])

  const handleConfigUpdate = async (newConfig: TwitterConfig) => {
    try {
      const response = await fetch('/api/admin/twitter/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig)
      })

      if (!response.ok) {
        throw new Error('Failed to update configuration')
      }

      setTwitterConfig(newConfig)
      await fetchTwitterData() // Refresh all data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration')
    }
  }

  const handleManualScan = async () => {
    try {
      setError(null)
      const response = await fetch('/api/admin/twitter/scan', {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to trigger scan')
      }

      const result = await response.json()
      await fetchTwitterData() // Refresh stats after scan
      
      // Show success message
      alert(`Scan completed: ${result.data.tweetsProcessed} tweets processed, ${result.data.tweetsApproved} approved`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger manual scan')
    }
  }

  const handleTestConnection = async () => {
    try {
      setError(null)
      const response = await fetch('/api/admin/twitter/test-connection', {
        method: 'POST'
      })

      const result = await response.json()
      
      if (result.success) {
        alert('Twitter API connection successful!')
        await fetchTwitterData()
      } else {
        setError(result.message)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test connection')
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Twitter Integration</h1>
            <p className="mt-1 text-sm text-gray-600">
              Configure and monitor Twitter content scanning
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              Test Connection
            </button>
            <button
              onClick={handleManualScan}
              disabled={!twitterConfig?.isEnabled}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Manual Scan
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">❌</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Status Banner */}
        {twitterStatus && (
          <div className={`rounded-lg p-4 ${
            twitterStatus.isConnected 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              <span className="text-lg mr-3">
                {twitterStatus.isConnected ? '✅' : '❌'}
              </span>
              <div>
                <h3 className={`text-sm font-medium ${
                  twitterStatus.isConnected ? 'text-green-800' : 'text-red-800'
                }`}>
                  Twitter API {twitterStatus.isConnected ? 'Connected' : 'Disconnected'}
                </h3>
                <p className={`text-sm ${
                  twitterStatus.isConnected ? 'text-green-600' : 'text-red-600'
                }`}>
                  {twitterStatus.isConnected 
                    ? `Rate limits: ${twitterStatus.rateLimits.search.remaining}/${twitterStatus.rateLimits.search.limit} remaining`
                    : twitterStatus.lastError || 'Unable to connect to Twitter API'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'settings', label: 'Settings', icon: '⚙️' },
              { id: 'stats', label: 'Statistics', icon: '📊' },
              { id: 'status', label: 'API Status', icon: '🔌' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'settings' && twitterConfig && (
            <TwitterConfigForm
              config={twitterConfig}
              onUpdate={handleConfigUpdate}
              isConnected={twitterStatus?.isConnected || false}
            />
          )}

          {activeTab === 'stats' && twitterStats && (
            <TwitterStats
              stats={twitterStats}
              onRefresh={fetchTwitterData}
            />
          )}

          {activeTab === 'status' && twitterStatus && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">API Status Details</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Connection Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    twitterStatus.isConnected 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {twitterStatus.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Search API Limit</span>
                  <span className="text-sm text-gray-900">
                    {twitterStatus.rateLimits.search.remaining} / {twitterStatus.rateLimits.search.limit}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Search API Reset</span>
                  <span className="text-sm text-gray-900">
                    {new Date(twitterStatus.rateLimits.search.resetTime).toLocaleTimeString()}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Users API Limit</span>
                  <span className="text-sm text-gray-900">
                    {twitterStatus.rateLimits.users.remaining} / {twitterStatus.rateLimits.users.limit}
                  </span>
                </div>

                {twitterStatus.lastRequest && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Last Request</span>
                    <span className="text-sm text-gray-900">
                      {new Date(twitterStatus.lastRequest).toLocaleString()}
                    </span>
                  </div>
                )}

                {twitterStatus.lastError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm font-medium text-red-800">Last Error</div>
                    <div className="text-sm text-red-600 mt-1">{twitterStatus.lastError}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}