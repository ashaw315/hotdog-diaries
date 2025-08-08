'use client'

import { useState, useEffect } from 'react'

export default function TestFeed() {
  const [posts, setPosts] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/content?limit=10')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPosts(data.data?.content || [])
        }
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>
  if (posts.length === 0) return <div style={{ padding: '20px' }}>No posts</div>

  const currentPost = posts[currentIndex]

  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Current post */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {currentPost.content_image_url ? (
          <img 
            src={currentPost.content_image_url}
            alt="Content"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h2>🌭</h2>
            <p>{currentPost.content_text || 'No content'}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '10px'
      }}>
        <button 
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          Previous
        </button>
        <span>{currentIndex + 1} / {posts.length}</span>
        <button 
          onClick={() => setCurrentIndex(Math.min(posts.length - 1, currentIndex + 1))}
          disabled={currentIndex === posts.length - 1}
        >
          Next
        </button>
      </div>
    </div>
  )
}