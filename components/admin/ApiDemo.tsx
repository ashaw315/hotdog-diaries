'use client'

import React, { useState } from 'react'
import { adminApi, ApiHelpers } from '@/lib/api-client'
import { usePlatformStatus, useSystemHealth, useContentData } from '@/hooks/useAdminData'

export default function ApiDemo() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Use the new data hooks
  const { data: platformData, loading: platformLoading, testConnection, scanPlatform } = usePlatformStatus()
  const { data: healthData, loading: healthLoading, runHealthCheck } = useSystemHealth()
  const { data: contentData, loading: contentLoading, updateContentStatus } = useContentData({ 
    page: 1, 
    limit: 5, 
    status: 'pending' 
  })

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testAuthEndpoint = async () => {
    setLoading(true)
    try {
      const response = await adminApi.verifyToken()
      if (response.success) {
        addResult('✅ Auth verification successful')
      } else {
        addResult('❌ Auth verification failed: ' + response.error)
      }
    } catch (error) {
      addResult('❌ Auth test error: ' + ApiHelpers.handleError(error))
    } finally {
      setLoading(false)
    }
  }

  const testDashboardEndpoint = async () => {
    setLoading(true)
    try {
      const response = await adminApi.getDashboard()
      if (response.success && response.data) {
        addResult(`✅ Dashboard loaded: ${response.data.queueStats.totalApproved} approved items`)
      } else {
        addResult('❌ Dashboard failed: ' + response.error)
      }
    } catch (error) {
      addResult('❌ Dashboard error: ' + ApiHelpers.handleError(error))
    } finally {
      setLoading(false)
    }
  }

  const testContentEndpoint = async () => {
    setLoading(true)
    try {
      const response = await adminApi.getContent({ page: 1, limit: 3, status: 'pending' })
      if (response.success && response.data) {
        addResult(`✅ Content loaded: ${response.data.length} items found`)
      } else {
        addResult('❌ Content failed: ' + response.error)
      }
    } catch (error) {
      addResult('❌ Content error: ' + ApiHelpers.handleError(error))
    } finally {
      setLoading(false)
    }
  }

  const testPlatformScan = async () => {
    setLoading(true)
    try {
      const result = await scanPlatform('reddit', 2)
      if (result) {
        addResult(`✅ Reddit scan: ${result.totalFound} found, ${result.processed} processed`)
      } else {
        addResult('❌ Platform scan failed')
      }
    } catch (error) {
      addResult('❌ Platform scan error: ' + ApiHelpers.handleError(error))
    } finally {
      setLoading(false)
    }
  }

  const testHealthCheck = async () => {
    setLoading(true)
    try {
      const result = await runHealthCheck()
      if (result) {
        addResult(`✅ Health check: ${result.overallStatus} - ${result.uptime}s uptime`)
      } else {
        addResult('❌ Health check failed')
      }
    } catch (error) {
      addResult('❌ Health check error: ' + ApiHelpers.handleError(error))
    } finally {
      setLoading(false)
    }
  }

  const clearResults = () => {
    setTestResults([])
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🧪 API Integration Test Suite</h3>
      
      {/* Test Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <button 
          onClick={testAuthEndpoint}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          Test Auth
        </button>
        <button 
          onClick={testDashboardEndpoint}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          Test Dashboard
        </button>
        <button 
          onClick={testContentEndpoint}
          disabled={loading}
          className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:bg-gray-400"
        >
          Test Content
        </button>
        <button 
          onClick={testPlatformScan}
          disabled={loading}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-400"
        >
          Test Scan
        </button>
        <button 
          onClick={testHealthCheck}
          disabled={loading}
          className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400"
        >
          Test Health
        </button>
        <button 
          onClick={clearResults}
          disabled={loading}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:bg-gray-400"
        >
          Clear Results
        </button>
      </div>

      {/* Data Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded">
          <h4 className="font-medium text-sm text-gray-600">Platform Status</h4>
          <p className="text-sm">
            {platformLoading ? 'Loading...' : platformData ? 'Loaded' : 'Not loaded'}
          </p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <h4 className="font-medium text-sm text-gray-600">System Health</h4>
          <p className="text-sm">
            {healthLoading ? 'Loading...' : healthData ? `${healthData.overallStatus}` : 'Not loaded'}
          </p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <h4 className="font-medium text-sm text-gray-600">Content Data</h4>
          <p className="text-sm">
            {contentLoading ? 'Loading...' : contentData ? `${contentData.length} items` : 'Not loaded'}
          </p>
        </div>
      </div>

      {/* Results Log */}
      <div>
        <h4 className="font-medium text-gray-700 mb-2">Test Results:</h4>
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-64 overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="text-gray-500">No tests run yet. Click buttons above to test API endpoints.</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))
          )}
          {loading && (
            <div className="text-yellow-400 animate-pulse">Running test...</div>
          )}
        </div>
      </div>
    </div>
  )
}