'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import HotdogDiariesLogoMouseGradient from '@/components/HotdogDiariesLogoMouseGradient'

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

interface NavigationInfo {
  prevId: number | null
  nextId: number | null
}

export default function ArchiveItemPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [item, setItem] = useState<ArchiveItem | null>(null)
  const [navigation, setNavigation] = useState<NavigationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0)

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/archive/${id}`)

        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Item not found' : 'Failed to fetch item')
        }

        const data = await response.json()
        setItem(data.item)
        setNavigation(data.navigation)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchItem()
  }, [id])

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid date'
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date)
  }

  const renderContent = () => {
    if (!item) return null

    // Handle gallery
    if (item.content_metadata?.gallery_images && item.content_metadata.gallery_images.length > 0) {
      const images = item.content_metadata.gallery_images

      return (
        <div style={{ position: 'relative' }}>
          <img
            src={images[currentGalleryIndex]}
            alt={item.content_text || `Gallery image ${currentGalleryIndex + 1}`}
            style={{
              width: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
              borderRadius: '12px'
            }}
          />
          {images.length > 1 && (
            <>
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px'
              }}>
                {currentGalleryIndex + 1} / {images.length}
              </div>
              {currentGalleryIndex > 0 && (
                <button
                  onClick={() => setCurrentGalleryIndex(currentGalleryIndex - 1)}
                  style={{
                    position: 'absolute',
                    left: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 210, 31, 0.95)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    fontSize: '24px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ←
                </button>
              )}
              {currentGalleryIndex < images.length - 1 && (
                <button
                  onClick={() => setCurrentGalleryIndex(currentGalleryIndex + 1)}
                  style={{
                    position: 'absolute',
                    right: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 210, 31, 0.95)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    fontSize: '24px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  →
                </button>
              )}
            </>
          )}
        </div>
      )
    }

    // Handle video
    if (item.content_type === 'video' && item.content_video_url) {
      return (
        <video
          src={item.content_video_url}
          controls
          loop
          autoPlay
          playsInline
          preload="metadata"
          style={{
            width: '100%',
            maxHeight: '70vh',
            borderRadius: '12px'
          }}
          onError={(e) => {
            console.error('Video failed to load:', item.content_video_url)
          }}
        />
      )
    }

    // Handle gif
    if (item.content_type === 'gif' && item.content_image_url) {
      return (
        <img
          src={item.content_image_url}
          alt={item.content_text || 'GIF content'}
          style={{
            width: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            borderRadius: '12px'
          }}
        />
      )
    }

    // Handle image
    if (item.content_type === 'image' && item.content_image_url) {
      return (
        <img
          src={item.content_image_url}
          alt={item.content_text || 'Image content'}
          style={{
            width: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            borderRadius: '12px'
          }}
        />
      )
    }

    // Handle text-only
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '60px 40px',
        borderRadius: '12px',
        textAlign: 'center',
        minHeight: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{
          color: 'white',
          fontSize: '24px',
          lineHeight: '1.6',
          maxWidth: '600px'
        }}>
          {item.content_text || 'No content available'}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: '20px'
      }}>
        <HotdogDiariesLogoMouseGradient />
        Loading...
      </div>
    )
  }

  if (error || !item) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'white',
        padding: '40px 20px'
      }}>
        <HotdogDiariesLogoMouseGradient />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 80px)'
        }}>
          <div style={{
            background: '#fff5f5',
            border: '1px solid #ffcccc',
            padding: '40px',
            borderRadius: '12px',
            maxWidth: '600px',
            textAlign: 'center'
          }}>
            <h1 style={{ color: '#e52b2b', marginBottom: '16px' }}>Error</h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>{error || 'Item not found'}</p>
            <Link href="/archive" style={{
              display: 'inline-block',
              background: '#ffd21f',
              color: '#333',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '500'
            }}>
              ← Back to Archive
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'white',
      padding: '40px 20px'
    }}>
      <HotdogDiariesLogoMouseGradient />
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        paddingTop: '60px'
      }}>
        {/* Header Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          <Link href="/archive" style={{
            color: '#e52b2b',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ← Back to Archive
          </Link>

          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            {navigation?.prevId ? (
              <button
                onClick={() => router.push(`/archive/${navigation.prevId}`)}
                style={{
                  background: '#ffd21f',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#333',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                ← Newer
              </button>
            ) : (
              <div style={{ width: '90px' }} />
            )}

            {navigation?.nextId ? (
              <button
                onClick={() => router.push(`/archive/${navigation.nextId}`)}
                style={{
                  background: '#ffd21f',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#333',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Older →
              </button>
            ) : (
              <div style={{ width: '90px' }} />
            )}
          </div>
        </div>

        {/* Content Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
        }}>
          {/* Content */}
          <div style={{ marginBottom: '32px' }}>
            {renderContent()}
          </div>

          {/* Text Content */}
          {item.content_text && item.content_type !== 'text' && (
            <p style={{
              fontSize: '16px',
              lineHeight: '1.6',
              color: '#333',
              marginBottom: '24px',
              padding: '20px',
              background: '#f9f9f9',
              borderRadius: '8px'
            }}>
              {item.content_text}
            </p>
          )}

          {/* Metadata */}
          <div style={{
            borderTop: '1px solid #eee',
            paddingTop: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '13px', color: '#999', marginBottom: '4px' }}>Platform</div>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#333' }}>
                {item.source_platform}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '13px', color: '#999', marginBottom: '4px' }}>Content Type</div>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#333', textTransform: 'capitalize' }}>
                {item.content_type}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '13px', color: '#999', marginBottom: '4px' }}>Posted</div>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#333' }}>
                {formatDate(item.posted_at)}
              </div>
            </div>

            {item.original_author && (
              <div>
                <div style={{ fontSize: '13px', color: '#999', marginBottom: '4px' }}>Author</div>
                <div style={{ fontSize: '15px', fontWeight: '500', color: '#333' }}>
                  {item.original_author}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
