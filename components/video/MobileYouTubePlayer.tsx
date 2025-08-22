'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'

interface MobileYouTubePlayerProps {
  videoId: string
  isActive: boolean
  onPlayerRef?: (el: HTMLIFrameElement | null) => void
  className?: string
  style?: React.CSSProperties
  autoplayOnVisible?: boolean
  onPlayStateChange?: (playing: boolean) => void
}

export default function MobileYouTubePlayer({
  videoId,
  isActive,
  onPlayerRef,
  className = '',
  style = {},
  autoplayOnVisible = true,
  onPlayStateChange
}: MobileYouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showPlayButton, setShowPlayButton] = useState(true)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [shouldAutoplay, setShouldAutoplay] = useState(false)

  // Intersection observer for visibility detection
  const { isIntersecting } = useIntersectionObserver(containerRef, {
    threshold: 0.5,
    rootMargin: '0px'
  })

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window)
    
    // Add global touch/click handler for initial user interaction
    const enableAutoplay = () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true)
        console.log(`✋ User interaction detected - autoplay now enabled`)
      }
    }

    // Listen for any user interaction globally
    document.addEventListener('touchstart', enableAutoplay, { once: true })
    document.addEventListener('click', enableAutoplay, { once: true })
    
    return () => {
      document.removeEventListener('touchstart', enableAutoplay)
      document.removeEventListener('click', enableAutoplay)  
    }
  }, [hasUserInteracted])

  // Handle YouTube iframe API messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return
      
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        
        if (data.event === 'video-progress') {
          // Player is ready and playing
          if (!playerReady) {
            setPlayerReady(true)
            setIsLoading(false)
          }
        }
        
        if (data.event === 'onStateChange') {
          const playerState = data.info
          // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
          const playing = playerState === 1
          const paused = playerState === 2
          const ended = playerState === 0
          
          console.log(`🎬 YouTube state change: ${videoId} - State: ${playerState} (${playing ? 'playing' : paused ? 'paused' : ended ? 'ended' : 'other'})`)
          
          setIsPlaying(playing)
          onPlayStateChange?.(playing)
          
          if (playing) {
            setShowPlayButton(false)
            setHasUserInteracted(true) // Mark as interacted when playing starts
          } else if (paused || ended) {
            // Don't show play button again after first interaction unless user wants manual control
            if (!hasUserInteracted) {
              setShowPlayButton(true)
            }
          }
        }
      } catch (error) {
        // Ignore parsing errors from other iframe messages
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [playerReady, onPlayStateChange])

  // YouTube iframe ref callback
  useEffect(() => {
    if (onPlayerRef && iframeRef.current) {
      onPlayerRef(iframeRef.current)
    }
  }, [onPlayerRef])

  // Handle autoplay when video becomes visible and active
  useEffect(() => {
    if (!autoplayOnVisible || !iframeRef.current) return
    
    // More aggressive autoplay logic - try autoplay when video is visible and active
    const shouldTryAutoplay = isIntersecting && isActive
    
    if (shouldTryAutoplay && !isPlaying) {
      console.log(`🎬 Attempting autoplay for video ${videoId} (intersection: ${isIntersecting}, active: ${isActive}, hasInteracted: ${hasUserInteracted})`)
      
      // Hide play button immediately when autoplay starts
      if (showPlayButton) {
        setShowPlayButton(false)
      }
      
      // Send play command to YouTube iframe
      iframeRef.current.contentWindow?.postMessage(
        '{"event":"command","func":"playVideo","args":""}',
        'https://www.youtube.com'
      )
      setShouldAutoplay(true)
    } else if (!isIntersecting && isPlaying) {
      console.log(`⏸️ Pausing video ${videoId} (no longer visible)`)
      // Send pause command to YouTube iframe
      iframeRef.current.contentWindow?.postMessage(
        '{"event":"command","func":"pauseVideo","args":""}',
        'https://www.youtube.com'
      )
      setShouldAutoplay(false)
    } else if (!isActive && isPlaying) {
      console.log(`⏸️ Pausing video ${videoId} (no longer active)`)
      // Pause when another video becomes active
      iframeRef.current.contentWindow?.postMessage(
        '{"event":"command","func":"pauseVideo","args":""}',
        'https://www.youtube.com'
      )
      setShouldAutoplay(false)
    }
  }, [isIntersecting, isActive, hasUserInteracted, isPlaying, autoplayOnVisible, videoId, showPlayButton])

  // Add a way to programmatically pause this video from parent component
  useEffect(() => {
    const handleGlobalPause = (event: CustomEvent<{videoId: string}>) => {
      if (event.detail.videoId !== videoId && isPlaying && iframeRef.current) {
        console.log(`⏸️ Pausing video ${videoId} due to global pause event`)
        iframeRef.current.contentWindow?.postMessage(
          '{"event":"command","func":"pauseVideo","args":""}',
          'https://www.youtube.com'
        )
      }
    }

    window.addEventListener('pauseOtherVideos', handleGlobalPause as EventListener)
    return () => window.removeEventListener('pauseOtherVideos', handleGlobalPause as EventListener)
  }, [videoId, isPlaying])

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false)
    // Enable YouTube API listening after iframe loads
    setTimeout(() => {
      if (iframeRef.current) {
        // Send listening command to enable API events
        iframeRef.current.contentWindow?.postMessage(
          '{"event":"listening","id":"' + videoId + '","channel":"widget"}',
          'https://www.youtube.com'
        )
      }
    }, 100)
  }, [videoId])

  const handlePlayClick = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    setHasUserInteracted(true)
    
    if (playerReady) {
      // Use iframe API to play if player is ready
      iframe.contentWindow?.postMessage(
        '{"event":"command","func":"playVideo","args":""}',
        'https://www.youtube.com'
      )
    } else {
      // Fallback: Update iframe src to start playing
      const currentSrc = iframe.src
      const newSrc = currentSrc.includes('autoplay=1') 
        ? currentSrc 
        : currentSrc.replace('autoplay=0', 'autoplay=1')
      
      iframe.src = newSrc
    }
    
    setShowPlayButton(false)
  }, [playerReady])

  const handleContainerClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!hasUserInteracted && showPlayButton) {
      e.preventDefault()
      handlePlayClick()
    }
  }, [hasUserInteracted, showPlayButton, handlePlayClick])

  // Generate YouTube embed URL with enhanced autoplay capabilities
  const embedUrl = `https://www.youtube.com/embed/${videoId}?${new URLSearchParams({
    autoplay: (isActive && isIntersecting) ? '1' : '0', // More aggressive autoplay based on visibility
    mute: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    controls: '1',
    showinfo: '0',
    iv_load_policy: '3',
    enablejsapi: '1',
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    // Disable related videos at end
    'end': '',
    'loop': '0',
    // Enable API events
    'widget_referrer': typeof window !== 'undefined' ? window.location.origin : ''
  }).toString()}`

  return (
    <div
      ref={containerRef}
      className={`mobile-youtube-player ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
        cursor: showPlayButton ? 'pointer' : 'default',
        ...style
      }}
      onClick={handleContainerClick}
      onTouchStart={handleContainerClick}
    >
      {/* YouTube iframe */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={handleIframeLoad}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          pointerEvents: 'auto'
        }}
        title={`YouTube video ${videoId}`}
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

      {/* Custom play button overlay - only show when explicitly needed */}
      {!isLoading && showPlayButton && !isPlaying && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: hasUserInteracted ? 5 : 15, // Lower z-index after interaction to allow iframe access
            cursor: 'pointer',
            pointerEvents: isPlaying ? 'none' : 'auto' // Disable overlay when video is playing
          }}
          onClick={handlePlayClick}
        >
          {/* Large play button */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: '#ff0000',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.transform = 'scale(1.1)'
              ;(e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 1)'
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.transform = 'scale(1)'
              ;(e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.9)'
            }}
          >
            <div style={{ marginLeft: '4px' }}>▶️</div>
          </div>
        </div>
      )}

      {/* YouTube branding */}
      {!isLoading && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            color: 'white',
            fontSize: '12px',
            opacity: 0.7,
            zIndex: 10,
            pointerEvents: 'none',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.7)'
          }}
        >
          📺 YouTube
        </div>
      )}

      {/* Touch instructions (mobile only) */}
      {isTouchDevice && !isLoading && showPlayButton && (
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
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
          Tap to play video
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

        .mobile-youtube-player {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        /* Ensure minimum touch target size */
        .mobile-youtube-player iframe {
          min-height: 44px;
        }

        /* Prevent iframe scrolling issues on mobile */
        .mobile-youtube-player iframe {
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </div>
  )
}