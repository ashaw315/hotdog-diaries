'use client'

import { useState, useEffect, useMemo } from 'react'
import { BulkEditModal } from './BulkEditModal'
import { authFetch } from '@/lib/auth-fetch'
import { useContentData } from '@/hooks/useAdminData'
import { useUrlSort, SORT_CONFIGS } from '@/hooks/useUrlSort'
import { ScheduleBadge } from './ScheduleBadge'
import { getETTimeString } from '@/lib/design-tokens/schedule-badges'

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
  scheduled_post_time: string | null
  confidence_score: number | null
  is_spam: boolean | null
  is_inappropriate: boolean | null
  is_unrelated: boolean | null
  is_valid_hotdog: boolean | null
}

export default function ContentQueue() {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [filterBy, setFilterBy] = useState<'all' | 'discovered' | 'pending_review' | 'approved' | 'scheduled' | 'rejected'>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [editingContent, setEditingContent] = useState<number | null>(null)
  const [editText, setEditText] = useState<string>('')
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)

  // URL-persisted sort state - default to scheduled_post_time ascending for schedule view
  const {
    sortBy,
    direction,
    setSortWithToggle,
    getSortIndicator,
    isSorted
  } = useUrlSort(SORT_CONFIGS.schedule)

  // Map the filterBy values to the hook's expected status values
  const getHookStatus = (filter: string) => {
    switch (filter) {
      case 'discovered': return 'pending' // Map discovered to pending (not approved)
      case 'pending_review': return 'pending'
      case 'approved': return 'approved'
      case 'scheduled': return 'scheduled'
      case 'rejected': return 'rejected'
      case 'posted': return 'posted'
      default: return undefined
    }
  }

  // Use the hook for content data management
  const {
    data: queuedContent,
    loading: isLoading,
    error: contentError,
    refresh,
    updateContentStatus
  } = useContentData({
    page: 1,
    limit: 200, // Increased from 50 to show more content
    status: getHookStatus(filterBy),
    platform: platformFilter !== 'all' ? platformFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    autoRefresh: true
  })

  // 🧩 Diagnostic logging for queue rendering
  useEffect(() => {
    console.group('🧩 [Queue Render] ContentQueue useEffect')
    console.log('Current filter:', filterBy)
    console.log('Hook status filter:', getHookStatus(filterBy))
    console.log('Queue data length:', queuedContent?.length)
    console.log('Queue first item:', queuedContent?.[0])
    console.log('Loading state:', isLoading)
    console.log('Error state:', contentError)
    console.groupEnd()
  }, [filterBy, queuedContent, isLoading, contentError])

  // Smart sorting: auto-adjust sort based on filter
  useEffect(() => {
    if (filterBy === 'discovered' || filterBy === 'pending_review') {
      // Discovered content: show newest first
      if (sortBy !== 'scraped_at') {
        setSortWithToggle('scraped_at')
      }
    } else if (filterBy === 'approved') {
      // Approved content: FIFO (oldest first)
      if (sortBy !== 'created_at') {
        setSortWithToggle('created_at')
      }
    } else if (filterBy === 'scheduled') {
      // Scheduled content: soonest first
      if (sortBy !== 'scheduled_post_time') {
        setSortWithToggle('scheduled_post_time')
      }
    }
  }, [filterBy, sortBy, setSortWithToggle])

  // Refresh when sort or filter changes
  useEffect(() => {
    refresh()
  }, [sortBy, direction, filterBy, platformFilter, typeFilter, refresh])

  // Replace the manual fetchQueuedContent with the hook's refresh function
  const fetchQueuedContent = refresh

  // Fetch distribution stats from ALL content (not just paginated results)
  const [allDistributionStats, setAllDistributionStats] = useState<{
    platforms: Record<string, number>
    contentTypes: Record<string, number>
    total: number
  }>({ platforms: {}, contentTypes: {}, total: 0 })

  // Fetch full distribution stats when filters change
  useEffect(() => {
    const fetchDistributionStats = async () => {
      try {
        const params = new URLSearchParams()
        if (getHookStatus(filterBy)) params.set('status', getHookStatus(filterBy)!)
        if (platformFilter !== 'all') params.set('platform', platformFilter)
        if (typeFilter !== 'all') params.set('type', typeFilter)

        // Fetch with high limit to get all items for stats
        params.set('limit', '10000')
        params.set('page', '1')

        const response = await authFetch(`/api/admin/content?${params}`)
        if (response.ok) {
          const data = await response.json()
          const content = data.data?.content || []

          const platforms: Record<string, number> = {}
          const contentTypes: Record<string, number> = {}

          content.forEach((item: QueuedContent) => {
            platforms[item.source_platform] = (platforms[item.source_platform] || 0) + 1
            contentTypes[item.content_type] = (contentTypes[item.content_type] || 0) + 1
          })

          setAllDistributionStats({
            platforms,
            contentTypes,
            total: content.length
          })
        }
      } catch (error) {
        console.error('Failed to fetch distribution stats:', error)
      }
    }

    fetchDistributionStats()
  }, [filterBy, platformFilter, typeFilter])

  // Use the full distribution stats instead of just paginated results
  const distributionStats = allDistributionStats

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
        
        return authFetch(`/api/admin/content?id=${id}`, {
          method: 'PATCH',
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
      // If it's a status update, use the hook's method
      if (updates.content_status) {
        const success = await updateContentStatus(id, updates.content_status as any, {
          reason: updates.rejection_reason
        })
        if (success && editingContent === id) {
          setEditingContent(null)
          setEditText('')
        }
      } else {
        // For other updates (like text editing), use manual API call
        const response = await authFetch(`/api/admin/content?id=${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates)
        })

        if (response.ok) {
          await refresh()
          if (editingContent === id) {
            setEditingContent(null)
            setEditText('')
          }
        } else {
          console.error('Failed to update content')
        }
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

  const handleReconcileContent = async (contentId: number) => {
    try {
      const response = await authFetch(`/api/admin/content/${contentId}/reconcile`, {
        method: 'POST'
      })

      if (response.ok) {
        await refresh()
      } else {
        console.error('Failed to reconcile content')
      }
    } catch (error) {
      console.error('Error reconciling content:', error)
    }
  }

  const handleBulkEdit = async (changes: any) => {
    try {
      if (changes.action === 'status') {
        // Handle status changes
        const updates = Array.from(selectedItems).map(async (id) => {
          return authFetch(`/api/admin/content?id=${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              content_status: changes.content_status,
              rejection_reason: changes.rejection_reason
            })
          })
        })
        await Promise.all(updates)
      } else if (changes.action === 'schedule') {
        // Handle bulk scheduling
        const response = await authFetch('/api/admin/content/bulk', {
          method: 'POST',
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
          
          return authFetch(`/api/admin/content?id=${item.id}`, {
            method: 'PATCH',
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

  const formatScheduledDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Error state with retry option
  if (contentError) {
    return (
      <>
        <style jsx>{`
          .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            padding: 40px;
            text-align: center;
          }
          
          .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          
          .error-title {
            color: #dc2626;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          
          .error-message {
            color: #6b7280;
            font-size: 16px;
            margin-bottom: 20px;
          }
          
          .retry-btn {
            padding: 12px 24px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
          }
          
          .retry-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          }
        `}</style>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">Content Queue Error</h2>
          <p className="error-message">{contentError}</p>
          <button onClick={refresh} className="retry-btn">
            🔄 Retry Loading
          </button>
        </div>
      </>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            padding: 40px;
          }
          
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e5e7eb;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          
          .loading-text {
            color: #6b7280;
            font-size: 16px;
            margin: 0;
          }
        `}</style>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading content queue...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <style jsx>{`
        .queue-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        
        .queue-section {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .section-header {
          padding: 24px;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        
        .header-info h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 8px 0;
        }
        
        .header-description {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }
        
        .refresh-btn {
          padding: 10px 20px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .refresh-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        
        .section-body {
          padding: 24px;
        }
        
        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .filters-group {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .filter-label {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }
        
        .filter-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          color: #374151;
          font-size: 14px;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        
        .filter-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .bulk-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .selected-count {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }
        
        .action-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .action-btn-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        
        .action-btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }
        
        .action-btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
        }
        
        .action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        
        .list-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .select-checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        
        .select-all-text {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }
        
        .content-list {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .content-item {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          transition: all 0.2s ease;
        }
        
        .content-item:hover {
          border-color: #d1d5db;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .item-main {
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }
        
        .media-preview {
          flex-shrink: 0;
          width: 80px;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .preview-image, .preview-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .preview-placeholder {
          font-size: 24px;
          color: #9ca3af;
        }
        
        .youtube-preview {
          position: relative;
        }
        
        .play-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        
        .item-content {
          flex: 1;
          min-width: 0;
        }
        
        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        
        .content-main {
          flex: 1;
          min-width: 0;
        }
        
        .content-tags {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        
        .content-tag {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }
        
        .tag-platform {
          background: #e0e7ff;
          color: #3730a3;
        }
        
        .tag-discovered {
          background: #dbeafe;
          color: #1e40af;
        }
        
        .tag-pending {
          background: #fef3c7;
          color: #d97706;
        }
        
        .tag-approved {
          background: #d1fae5;
          color: #065f46;
        }
        
        .tag-scheduled {
          background: #e9d5ff;
          color: #6b21a8;
        }
        
        .tag-posted {
          background: #f3f4f6;
          color: #4b5563;
        }
        
        .tag-rejected {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .tag-archived {
          background: #f9fafb;
          color: #6b7280;
        }
        
        .tag-confidence-high {
          background: #d1fae5;
          color: #065f46;
        }
        
        .tag-confidence-med {
          background: #fef3c7;
          color: #d97706;
        }
        
        .tag-confidence-low {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .tag-scheduled-time {
          background: linear-gradient(135deg, #e3f2ff 0%, #cce7ff 100%);
          color: #0066cc;
          font-weight: 600;
          border: 1px solid #b3d9ff;
          border-radius: 0.5rem;
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          box-shadow: 0 1px 3px rgba(0, 102, 204, 0.12);
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .tag-scheduled-time:hover {
          background: linear-gradient(135deg, #cce7ff 0%, #b3d9ff 100%);
          box-shadow: 0 2px 6px rgba(0, 102, 204, 0.2);
          transform: translateY(-1px);
        }
        
        .reconcile-warning {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 1px solid #f59e0b;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(245, 158, 11, 0.12);
        }
        
        .warning-icon {
          color: #d97706;
          font-weight: 600;
          font-size: 1rem;
        }
        
        .reconcile-btn {
          padding: 0.25rem 0.5rem;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .reconcile-btn:hover {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(217, 119, 6, 0.25);
        }
        
        .content-text {
          margin: 12px 0;
          color: #374151;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .content-meta {
          font-size: 13px;
          color: #6b7280;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .meta-link {
          color: #3b82f6;
          text-decoration: none;
          transition: color 0.2s;
        }
        
        .meta-link:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }
        
        .edit-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          resize: vertical;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        
        .edit-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .edit-actions {
          display: flex;
          gap: 8px;
        }
        
        .timestamps {
          text-align: right;
          font-size: 12px;
          color: #6b7280;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .scheduled-time-detail {
          color: #059669;
          font-weight: 500;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        }
        
        .action-buttons {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }
        
        .empty-icon {
          font-size: 4rem;
          margin-bottom: 20px;
        }
        
        .empty-title {
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 8px;
        }
        
        .empty-description {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.5;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
          .queue-container {
            padding: 16px;
          }
          
          .section-header {
            padding: 20px;
          }
          
          .header-content {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }
          
          .controls-row {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }
          
          .filters-group {
            justify-content: center;
          }
          
          .bulk-actions {
            justify-content: center;
          }
          
          .item-main {
            flex-direction: column;
            gap: 12px;
          }
          
          .content-header {
            flex-direction: column;
            gap: 12px;
          }
          
          .timestamps {
            text-align: left;
          }
          
          .action-buttons {
            justify-content: center;
          }
        }
      `}</style>
      
      <div className="queue-container" data-testid="content-queue">
        {/* Header */}
        <div className="queue-section">
          <div className="section-header">
            <div className="header-content">
              <div className="header-info">
                <h1>
                  <span>📋</span>
                  Content Queue
                </h1>
                <p className="header-description">
                  Manage pending and scheduled content for posting
                </p>
              </div>
              <button
                type="button"
                className="refresh-btn"
                onClick={fetchQueuedContent}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Toggles */}
        <div className="queue-section">
          <div className="section-body">
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  setFilterBy('discovered')
                  setPlatformFilter('all')
                  setTypeFilter('all')
                }}
                style={{
                  padding: '12px 24px',
                  border: filterBy === 'discovered' ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  background: filterBy === 'discovered' ? '#eff6ff' : 'white',
                  color: filterBy === 'discovered' ? '#1e40af' : '#374151',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📥 Discovered
              </button>
              <button
                onClick={() => {
                  setFilterBy('approved')
                  setPlatformFilter('all')
                  setTypeFilter('all')
                }}
                style={{
                  padding: '12px 24px',
                  border: filterBy === 'approved' ? '2px solid #10b981' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  background: filterBy === 'approved' ? '#d1fae5' : 'white',
                  color: filterBy === 'approved' ? '#065f46' : '#374151',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                ✅ Approved
              </button>
              <button
                onClick={() => {
                  setFilterBy('scheduled')
                  setPlatformFilter('all')
                  setTypeFilter('all')
                }}
                style={{
                  padding: '12px 24px',
                  border: filterBy === 'scheduled' ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  background: filterBy === 'scheduled' ? '#ede9fe' : 'white',
                  color: filterBy === 'scheduled' ? '#6b21a8' : '#374151',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📅 Scheduled
              </button>
              <button
                onClick={() => {
                  setFilterBy('all')
                  setPlatformFilter('all')
                  setTypeFilter('all')
                }}
                style={{
                  padding: '12px 24px',
                  border: filterBy === 'all' ? '2px solid #6b7280' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  background: filterBy === 'all' ? '#f3f4f6' : 'white',
                  color: filterBy === 'all' ? '#1f2937' : '#374151',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📋 All Content
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Bulk Actions */}
        <div className="queue-section">
          <div className="section-body">
            <div className="controls-row">
              {/* Filters */}
              <div className="filters-group">
                <div className="filter-group">
                  <label htmlFor="filter" className="filter-label">Filter:</label>
                  <select
                    id="filter"
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value as any)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="discovered">Discovered</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="platform" className="filter-label">Platform:</label>
                  <select
                    id="platform"
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Platforms</option>
                    {Object.keys(distributionStats.platforms)
                      .sort()
                      .map(platform => (
                        <option key={platform} value={platform}>
                          {platform} ({distributionStats.platforms[platform]})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="type" className="filter-label">Type:</label>
                  <select
                    id="type"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Types</option>
                    {Object.keys(distributionStats.contentTypes)
                      .sort()
                      .map(type => (
                        <option key={type} value={type}>
                          {getContentTypeIcon(type)} {type} ({distributionStats.contentTypes[type]})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="sort" className="filter-label">Sort by:</label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortWithToggle(e.target.value as any)}
                    className="filter-select"
                  >
                    <option value="scheduled_post_time">Scheduled (ET) {getSortIndicator('scheduled_post_time')}</option>
                    <option value="created_at">Created Date {getSortIndicator('created_at')}</option>
                    <option value="updated_at">Updated Date {getSortIndicator('updated_at')}</option>
                    <option value="confidence_score">Confidence Score {getSortIndicator('confidence_score')}</option>
                    <option value="scraped_at">Scraped Date {getSortIndicator('scraped_at')}</option>
                  </select>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedItems.size > 0 && (
                <div className="bulk-actions">
                  <span className="selected-count">
                    {selectedItems.size} selected
                  </span>
                  <button
                    onClick={() => handleBulkAction('approve')}
                    className="action-btn action-btn-success"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleBulkAction('reject')}
                    className="action-btn action-btn-danger"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setShowBulkEditModal(true)}
                    className="action-btn action-btn-primary"
                  >
                    📝 Bulk Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Distribution Stats */}
        {distributionStats.total > 0 && (
          <div className="queue-section">
            <div className="section-header">
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📊 Content Distribution
              </h3>
            </div>
            <div className="section-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px'
              }}>
                {/* Platform Distribution */}
                <div>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '16px'
                  }}>
                    By Platform
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(distributionStats.platforms)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([platform, count]) => {
                        const percentage = ((count as number) / distributionStats.total * 100).toFixed(1)
                        return (
                          <div
                            key={platform}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              background: '#f9fafb',
                              borderRadius: '6px',
                              border: '1px solid #e5e7eb'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#1f2937',
                                textTransform: 'capitalize'
                              }}>
                                {platform}
                              </span>
                              <div style={{
                                flex: 1,
                                height: '6px',
                                background: '#e5e7eb',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                maxWidth: '120px'
                              }}>
                                <div style={{
                                  height: '100%',
                                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                  width: `${percentage}%`,
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              minWidth: '100px',
                              justifyContent: 'flex-end'
                            }}>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#3b82f6'
                              }}>
                                {count}
                              </span>
                              <span style={{
                                fontSize: '12px',
                                color: '#6b7280'
                              }}>
                                ({percentage}%)
                              </span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Content Type Distribution */}
                <div>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '16px'
                  }}>
                    By Content Type
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(distributionStats.contentTypes)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([type, count]) => {
                        const percentage = ((count as number) / distributionStats.total * 100).toFixed(1)
                        const icon = getContentTypeIcon(type)
                        return (
                          <div
                            key={type}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              background: '#f9fafb',
                              borderRadius: '6px',
                              border: '1px solid #e5e7eb'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <span style={{ fontSize: '18px' }}>{icon}</span>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#1f2937',
                                textTransform: 'capitalize'
                              }}>
                                {type}
                              </span>
                              <div style={{
                                flex: 1,
                                height: '6px',
                                background: '#e5e7eb',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                maxWidth: '120px'
                              }}>
                                <div style={{
                                  height: '100%',
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  width: `${percentage}%`,
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              minWidth: '100px',
                              justifyContent: 'flex-end'
                            }}>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#10b981'
                              }}>
                                {count}
                              </span>
                              <span style={{
                                fontSize: '12px',
                                color: '#6b7280'
                              }}>
                                ({percentage}%)
                              </span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="queue-section">
          {queuedContent.length > 0 ? (
            <>
              {/* List Header */}
              <div className="list-header">
                <input
                  type="checkbox"
                  checked={selectedItems.size === queuedContent.length && queuedContent.length > 0}
                  onChange={handleSelectAll}
                  className="select-checkbox"
                />
                <span className="select-all-text">
                  Select All
                </span>
              </div>

              {/* Content Items */}
              <div className="content-list">
                {queuedContent.map((item) => (
                  <div key={item.id} className="content-item" data-testid="content-item">
                    <div className="item-main">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="select-checkbox"
                      />
                      
                      {/* Media preview */}
                      <div className="media-preview">
                        {item.content_video_url ? (
                          <>
                            {/* For YouTube videos, show thumbnail instead of trying to embed */}
                            {item.content_video_url.includes('youtube.com/watch') && item.content_image_url ? (
                              <div className="youtube-preview">
                                <img
                                  src={item.content_image_url}
                                  alt="Video thumbnail"
                                  className="preview-image"
                                />
                                <div className="play-overlay">▶</div>
                              </div>
                            ) : 
                            /* For direct video files */
                            item.content_video_url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
                              <video
                                src={item.content_video_url}
                                muted
                                loop
                                className="preview-video"
                                onMouseEnter={(e) => e.currentTarget.play()}
                                onMouseLeave={(e) => e.currentTarget.pause()}
                              />
                            ) : (
                              /* Fallback for other video types */
                              <div className="preview-placeholder">🎥</div>
                            )}
                          </>
                        ) : item.content_image_url ? (
                          <img
                            src={item.content_image_url}
                            alt="Content preview"
                            className="preview-image"
                          />
                        ) : (
                          <div className="preview-placeholder">
                            {getContentTypeIcon(item.content_type)}
                          </div>
                        )}
                      </div>

                      {/* Content details */}
                      <div className="item-content">
                        <div className="content-header">
                          <div className="content-main">
                            <div className="content-tags">
                              <span className="content-tag tag-platform">{item.source_platform}</span>
                              <span className={`content-tag tag-${item.content_status}`}>
                                {item.content_status.replace('_', ' ')}
                              </span>
                              {item.confidence_score && (
                                <span className={`content-tag ${
                                  item.confidence_score >= 0.8 ? 'tag-confidence-high' :
                                  item.confidence_score >= 0.6 ? 'tag-confidence-med' : 'tag-confidence-low'
                                }`}>
                                  {Math.round(item.confidence_score * 100)}% confidence
                                </span>
                              )}
                              
                              {/* Enhanced scheduled status with ET badge */}
                              {(item.scheduled_for || item.scheduled_post_time) && (
                                <ScheduleBadge 
                                  scheduledTime={item.scheduled_post_time || item.scheduled_for}
                                />
                              )}
                              
                              {/* Reconcile warning for content with missing enrichment */}
                              {item.id && !item.content_text && (
                                <div className="reconcile-warning" data-testid="reconcile-warning">
                                  <span className="warning-icon" title="Missing content enrichment">⚠︎</span>
                                  <button
                                    onClick={() => handleReconcileContent(item.id)}
                                    className="reconcile-btn"
                                    data-testid="reconcile-btn"
                                    title="One-click reconcile"
                                  >
                                    Reconcile
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {editingContent === item.id ? (
                              <div>
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="edit-textarea"
                                  rows={4}
                                  placeholder="Edit content text..."
                                />
                                <div className="edit-actions">
                                  <button
                                    onClick={handleSaveEdit}
                                    className="action-btn action-btn-success"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="action-btn"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {item.content_text && (
                                  <div className="content-text">
                                    {item.content_text}
                                  </div>
                                )}
                                <div className="content-meta">
                                  <div>Author: {item.original_author}</div>
                                  <a 
                                    href={item.original_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="meta-link"
                                  >
                                    View Original
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Timestamps */}
                          <div className="timestamps">
                            <div>Created: {formatDate(new Date(item.created_at))}</div>
                            <div>Updated: {formatDate(new Date(item.updated_at))}</div>
                            {(item.scheduled_for || item.scheduled_post_time) && (
                              <div className="scheduled-time-detail">
                                <strong>Scheduled (ET):</strong> {getETTimeString(item.scheduled_post_time || item.scheduled_for)}
                              </div>
                            )}
                            {item.reviewed_at && (
                              <div>Reviewed: {formatDate(new Date(item.reviewed_at))}</div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="action-buttons">
                          {editingContent !== item.id && (
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="action-btn"
                              disabled={item.content_status === 'posted'}
                            >
                              ✏️ Edit
                            </button>
                          )}
                          
                          {item.content_status === 'pending_review' && (
                            <>
                              <button
                                onClick={() => handleUpdateContent(item.id, { content_status: 'approved' })}
                                className="action-btn action-btn-success"
                              >
                                ✅ Approve
                              </button>
                              <button
                                onClick={() => handleUpdateContent(item.id, { content_status: 'rejected', rejection_reason: 'Manual review rejection' })}
                                className="action-btn action-btn-danger"
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
                              className="action-btn action-btn-primary"
                            >
                              📅 Schedule
                            </button>
                          )}
                          
                          {item.content_status !== 'posted' && (
                            <button
                              onClick={() => handleUpdateContent(item.id, { content_status: 'archived' })}
                              className="action-btn"
                            >
                              🗄️ Archive
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3 className="empty-title">No content found</h3>
              <p className="empty-description">
                No content matches the current filter. Try changing the filter or running a content scan.
              </p>
            </div>
          )}
        </div>

        {/* Bulk Edit Modal */}
        <BulkEditModal
          isOpen={showBulkEditModal}
          onClose={() => setShowBulkEditModal(false)}
          selectedCount={selectedItems.size}
          onBulkEdit={handleBulkEdit}
        />
      </div>
    </>
  )
}