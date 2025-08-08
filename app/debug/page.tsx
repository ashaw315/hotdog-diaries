'use client'

import { useState, useEffect } from 'react'

export default function DebugPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/content?limit=5')
      .then(res => res.json())
      .then(data => {
        console.log('API Response:', data)
        if (data.success) {
          setPosts(data.data?.content || [])
        } else {
          setError(data.error || 'Failed to load')
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Fetch error:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
      <h1>Debug Feed Content</h1>
      
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      
      <h2>Posts ({posts.length}):</h2>
      {posts.map((post, index) => (
        <div key={post.id} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
          <h3>Post {index + 1} (ID: {post.id})</h3>
          <p><strong>Type:</strong> {post.content_type}</p>
          <p><strong>Platform:</strong> {post.source_platform}</p>
          <p><strong>Author:</strong> {post.original_author || 'None'}</p>
          <p><strong>Text:</strong> {post.content_text || 'None'}</p>
          <p><strong>Image URL:</strong> {post.content_image_url || 'None'}</p>
          <p><strong>Video URL:</strong> {post.content_video_url || 'None'}</p>
          
          {post.content_image_url && (
            <div>
              <p>Image Preview:</p>
              <img 
                src={post.content_image_url} 
                alt="Test" 
                style={{ maxWidth: '300px', height: 'auto' }}
                onError={(e) => console.error('Image load error:', e)}
                onLoad={() => console.log('Image loaded successfully')}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}