'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface PlatformScanResult {
  platform: string
  status: 'success' | 'partial' | 'failed' | 'pending'
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
  duration: number
  timestamp: string
}

interface ValidationResult {
  platform: string
  totalInDb: number
  approvedInDb: number
  avgConfidence: number
  hasContent: boolean
  hasApprovedContent: boolean
}

interface TestResults {
  scanResults: PlatformScanResult[]
  validationResults: ValidationResult[]
  summary: {
    totalPlatforms: number
    successfulScans: number
    partialScans: number
    failedScans: number
    totalContentFound: number
    totalContentApproved: number
    totalDuration: number
  }
  timestamp: string
}

export default function TestResultsPage() {
  const [results, setResults] = useState<TestResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    loadResults()
  }, [])

  const loadResults = async () => {
    try {
      // Try to load from API endpoint first
      const response = await fetch('/api/test/results')
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      } else {
        // Fallback to checking current status
        const statusResponse = await fetch('/api/test/scan-all')
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          // Create a minimal results object from current status
          setResults({
            scanResults: [],
            validationResults: statusData.validationResults || [],
            summary: {
              totalPlatforms: statusData.summary?.platforms || 8,
              successfulScans: 0,
              partialScans: 0,
              failedScans: 0,
              totalContentFound: statusData.summary?.totalContent || 0,
              totalContentApproved: statusData.summary?.totalApprovedContent || 0,
              totalDuration: 0
            },
            timestamp: new Date().toISOString()
          })
        }
      }
    } catch (error) {
      console.error('Failed to load test results:', error)
    } finally {
      setLoading(false)
    }
  }

  const runScanTest = async () => {
    setIsScanning(true)
    try {
      const response = await fetch('/api/test/scan-all', {
        method: 'POST'
      })
      
      if (response.ok) {
        // Reload results after scan
        setTimeout(() => {
          loadResults()
          setIsScanning(false)
        }, 2000)
      } else {
        setIsScanning(false)
        alert('Scan test failed. Check console for details.')
      }
    } catch (error) {
      console.error('Scan test error:', error)
      setIsScanning(false)
      alert('Scan test failed. Check console for details.')
    }
  }

  const resetDatabase = async () => {
    if (!confirm('This will clear all content data. Are you sure?')) {
      return
    }
    
    alert('Please run: npm run reset-db from the terminal')
  }

  const getStatusColor = (status: 'success' | 'partial' | 'failed' | 'pending') => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getHealthColor = (hasContent: boolean, hasApproved: boolean) => {
    if (hasApproved) return 'text-green-600'
    if (hasContent) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Platform Test Results</h1>
          <p>Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Platform Test Results</h1>
          <div className="flex gap-4">
            <button
              onClick={resetDatabase}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reset Database
            </button>
            <button
              onClick={runScanTest}
              disabled={isScanning}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isScanning ? 'Scanning...' : 'Run Scan Test'}
            </button>
          </div>
        </div>

        {results && (
          <>
            {/* Summary Section */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Test Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-600">Total Platforms</p>
                  <p className="text-2xl font-bold">{results.summary.totalPlatforms}</p>
                </div>
                <div>
                  <p className="text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">{results.summary.successfulScans}</p>
                </div>
                <div>
                  <p className="text-gray-600">Content Found</p>
                  <p className="text-2xl font-bold">{results.summary.totalContentFound}</p>
                </div>
                <div>
                  <p className="text-gray-600">Content Approved</p>
                  <p className="text-2xl font-bold text-blue-600">{results.summary.totalContentApproved}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Last run: {new Date(results.timestamp).toLocaleString()}
                {' • '}
                Duration: {formatDuration(results.summary.totalDuration)}
              </p>
            </div>

            {/* Platform Results Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scan Results
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Database Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(results.scanResults.length > 0 ? results.scanResults : 
                    // If no scan results, create placeholder entries from validation results
                    results.validationResults.map(v => ({
                      platform: v.platform,
                      status: 'pending' as const,
                      totalFound: 0,
                      processed: 0,
                      approved: 0,
                      rejected: 0,
                      duplicates: 0,
                      errors: [],
                      duration: 0,
                      timestamp: new Date().toISOString()
                    }))
                  ).map((scanResult, index) => {
                    const validationResult = results.validationResults.find(
                      v => v.platform === scanResult.platform
                    )
                    
                    return (
                      <tr key={scanResult.platform}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {scanResult.platform}
                            </span>
                            {validationResult && (
                              <span className={`ml-2 ${getHealthColor(
                                validationResult.hasContent,
                                validationResult.hasApprovedContent
                              )}`}>
                                {validationResult.hasApprovedContent ? '✓' : 
                                 validationResult.hasContent ? '○' : '✗'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            getStatusColor(scanResult.status)
                          }`}>
                            {scanResult.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            Found: {scanResult.totalFound} | 
                            Approved: {scanResult.approved} | 
                            Rejected: {scanResult.rejected}
                            {scanResult.duplicates > 0 && ` | Dupes: ${scanResult.duplicates}`}
                          </div>
                          {scanResult.errors.length > 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              {scanResult.errors[0]}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {validationResult ? (
                            <div>
                              Total: {validationResult.totalInDb} | 
                              Approved: {validationResult.approvedInDb}
                            </div>
                          ) : (
                            'No data'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {validationResult && validationResult.avgConfidence > 0 ? (
                            `${validationResult.avgConfidence.toFixed(2)}`
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/api/admin/${scanResult.platform}/test`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Test API
                          </Link>
                          <Link
                            href={`/admin/content?platform=${scanResult.platform}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            View Content
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Legend</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 bg-green-100 rounded"></span>
                  <span>Success - Platform working correctly</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 bg-yellow-100 rounded"></span>
                  <span>Partial - Some errors occurred</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 bg-red-100 rounded"></span>
                  <span>Failed - Platform not working</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Has approved content</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600">○</span>
                  <span>Has content (not approved)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600">✗</span>
                  <span>No content found</span>
                </div>
              </div>
            </div>
          </>
        )}

        {!results && !loading && (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">No test results available. Run a scan test to generate results.</p>
          </div>
        )}
      </div>
    </div>
  )
}