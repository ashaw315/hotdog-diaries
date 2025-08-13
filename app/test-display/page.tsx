'use client'

import { useEffect, useState } from 'react'

interface ContentItem {
  id: number
  platform: string
  contentType: string
  contentText: string | null
  contentImageUrl: string | null
  contentVideoUrl: string | null
  originalUrl: string
}

export default function TestDisplayPage() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [scrollTest, setScrollTest] = useState(0)

  useEffect(() => {
    fetchSampleContent()
    
    // Handle scroll for back-to-top button and test scrolling
    const handleScroll = () => {
      const scrollY = window.scrollY
      setShowBackToTop(scrollY > 400)
      setScrollTest(scrollY)
      console.log('Scroll position:', scrollY)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const fetchSampleContent = async () => {
    try {
      const response = await fetch('/api/test/display-samples')
      if (!response.ok) throw new Error('Failed to fetch content')
      
      const data = await response.json()
      setContent(data.samples)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderContent = (item: ContentItem) => {
    const { contentType, contentImageUrl, contentVideoUrl, contentText, originalUrl } = item

    // YouTube videos
    if (item.platform === 'youtube' && contentVideoUrl) {
      const videoId = contentVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      if (videoId) {
        return (
          <div>
            <p className="text-xs mb-1">YouTube Embed (iframe)</p>
            <iframe
              width="100%"
              height="200"
              src={`https://www.youtube.com/embed/${videoId}`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )
      }
    }

    // Giphy GIFs (use MP4 if available)
    if (item.platform === 'giphy' && contentVideoUrl) {
      return (
        <div>
          <p className="text-xs mb-1">Giphy MP4 (video tag)</p>
          <video
            autoPlay
            loop
            muted
            playsInline
            width="100%"
            height="200"
          >
            <source src={contentVideoUrl} type="video/mp4" />
            {contentImageUrl && <img src={contentImageUrl} alt="GIF fallback" />}
          </video>
        </div>
      )
    }

    // Images (Pixabay, Imgur, Reddit with images)
    if (contentImageUrl && contentType === 'image') {
      return (
        <div>
          <p className="text-xs mb-1">Image (img tag)</p>
          <img 
            src={contentImageUrl} 
            alt={contentText || 'Content image'}
            style={{ width: '100%', height: '200px', objectFit: 'cover' }}
            onError={(e) => {
              console.error('Image failed to load:', contentImageUrl)
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ccc"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23666"%3EImage Error%3C/text%3E%3C/svg%3E'
            }}
          />
        </div>
      )
    }

    // Text content (Bluesky, some Reddit/Lemmy)
    if (contentText && contentType === 'text') {
      return (
        <div>
          <p className="text-xs mb-1">Text Content</p>
          <div className="p-2 bg-gray-100 rounded h-[200px] overflow-y-auto">
            <p className="text-sm">{contentText}</p>
          </div>
        </div>
      )
    }

    // Fallback
    return (
      <div>
        <p className="text-xs mb-1">Unknown Content Type</p>
        <div className="p-2 bg-red-100 rounded">
          <p className="text-xs">Type: {contentType}</p>
          <p className="text-xs">Has Image: {contentImageUrl ? 'Yes' : 'No'}</p>
          <p className="text-xs">Has Video: {contentVideoUrl ? 'Yes' : 'No'}</p>
          <p className="text-xs">Has Text: {contentText ? 'Yes' : 'No'}</p>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🌭</div>
        <div>Loading content samples...</div>
      </div>
    </div>
  )
  
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-red-500">
        <div className="text-4xl mb-4">❌</div>
        <div>Error: {error}</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '200vh', backgroundColor: '#f9fafb' }}>
      {/* Scroll Test Banner */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        right: 0, 
        background: '#000', 
        color: '#fff', 
        padding: '10px', 
        fontSize: '12px',
        zIndex: 1000
      }}>
        Scroll: {scrollTest}px
      </div>
      
      {/* Header */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>🌭 Content Display Test</h1>
        <p style={{ color: '#666', margin: '5px 0 0 0' }}>Testing content rendering from all platforms - SCROLL TEST</p>
      </div>

      {/* Content Grid */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {content.map((item, index) => (
          <div key={item.id} style={{ 
            backgroundColor: 'white', 
            marginBottom: '40px', 
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {/* Platform Header */}
            <div style={{
              background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
              color: 'white',
              padding: '20px'
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                {index + 1}. {item.platform.toUpperCase()}
              </h2>
              <p style={{ fontSize: '14px', margin: '5px 0 0 0', opacity: 0.9 }}>
                Platform #{index + 1} • ID: {item.id} • Type: {item.contentType}
              </p>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                Image: {item.contentImageUrl ? '✓' : '✗'} | Video: {item.contentVideoUrl ? '✓' : '✗'}
              </div>
            </div>

            {/* Content Display */}
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Left: Content Preview */}
                <div>
                  <h3 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Content Preview</h3>
                  <div style={{ 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px', 
                    overflow: 'hidden', 
                    backgroundColor: '#f9fafb',
                    minHeight: '200px'
                  }}>
                    {renderContent(item)}
                  </div>
                </div>

                {/* Right: Metadata */}
                <div>
                  <h3 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Content Details</h3>
                  <div style={{ fontSize: '14px' }}>
                    <div style={{ backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
                      <div style={{ fontWeight: '500', marginBottom: '5px' }}>Text Content:</div>
                      <div style={{ maxHeight: '60px', overflow: 'auto' }}>
                        {item.contentText || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No text content</span>}
                      </div>
                    </div>
                    
                    <div style={{ backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
                      <div style={{ fontWeight: '500', marginBottom: '5px' }}>Image URL:</div>
                      <div style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                        {item.contentImageUrl || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No image URL</span>}
                      </div>
                    </div>
                    
                    <div style={{ backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>
                      <div style={{ fontWeight: '500', marginBottom: '5px' }}>Video URL:</div>
                      <div style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                        {item.contentVideoUrl || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No video URL</span>}
                      </div>
                    </div>

                    <a 
                      href={item.originalUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      View Original Source →
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ))}

        {/* Scroll Test Sections */}
        <div style={{ marginTop: '40px', padding: '40px', backgroundColor: 'white', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>🔍 Scroll Test Sections</h2>
          
          {[1,2,3,4,5].map(num => (
            <div key={num} style={{ 
              padding: '40px', 
              marginBottom: '20px', 
              backgroundColor: num % 2 === 0 ? '#f3f4f6' : '#e5e7eb',
              borderRadius: '6px'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                Section {num} - Keep Scrolling Test
              </h3>
              <p>This is test content to ensure the page scrolls properly. Current scroll position: {scrollTest}px</p>
              <div style={{ height: '100px', backgroundColor: '#ddd6fe', margin: '10px 0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Test Block {num}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{ marginTop: '40px', backgroundColor: 'white', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>🔍 Test Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '15px' }}>
              <div style={{ fontWeight: 'bold', color: '#166534' }}>Platforms Found</div>
              <div style={{ color: '#16a34a' }}>{content.length} out of 8</div>
            </div>
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '15px' }}>
              <div style={{ fontWeight: 'bold', color: '#1e40af' }}>Content Types</div>
              <div style={{ color: '#2563eb' }}>
                {[...new Set(content.map(item => item.contentType))].join(', ')}
              </div>
            </div>
            <div style={{ backgroundColor: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: '6px', padding: '15px' }}>
              <div style={{ fontWeight: 'bold', color: '#7c2d12' }}>Scroll Status</div>
              <div style={{ color: '#a855f7' }}>Position: {scrollTest}px</div>
            </div>
          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px',
            borderRadius: '50%',
            border: 'none',
            boxShadow: '0 10px 15px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            zIndex: 1000
          }}
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
      
      {/* Bottom marker */}
      <div style={{ 
        height: '200px', 
        backgroundColor: '#fecaca', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        🎯 END OF PAGE - SCROLLING WORKS!
      </div>
    </div>
  )
}