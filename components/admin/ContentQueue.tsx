'use client'

import { useState, useEffect } from 'react'

interface QueuedContent {
  id: string
  title: string
  content_text?: string
  platform: string
  scheduled_for?: Date
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'scheduled' | 'processing'
  created_at: Date
  media_url?: string
  tags: string[]
}

export default function ContentQueue() {
  const [queuedContent, setQueuedContent] = useState<QueuedContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'created_at' | 'priority' | 'scheduled_for'>('created_at')
  const [filterBy, setFilterBy] = useState<'all' | 'pending' | 'scheduled'>('all')

  useEffect(() => {
    fetchQueuedContent()
  }, [sortBy, filterBy])

  const fetchQueuedContent = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        sort: sortBy,
        filter: filterBy
      })
      
      const response = await fetch(`/api/admin/content/queue?${params}`)
      if (response.ok) {
        const data = await response.json()
        setQueuedContent(data)
      } else {
        console.error('Failed to fetch queued content')
      }
    } catch (error) {
      console.error('Error fetching queued content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedItems.size === queuedContent.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(queuedContent.map(item => item.id)))
    }
  }

  const handleBulkAction = async (action: 'approve' | 'delete' | 'schedule') => {
    if (selectedItems.size === 0) return

    try {
      const response = await fetch('/api/admin/content/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          contentIds: Array.from(selectedItems)
        })
      })

      if (response.ok) {
        await fetchQueuedContent()
        setSelectedItems(new Set())
      } else {
        console.error(`Failed to ${action} selected items`)
      }
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error)
    }
  }

  const handleScheduleContent = async (id: string, scheduledFor: Date) => {
    try {
      const response = await fetch(`/api/admin/content/${id}/schedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scheduled_for: scheduledFor.toISOString()
        })
      })

      if (response.ok) {
        await fetchQueuedContent()
      } else {
        console.error('Failed to schedule content')
      }
    } catch (error) {
      console.error('Error scheduling content:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-800'
      case 'scheduled': return 'bg-purple-100 text-purple-800'
      case 'processing': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Queue</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage pending and scheduled content for posting
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={fetchQueuedContent}
          >
            <span className="text-lg mr-2">🔄</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Bulk Actions */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div>
              <label htmlFor="filter" className="text-sm font-medium text-gray-700 mr-2">
                Filter:
              </label>
              <select
                id="filter"
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="border-gray-300 rounded-md text-sm"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            <div>
              <label htmlFor="sort" className="text-sm font-medium text-gray-700 mr-2">
                Sort by:
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border-gray-300 rounded-md text-sm"
              >
                <option value="created_at">Created Date</option>
                <option value="priority">Priority</option>
                <option value="scheduled_for">Scheduled Time</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedItems.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedItems.size} selected
              </span>
              <button
                onClick={() => handleBulkAction('approve')}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleBulkAction('schedule')}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Schedule
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {queuedContent.length > 0 ? (
          <>
            {/* Header */}
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedItems.size === queuedContent.length && queuedContent.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm font-medium text-gray-900">
                  Select All ({queuedContent.length} items)
                </span>
              </div>
            </div>

            {/* Content Items */}
            <div className="divide-y divide-gray-200">
              {queuedContent.map((item) => (
                <div key={item.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    
                    {/* Media preview */}
                    {item.media_url && (
                      <div className="flex-shrink-0">
                        <img
                          src={item.media_url}
                          alt="Content preview"
                          className="h-16 w-16 object-cover rounded-lg"
                        />
                      </div>
                    )}

                    {/* Content details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {item.title || 'Untitled'}
                          </h3>
                          {item.content_text && (
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                              {item.content_text}
                            </p>
                          )}
                          
                          {/* Tags */}
                          {item.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.tags.slice(0, 3).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {item.tags.length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{item.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Status and Priority badges */}
                        <div className="ml-4 flex flex-col items-end space-y-2">
                          <div className="flex space-x-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}>
                              {item.priority}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          
                          <div className="text-xs text-gray-500 text-right">
                            <div>Created: {formatDate(item.created_at)}</div>
                            {item.scheduled_for && (
                              <div>Scheduled: {formatDate(item.scheduled_for)}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const scheduledFor = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
                            handleScheduleContent(item.id, scheduledFor)
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Schedule
                        </button>
                        <span className="text-gray-300">|</span>
                        <button className="text-sm text-green-600 hover:text-green-800">
                          Approve
                        </button>
                        <span className="text-gray-300">|</span>
                        <button className="text-sm text-red-600 hover:text-red-800">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No content in queue</h3>
            <p className="text-gray-600">
              Content will appear here when it&apos;s added to the posting queue.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}