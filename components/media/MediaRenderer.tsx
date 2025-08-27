'use client'

import React, { useState, useRef, useEffect } from 'react'
import { SourcePlatform, ContentType } from '@/types'
import { getMediaInfo, getMediaFallback, getLoadingPlaceholder, isValidMediaUrl } from '@/lib/utils/media-utils'
import MobileYouTubePlayer from '@/components/video/MobileYouTubePlayer'
import MobileVideoPlayer from '@/components/video/MobileVideoPlayer'

interface MediaRendererProps {
  imageUrl?: string
  videoUrl?: string
  contentType: ContentType
  platform: SourcePlatform
  originalUrl?: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  showControls?: boolean
  autoPlay?: boolean
  muted?: boolean
  onLoadStart?: () => void
  onLoadEnd?: () => void
  onError?: (error: Error) => void
}

export default function MediaRenderer({
  imageUrl,
  videoUrl,
  contentType,
  platform,
  originalUrl,
  alt = 'Media content',
  className = '',
  style = {},
  showControls = true,
  autoPlay = false,
  muted = true,
  onLoadStart,
  onLoadEnd,
  onError
}: MediaRendererProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [activeMedia, setActiveMedia] = useState<'image' | 'video' | null>(null)
  const [mediaStartedLoading, setMediaStartedLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout>()

  // Determine which media to display
  const mediaUrl = videoUrl || imageUrl
  const mediaInfo = mediaUrl ? getMediaInfo(mediaUrl, platform, contentType) : null

  useEffect(() => {
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    if (mediaInfo && mediaUrl) {
      // Determine active media type
      if (videoUrl && (contentType === ContentType.VIDEO || mediaInfo.type === 'video' || mediaInfo.type === 'gif')) {
        setActiveMedia('video')
      } else if (imageUrl) {
        setActiveMedia('image')
      } else {
        setActiveMedia(null)
      }
    } else {
      setActiveMedia(null)
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [mediaUrl, contentType, videoUrl, imageUrl, mediaInfo])

  const handleLoadStart = () => {
    if (!mediaStartedLoading) {
      setMediaStartedLoading(true)
      setIsLoading(true)
      setHasError(false)
      onLoadStart?.()
      
      // Set loading timeout only when media actually starts loading
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn(`Media loading timeout for ${platform}:`, mediaUrl)
        setIsLoading(false)
        setHasError(true)
      }, 8000) // 8 second timeout
    }
  }

  const handleLoadSuccess = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }
    setIsLoading(false)
    setHasError(false)
    setMediaStartedLoading(true)
    onLoadEnd?.()
  }

  const handleLoadError = (error?: Error) => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }
    setIsLoading(false)
    setHasError(true)
    setMediaStartedLoading(true)
    
    const errorMsg = error || new Error(`Failed to load ${activeMedia} from ${platform}`)
    onError?.(errorMsg)

    // Retry once for transient failures
    if (retryCount < 1) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1)
        setHasError(false)
        setMediaStartedLoading(false)
      }, 2000)
    }
  }

  // Handle case where no valid media URL is provided
  if (!mediaUrl || !mediaInfo || !isValidMediaUrl(mediaUrl)) {
    const fallback = getMediaFallback(platform, contentType || 'content')
    return (
      <div 
        className={`media-renderer media-fallback ${className}`}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '200px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          color: '#6b7280',
          ...style 
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📄</div>
          <div>{fallback.text}</div>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading && !hasError) {
    return (
      <div 
        className={`media-renderer media-loading ${className}`}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '200px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          ...style 
        }}
      >
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <div>Loading {activeMedia}...</div>
        </div>
      </div>
    )
  }

  // Error state with fallback
  if (hasError) {
    const fallback = getMediaFallback(platform, activeMedia || 'media')
    return (
      <div 
        className={`media-renderer media-error ${className}`}
        style={{ 
          position: 'relative',
          minHeight: '200px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          overflow: 'hidden',
          ...style 
        }}
      >
        <img 
          src={fallback.url}
          alt={fallback.text}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain'
          }}
        />
        {retryCount < 1 && (
          <button
            onClick={() => {
              setRetryCount(prev => prev + 1)
              setHasError(false)
              setIsLoading(true)
            }}
            style={{
              position: 'absolute',
              bottom: '1rem',
              right: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  // Render media based on type
  const renderMedia = () => {
    if (!mediaInfo) return null

    switch (mediaInfo.type) {
      case 'video':
        if (mediaInfo.requiresIframe && mediaInfo.embedUrl) {
          // YouTube embed
          if (platform === 'youtube' as SourcePlatform) {
            const videoId = mediaInfo.embedUrl.match(/embed\/([^?]+)/)?.[1]
            if (videoId) {
              return (
                <MobileYouTubePlayer
                  videoId={videoId}
                  isActive={true}
                  autoplayOnVisible={autoPlay}
                  style={{ width: '100%', height: '100%' }}
                  onPlayStateChange={(playing) => {
                    if (playing) {
                      handleLoadSuccess()
                    } else {
                      handleLoadStart()
                    }
                  }}
                />
              )
            }
          }
          
          // Fallback iframe
          return (
            <iframe
              src={mediaInfo.embedUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={handleLoadSuccess}
              onError={() => handleLoadError()}
              onLoadStart={handleLoadStart}
              title={`${platform} video embed`}
            />
          )
        } else {
          // Direct video file
          return (
            <MobileVideoPlayer
              src={mediaInfo.url}
              poster={imageUrl} // Use image as poster if available
              isActive={true}
              style={{ width: '100%', height: '100%' }}
              muted={muted}
              controls={showControls}
              autoPlay={autoPlay}
            />
          )
        }

      case 'gif':
        // Render GIFs as video for better performance, fallback to img
        if (mediaInfo.url.endsWith('.mp4') || mediaInfo.url.includes('giphy.com')) {
          return (
            <video
              src={mediaInfo.url}
              autoPlay
              loop
              muted
              playsInline
              style={{ 
                width: '100%', 
                height: '100%',
                objectFit: 'cover',
                maxHeight: '400px'
              }}
              onLoadStart={handleLoadStart}
              onLoadedData={handleLoadSuccess}
              onError={() => handleLoadError()}
            />
          )
        }
        // Fallback to regular image for GIFs
        // Fall through to image case

      case 'image':
        return (
          <img
            src={mediaInfo.url}
            alt={alt}
            style={{ 
              width: '100%', 
              height: 'auto',
              objectFit: 'cover',
              maxHeight: '600px'
            }}
            onLoadStart={handleLoadStart}
            onLoad={handleLoadSuccess}
            onError={() => handleLoadError()}
            loading="lazy"
          />
        )

      default:
        return (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            color: '#6b7280',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❓</div>
            <div>Unsupported media type</div>
            {originalUrl && (
              <a 
                href={originalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', marginTop: '0.5rem', display: 'block' }}
              >
                View original
              </a>
            )}
          </div>
        )
    }
  }

  return (
    <div 
      ref={containerRef}
      className={`media-renderer ${className}`}
      style={{ 
        position: 'relative',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#000',
        ...style 
      }}
    >
      {renderMedia()}
      
      {/* Platform badge */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          padding: '4px 8px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          fontSize: '12px',
          borderRadius: '4px',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        {platform === 'youtube' ? '📺' : 
         platform === 'giphy' ? '🎭' :
         platform === 'imgur' ? '📸' :
         platform === 'reddit' ? '🤖' :
         platform === 'pixabay' ? '🎨' :
         platform === 'tumblr' ? '📱' :
         platform === 'bluesky' ? '🦋' :
         platform === 'lemmy' ? '🔗' : '🌐'} {platform}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .media-renderer {
          background: linear-gradient(45deg, #f3f4f6 25%, transparent 25%), 
                     linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), 
                     linear-gradient(45deg, transparent 75%, #f3f4f6 75%), 
                     linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }

        .media-renderer img,
        .media-renderer video {
          background: white;
        }

        @media (max-width: 768px) {
          .media-renderer {
            border-radius: 4px;
          }
        }
      `}</style>
    </div>
  )
}