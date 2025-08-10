'use client'

import { useEffect, useRef } from 'react'

interface YouTubePlayerProps {
  videoId: string
  thumbnail: string
  title?: string
}

export default function YouTubePlayer({ videoId, thumbnail, title }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const isPlaying = useRef(false)

  const handleClick = () => {
    if (!isPlaying.current && containerRef.current) {
      // Create a simple iframe without autoplay
      // User will need to click play button in YouTube player
      const iframe = document.createElement('iframe')
      iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0`
      iframe.style.width = '100%'
      iframe.style.height = '100%'
      iframe.style.border = 'none'
      iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
      iframe.allowFullscreen = true
      
      // Replace thumbnail with iframe
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(iframe)
      isPlaying.current = true
    }
  }

  return (
    <div 
      ref={containerRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        position: 'relative',
        background: '#000'
      }}
    >
      {/* Initial thumbnail state */}
      <img
        src={thumbnail}
        alt={title || 'YouTube video'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        onError={(e) => {
          // Fallback to lower quality thumbnail
          const img = e.target as HTMLImageElement
          if (img.src.includes('maxresdefault')) {
            img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          }
        }}
      />
      
      {/* Play button overlay */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80px',
        height: '80px',
        background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>
  )
}