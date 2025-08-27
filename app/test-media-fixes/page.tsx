'use client'

import { useEffect, useState } from 'react'
import AdaptiveTikTokFeed from '@/components/AdaptiveTikTokFeed'

interface TestPost {
  id: number
  content_text: string
  content_image_url?: string
  content_video_url?: string
  content_type: string
  source_platform: string
  original_url?: string
  original_author?: string
  posted_at: string
  is_posted: boolean
}

export default function TestMediaFixesPage() {
  const [testPosts, setTestPosts] = useState<TestPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Create test posts for all platforms - universal media support
    const mockPosts: TestPost[] = [
      {
        id: 25,
        content_text: "Amazing hotdog compilation!",
        content_video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        content_type: "video",
        source_platform: "youtube",
        original_author: "TestUser",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 26,
        content_text: "Funny hotdog dancing GIF",
        content_image_url: "https://giphy.com/gifs/hot-dog-hotdog-26BRuo6sLetdllPAQ",
        content_type: "image", 
        source_platform: "giphy",
        original_author: "GiphyUser",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 27,
        content_text: "Delicious hotdog photo",
        content_image_url: "https://i.imgur.com/hotdog123.jpg",
        content_type: "image",
        source_platform: "imgur", 
        original_author: "ImgurUser",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 28,
        content_text: "Hotdog cooking video",
        content_video_url: "https://sample-videos.com/zip/10/mp4/mp4/SampleVideo_1280x720_1mb.mp4",
        content_type: "video",
        source_platform: "reddit",
        original_author: "RedditUser", 
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 29,
        content_text: "Animated hotdog GIF",
        content_image_url: "https://media.giphy.com/media/3o7aTskHEUdgCQAXde/giphy.gif",
        content_type: "image",
        source_platform: "giphy",
        original_author: "GiphyUser2",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      // UNIVERSAL PLATFORM TESTS - These should now work!
      {
        id: 30,
        content_text: "Bluesky hotdog GIF test",
        content_image_url: "https://media.giphy.com/media/3o7aTskHEUdgCQAXde/giphy.gif",
        content_type: "gif",
        source_platform: "bluesky",
        original_author: "BlueskyUser",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 31,
        content_text: "Bluesky hotdog video",
        content_video_url: "https://sample-videos.com/zip/10/mp4/mp4/SampleVideo_1280x720_1mb.mp4",
        content_type: "video",
        source_platform: "bluesky",
        original_author: "BlueskyUser2",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 32,
        content_text: "Tumblr animated hotdog",
        content_video_url: "https://media.giphy.com/media/hot/giphy.mp4",
        content_type: "gif",
        source_platform: "tumblr",
        original_author: "TumblrUser",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 33,
        content_text: "Tumblr hotdog MP4",
        content_image_url: "https://i.imgur.com/testgif.mp4",
        content_type: "image",
        source_platform: "tumblr",
        original_author: "TumblrUser2",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 34,
        content_text: "Lemmy hotdog cooking video",
        content_video_url: "https://v.redd.it/testvideo.mp4",
        content_type: "video",
        source_platform: "lemmy",
        original_author: "LemmyUser",
        posted_at: new Date().toISOString(),
        is_posted: true
      },
      {
        id: 35,
        content_text: "Lemmy hotdog GIF",
        content_image_url: "https://imgur.com/testgif.gifv",
        content_type: "gif",
        source_platform: "lemmy",
        original_author: "LemmyUser2",
        posted_at: new Date().toISOString(),
        is_posted: true
      }
    ]
    
    setTestPosts(mockPosts)
    setLoading(false)
  }, [])

  return (
    <div style={{ 
      padding: '1rem',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        color: '#333',
        marginBottom: '2rem',
        fontSize: '2rem'
      }}>
        🌭 Media Rendering Fixes Test
      </h1>
      
      <div style={{
        backgroundColor: '#fff',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        border: '1px solid #ddd'
      }}>
        <h2>Universal Platform Media Support Testing:</h2>
        <ul>
          <li>✅ <strong>YouTube</strong>: Enhanced URL detection for all formats</li>
          <li>✅ <strong>Giphy</strong>: GIF rendering (page URLs and direct media)</li>
          <li>✅ <strong>Imgur</strong>: Images and MP4 GIF handling</li>
          <li>✅ <strong>Reddit</strong>: Video playback support</li>
          <li>✅ <strong>Bluesky</strong>: Now supports videos and GIFs!</li>
          <li>✅ <strong>Tumblr</strong>: Now supports videos and GIFs!</li>
          <li>✅ <strong>Lemmy</strong>: Now supports videos and GIFs!</li>
          <li>✅ <strong>Universal</strong>: Any platform can show any media type</li>
        </ul>
        <div style={{
          padding: '1rem',
          backgroundColor: '#e8f5e8',
          borderRadius: '8px',
          marginTop: '1rem'
        }}>
          <strong>🎯 NEW: Platform-Agnostic Media Rendering</strong>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px' }}>Media type is now determined by content, not platform. Any platform can display videos, GIFs, and images!</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div>Loading test content...</div>
        </div>
      ) : (
        <div style={{ 
          maxWidth: '600px', 
          margin: '0 auto',
          backgroundColor: '#fff',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <AdaptiveTikTokFeed 
            posts={testPosts}
            isLoading={false}
          />
        </div>
      )}
    </div>
  )
}