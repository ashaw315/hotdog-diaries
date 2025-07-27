'use client'

import { useState, useEffect } from 'react'
import ContentCard, { ContentCardProps } from './ContentCard'
import { ContentType, SourcePlatform } from '@/types'

export interface ContentFeedProps {
  apiEndpoint: string
  showActions?: boolean
  enableFilters?: boolean
  pageSize?: number
  emptyMessage?: string
  errorMessage?: string
  onContentAction?: (action: 'edit' | 'delete' | 'post', contentId: number) => void
}

interface ContentFeedData {
  items: ContentCardProps[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

interface Filters {
  content_type?: ContentType
  source_platform?: SourcePlatform
  is_approved?: boolean
  author?: string
}

export default function ContentFeed({
  apiEndpoint,
  showActions = false,
  enableFilters = false,
  pageSize = 10,
  emptyMessage = 'No content found',
  errorMessage = 'Failed to load content',
  onContentAction
}: ContentFeedProps) {
  const [data, setData] = useState<ContentFeedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({})

  const fetchContent = async (page: number = 1, newFilters: Filters = {}) => {
    setLoading(true)
    setError(null)

    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...Object.fromEntries(
          Object.entries({ ...filters, ...newFilters })
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([key, value]) => [key, value.toString()])
        )
      })

      const response = await fetch(`${apiEndpoint}?${searchParams}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch content')
      }

      setData(result.data)
      setCurrentPage(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : errorMessage)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContent(1, filters)
  }, [apiEndpoint, pageSize, filters])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && (!data || newPage <= data.pagination.totalPages)) {
      fetchContent(newPage, filters)
    }
  }

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters)
    fetchContent(1, newFilters)
  }

  const handleContentAction = (action: 'edit' | 'delete' | 'post', contentId: number) => {
    if (onContentAction) {
      onContentAction(action, contentId)
      // Refresh the content after action
      setTimeout(() => {
        fetchContent(currentPage, filters)
      }, 1000)
    }
  }

  const renderFilters = () => {
    if (!enableFilters) return null

    return (
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Content Type</label>
            <select
              value={filters.content_type || ''}
              onChange={(e) => handleFilterChange({
                ...filters,
                content_type: e.target.value as ContentType || undefined
              })}
              className="w-full px-3 py-2 border border-border rounded text-sm"
            >
              <option value="">All Types</option>
              {Object.values(ContentType).map(type => (
                <option key={type} value={type} className="capitalize">
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Platform</label>
            <select
              value={filters.source_platform || ''}
              onChange={(e) => handleFilterChange({
                ...filters,
                source_platform: e.target.value as SourcePlatform || undefined
              })}
              className="w-full px-3 py-2 border border-border rounded text-sm"
            >
              <option value="">All Platforms</option>
              {Object.values(SourcePlatform).map(platform => (
                <option key={platform} value={platform} className="capitalize">
                  {platform.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filters.is_approved === undefined ? '' : filters.is_approved.toString()}
              onChange={(e) => handleFilterChange({
                ...filters,
                is_approved: e.target.value === '' ? undefined : e.target.value === 'true'
              })}
              className="w-full px-3 py-2 border border-border rounded text-sm"
            >
              <option value="">All Status</option>
              <option value="true">Approved</option>
              <option value="false">Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Author</label>
            <input
              type="text"
              value={filters.author || ''}
              onChange={(e) => handleFilterChange({
                ...filters,
                author: e.target.value || undefined
              })}
              placeholder="Search by author..."
              className="w-full px-3 py-2 border border-border rounded text-sm"
            />
          </div>
        </div>

        <div className="mt-3">
          <button
            onClick={() => handleFilterChange({})}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>
    )
  }

  const renderPagination = () => {
    if (!data || data.pagination.totalPages <= 1) return null

    const { pagination } = data
    const maxVisiblePages = 5
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1)

    return (
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-text opacity-60">
          Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} results
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!pagination.hasPreviousPage}
            className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>

          {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
            const page = startPage + i
            return (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 text-sm border rounded ${
                  currentPage === page
                    ? 'bg-primary text-white border-primary'
                    : 'border-border hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            )
          })}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!pagination.hasNextPage}
            className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {renderFilters()}
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-text opacity-60">Loading content...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        {renderFilters()}
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchContent(currentPage, filters)}
            className="px-4 py-2 bg-primary text-white rounded hover:opacity-80 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-4">
        {renderFilters()}
        <div className="text-center py-8">
          <p className="text-text opacity-60">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {renderFilters()}
      
      <div className="grid gap-6">
        {data.items.map((item) => (
          <ContentCard
            key={item.id}
            {...item}
            showActions={showActions}
            onEdit={showActions ? (id) => handleContentAction('edit', id) : undefined}
            onDelete={showActions ? (id) => handleContentAction('delete', id) : undefined}
            onPost={showActions ? (id) => handleContentAction('post', id) : undefined}
          />
        ))}
      </div>

      {renderPagination()}
    </div>
  )
}