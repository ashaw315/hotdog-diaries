'use client'

import { useState, useEffect } from 'react'
import { BulkEditModal } from './BulkEditModal'

interface QueuedContent {
  id: number
  content_text: string | null
  content_image_url: string | null
  content_video_url: string | null
  content_type: string
  source_platform: string
  original_url: string
  original_author: string | null
  scraped_at: string
  content_status: 'discovered' | 'pending_review' | 'approved' | 'scheduled' | 'posted' | 'rejected' | 'archived'
  is_approved: boolean | null
  is_posted: boolean
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  scheduled_for: string | null
  confidence_score: number | null
  is_spam: boolean | null
  is_inappropriate: boolean | null
  is_unrelated: boolean | null
  is_valid_hotdog: boolean | null
}

export default function ContentQueue() {
  const [queuedContent, setQueuedContent] = useState<QueuedContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'scraped_at' | 'confidence_score'>('created_at')
  const [filterBy, setFilterBy] = useState<'all' | 'discovered' | 'pending_review' | 'approved' | 'rejected'>('all')
  const [editingContent, setEditingContent] = useState<number | null>(null)
  const [editText, setEditText] = useState<string>('')
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)

  useEffect(() => {
    fetchQueuedContent()
  }, [sortBy, filterBy])

  const fetchQueuedContent = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        sort: sortBy,
        status: filterBy === 'all' ? 'all' : filterBy,
        order: 'desc',
        limit: '50'
      })
      
      const response = await fetch(`/api/admin/content/queue?${params}`)
      if (response.ok) {
        const data = await response.json()
        setQueuedContent(data.content || [])
      } else {
        console.error('Failed to fetch queued content')
      }
    } catch (error) {
      console.error('Error fetching queued content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectItem = (id: number) => {
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

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedItems.size === 0) return

    try {
      const updates = Array.from(selectedItems).map(async (id) => {
        const content_status = action === 'approve' ? 'approved' : 'rejected'
        const rejection_reason = action === 'reject' ? 'Bulk rejection' : undefined
        
        return fetch(`/api/admin/content/queue?id=${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content_status,
            rejection_reason
          })
        })
      })

      await Promise.all(updates)
      await fetchQueuedContent()
      setSelectedItems(new Set())
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error)
    }
  }

  const handleUpdateContent = async (id: number, updates: Partial<QueuedContent>) => {
    try {
      const response = await fetch(`/api/admin/content/queue?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        await fetchQueuedContent()
        if (editingContent === id) {
          setEditingContent(null)
          setEditText('')
        }
      } else {
        console.error('Failed to update content')
      }
    } catch (error) {
      console.error('Error updating content:', error)
    }
  }

  const handleStartEdit = (content: QueuedContent) => {
    setEditingContent(content.id)
    setEditText(content.content_text || '')
  }

  const handleSaveEdit = async () => {
    if (editingContent) {
      await handleUpdateContent(editingContent, { content_text: editText })
    }
  }

  const handleCancelEdit = () => {
    setEditingContent(null)
    setEditText('')
  }

  const handleBulkEdit = async (changes: any) => {
    try {
      if (changes.action === 'status') {
        // Handle status changes
        const updates = Array.from(selectedItems).map(async (id) => {
          return fetch(`/api/admin/content/queue?id=${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content_status: changes.content_status,
              rejection_reason: changes.rejection_reason
            })
          })
        })
        await Promise.all(updates)
      } else if (changes.action === 'schedule') {
        // Handle bulk scheduling
        const response = await fetch('/api/admin/content/bulk-schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contentIds: Array.from(selectedItems),
            scheduleType: changes.scheduleType,
            customDateTime: changes.customDateTime,
            distributionHours: changes.distributionHours
          })
        })
        if (!response.ok) {
          throw new Error('Failed to schedule content')
        }
      } else if (changes.action === 'text_edit') {
        // Handle text editing
        const content = queuedContent.filter(item => selectedItems.has(item.id))
        const updates = content.map(async (item) => {
          let newText = item.content_text || ''
          
          switch (changes.textOperation) {
            case 'prefix':
              newText = changes.textValue + ' ' + newText
              break
            case 'suffix':
              newText = newText + ' ' + changes.textValue
              break
            case 'replace':
              newText = changes.textValue
              break
            case 'find_replace':
              newText = newText.replace(new RegExp(changes.findText, 'g'), changes.replaceText)
              break
          }
          
          return fetch(`/api/admin/content/queue?id=${item.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content_text: newText
            })
          })
        })
        await Promise.all(updates)
      }
      
      await fetchQueuedContent()
      setSelectedItems(new Set())
      setShowBulkEditModal(false)
    } catch (error) {
      console.error('Bulk edit failed:', error)
      throw error
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'discovered': return 'text-info'
      case 'pending_review': return 'text-warning'
      case 'approved': return 'text-success'
      case 'scheduled': return 'text-primary'
      case 'posted': return 'text-muted'
      case 'rejected': return 'text-danger'
      case 'archived': return 'text-muted'
      default: return 'text-muted'
    }
  }

  const getConfidenceColor = (score: number | null) => {
    if (!score) return 'text-muted'
    if (score >= 0.8) return 'text-success'
    if (score >= 0.6) return 'text-warning'
    return 'text-danger'
  }

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return '🖼️'
      case 'video': return '🎥'
      case 'text': return '📝'
      case 'mixed': return '🎭'
      default: return '📄'
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
                    <option value="discovered">Discovered</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
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
                    <option value="updated_at">Updated Date</option>
                    <option value="confidence_score">Confidence Score</option>
                    <option value="scraped_at">Scraped Date</option>
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
                    onClick={() => handleBulkAction('reject')}
                    className="btn btn-danger btn-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setShowBulkEditModal(true)}
                    className="btn btn-primary btn-sm"
                  >
                    📝 Bulk Edit
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
                          {item.content_image_url && (
                            <div>
                              <img
                                src={item.content_image_url}
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
                                <div className="flex align-center gap-sm mb-xs">
                                  <span>{getContentTypeIcon(item.content_type)}</span>
                                  <span className="tag">{item.source_platform}</span>
                                  <span className={`tag ${getStatusColor(item.content_status)}`}>
                                    {item.content_status.replace('_', ' ')}
                                  </span>
                                  {item.confidence_score && (
                                    <span className={`tag ${getConfidenceColor(item.confidence_score)}`}>
                                      {Math.round(item.confidence_score * 100)}% confidence
                                    </span>
                                  )}
                                </div>
                                
                                {editingContent === item.id ? (
                                  <div className="mb-sm">
                                    <textarea
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="form-textarea w-full"
                                      rows={4}
                                      placeholder="Edit content text..."
                                    />
                                    <div className="flex gap-xs mt-xs">
                                      <button
                                        onClick={handleSaveEdit}
                                        className="btn btn-sm btn-success"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        className="btn btn-sm"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mb-sm">
                                    {item.content_text && (
                                      <p className="text-muted mb-sm line-clamp-3">
                                        {item.content_text}
                                      </p>
                                    )}
                                    <div className="text-sm text-muted">
                                      <div>Author: {item.original_author}</div>
                                      <a 
                                        href={item.original_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                      >
                                        View Original
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Timestamps and details */}
                              <div className="text-right">
                                <div className="text-muted text-sm">
                                  <div>Created: {formatDate(new Date(item.created_at))}</div>
                                  <div>Updated: {formatDate(new Date(item.updated_at))}</div>
                                  {item.scheduled_for && (
                                    <div>Scheduled: {formatDate(new Date(item.scheduled_for))}</div>
                                  )}
                                  {item.reviewed_at && (
                                    <div>Reviewed: {formatDate(new Date(item.reviewed_at))}</div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-sm mt-sm flex-wrap">
                              {editingContent !== item.id && (
                                <button
                                  onClick={() => handleStartEdit(item)}
                                  className="btn btn-sm"
                                  disabled={item.content_status === 'posted'}
                                >
                                  ✏️ Edit
                                </button>
                              )}
                              
                              {item.content_status === 'pending_review' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateContent(item.id, { content_status: 'approved' })}
                                    className="btn btn-sm btn-success"
                                  >
                                    ✅ Approve
                                  </button>
                                  <button
                                    onClick={() => handleUpdateContent(item.id, { content_status: 'rejected', rejection_reason: 'Manual review rejection' })}
                                    className="btn btn-sm btn-danger"
                                  >
                                    ❌ Reject
                                  </button>
                                </>
                              )}
                              
                              {item.content_status === 'approved' && (
                                <button
                                  onClick={() => handleUpdateContent(item.id, { 
                                    content_status: 'scheduled',
                                    scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                                  })}
                                  className="btn btn-sm btn-primary"
                                >
                                  📅 Schedule
                                </button>
                              )}
                              
                              {item.content_status !== 'posted' && (
                                <button
                                  onClick={() => handleUpdateContent(item.id, { content_status: 'archived' })}
                                  className="btn btn-sm btn-warning"
                                >
                                  🗄️ Archive
                                </button>
                              )}
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
              <h3 className="mb-sm">No content found</h3>
              <p className="text-muted">
                No content matches the current filter. Try changing the filter or running a content scan.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        selectedCount={selectedItems.size}
        onBulkEdit={handleBulkEdit}
      />
    </div>
  )
}