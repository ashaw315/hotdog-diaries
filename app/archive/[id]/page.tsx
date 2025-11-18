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

  const isHotlinkProtected = (url: string | null | undefined): boolean => {
    if (!url) return false
    // Reddit preview URLs with hotlink protection
    if (url.includes('preview.redd.it')) return true
    // Pixabay hotlink protected URLs
    if (url.includes('pixabay.com/get/')) return true
    return false
  }

  const renderContent = () => {
    if (!item) return null

    // Handle gallery
    if (item.content_metadata?.gallery_images && item.content_metadata.gallery_images.length > 0) {
      // Filter out hotlink-protected images (Reddit preview, Pixabay, etc.)
      const validImages = item.content_metadata.gallery_images.filter(url => !isHotlinkProtected(url))

      // If all images are hotlink-protected, show fallback
      if (validImages.length === 0) {
        return (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '60px 40px',
            textAlign: 'center',
            minHeight: '300px',
            minWidth: '400px',
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
              {item.content_text || 'Gallery images unavailable (hotlink protected)'}
            </p>
          </div>
        )
      }

      const images = validImages

      return (
        <div style={{ position: 'relative' }}>
          <img
            src={images[currentGalleryIndex]}
            alt={item.content_text || `Gallery image ${currentGalleryIndex + 1}`}
            style={{
              width: '100%',
              maxHeight: '70vh',
              objectFit: 'contain'
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
            maxHeight: '70vh'
          }}
          onError={(e) => {
            console.error('Video failed to load:', item.content_video_url)
          }}
        />
      )
    }

    // Handle gif - check if it's a video file (e.g., Imgur GIFs are .mp4)
    if (item.content_type === 'gif' && item.content_image_url) {
      // Check if GIF is hotlink-protected
      if (isHotlinkProtected(item.content_image_url)) {
        return (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '60px 40px',
            textAlign: 'center',
            minHeight: '300px',
            minWidth: '400px',
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
              {item.content_text || 'GIF unavailable (hotlink protected)'}
            </p>
          </div>
        )
      }

      const isVideoFile = item.content_image_url.endsWith('.mp4') ||
                         item.content_image_url.endsWith('.webm') ||
                         item.content_image_url.endsWith('.mov')

      if (isVideoFile) {
        return (
          <video
            src={item.content_image_url}
            controls
            loop
            autoPlay
            playsInline
            preload="metadata"
            style={{
              width: '100%',
              maxHeight: '70vh'
            }}
            onError={(e) => {
              console.error('Video failed to load:', item.content_image_url)
            }}
          />
        )
      }

      return (
        <img
          src={item.content_image_url}
          alt={item.content_text || 'GIF content'}
          style={{
            width: '100%',
            maxHeight: '70vh',
            objectFit: 'contain'
          }}
        />
      )
    }

    // Handle image
    if (item.content_type === 'image' && item.content_image_url) {
      // Check if image is hotlink-protected
      if (isHotlinkProtected(item.content_image_url)) {
        return (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '60px 40px',
            textAlign: 'center',
            minHeight: '300px',
            minWidth: '400px',
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
              {item.content_text || 'Image unavailable (hotlink protected)'}
            </p>
          </div>
        )
      }

      return (
        <img
          src={item.content_image_url}
          alt={item.content_text || 'Image content'}
          style={{
            width: '100%',
            maxHeight: '70vh',
            objectFit: 'contain'
          }}
        />
      )
    }

    // Handle text-only
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '60px 40px',
        textAlign: 'center',
        minHeight: '300px',
        minWidth: '400px',
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
          marginBottom: '32px',
          marginTop: '20px'
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

        {/* Content Container with Feed-Style Presentation */}
        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'flex-start'
        }}>
          {/* Main Content - Feed Style */}
          <div style={{
            flex: '1',
            maxWidth: '800px',
            width: '100%'
          }}>
            {/* Content */}
            <div>
              {renderContent()}
            </div>

          </div>

          {/* Metadata Sidebar - Bottom Right */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '20px',
            background: '#f9f9f9',
            borderRadius: '12px',
            minWidth: '200px',
            alignSelf: 'flex-start',
            position: 'sticky',
            top: '100px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Platform</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                {item.source_platform}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#333', textTransform: 'capitalize' }}>
                {item.content_type}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Posted</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                {formatDate(item.posted_at)}
              </div>
            </div>

            {item.original_author && (
              <div>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Author</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                  {item.original_author}
                </div>
              </div>
            )}

            {item.content_text && (
              <div>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Text</div>
                <div style={{ fontSize: '14px', fontWeight: '400', color: '#333', lineHeight: '1.5' }}>
                  {item.content_text}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
