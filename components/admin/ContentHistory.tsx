'use client'

import { useState, useEffect } from 'react'

interface HistoryContent {
  id: string
  title: string
  content_text?: string
  platform: string
  status: 'posted' | 'failed' | 'draft'
  posted_at?: Date
  created_at: Date
  media_url?: string
  tags: string[]
  views?: number
  likes?: number
  shares?: number
  comments?: number
  engagement_rate?: number
}

interface FilterOptions {
  status: 'all' | 'posted' | 'failed' | 'draft'
  platform: 'all' | 'instagram' | 'facebook' | 'reddit' | 'tiktok'
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom'
  startDate?: string
  endDate?: string
}

export default function ContentHistory() {
  const [historyContent, setHistoryContent] = useState<HistoryContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    platform: 'all',
    dateRange: 'all'
  })
  const [sortBy, setSortBy] = useState<'posted_at' | 'created_at' | 'engagement_rate'>('posted_at')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchHistoryContent()
  }, [filters, sortBy, currentPage])

  const fetchHistoryContent = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        status: filters.status,
        platform: filters.platform,
        dateRange: filters.dateRange,
        sort: sortBy,
        page: currentPage.toString(),
        limit: '20'
      })

      if (filters.dateRange === 'custom' && filters.startDate && filters.endDate) {
        params.append('startDate', filters.startDate)
        params.append('endDate', filters.endDate)
      }
      
      const response = await fetch(`/api/admin/content/history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setHistoryContent(data.content)
        setTotalPages(data.totalPages)
        setTotalCount(data.totalCount)
      } else {
        console.error('Failed to fetch content history')
      }
    } catch (error) {
      console.error('Error fetching content history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1) // Reset to first page when filters change
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        status: filters.status,
        platform: filters.platform,
        dateRange: filters.dateRange,
        export: 'true'
      })

      if (filters.dateRange === 'custom' && filters.startDate && filters.endDate) {
        params.append('startDate', filters.startDate)
        params.append('endDate', filters.endDate)
      }

      const response = await fetch(`/api/admin/content/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `content-history-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting data:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatEngagement = (content: HistoryContent) => {
    if (!content.views || content.views === 0) return 'No data'
    
    const totalEngagement = (content.likes || 0) + (content.shares || 0) + (content.comments || 0)
    const rate = (totalEngagement / content.views) * 100
    return `${rate.toFixed(1)}%`
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content History</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and analyze posted content performance ({totalCount} items)
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="text-lg mr-2">📤</span>
            Export
          </button>
          <button
            type="button"
            onClick={fetchHistoryContent}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="text-lg mr-2">🔄</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="posted">Posted</option>
              <option value="failed">Failed</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Platform Filter */}
          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-1">
              Platform
            </label>
            <select
              id="platform"
              value={filters.platform}
              onChange={(e) => handleFilterChange('platform', e.target.value)}
              className="w-full border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Platforms</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              id="dateRange"
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="w-full border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full border-gray-300 rounded-md text-sm"
            >
              <option value="posted_at">Posted Date</option>
              <option value="created_at">Created Date</option>
              <option value="engagement_rate">Engagement Rate</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range */}
        {filters.dateRange === 'custom' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Content List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {historyContent.length > 0 ? (
          <>
            <div className="divide-y divide-gray-200">
              {historyContent.map((item) => (
                <div key={item.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-4">
                    {/* Media preview */}
                    {item.media_url && (
                      <div className="flex-shrink-0">
                        <img
                          src={item.media_url}
                          alt="Content preview"
                          className="h-20 w-20 object-cover rounded-lg"
                        />
                      </div>
                    )}

                    {/* Content details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {item.title || 'Untitled'}
                          </h3>
                          {item.content_text && (
                            <p className="mt-1 text-sm text-gray-600 line-clamp-3">
                              {item.content_text}
                            </p>
                          )}
                          
                          {/* Tags */}
                          {item.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.tags.slice(0, 4).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {item.tags.length > 4 && (
                                <span className="text-xs text-gray-500">
                                  +{item.tags.length - 4} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Engagement metrics */}
                          {item.status === 'posted' && (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div className="flex items-center">
                                <span className="text-gray-500 mr-1">👀</span>
                                <span>{item.views?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-gray-500 mr-1">❤️</span>
                                <span>{item.likes?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-gray-500 mr-1">🔄</span>
                                <span>{item.shares?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-gray-500 mr-1">💬</span>
                                <span>{item.comments?.toLocaleString() || 0}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Status and metrics */}
                        <div className="ml-4 flex flex-col items-end space-y-2 text-right">
                          <div className="flex space-x-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {item.platform}
                            </span>
                          </div>
                          
                          <div className="text-xs text-gray-500">
                            {item.posted_at && (
                              <div>Posted: {formatDate(item.posted_at)}</div>
                            )}
                            <div>Created: {formatDate(item.created_at)}</div>
                            {item.status === 'posted' && (
                              <div className="font-medium text-indigo-600">
                                Engagement: {formatEngagement(item)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages} • {totalCount} total items
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
            <p className="text-gray-600">
              No content matches your current filters.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}