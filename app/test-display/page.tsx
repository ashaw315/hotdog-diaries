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
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    fetchSampleContent()
  }, [refreshCount]) // Re-fetch when refreshCount changes
  
  useEffect(() => {
    
    // Ensure page can scroll - override any CSS that might prevent scrolling
    document.body.style.setProperty('overflow', 'auto', 'important')
    document.body.style.setProperty('overflow-y', 'auto', 'important')
    document.body.style.setProperty('height', 'auto', 'important')
    document.body.style.setProperty('position', 'static', 'important')
    document.body.style.setProperty('width', 'auto', 'important')
    document.documentElement.style.setProperty('overflow', 'auto', 'important')
    document.documentElement.style.setProperty('height', 'auto', 'important')
    
    // Handle scroll for back-to-top button and test scrolling
    const handleScroll = () => {
      const scrollY = window.scrollY
      setShowBackToTop(scrollY > 400)
      setScrollTest(scrollY)
      console.log('Scroll position:', scrollY)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      // Cleanup - restore original CSS
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('overflow-y') 
      document.body.style.removeProperty('height')
      document.body.style.removeProperty('position')
      document.body.style.removeProperty('width')
      document.documentElement.style.removeProperty('overflow')
      document.documentElement.style.removeProperty('height')
    }
  }, [])

  const fetchSampleContent = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Calculate offset based on refresh count (cycle through different sets of content)
      const offset = refreshCount * 2
      
      const response = await fetch(`/api/test/platform-display?offset=${offset}`)
      if (!response.ok) throw new Error('Failed to fetch content')
      
      const data = await response.json()
      
      // Transform the data to match expected interface
      const transformedContent = (data.items || []).map((item: any) => ({
        id: item.id,
        platform: item.source_platform,
        contentType: item.content_type,
        contentText: item.content_text,
        contentImageUrl: item.content_image_url,
        contentVideoUrl: item.content_video_url,
        originalUrl: item.original_url
      }))
      
      setContent(transformedContent)
      
      // If we got less content than expected, reset to beginning
      if (transformedContent.length < 8) {
        setRefreshCount(0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  const handleRefreshContent = () => {
    setRefreshCount(prev => prev + 1)
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
      // Determine the image source - use proxy for problematic platforms
      let imageSrc = contentImageUrl
      let imageLabel = 'Image (img tag)'
      
      if (item.platform === 'pixabay') {
        const pageUrl = item.originalUrl
        imageSrc = `/api/proxy/pixabay-image?url=${encodeURIComponent(contentImageUrl)}&page=${encodeURIComponent(pageUrl)}`
        imageLabel = 'Pixabay Image (via proxy with refresh)'
      } else if (item.platform === 'bluesky') {
        imageSrc = `/api/proxy/bluesky-image?url=${encodeURIComponent(contentImageUrl)}`
        imageLabel = 'Bluesky Image (via AT Protocol proxy)'
      }
      
      return (
        <div>
          <p className="text-xs mb-1">{imageLabel}</p>
          <img 
            src={imageSrc} 
            alt={contentText || 'Content image'}
            style={{ width: '100%', height: '200px', objectFit: 'cover' }}
            onError={(e) => {
              console.error(`❌ Image failed to load for ${item.platform}:`)
              console.error('Original URL:', contentImageUrl)
              console.error('Proxied URL:', imageSrc)
              const target = e.currentTarget
              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ff6b6b"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23fff" font-size="10"%3E' + item.platform.toUpperCase() + ' ERROR%3C/text%3E%3C/svg%3E'
              // Add red border to indicate error
              target.style.border = '2px solid #ff6b6b'
              target.style.borderRadius = '4px'
            }}
            onLoad={() => {
              console.log(`✅ Image loaded successfully for ${item.platform}:`, imageSrc)
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
    <div style={{ 
      minHeight: '200vh', 
      backgroundColor: '#f9fafb',
      overflow: 'auto',
      position: 'relative'
    }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>🌭 Content Display Test</h1>
            <p style={{ color: '#666', margin: '5px 0 0 0' }}>Testing content rendering from all platforms - SCROLL TEST</p>
          </div>
          <button 
            onClick={handleRefreshContent}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#ccc' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                Loading...
              </>
            ) : (
              <>
                <span style={{ fontSize: '18px' }}>🔄</span>
                Load Different Content
              </>
            )}
          </button>
        </div>
        {refreshCount > 0 && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: '#f0f9ff', borderRadius: '6px', fontSize: '14px', color: '#0369a1' }}>
            📊 Showing content set #{refreshCount + 1} (offset: {refreshCount * 2} items per platform)
          </div>
        )}
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
              <div style={{ color: '#16a34a' }}>{[...new Set(content.map(item => item.platform))].length} out of 8</div>
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
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '15px' }}>
              <div style={{ fontWeight: 'bold', color: '#92400e' }}>Content Set</div>
              <div style={{ color: '#d97706' }}>#{refreshCount + 1} (Items {refreshCount * 2 + 1}-{refreshCount * 2 + 2})</div>
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
      
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}