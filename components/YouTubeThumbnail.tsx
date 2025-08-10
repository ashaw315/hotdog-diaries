'use client'

interface YouTubeThumbnailProps {
  videoId: string
  videoUrl: string
  title?: string
}

export default function YouTubeThumbnail({ videoId, videoUrl, title }: YouTubeThumbnailProps) {
  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#000',
        textDecoration: 'none'
      }}
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt={title || 'YouTube video'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        onError={(e) => {
          const img = e.target as HTMLImageElement
          if (img.src.includes('maxresdefault')) {
            img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          }
        }}
      />
      
      {/* YouTube branding overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(255, 0, 0, 0.9)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M23.498 6.186a3.02 3.02 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.02 3.02 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.02 3.02 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.02 3.02 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        YouTube
      </div>
      
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
        transition: 'all 0.2s',
        border: '2px solid rgba(255, 255, 255, 0.8)'
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
      
      {/* Click instruction */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '4px',
        fontSize: '14px',
        whiteSpace: 'nowrap'
      }}>
        Opens in YouTube
      </div>
    </a>
  )
}