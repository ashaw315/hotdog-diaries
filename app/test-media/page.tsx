'use client'

import MediaRenderer from '@/components/media/MediaRenderer'
import { ContentType, SourcePlatform } from '@/types'

export default function TestMediaPage() {
  return (
    <div style={{ 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>🌭 Media Test Page</h1>
      <p>Testing MediaRenderer component with various media types. This page should scroll!</p>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>1. YouTube Video Test</h2>
        <MediaRenderer
          videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          contentType={ContentType.VIDEO}
          platform={SourcePlatform.YOUTUBE}
          alt="YouTube video test"
          style={{ width: '100%', maxWidth: '500px', maxHeight: '300px' }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>2. Direct Image Test</h2>
        <MediaRenderer
          imageUrl="https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop"
          contentType={ContentType.IMAGE}
          platform={SourcePlatform.PIXABAY}
          alt="Test image"
          style={{ width: '100%', maxWidth: '500px', maxHeight: '300px' }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>3. GIF Test</h2>
        <MediaRenderer
          imageUrl="https://media.giphy.com/media/3o7aTskHEUdgCQAXde/giphy.gif"
          contentType={ContentType.IMAGE}
          platform={SourcePlatform.GIPHY}
          alt="Test GIF"
          style={{ width: '100%', maxWidth: '500px', maxHeight: '300px' }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>4. Placeholder Image Test</h2>
        <MediaRenderer
          imageUrl="https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=Hot+Dog+Test"
          contentType={ContentType.IMAGE}
          platform={SourcePlatform.TUMBLR}
          alt="Placeholder test"
          style={{ width: '100%', maxWidth: '500px', maxHeight: '300px' }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>5. Broken URL Test (Should Show Fallback)</h2>
        <MediaRenderer
          imageUrl="https://example.com/broken-image.jpg"
          contentType={ContentType.IMAGE}
          platform={SourcePlatform.REDDIT}
          alt="Broken URL test"
          style={{ width: '100%', maxWidth: '500px', maxHeight: '300px' }}
        />
      </div>

      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ 
          padding: '1rem', 
          marginBottom: '1rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <h3>Additional Content Block {i + 1}</h3>
          <p>This is extra content to test scrolling. Block number {i + 1}.</p>
        </div>
      ))}
      
      <div style={{ 
        padding: '2rem',
        backgroundColor: '#4ade80',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '1.2rem',
        fontWeight: 'bold'
      }}>
        🎉 If you can see this, the page scrolls AND media components work!
      </div>
    </div>
  )
}