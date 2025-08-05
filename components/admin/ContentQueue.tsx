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
      case 'high': return 'text-danger'
      case 'medium': return 'text-warning'
      case 'low': return 'text-success'
      default: return 'text-muted'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-info'
      case 'scheduled': return 'text-primary'
      case 'processing': return 'text-warning'
      default: return 'text-muted'
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
      <div className="container content-area">
        <div className="text-center">
          <div className="spinner mb-sm"></div>
          <p className="loading">Loading content queue...</p>
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
                  <span>📋</span>
                  Content Queue
                </h1>
                <p className="text-muted">
                  Manage pending and scheduled content for posting
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={fetchQueuedContent}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Bulk Actions */}
        <div className="card">
          <div className="card-body">
            <div className="flex justify-between align-center flex-wrap gap-md">
              {/* Filters */}
              <div className="flex align-center gap-md flex-wrap">
                <div className="flex align-center gap-xs">
                  <label htmlFor="filter" className="text-muted">Filter:</label>
                  <select
                    id="filter"
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value as any)}
                    className="form-select"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div className="flex align-center gap-xs">
                  <label htmlFor="sort" className="text-muted">Sort by:</label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="form-select"
                  >
                    <option value="created_at">Created Date</option>
                    <option value="priority">Priority</option>
                    <option value="scheduled_for">Scheduled Time</option>
                  </select>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedItems.size > 0 && (
                <div className="flex align-center gap-sm">
                  <span className="text-muted">
                    {selectedItems.size} selected
                  </span>
                  <button
                    onClick={() => handleBulkAction('approve')}
                    className="btn btn-success btn-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleBulkAction('schedule')}
                    className="btn btn-primary btn-sm"
                  >
                    Schedule
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="card">
          {queuedContent.length > 0 ? (
            <>
              {/* Header */}
              <div className="card-header">
                <div className="flex align-center gap-sm">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === queuedContent.length && queuedContent.length > 0}
                    onChange={handleSelectAll}
                    className="form-checkbox"
                  />
                  <span>
                    Select All ({queuedContent.length} items)
                  </span>
                </div>
              </div>

              {/* Content Items */}
              <div className="card-body">
                <div className="grid gap-md">
                  {queuedContent.map((item) => (
                    <div key={item.id} className="card">
                      <div className="card-body">
                        <div className="flex align-start gap-md">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                            className="form-checkbox"
                          />
                          
                          {/* Media preview */}
                          {item.media_url && (
                            <div>
                              <img
                                src={item.media_url}
                                alt="Content preview"
                                className="content-image"
                                style={{ width: '64px', height: '64px', objectFit: 'cover' }}
                              />
                            </div>
                          )}

                          {/* Content details */}
                          <div className="flex-1">
                            <div className="flex justify-between align-start">
                              <div className="flex-1">
                                <h3 className="mb-xs">
                                  {item.title || 'Untitled'}
                                </h3>
                                {item.content_text && (
                                  <p className="text-muted mb-sm line-clamp-2">
                                    {item.content_text}
                                  </p>
                                )}
                                
                                {/* Tags */}
                                {item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-xs mb-sm">
                                    {item.tags.slice(0, 3).map((tag, index) => (
                                      <span key={index} className="tag">
                                        #{tag}
                                      </span>
                                    ))}
                                    {item.tags.length > 3 && (
                                      <span className="text-muted">
                                        +{item.tags.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Status and Priority badges */}
                              <div className="text-right">
                                <div className="flex gap-sm mb-xs">
                                  <span className={`tag ${getPriorityColor(item.priority)}`}>
                                    {item.priority}
                                  </span>
                                  <span className={`tag ${getStatusColor(item.status)}`}>
                                    {item.status}
                                  </span>
                                </div>
                                
                                <div className="text-muted text-sm">
                                  <div>Created: {formatDate(item.created_at)}</div>
                                  {item.scheduled_for && (
                                    <div>Scheduled: {formatDate(item.scheduled_for)}</div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-sm mt-sm">
                              <button
                                onClick={() => {
                                  const scheduledFor = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
                                  handleScheduleContent(item.id, scheduledFor)
                                }}
                                className="btn btn-sm"
                              >
                                📅 Schedule
                              </button>
                              <button className="btn btn-sm btn-success">
                                ✅ Approve
                              </button>
                              <button className="btn btn-sm btn-danger">
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card-body text-center">
              <div className="mb-md" style={{ fontSize: '3rem' }}>📭</div>
              <h3 className="mb-sm">No content in queue</h3>
              <p className="text-muted">
                Content will appear here when it's added to the posting queue.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}