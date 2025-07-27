'use client'

import { useState } from 'react'

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

interface TwitterStatsProps {
  stats: TwitterScanStats
  onRefresh: () => Promise<void>
}

export default function TwitterStats({ stats, onRefresh }: TwitterStatsProps) {
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    try {
      setLoading(true)
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date?: Date) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleString()
  }

  const formatPercentage = (numerator: number, denominator: number) => {
    if (denominator === 0) return '0%'
    return `${((numerator / denominator) * 100).toFixed(1)}%`
  }

  const getApprovalRate = () => {
    return formatPercentage(stats.totalTweetsApproved, stats.totalTweetsProcessed)
  }

  const getProcessingRate = () => {
    return formatPercentage(stats.totalTweetsProcessed, stats.totalTweetsFound)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Twitter Scanning Statistics</h2>
          <p className="text-sm text-gray-600">
            Performance metrics and analytics for Twitter content scanning
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="text-2xl">🔍</div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Total Scans</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalScans.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="text-2xl">🐦</div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Tweets Found</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalTweetsFound.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="text-2xl">✅</div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Tweets Approved</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalTweetsApproved.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="text-2xl">📊</div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Approval Rate</div>
              <div className="text-2xl font-bold text-blue-600">
                {getApprovalRate()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalTweetsProcessed.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Tweets Processed</div>
            <div className="text-xs text-gray-500 mt-1">
              {getProcessingRate()} of found tweets
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.scanFrequency}m
            </div>
            <div className="text-sm text-gray-600">Scan Frequency</div>
            <div className="text-xs text-gray-500 mt-1">
              Every {stats.scanFrequency} minutes
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.averageEngagement.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Avg Engagement</div>
            <div className="text-xs text-gray-500 mt-1">
              Likes + retweets + replies
            </div>
          </div>
        </div>
      </div>

      {/* Scan Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Timeline</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Last Scan</span>
            <span className="text-sm text-gray-900">
              {formatTime(stats.lastScanTime)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Next Scan</span>
            <span className="text-sm text-gray-900">
              {formatTime(stats.nextScanTime)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Scan Interval</span>
            <span className="text-sm text-gray-900">
              Every {stats.scanFrequency} minutes
            </span>
          </div>
        </div>
      </div>

      {/* Top Hashtags */}
      {stats.topHashtags && stats.topHashtags.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Hashtags</h3>
          
          <div className="space-y-3">
            {stats.topHashtags.slice(0, 10).map((hashtag, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-blue-600 font-medium">#{hashtag.hashtag}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ 
                        width: `${Math.min((hashtag.count / (stats.topHashtags[0]?.count || 1)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-8 text-right">
                    {hashtag.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Authors */}
      {stats.topAuthors && stats.topAuthors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Authors</h3>
          
          <div className="space-y-3">
            {stats.topAuthors.slice(0, 10).map((author, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-gray-900 font-medium">@{author.username}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ 
                        width: `${Math.min((author.count / (stats.topAuthors[0]?.count || 1)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-8 text-right">
                    {author.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Data State */}
      {stats.totalScans === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Scan Data Yet</h3>
          <p className="text-gray-600 mb-4">
            Enable Twitter scanning and perform your first scan to see statistics here.
          </p>
        </div>
      )}

      {/* Insights */}
      {stats.totalScans > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-900 mb-2">📈 Insights</h3>
          <div className="space-y-2 text-sm text-blue-800">
            {parseFloat(getApprovalRate()) > 80 && (
              <div className="flex items-start gap-2">
                <span>✅</span>
                <span>High approval rate! Your search queries are finding quality content.</span>
              </div>
            )}
            
            {parseFloat(getApprovalRate()) < 30 && (
              <div className="flex items-start gap-2">
                <span>⚠️</span>
                <span>Low approval rate. Consider refining your search queries or adjusting filters.</span>
              </div>
            )}
            
            {stats.totalTweetsFound > 0 && parseFloat(getProcessingRate()) < 50 && (
              <div className="flex items-start gap-2">
                <span>🔄</span>
                <span>Many tweets found but few processed. Check your filtering criteria.</span>
              </div>
            )}
            
            {stats.totalScans > 5 && stats.totalTweetsApproved === 0 && (
              <div className="flex items-start gap-2">
                <span>🔍</span>
                <span>No tweets approved yet. Consider broadening your search queries or adjusting engagement thresholds.</span>
              </div>
            )}
            
            {stats.scanFrequency > 60 && (
              <div className="flex items-start gap-2">
                <span>⏰</span>
                <span>Consider more frequent scans (< 60 minutes) to catch trending content quickly.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}