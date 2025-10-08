'use client'

import React, { useState, useEffect } from 'react'
import { Clock, Calendar, TrendingUp, AlertCircle, CheckCircle2, Eye } from 'lucide-react'

interface DailyScheduleItem {
  id: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source: string
  scheduled_time: string
  title?: string
  confidence_score?: number
}

interface DailyScheduleData {
  date: string
  scheduled_content: DailyScheduleItem[]
  summary: {
    total_posts: number
    platforms: { [platform: string]: number }
    content_types: { [type: string]: number }
    diversity_score: number
  }
}

interface DailyScheduleOverviewProps {
  selectedDate?: string
  onRefresh?: () => void
}

const PLATFORM_COLORS: { [key: string]: string } = {
  reddit: 'bg-orange-100 text-orange-800',
  bluesky: 'bg-blue-100 text-blue-800',
  tumblr: 'bg-purple-100 text-purple-800',
  lemmy: 'bg-green-100 text-green-800',
  giphy: 'bg-pink-100 text-pink-800',
  imgur: 'bg-gray-100 text-gray-800',
  unknown: 'bg-gray-100 text-gray-600'
}

const CONTENT_TYPE_ICONS: { [key: string]: string } = {
  image: '🖼️',
  video: '🎥',
  text: '📝',
  link: '🔗'
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return 'Invalid time'
  }
}

function getDiversityStatus(score: number): { label: string; color: string; icon: React.ReactNode } {
  if (score >= 80) {
    return {
      label: 'Excellent Diversity',
      color: 'text-green-600',
      icon: <CheckCircle2 className="w-4 h-4" />
    }
  } else if (score >= 60) {
    return {
      label: 'Good Diversity',
      color: 'text-blue-600',
      icon: <TrendingUp className="w-4 h-4" />
    }
  } else if (score >= 40) {
    return {
      label: 'Moderate Diversity',
      color: 'text-yellow-600',
      icon: <AlertCircle className="w-4 h-4" />
    }
  } else {
    return {
      label: 'Low Diversity',
      color: 'text-red-600',
      icon: <AlertCircle className="w-4 h-4" />
    }
  }
}

export default function DailyScheduleOverview({ selectedDate, onRefresh }: DailyScheduleOverviewProps) {
  const [data, setData] = useState<DailyScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetDate = selectedDate || new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchDailySchedule()
  }, [targetDate])

  const fetchDailySchedule = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/admin/schedule/daily?date=${targetDate}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const dailyData: DailyScheduleData = await response.json()
      setData(dailyData)
    } catch (err) {
      console.error('Error fetching daily schedule:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch daily schedule')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchDailySchedule()
    onRefresh?.()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Daily Scheduled Content</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Daily Scheduled Content</h3>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const diversityStatus = getDiversityStatus(data.summary.diversity_score)
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Daily Scheduled Content</h3>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">{data.date}</span>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Posts</p>
              <p className="text-2xl font-bold text-blue-900">{data.summary.total_posts}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Platforms</p>
              <p className="text-2xl font-bold text-green-900">{Object.keys(data.summary.platforms).length}</p>
            </div>
            <div className="text-2xl">🌐</div>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Diversity Score</p>
              <p className="text-2xl font-bold text-purple-900">{data.summary.diversity_score}%</p>
            </div>
            <div className={`flex items-center ${diversityStatus.color}`}>
              {diversityStatus.icon}
            </div>
          </div>
        </div>
      </div>

      {/* Diversity Status */}
      <div className={`flex items-center space-x-2 mb-6 p-3 rounded-lg ${
        data.summary.diversity_score >= 60 ? 'bg-green-50' : 'bg-yellow-50'
      }`}>
        <span className={diversityStatus.color}>{diversityStatus.icon}</span>
        <span className={`font-medium ${diversityStatus.color}`}>{diversityStatus.label}</span>
        {data.summary.diversity_score < 60 && (
          <span className="text-sm text-gray-600">
            - Consider adding more variety in platforms or content types
          </span>
        )}
      </div>

      {/* Scheduled Content List */}
      {data.scheduled_content.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No content scheduled for {data.date}</p>
          <p className="text-sm text-gray-400 mt-2">
            Content will appear here once scheduling is completed
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 mb-3">
            Scheduled Posts ({data.scheduled_content.length})
          </h4>
          
          <div className="overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.scheduled_content.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatTime(item.scheduled_time)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        PLATFORM_COLORS[item.platform] || PLATFORM_COLORS.unknown
                      }`}>
                        {item.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <span className="text-lg">{CONTENT_TYPE_ICONS[item.content_type] || '📄'}</span>
                        <span className="text-sm text-gray-600 capitalize">{item.content_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 truncate max-w-32">
                      {item.source}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-48">
                      {item.title || 'No preview available'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Platform & Content Type Breakdown */}
      {data.summary.total_posts > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform Distribution */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Platform Distribution</h4>
            <div className="space-y-2">
              {Object.entries(data.summary.platforms).map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    PLATFORM_COLORS[platform] || PLATFORM_COLORS.unknown
                  }`}>
                    {platform}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{count} posts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Content Type Distribution */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Content Type Distribution</h4>
            <div className="space-y-2">
              {Object.entries(data.summary.content_types).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{CONTENT_TYPE_ICONS[type] || '📄'}</span>
                    <span className="text-sm capitalize text-gray-900">{type}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count} posts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}