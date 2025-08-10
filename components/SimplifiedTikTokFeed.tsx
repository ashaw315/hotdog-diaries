'use client'

import { useState, useEffect } from 'react'
import { ContentType, SourcePlatform } from '@/types'

interface Post {
  id: number
  content_text?: string
  content_type: ContentType
  source_platform: SourcePlatform
  original_url: string
  original_author?: string
  content_image_url?: string
  content_video_url?: string
  scraped_at: Date
  is_posted: boolean
  is_approved: boolean
  posted_at?: Date
}

export default function SimplifiedTikTokFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/content?limit=10')
      const data = await response.json()
      
      if (data.success) {
        setPosts(data.data?.content || [])
      }
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
  }

  const currentPost = posts[currentIndex]
  if (!currentPost) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>No posts found</div>
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: '#f0f0f0'
    }}>
      {/* Debug Info */}
      <div style={{
        background: '#333',
        color: 'white',
        padding: '10px',
        fontSize: '14px'
      }}>
        Post {currentIndex + 1} of {posts.length} | 
        Platform: {currentPost.source_platform} | 
        Type: {currentPost.content_type} |
        ID: {currentPost.id}
      </div>

      {/* Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        padding: '10px',
        background: '#ddd'
      }}>
        <button 
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          style={{ padding: '10px 20px' }}
        >
          Previous
        </button>
        <button 
          onClick={() => setCurrentIndex(Math.min(posts.length - 1, currentIndex + 1))}
          disabled={currentIndex === posts.length - 1}
          style={{ padding: '10px 20px' }}
        >
          Next
        </button>
      </div>

      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '600px',
          height: '80vh',
          background: 'black',
          border: '3px solid #333',
          borderRadius: '10px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {/* YOUTUBE - EXTERNAL LINK ONLY (NO CORS) */}
          {currentPost.source_platform === 'youtube' && currentPost.content_video_url && (
            <div 
              onClick={() => window.open(currentPost.content_video_url, '_blank')}
              style={{
                width: '100%',
                height: '100%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `url(https://img.youtube.com/vi/${extractYouTubeId(currentPost.content_video_url)}/maxresdefault.jpg) center/cover`,
                position: 'relative'
              }}
            >
              <div style={{
                background: 'rgba(255,0,0,0.9)',
                color: 'white',
                padding: '20px 40px',
                borderRadius: '10px',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                ▶️ CLICK TO PLAY YOUTUBE
              </div>
            </div>
          )}

          {/* IMGUR VIDEO */}
          {currentPost.source_platform === 'imgur' && currentPost.content_video_url && (
            <video
              src={currentPost.content_video_url.replace('.gif', '.mp4')}
              controls
              autoPlay
              muted
              loop
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => console.error('Imgur video error:', currentPost.content_video_url)}
            />
          )}

          {/* OTHER VIDEO */}
          {currentPost.content_type === 'video' && 
           currentPost.source_platform !== 'youtube' && 
           currentPost.source_platform !== 'imgur' &&
           currentPost.content_video_url && (
            <video
              src={currentPost.content_video_url}
              controls
              autoPlay
              muted
              loop
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => console.error(`${currentPost.source_platform} video error:`, currentPost.content_video_url)}
            />
          )}

          {/* IMAGE */}
          {currentPost.content_image_url && currentPost.content_type !== 'video' && (
            <img
              src={currentPost.content_image_url}
              alt={currentPost.content_text || 'Content'}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => console.error(`${currentPost.source_platform} image error:`, currentPost.content_image_url)}
            />
          )}

          {/* TEXT ONLY */}
          {!currentPost.content_image_url && !currentPost.content_video_url && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '40px',
              textAlign: 'center',
              color: 'white'
            }}>
              <div>
                <div style={{ fontSize: '60px', marginBottom: '20px' }}>🌭</div>
                <p style={{ fontSize: '18px', lineHeight: 1.5 }}>
                  {currentPost.content_text || 'No content available'}
                </p>
              </div>
            </div>
          )}

          {/* Post Info Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            right: '20px',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            pointerEvents: 'none'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              @{currentPost.original_author || 'unknown'}
            </div>
            {currentPost.content_text && (
              <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                {currentPost.content_text.substring(0, 100)}...
              </div>
            )}
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {currentPost.source_platform} • {currentPost.content_type}
            </div>
          </div>
        </div>
      </div>

      {/* Debug Console */}
      <div style={{
        background: '#222',
        color: '#0f0',
        padding: '10px',
        fontSize: '12px',
        fontFamily: 'monospace',
        maxHeight: '100px',
        overflow: 'auto'
      }}>
        <div>Video URL: {currentPost.content_video_url || 'none'}</div>
        <div>Image URL: {currentPost.content_image_url || 'none'}</div>
      </div>
    </div>
  )
}