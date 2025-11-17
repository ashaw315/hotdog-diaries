'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ArchiveItem {
  id: number
  content_type: 'video' | 'gif' | 'text' | 'image'
  source_platform: string
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  content_metadata?: {
    gallery_images?: string[]
    image_count?: number
  } | null
  original_author?: string
  original_url?: string
  posted_at: string
}

interface PaginationInfo {
  total: number
  limit: number
  offset: number
  totalPages: number
  currentPage: number
  hasMore: boolean
}

export default function ArchivePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = parseInt(searchParams.get('page') || '1')

  const [items, setItems] = useState<ArchiveItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchArchive = async () => {
      try {
        setLoading(true)
        setError(null)

        const offset = (page - 1) * 20
        const response = await fetch(`/api/archive?limit=20&offset=${offset}`)

        if (!response.ok) {
          throw new Error('Failed to fetch archive')
        }

        const data = await response.json()
        setItems(data.items)
        setPagination(data.pagination)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchArchive()
  }, [page])

  const getThumbnailUrl = (item: ArchiveItem): string | null => {
    if (item.content_type === 'image' && item.content_image_url) {
      return item.content_image_url
    }
    if (item.content_type === 'video' && item.content_image_url) {
      return item.content_image_url // Thumbnail for video
    }
    if (item.content_type === 'gif' && item.content_image_url) {
      return item.content_image_url
    }
    if (item.content_metadata?.gallery_images && item.content_metadata.gallery_images.length > 0) {
      return item.content_metadata.gallery_images[0]
    }
    return null
  }

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid date'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  }

  const goToPage = (newPage: number) => {
    router.push(`/archive?page=${newPage}`)
  }

  const renderPaginationButtons = () => {
    if (!pagination) return null

    const { currentPage, totalPages } = pagination
    const pages: (number | string)[] = []

    // Always show first page
    pages.push(1)

    // Show pages around current page
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    if (start > 2) {
      pages.push('...')
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (end < totalPages - 1) {
      pages.push('...')
    }

    // Always show last page if more than 1 page
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages.map((page, index) => {
      if (page === '...') {
        return (
          <span key={`ellipsis-${index}`} style={{
            padding: '8px 12px',
            color: '#666'
          }}>
            ...
          </span>
        )
      }

      const pageNum = page as number
      const isCurrentPage = pageNum === currentPage

      return (
        <button
          key={pageNum}
          onClick={() => goToPage(pageNum)}
          disabled={isCurrentPage}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            background: isCurrentPage ? '#ffd21f' : 'white',
            color: isCurrentPage ? '#333' : '#666',
            fontWeight: isCurrentPage ? '600' : '400',
            cursor: isCurrentPage ? 'default' : 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!isCurrentPage) {
              (e.target as HTMLElement).style.background = '#f5f5f5'
            }
          }}
          onMouseLeave={(e) => {
            if (!isCurrentPage) {
              (e.target as HTMLElement).style.background = 'white'
            }
          }}
        >
          {pageNum}
        </button>
      )
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto 40px',
        textAlign: 'center'
      }}>
        <h1 style={{
          color: 'white',
          fontSize: '48px',
          fontWeight: '700',
          marginBottom: '16px',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)'
        }}>
          Hotdog Archive
        </h1>
        <p style={{
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '18px',
          marginBottom: '24px'
        }}>
          {pagination ? `${pagination.total} hot dogs and counting` : 'Loading...'}
        </p>
        <Link href="/" style={{
          color: '#ffd21f',
          textDecoration: 'none',
          fontSize: '16px',
          fontWeight: '500'
        }}>
          ← Back to Feed
        </Link>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'white',
            fontSize: '18px'
          }}>
            Loading archive...
          </div>
        )}

        {error && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#ff6b6b',
            fontSize: '18px',
            background: 'white',
            borderRadius: '12px',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'white',
            fontSize: '18px'
          }}>
            No items in archive yet.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '24px',
              marginBottom: '40px'
            }}>
              {items.map((item) => {
                const thumbnail = getThumbnailUrl(item)

                return (
                  <Link
                    key={item.id}
                    href={`/archive/${item.id}`}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit'
                    }}
                  >
                    <div
                      style={{
                        background: 'white',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{
                        width: '100%',
                        height: '200px',
                        position: 'relative',
                        background: thumbnail ? '#f5f5f5' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        overflow: 'hidden'
                      }}>
                        {item.content_type === 'video' && item.content_video_url ? (
                          <video
                            src={item.content_video_url}
                            muted
                            loop
                            autoPlay
                            playsInline
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        ) : thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={item.content_text || 'Hotdog content'}
                            onError={(e) => {
                              // Replace broken image with fallback
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              if (target.nextElementSibling) {
                                (target.nextElementSibling as HTMLElement).style.display = 'flex'
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        ) : null}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          display: (thumbnail || (item.content_type === 'video' && item.content_video_url)) ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '20px',
                          fontSize: item.content_type === 'text' ? '16px' : '48px',
                          color: 'white',
                          textAlign: 'center',
                          lineHeight: '1.5'
                        }}>
                          {item.content_type === 'text' && item.content_text ? (
                            <div style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 6,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              maxWidth: '100%'
                            }}>
                              {item.content_text}
                            </div>
                          ) : (
                            '🌭'
                          )}
                        </div>

                        {/* Content Type Badge */}
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          textTransform: 'uppercase'
                        }}>
                          {item.content_type}
                        </div>

                        {/* Platform Badge */}
                        <div style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '12px',
                          background: 'rgba(255, 210, 31, 0.95)',
                          color: '#333',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {item.source_platform}
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          fontSize: '13px',
                          color: '#666'
                        }}>
                          {formatDate(item.posted_at)}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '20px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#666',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.5 : 1,
                    fontWeight: '500'
                  }}
                >
                  ← Previous
                </button>

                {renderPaginationButtons()}

                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={!pagination.hasMore}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#666',
                    cursor: !pagination.hasMore ? 'not-allowed' : 'pointer',
                    opacity: !pagination.hasMore ? 0.5 : 1,
                    fontWeight: '500'
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
