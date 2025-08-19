'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'

interface MobileVideoPlayerProps {
  src: string
  poster?: string
  isActive: boolean
  onVideoRef?: (el: HTMLVideoElement | null) => void
  className?: string
  style?: React.CSSProperties
}

export default function MobileVideoPlayer({
  src,
  poster,
  isActive,
  onVideoRef,
  className = '',
  style = {}
}: MobileVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [volume, setVolume] = useState(0.5)
  const [showVolumeControl, setShowVolumeControl] = useState(false)
  const [lastTouchTime, setLastTouchTime] = useState(0)
  const [touchStartY, setTouchStartY] = useState(0)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Validate video URL format on component mount
  useEffect(() => {
    const isValidVideoUrl = (url: string): boolean => {
      // Check if it's a direct video file
      if (url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) return true
      
      // Check if it's from supported video hosts
      if (url.includes('imgur.com') || url.includes('i.redd.it')) return true
      
      // Block YouTube URLs - these should use YouTube player
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        console.warn('⚠️ YouTube URL passed to MobileVideoPlayer - should use MobileYouTubePlayer instead:', url)
        return false
      }
      
      return false
    }
    
    if (!isValidVideoUrl(src)) {
      setHasError(true)
      console.error('Invalid video URL format for MobileVideoPlayer:', src)
    }
  }, [src])

  // Intersection observer for autoplay
  const { isIntersecting } = useIntersectionObserver(containerRef, {
    threshold: 0.5,
    rootMargin: '0px'
  })

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window)
  }, [])

  // Video ref callback
  useEffect(() => {
    if (onVideoRef && videoRef.current) {
      onVideoRef(videoRef.current)
    }
  }, [onVideoRef])

  // Autoplay logic based on intersection and active state
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleAutoplay = async () => {
      try {
        if (isActive && isIntersecting && !isPlaying) {
          // Ensure video is muted for autoplay
          video.muted = true
          setIsMuted(true)
          await video.play()
          setIsPlaying(true)
        } else if ((!isActive || !isIntersecting) && isPlaying) {
          video.pause()
          setIsPlaying(false)
        }
      } catch (error) {
        console.warn('Video autoplay failed:', error)
      }
    }

    handleAutoplay()
  }, [isActive, isIntersecting, isPlaying])

  // Video event handlers
  const handleVideoLoad = () => {
    setIsLoading(false)
    const video = videoRef.current
    if (video) {
      video.volume = volume
      video.muted = isMuted
    }
  }

  const handleVideoError = (error: Event) => {
    setIsLoading(false)
    setHasError(true)
    
    // Provide more detailed error information
    const videoElement = error.target as HTMLVideoElement
    const errorCode = videoElement?.error?.code
    const errorMessage = videoElement?.error?.message
    
    console.error('Video failed to load:', {
      src,
      errorCode,
      errorMessage,
      error: videoElement?.error
    })
    
    // Report error to API for monitoring
    if (typeof window !== 'undefined') {
      fetch('/api/video-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: src,
          errorType: getErrorType(errorCode),
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to report video error:', err))
    }
  }
  
  // Helper to convert error codes to readable types
  const getErrorType = (code?: number): string => {
    switch (code) {
      case 1: return 'MEDIA_ERR_ABORTED'
      case 2: return 'MEDIA_ERR_NETWORK' 
      case 3: return 'MEDIA_ERR_DECODE'
      case 4: return 'MEDIA_ERR_SRC_NOT_SUPPORTED'
      default: return 'UNKNOWN_ERROR'
    }
  }

  const handlePlayPause = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    try {
      if (isPlaying) {
        video.pause()
        setIsPlaying(false)
      } else {
        await video.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.warn('Play/pause failed:', error)
    }
  }, [isPlaying])

  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const newMuted = !isMuted
    video.muted = newMuted
    setIsMuted(newMuted)
    
    // Show volume control briefly when unmuting
    if (!newMuted) {
      setShowVolumeControl(true)
      setTimeout(() => setShowVolumeControl(false), 3000)
    }
  }, [isMuted])

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current
    if (!video) return

    setVolume(newVolume)
    video.volume = newVolume
    
    // Unmute if volume is increased
    if (newVolume > 0 && isMuted) {
      video.muted = false
      setIsMuted(false)
    }
  }, [isMuted])

  // Touch gesture handling for volume control
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    // Only handle touches on the right side for volume control
    const isRightSide = touch.clientX > rect.left + rect.width * 0.7
    if (isRightSide) {
      setTouchStartY(touch.clientY)
      setShowVolumeControl(true)
      e.preventDefault()
    }

    // Handle double tap to play/pause
    const now = Date.now()
    if (now - lastTouchTime < 300) {
      handlePlayPause()
    }
    setLastTouchTime(now)
  }, [lastTouchTime, handlePlayPause])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY === 0) return

    const touch = e.touches[0]
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const deltaY = touchStartY - touch.clientY
    const maxDelta = rect.height * 0.3
    const volumeChange = Math.max(0, Math.min(1, deltaY / maxDelta))
    
    handleVolumeChange(volumeChange)
    e.preventDefault()
  }, [touchStartY, handleVolumeChange])

  const handleTouchEnd = useCallback(() => {
    setTouchStartY(0)
    setTimeout(() => setShowVolumeControl(false), 2000)
  }, [])

  // Tap to play/pause (for non-touch or fallback)
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Prevent click if it's from a touch event
    if (isTouchDevice) return
    
    handlePlayPause()
  }, [isTouchDevice, handlePlayPause])

  // Show error state if video URL is invalid or failed to load
  if (hasError) {
    return (
      <div
        ref={containerRef}
        className={`mobile-video-player error-state ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a1a',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: '#fff',
          textAlign: 'center',
          padding: '20px',
          ...style
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <div style={{ fontSize: '16px', marginBottom: '8px' }}>Video Unavailable</div>
        <div style={{ fontSize: '14px', opacity: 0.7, maxWidth: '80%' }}>
          This video format is not supported or the source is unavailable.
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`mobile-video-player ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
        cursor: 'pointer',
        ...style
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onLoadedMetadata={handleVideoLoad}
        onError={handleVideoError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />

      {/* Loading spinner */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '24px',
            zIndex: 10
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderTop: '3px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
        </div>
      )}

      {/* Play/Pause overlay (center) */}
      {!isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '48px',
            opacity: isPlaying ? 0 : 0.8,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
            zIndex: 5,
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.7)'
          }}
        >
          {!isPlaying && '▶️'}
        </div>
      )}

      {/* Mute/Unmute button (bottom right) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleMuteToggle()
        }}
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: 'none',
          color: 'white',
          fontSize: '18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 15,
          transition: 'background-color 0.2s ease',
          minWidth: '44px',
          minHeight: '44px'
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.6)'
        }}
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      {/* Volume control slider (right side) */}
      {showVolumeControl && !isMuted && (
        <div
          style={{
            position: 'absolute',
            right: '24px',
            top: '50%',
            transform: 'translateY(-50%)',
            height: '200px',
            width: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '2px',
            zIndex: 20
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              width: '100%',
              height: `${volume * 100}%`,
              backgroundColor: 'white',
              borderRadius: '2px',
              transition: 'height 0.1s ease'
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: `${volume * 100}%`,
              left: '50%',
              transform: 'translate(-50%, 50%)',
              width: '12px',
              height: '12px',
              backgroundColor: 'white',
              borderRadius: '50%',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
            }}
          />
        </div>
      )}

      {/* Tap instructions (mobile only, first few seconds) */}
      {isTouchDevice && !isLoading && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            fontSize: '14px',
            textAlign: 'center',
            opacity: 0.7,
            animation: 'fadeOut 4s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 10,
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)'
          }}
        >
          <div>Tap to play/pause</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Swipe up/down on right to adjust volume
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fadeOut {
          0% { opacity: 0.7; }
          70% { opacity: 0.7; }
          100% { opacity: 0; }
        }

        .mobile-video-player {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        /* Ensure touch targets are at least 44px */
        .mobile-video-player button {
          min-width: 44px;
          min-height: 44px;
        }

        /* Hide video controls on mobile for custom implementation */
        .mobile-video-player video::-webkit-media-controls {
          display: none !important;
        }

        .mobile-video-player video::-webkit-media-controls-panel {
          display: none !important;
        }

        .mobile-video-player video::-webkit-media-controls-play-button {
          display: none !important;
        }

        .mobile-video-player video::-webkit-media-controls-start-playback-button {
          display: none !important;
        }
      `}</style>
    </div>
  )
}