'use client'

import { useState } from 'react'

interface FlaggedContent {
  id: number
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  content_type: string
  source_platform: string
  original_url: string
  original_author?: string
  is_spam: boolean
  is_inappropriate: boolean
  is_unrelated: boolean
  confidence_score: number
  flagged_patterns: string[]
  flagged_reason: string
  processing_notes: string[]
  created_at: string
  flagged_at: string
}

interface ReviewQueueProps {
  flaggedContent: FlaggedContent[]
  onReviewAction: (contentId: number, action: 'approve' | 'reject', reason?: string, notes?: string) => Promise<void>
  onBulkAction: (contentIds: number[], action: 'approve' | 'reject', reason?: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export function ReviewQueue({ flaggedContent, onReviewAction, onBulkAction, onRefresh }: ReviewQueueProps) {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [loading, setLoading] = useState<number | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [reviewNotes, setReviewNotes] = useState<{ [key: number]: string }>({})
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  const handleItemSelect = (contentId: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(contentId)) {
      newSelected.delete(contentId)
    } else {
      newSelected.add(contentId)
    }
    setSelectedItems(newSelected)
    setShowBulkActions(newSelected.size > 0)
  }

  const handleSelectAll = () => {
    if (selectedItems.size === flaggedContent.length) {
      setSelectedItems(new Set())
      setShowBulkActions(false)
    } else {
      setSelectedItems(new Set(flaggedContent.map(item => item.id)))
      setShowBulkActions(true)
    }
  }

  const handleReviewAction = async (contentId: number, action: 'approve' | 'reject') => {
    try {
      setLoading(contentId)
      const notes = reviewNotes[contentId] || ''
      await onReviewAction(contentId, action, '', notes)
      
      // Remove from selected items
      const newSelected = new Set(selectedItems)
      newSelected.delete(contentId)
      setSelectedItems(newSelected)
      setShowBulkActions(newSelected.size > 0)
      
      // Clear notes
      const newNotes = { ...reviewNotes }
      delete newNotes[contentId]
      setReviewNotes(newNotes)
    } catch (err) {
      console.error('Review action failed:', err)
    } finally {
      setLoading(null)
    }
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    try {
      setBulkLoading(true)
      const reason = action === 'approve' ? 'Bulk approval' : 'Bulk rejection'
      await onBulkAction(Array.from(selectedItems), action, reason)
      
      setSelectedItems(new Set())
      setShowBulkActions(false)
    } catch (err) {
      console.error('Bulk action failed:', err)
    } finally {
      setBulkLoading(false)
    }
  }

  const toggleExpanded = (contentId: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(contentId)) {
      newExpanded.delete(contentId)
    } else {
      newExpanded.add(contentId)
    }
    setExpandedItems(newExpanded)
  }

  const getContentPreview = (content: FlaggedContent) => {
    if (content.content_text) {
      return content.content_text.length > 150 
        ? content.content_text.substring(0, 150) + '...'
        : content.content_text
    }
    return `${content.content_type} content from ${content.source_platform}`
  }

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return '🖼️'
      case 'video':
        return '🎥'
      case 'text':
        return '📝'
      default:
        return '📄'
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return '📸'
      case 'facebook':
        return '📘'
      case 'reddit':
        return '🤖'
      case 'tiktok':
        return '🎵'
      default:
        return '🌐'
    }
  }

  const getFlagReasonColor = (content: FlaggedContent) => {
    if (content.is_spam) return 'bg-red-100 text-red-800'
    if (content.is_inappropriate) return 'bg-orange-100 text-orange-800'
    if (content.is_unrelated) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getFlagReasonIcon = (content: FlaggedContent) => {
    if (content.is_spam) return '🚫'
    if (content.is_inappropriate) return '⚠️'
    if (content.is_unrelated) return '🔄'
    return '🚩'
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Review Queue</h2>
          <p className="text-sm text-gray-600">
            {flaggedContent.length} items flagged for review
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedItems.size} items selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('approve')}
                disabled={bulkLoading}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {bulkLoading ? 'Processing...' : 'Approve All'}
              </button>
              <button
                onClick={() => handleBulkAction('reject')}
                disabled={bulkLoading}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {bulkLoading ? 'Processing...' : 'Reject All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select All */}
      {flaggedContent.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={selectedItems.size === flaggedContent.length}
            onChange={handleSelectAll}
            className="rounded border-gray-300"
          />
          <label className="text-sm text-gray-700">
            Select all ({flaggedContent.length} items)
          </label>
        </div>
      )}

      {/* Content List */}
      <div className="space-y-4">
        {flaggedContent.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl mb-4 block">🎉</span>
            <p className="text-lg font-medium">No items to review!</p>
            <p className="text-sm">All content has been processed.</p>
          </div>
        ) : (
          flaggedContent.map((content) => (
            <div key={content.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-start gap-4">
                {/* Selection Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedItems.has(content.id)}
                  onChange={() => handleItemSelect(content.id)}
                  className="mt-1 rounded border-gray-300"
                />

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getContentTypeIcon(content.content_type)}</span>
                    <span className="text-lg">{getPlatformIcon(content.source_platform)}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(content.created_at).toLocaleString()}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFlagReasonColor(content)}`}>
                      {getFlagReasonIcon(content)} {content.flagged_reason}
                    </span>
                  </div>

                  <div className="mb-2">
                    <p className="text-gray-900 text-sm">
                      {getContentPreview(content)}
                    </p>
                  </div>

                  {/* Flagged Patterns */}
                  {content.flagged_patterns.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">Flagged patterns:</p>
                      <div className="flex flex-wrap gap-1">
                        {content.flagged_patterns.map((pattern, index) => (
                          <span key={index} className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    {content.original_author && (
                      <span>By: {content.original_author}</span>
                    )}
                    <span>Confidence: {(content.confidence_score * 100).toFixed(1)}%</span>
                    <button
                      onClick={() => toggleExpanded(content.id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {expandedItems.has(content.id) ? 'Less' : 'More'} details
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {expandedItems.has(content.id) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong>Source:</strong> 
                          <a href={content.original_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-1">
                            {content.original_url}
                          </a>
                        </div>
                        
                        {content.processing_notes.length > 0 && (
                          <div>
                            <strong>Processing Notes:</strong>
                            <ul className="list-disc list-inside ml-4 mt-1">
                              {content.processing_notes.map((note, index) => (
                                <li key={index} className="text-gray-600">{note}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {content.content_image_url && (
                          <div>
                            <strong>Image:</strong>
                            <img 
                              src={content.content_image_url} 
                              alt="Content" 
                              className="mt-1 max-w-xs rounded border"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {content.content_video_url && (
                          <div>
                            <strong>Video:</strong>
                            <a href={content.content_video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-1">
                              {content.content_video_url}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Review Notes */}
                  <div className="mb-3">
                    <textarea
                      value={reviewNotes[content.id] || ''}
                      onChange={(e) => setReviewNotes(prev => ({
                        ...prev,
                        [content.id]: e.target.value
                      }))}
                      placeholder="Add review notes (optional)..."
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      rows={2}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReviewAction(content.id, 'approve')}
                      disabled={loading === content.id}
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading === content.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReviewAction(content.id, 'reject')}
                      disabled={loading === content.id}
                      className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading === content.id ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}