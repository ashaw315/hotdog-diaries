'use client'

import { useState, useEffect, useRef } from 'react'
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
  content_metadata?: string
  scraped_at: Date
  is_posted: boolean
  is_approved: boolean
  posted_at?: Date
}

// Helper to determine card class based on content
function getCardClass(post: Post): string {
  if (post.content_type === 'video' && post.source_platform === 'youtube') return 'card-youtube'
  if (post.content_type === 'gif' || post.source_platform === 'giphy') return 'card-gif'
  
  // Check for mixed content (both text and image/video)
  if (post.content_text && (post.content_image_url || post.content_video_url)) {
    if (post.source_platform === 'bluesky') return 'card-mixed card-bluesky'
    return 'card-mixed'
  }
  
  // Pure image/video content (no text)
  if (post.content_image_url && !post.content_text) return 'card-image'
  if (post.content_video_url && !post.content_text) return 'card-video'
  
  // Pure text content
  if (post.content_type === 'text' || (!post.content_image_url && !post.content_video_url)) {
    // Special handling for Bluesky text
    if (post.source_platform === 'bluesky') return 'card-text card-bluesky'
    return 'card-text'
  }
  
  return 'card-default'
}

// Helper to determine if content is portrait/tall
function isPortraitContent(url: string): boolean {
  // Common portrait platforms/patterns
  return url.includes('tiktok') || url.includes('instagram') || url.includes('stories')
}


export default function AdaptiveTikTokFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDebugBorders, setShowDebugBorders] = useState(false)
  const [showSizeDebug, setShowSizeDebug] = useState(false)
  const [cardSizes, setCardSizes] = useState<{[key: number]: any}>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef<{ [key: number]: HTMLVideoElement }>({})

  useEffect(() => {
    fetchPosts()
  }, [])


  // Apply critical platform-specific fixes via JavaScript
  useEffect(() => {
    if (posts.length > 0) {
      const timer = setTimeout(() => {
        try {
          // SAFETY GUARD: Process only first 16 cards to prevent performance issues
          const postsToProcess = posts.slice(0, 16)
          
          // Batch DOM operations using requestAnimationFrame for better performance
          requestAnimationFrame(() => {
            postsToProcess.forEach((post) => {
              const cardElement = document.querySelector(`[data-card-id="${post.id}"]`) as HTMLElement
              if (!cardElement) return

              // YouTube smart scaling fallback
              if (post.source_platform === 'youtube') {
                const iframe = cardElement.querySelector('iframe') as HTMLIFrameElement
                if (iframe && iframe.style.width === '') {
                  // Fallback smart scaling if onLoad didn't trigger
                  const vw = window.innerWidth;
                  const vh = window.innerHeight;
                  const constraints = vw < 480 ? 
                    { minHeight: vh * 0.5, maxWidth: vw * 0.95, maxHeight: vh * 0.7 } :
                    vw < 768 ? 
                    { minHeight: 400, maxWidth: vw * 0.85, maxHeight: vh * 0.75 } :
                    { minHeight: 500, maxWidth: Math.min(vw * 0.8, 800), maxHeight: vh * 0.85 };
                  
                  const ytAspectRatio = 16 / 9;
                  let ytHeight = Math.min(constraints.minHeight, constraints.maxHeight);
                  let ytWidth = ytHeight * ytAspectRatio;
                  
                  if (ytWidth > constraints.maxWidth) {
                    ytWidth = constraints.maxWidth;
                    ytHeight = ytWidth / ytAspectRatio;
                  }
                  
                  iframe.style.width = `${ytWidth}px`;
                  iframe.style.height = `${ytHeight}px`;
                  
                  const card = iframe.closest('.content-card') as HTMLElement;
                  if (card) {
                    card.style.width = `${ytWidth}px`;
                    card.style.height = `${ytHeight}px`;
                  }
                  
                  console.log(`🎥 YouTube smart fallback: ${post.id} (${Math.round(ytWidth)}×${Math.round(ytHeight)} fits: ${ytWidth <= vw * 0.9})`);
                }
              }

              // Fix Bluesky text visibility - FORCE black text EVERYWHERE
              if (post.source_platform === 'bluesky') {
                const textContainer = cardElement.querySelector('.text-container') as HTMLElement
                if (textContainer) {
                  // Force black text on container and ALL children + add margin (no width override)
                  textContainer.style.cssText = 'color: #000000 !important; background-color: #ffffff !important; font-size: 16px; margin: 2rem !important;'
                  
                  // Apply to ALL text elements
                  const allTextElements = textContainer.querySelectorAll('p, span, div, *')
                  allTextElements.forEach(el => {
                    (el as HTMLElement).style.setProperty('color', '#000000', 'important');
                    (el as HTMLElement).style.color = '#000000';
                  });
                  
                  // Also set on card wrapper - should be transparent to show hotdog background  
                  cardElement.style.color = '#000000';
                  cardElement.style.removeProperty('background-color'); // Remove any background to show hotdogs
                  
                  console.log(`📝 Fixed Bluesky text color (FORCED BLACK): ${post.id}`)
                }
              }
            })
          })
        } catch (error) {
          console.error('❌ Error applying style fixes:', error)
        }
      }, 200) // Small delay to ensure elements are rendered

      return () => clearTimeout(timer)
    }
  }, [posts])

  // EMERGENCY: Clean up any expanded YouTube players  
  useEffect(() => {
    const cleanupYouTubePlayers = () => {
      // Remove any full YouTube players that might have expanded
      const players = document.querySelectorAll('.html5-video-player, .ytp-player')
      players.forEach(player => {
        const card = player.closest('[data-card-id]')
        if (card) {
          console.log(`🚨 Removing expanded YouTube player from card ${card.getAttribute('data-card-id')}`)
          // Don't remove the player, just force it to be contained
          const playerElement = player as HTMLElement
          playerElement.style.maxWidth = '400px'
          playerElement.style.maxHeight = '225px' 
          playerElement.style.overflow = 'hidden'
        }
      })

      // YouTube containers are now scaled by onLoad handlers
      const containers = document.querySelectorAll('.youtube-container')
      containers.forEach(container => {
        const containerElement = container as HTMLElement
        // Only apply if not already scaled
        if (!containerElement.style.width) {
          containerElement.style.background = 'black'
        }
      })
    }

    const timer = setTimeout(cleanupYouTubePlayers, 500)
    return () => clearTimeout(timer)
  }, [posts])

  // Measure cards when size debug is enabled
  useEffect(() => {
    if (!showSizeDebug || posts.length === 0) return

    const measureCards = () => {
      const newSizes: {[key: number]: any} = {}
      
      posts.forEach((post) => {
        const cardElement = document.querySelector(`[data-card-id="${post.id}"]`) as HTMLElement
        if (!cardElement) return
        
        const contentElement = cardElement.querySelector('.content-card') as HTMLElement
        const mediaElement = cardElement.querySelector('img, video, iframe, .text-container') as HTMLElement
        
        if (contentElement && mediaElement) {
          const cardBounds = contentElement.getBoundingClientRect()
          const mediaBounds = mediaElement.getBoundingClientRect()
          
          newSizes[post.id] = {
            card: {
              width: cardBounds.width,
              height: cardBounds.height
            },
            content: {
              width: mediaBounds.width,
              height: mediaBounds.height,
              type: mediaElement.tagName.toLowerCase()
            },
            diff: {
              width: cardBounds.width - mediaBounds.width,
              height: cardBounds.height - mediaBounds.height
            },
            platform: post.source_platform
          }
        }
      })
      
      setCardSizes(newSizes)
      console.log('📏 Card measurements:', newSizes)
    }

    const timer = setTimeout(measureCards, 500)
    return () => clearTimeout(timer)
  }, [showSizeDebug, posts, currentIndex])

  // Verification and fix function to ensure no whitespace
  useEffect(() => {
    if (posts.length === 0) return;

    const verifyNoWhitespace = () => {
      posts.forEach((post) => {
        const cardElement = document.querySelector(`[data-card-id="${post.id}"]`) as HTMLElement
        if (!cardElement) return;

        const contentCard = cardElement.querySelector('.content-card') as HTMLElement
        const content = contentCard?.querySelector('img, video, iframe, .text-container') as HTMLElement

        if (contentCard && content) {
          const cardRect = contentCard.getBoundingClientRect();
          const contentRect = content.getBoundingClientRect();

          // Check for whitespace gaps
          const heightDiff = Math.abs(cardRect.height - contentRect.height);
          const widthDiff = Math.abs(cardRect.width - contentRect.width);

          if (heightDiff > 2 || widthDiff > 2) { // Allow 2px tolerance
            console.warn(`⚠️  Whitespace detected on ${post.source_platform} ${post.id}: Card ${Math.round(cardRect.width)}×${Math.round(cardRect.height)} vs Content ${Math.round(contentRect.width)}×${Math.round(contentRect.height)}`);
            
            // Force fix - card matches content exactly
            contentCard.style.width = `${contentRect.width}px`;
            contentCard.style.height = `${contentRect.height}px`;
            contentCard.style.minHeight = 'unset';
            contentCard.style.maxHeight = 'unset';
            
            console.log(`🔧 Fixed whitespace: ${post.source_platform} now ${Math.round(contentRect.width)}×${Math.round(contentRect.height)}`);
          }
        }
      });
    };

    // Run verification after scaling completes
    const timer = setTimeout(verifyNoWhitespace, 1000);
    return () => clearTimeout(timer);
  }, [posts])

  // Content scaling is handled by individual onLoad handlers

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/content?limit=50')
      
      if (!response.ok) {
        throw new Error('Failed to load content')
      }
      
      const data = await response.json()
      
      // Add welcome card
      const welcomeCard: Post = {
        id: -999,
        content_text: "Welcome to Hotdog Diaries! Swipe up to see the best hotdog content from around the internet.",
        content_type: 'text' as ContentType,
        source_platform: 'reddit' as SourcePlatform,
        original_url: '',
        original_author: 'Hotdog Diaries',
        scraped_at: new Date(),
        is_posted: false,
        is_approved: true
      }
      
      // Transform API response to match Post interface
      const transformedContent = data.data.content.map((item: any) => ({
        ...item,
        is_posted: !!item.is_posted,
        is_approved: !!item.is_approved,
        scraped_at: new Date(item.scraped_at),
        posted_at: item.posted_at ? new Date(item.posted_at) : undefined
      }))
      
      setPosts([welcomeCard, ...transformedContent])
      console.log(`✅ Loaded ${transformedContent.length} posts with minimum height system applied`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  const handleScroll = () => {
    if (!containerRef.current) return
    
    const scrollTop = containerRef.current.scrollTop
    const viewportHeight = window.innerHeight
    const newIndex = Math.round(scrollTop / viewportHeight)
    
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex)
      
      // Pause previous video
      if (videosRef.current[currentIndex]) {
        videosRef.current[currentIndex].pause()
      }
      
      // Play new video if exists
      if (videosRef.current[newIndex]) {
        videosRef.current[newIndex].play().catch(() => {})
      }
    }
  }

  // Toggle debug features with keyboard
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebugBorders(prev => !prev)
      } else if (e.key === 's' || e.key === 'S') {
        setShowSizeDebug(prev => !prev)
      } else if (e.key === 't' || e.key === 'T') {
        // Test smart scaling results
        console.log('=== Smart Scaling Test Results ===');
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        console.log(`Viewport: ${vw}×${vh}`);
        
        document.querySelectorAll('.content-card').forEach(card => {
          const rect = card.getBoundingClientRect();
          const platform = card.closest('[data-card-id]')?.querySelector('.platform-badge')?.textContent || 'unknown';
          const fitsWidth = rect.width <= vw * 0.9;
          const fitsHeight = rect.height <= vh * 0.85;
          console.log(`${platform}: ${Math.round(rect.width)}×${Math.round(rect.height)} (fits screen: width=${fitsWidth}, height=${fitsHeight})`);
        });
      }
    }
    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [])

  const getPlatformIcon = (platform: SourcePlatform) => {
    const icons: Record<SourcePlatform, string> = {
      reddit: '🟠',
      youtube: '🔴',
      pixabay: '📸',
      news: '📰',
      mastodon: '🐘',
      bluesky: '🦋',
      giphy: '🎬',
      tumblr: '💙',
      lemmy: '🐭'
    }
    return icons[platform] || '🌐'
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner">🌭</div>
          <p>Loading hotdog content...</p>
        </div>
        <style jsx>{`
          .loading-container {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f0f0f0;
          }
          .loading-content {
            text-align: center;
          }
          .spinner {
            font-size: 48px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
        <style jsx>{`
          .error-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
          }
          button {
            padding: 8px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Fixed header */}
      <div className="header-title">
        <span className="hotdog-icon">🌭</span>
        <span className="title-text">Hotdog Diaries</span>
        {showDebugBorders && <span className="debug-indicator">DEBUG</span>}
        {showSizeDebug && <span className="debug-indicator" style={{ background: 'blue' }}>SIZE</span>}
      </div>
      
      {/* Debug controls - temporary */}
      <div className="debug-controls" style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 100,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '8px',
        borderRadius: '8px',
        display: 'flex',
        gap: '6px',
        fontSize: '11px'
      }}>
        <button 
          onClick={() => setShowDebugBorders(!showDebugBorders)}
          style={{ padding: '3px 6px', fontSize: '11px' }}
        >
          Borders (D)
        </button>
        <button 
          onClick={() => setShowSizeDebug(!showSizeDebug)}
          style={{ padding: '3px 6px', fontSize: '11px' }}
        >
          Sizes (S)
        </button>
        <button 
          onClick={() => {
            console.log('=== BLUESKY CSS DEBUG ANALYSIS ===');
            
            // Find the specific problematic card
            const problemCard = Array.from(document.querySelectorAll('[data-card-id]')).find(el => {
              const text = el.textContent;
              return text && text.includes('sausage is way too big');
            });
            
            if (problemCard) {
              const cardId = problemCard.getAttribute('data-card-id');
              const card = problemCard.querySelector('.content-card') as HTMLElement;
              const textContainer = problemCard.querySelector('.text-container') as HTMLElement;
              
              if (card && textContainer) {
                const cardStyles = window.getComputedStyle(card);
                const textStyles = window.getComputedStyle(textContainer);
                
                console.log(`🎯 FOUND PROBLEM CARD ${cardId}:`);
                console.log('Card classes:', card.className);
                console.log('Text container classes:', textContainer.className);
                console.log('Card computed styles:', {
                  margin: cardStyles.margin,
                  padding: cardStyles.padding,
                  backgroundColor: cardStyles.backgroundColor,
                  borderRadius: cardStyles.borderRadius,
                  boxShadow: cardStyles.boxShadow,
                  width: cardStyles.width,
                  height: cardStyles.height
                });
                console.log('Text container computed styles:', {
                  margin: textStyles.margin,
                  padding: textStyles.padding,
                  backgroundColor: textStyles.backgroundColor,
                  borderRadius: textStyles.borderRadius,
                  color: textStyles.color
                });
                
                // Check if CSS selectors exist
                const hasBlueskyStyles = Array.from(document.styleSheets).some(sheet => {
                  try {
                    return Array.from(sheet.cssRules || []).some(rule => 
                      rule.cssText && (
                        rule.cssText.includes('card-bluesky') || 
                        rule.cssText.includes('bluesky-text-container')
                      )
                    );
                  } catch(e) { return false; }
                });
                
                console.log('CSS rules present:', hasBlueskyStyles);
                console.log('Has card-bluesky class:', card.className.includes('card-bluesky'));
                console.log('Has bluesky-text-container class:', textContainer.className.includes('bluesky-text-container'));
              }
            } else {
              console.log('❌ Problem card not found on page');
            }
            
            // General verification
            console.log('=== ALL CARD VERIFICATION ===');
            document.querySelectorAll('.content-card').forEach(card => {
              const cardRect = card.getBoundingClientRect();
              const cardId = card.closest('[data-card-id]')?.getAttribute('data-card-id');
              const platform = card.closest('[data-card-id]')?.querySelector('.platform-badge')?.textContent || 'unknown';
              
              if (platform.includes('bluesky')) {
                const computedStyles = window.getComputedStyle(card);
                console.log(`🦋 Bluesky Card ${cardId}:`, {
                  hasProperMargin: computedStyles.margin !== '0px',
                  margin: computedStyles.margin,
                  backgroundColor: computedStyles.backgroundColor,
                  classes: (card as HTMLElement).className
                });
              }
            });
          }}
          style={{ padding: '3px 6px', fontSize: '11px' }}
        >
          Verify (T)
        </button>
      </div>
      
      {/* Feed container */}
      <div 
        ref={containerRef}
        className="feed-container"
        onScroll={handleScroll}
      >
        {posts.map((post, index) => (
          <div 
            key={post.id} 
            className={`card-wrapper ${showDebugBorders ? 'debug-borders' : ''}`}
            data-card-id={post.id}
          >
            <div className={`content-card ${getCardClass(post)}`}>
              <PostContent 
                post={post} 
                isActive={index === currentIndex}
                videoRef={(el) => {
                  if (el) videosRef.current[index] = el
                }}
                getPlatformIcon={getPlatformIcon}
              />
              {showSizeDebug && cardSizes[post.id] && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  zIndex: 10,
                  lineHeight: '1.4'
                }}>
                  <div>{post.source_platform} ({cardSizes[post.id].content.type})</div>
                  <div>Card: {Math.round(cardSizes[post.id].card.width)}×{Math.round(cardSizes[post.id].card.height)}</div>
                  <div>Content: {Math.round(cardSizes[post.id].content.width)}×{Math.round(cardSizes[post.id].content.height)}</div>
                  <div style={{ color: cardSizes[post.id].diff.height > 0 ? '#ff6666' : '#66ff66' }}>
                    Diff: {Math.round(cardSizes[post.id].diff.width)}×{Math.round(cardSizes[post.id].diff.height)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>


      <style jsx>{`
        .page-container {
          height: 100vh;
          background: url('/hotdog-tile.jpg') repeat;
          background-size: 100px 100px;
          position: relative;
          overflow: hidden;
        }

        .header-title {
          position: fixed;
          top: 20px;
          left: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 24px;
          font-weight: 700;
          color: black;
          z-index: 100;
          background: rgba(255, 255, 255, 0.9);
          padding: 8px 12px;
          border-radius: 8px;
          backdrop-filter: blur(10px);
        }

        .debug-indicator {
          font-size: 12px;
          background: red;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
        }

        .feed-container {
          height: 100vh;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .feed-container::-webkit-scrollbar {
          display: none;
        }

        .card-wrapper {
          width: 100vw;
          min-height: 100vh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          box-sizing: border-box;
        }

        .card-wrapper.debug-borders {
          border: 3px solid red;
          background: rgba(255, 0, 0, 0.05);
        }

        /* Base card - exact fit to content dimensions */
        .content-card {
          background: black;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          display: block;
          margin: 0 auto; /* Center in viewport */
          padding: 0 !important; /* No padding that adds to size */
          box-sizing: border-box;
          
          /* CRITICAL: Let content determine size - NO fixed dimensions */
          width: fit-content !important;
          height: fit-content !important;
          min-height: unset !important; /* Remove any min-height forcing */
          
          /* Safety constraints for layout protection */
          max-width: 90vw;
          max-height: 80vh !important; /* NEVER taller than 80% of viewport */
        }

        /* All images must respect viewport height */
        .content-card img {
          max-height: 80vh !important;
          max-width: 90vw !important;
          object-fit: contain; /* Maintain aspect ratio */
        }

        /* All videos must respect viewport height */
        .content-card video {
          max-height: 80vh !important;
          max-width: 90vw !important;
          object-fit: contain;
        }

        /* YouTube cards - dimensions set by JavaScript */
        .card-youtube {
          background: black;
          display: block;
          /* Width and height set by scaling logic */
        }

        /* Image and GIF cards - dimensions set by JavaScript */
        .card-image,
        .card-gif {
          background: black;
          display: block;
          /* Dimensions set by scaling logic */
        }

        /* Text cards - minimum 500px height */
        .card-text {
          min-height: 500px;
          width: 400px; /* Fixed width for text readability */
          background: #ffffff;
          display: block;
          color: black;
        }

        /* Mixed content cards */
        .card-mixed {
          min-height: 500px;
          justify-content: flex-start;
          align-items: stretch;
        }

        /* Bluesky specific styling - FORCE black text */
        .card-bluesky {
          background: #ffffff !important; /* White background for readability */
          color: #000000 !important; /* Black text */
        }
        
        /* Force ALL Bluesky text elements to be black */
        .card-bluesky *,
        .card-bluesky p,
        .card-bluesky span,
        .card-bluesky div,
        .card-bluesky .text-container,
        .card-bluesky .text-content,
        .card-bluesky .text-content p {
          color: #000000 !important;
          background-color: transparent !important;
        }
        
        /* Bluesky text container - combined styles */
        .card-bluesky .text-container {
          background: #ffffff !important;
          color: #000000 !important;
          height: 100%;
          overflow-y: auto;
          padding: 24px;
          text-align: left;
        }
        
        /* Bluesky mixed content (text above image) */
        .bluesky-mixed-container {
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-end !important;
          max-height: 700px !important;
          width: auto !important;
          background: white;
          overflow: hidden;
        }

        .bluesky-mixed-container .text-container {
          flex-shrink: 0 !important; /* Don't shrink text */
          background: white;
          padding: 1.5rem;
          color: #000000 !important;
          max-height: 150px; /* Limit text area */
          overflow: auto;
        }

        .bluesky-mixed-container .image-container {
          flex: 1 !important; /* Take remaining space */
          min-height: 0; /* Allow shrinking */
          overflow: hidden;
          display: flex !important;
          justify-content: flex-start !important;
          padding: 0.5rem !important;
          border-radius: 47px !important;
        }

        .bluesky-mixed-container img {
          max-width: 100% !important;
          width: auto !important;
          height: 400px !important;
          object-fit: contain !important;
        }
        
        .bluesky-mixed-container .text-container,
        .bluesky-mixed-container .text-container *,
        .bluesky-mixed-container .text-container p,
        .bluesky-mixed-container .text-container div {
          color: #000000 !important;
        }
        
        /* Mobile adjustments for Bluesky mixed */
        @media (max-width: 768px) {
          .bluesky-mixed-container {
            max-height: 70vh !important;
          }
          
          .bluesky-mixed-container .text-container {
            padding: 1rem !important;
            max-height: 120px !important;
          }
        }
        
        /* Bluesky text-only cards - ensure they get proper styling */
        .bluesky-text-container {
          background: #ffffff !important;
          color: #000000 !important;
          margin: 2rem !important;
          padding: 24px !important;
          border-radius: 12px !important;
          width: 400px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          text-align: left !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
        }
        
        .bluesky-text-container * {
          color: #000000 !important;
        }
        
        .bluesky-text-container .platform-badge {
          background-color: #f0f0f0 !important;
          color: #000000 !important;
          padding: 8px 16px !important;
          border-radius: 20px !important;
          font-size: 14px !important;
          margin-bottom: 16px !important;
        }
        
        .bluesky-text-container .text-content p {
          color: #000000 !important;
          font-size: 18px !important;
          line-height: 1.6 !important;
          margin: 0 !important;
        }
        
        /* Tumblr text-only cards - match Bluesky styling exactly */
        .tumblr-text-container {
          background: #ffffff !important;
          color: #000000 !important;
          margin: 2rem !important;
          padding: 24px !important;
          border-radius: 12px !important;
          width: 400px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          text-align: left !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
        }
        
        .tumblr-text-container * {
          color: #000000 !important;
        }
        
        .tumblr-text-container .platform-badge {
          background-color: #f0f0f0 !important;
          color: #000000 !important;
          padding: 8px 16px !important;
          border-radius: 20px !important;
          font-size: 14px !important;
          margin-bottom: 16px !important;
        }
        
        .tumblr-text-container .text-content {
          flex: 1 !important;
          display: flex !important;
          align-items: center !important;
          color: #000000 !important;
        }
        
        .tumblr-text-container .text-content p {
          color: #000000 !important;
          font-size: 18px !important;
          line-height: 1.6 !important;
          margin: 0 !important;
        }
        
        .bluesky-text-container .author {
          color: #666666 !important;
          font-size: 14px !important;
          margin-top: 16px !important;
        }
        
        /* Lemmy text-only cards - match Bluesky/Tumblr styling exactly */
        .lemmy-text-container {
          background: #ffffff !important;
          color: #000000 !important;
          margin: 2rem !important;
          padding: 24px !important;
          border-radius: 12px !important;
          width: 400px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          text-align: left !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
        }
        
        .lemmy-text-container * {
          color: #000000 !important;
        }
        
        .lemmy-text-container .platform-badge {
          background-color: #f0f0f0 !important;
          color: #000000 !important;
          padding: 8px 16px !important;
          border-radius: 20px !important;
          font-size: 14px !important;
          margin-bottom: 16px !important;
        }
        
        .lemmy-text-container .text-content {
          flex: 1 !important;
          display: flex !important;
          align-items: center !important;
          color: #000000 !important;
        }
        
        .lemmy-text-container .text-content p {
          color: #000000 !important;
          font-size: 18px !important;
          line-height: 1.6 !important;
          margin: 0 !important;
        }
        
        .lemmy-text-container .author {
          color: #000000 !important;
          font-size: 14px !important;
          margin-top: 16px !important;
        }
        
        /* Mixed content containers removed - Reddit, Tumblr, Lemmy now show media only */

        .card-bluesky .text-content {
          align-items: flex-start;
          justify-content: flex-start;
        }

        .card-bluesky .text-content p {
          font-size: 16px;
          line-height: 1.6;
          color: #000000;
          margin-bottom: 12px;
        }

        /* Responsive minimum heights */
        
        /* Desktop: 500px minimum */
        @media (min-width: 769px) {
          .content-card {
            min-height: 500px;
          }
          .card-image, .card-gif {
            min-height: 400px;
          }
        }

        /* Tablet: 450px minimum */
        @media (min-width: 481px) and (max-width: 768px) {
          .content-card {
            min-height: 450px;
          }
          .card-image, .card-gif {
            min-height: 350px;
          }
          .header-title {
            font-size: 20px;
            top: 15px;
            left: 15px;
          }
          .card-wrapper {
            padding: 20px 16px;
          }
        }

        /* Responsive design - NO fixed dimensions, constraints handled by JavaScript */
        @media (max-width: 480px) {
          .content-card {
            max-width: 95vw !important;  /* Only constrain max width */
            border-radius: 8px;
            /* No min-height - let content determine */
          }
          .header-title {
            font-size: 18px;
            top: 10px;
            left: 10px;
          }
          .card-wrapper {
            padding: 15px 10px;
          }
        }
        
        /* Tablet: Only width constraints */
        @media (min-width: 481px) and (max-width: 768px) {
          .content-card {
            max-width: 85vw !important;    /* Only constrain max width */
            /* No fixed heights - JavaScript handles this */
          }
          .header-title {
            font-size: 20px;
            top: 15px;
            left: 15px;
          }
          .card-wrapper {
            padding: 20px 16px;
          }
        }
        
        /* Desktop: Only width constraints */
        @media (min-width: 769px) {
          .content-card {
            max-width: min(80vw, 800px) !important; /* Only width constraint */
            /* Height is determined by scaled content exactly */
          }
        }

        /* Large screens */
        @media (min-width: 1200px) {
          .content-card {
            max-width: 600px;
          }
        }
      `}</style>
    </div>
  )
}

function PostContent({ 
  post, 
  isActive, 
  videoRef,
  getPlatformIcon
}: { 
  post: Post
  isActive: boolean
  videoRef?: (el: HTMLVideoElement | null) => void
  getPlatformIcon: (platform: SourcePlatform) => string
}) {
  const [imageError, setImageError] = useState(false)
  const [videoError, setVideoError] = useState(false)

  // Get responsive constraints based on screen size
  const getResponsiveConstraints = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    if (vw < 480) { // Mobile
      return {
        minHeight: vh * 0.4,  // 40% of screen
        maxWidth: vw * 0.95,   // 95% of screen width
        maxHeight: vh * 0.7    // 70% of screen height
      };
    } else if (vw < 768) { // Tablet
      return {
        minHeight: 400,
        maxWidth: vw * 0.85,
        maxHeight: vh * 0.75   // 75% of screen height
      };
    } else { // Desktop
      return {
        minHeight: 500,
        maxWidth: Math.min(vw * 0.8, 800),
        maxHeight: vh * 0.8    // 80% of screen height (was 85%)
      };
    }
  };

  // Smart scaling with BOTH min and max constraints
  const smartScaleContent = (element: HTMLElement, post: Post) => {
    const card = element.closest('.content-card') as HTMLElement;
    if (!card) return;

    const constraints = getResponsiveConstraints();
    let naturalWidth = 0;
    let naturalHeight = 0;

    // Get natural dimensions based on element type
    if (element.tagName === 'IMG') {
      const img = element as HTMLImageElement;
      naturalWidth = img.naturalWidth;
      naturalHeight = img.naturalHeight;
    } else if (element.tagName === 'VIDEO') {
      const video = element as HTMLVideoElement;
      naturalWidth = video.videoWidth;
      naturalHeight = video.videoHeight;
    } else if (element.tagName === 'IFRAME') {
      // YouTube: default 16:9 aspect ratio
      naturalWidth = 1280;
      naturalHeight = 720;
    }

    if (!naturalWidth || !naturalHeight) {
      console.log(`⚠️  Could not get dimensions for ${post.source_platform} ${post.id}`);
      return;
    }

    const aspectRatio = naturalWidth / naturalHeight;
    let finalWidth = naturalWidth;
    let finalHeight = naturalHeight;

    // Step 1: FIRST check if too tall (priority fix for layout issues)
    if (naturalHeight > constraints.maxHeight) {
      finalHeight = constraints.maxHeight;
      finalWidth = constraints.maxHeight * aspectRatio;
      console.log(`🚨 Height LIMITED ${post.source_platform}: ${naturalWidth}×${naturalHeight} → ${Math.round(finalWidth)}×${Math.round(finalHeight)} (was too tall)`);
    }

    // Step 2: Scale UP if too small (but only if not already constrained by height)
    if (finalHeight < constraints.minHeight && naturalHeight <= constraints.maxHeight) {
      finalHeight = constraints.minHeight;
      finalWidth = constraints.minHeight * aspectRatio;
      console.log(`📏 Scaling UP ${post.source_platform}: ${naturalWidth}×${naturalHeight} → ${Math.round(finalWidth)}×${finalHeight}`);
    }

    // Step 3: Scale DOWN if too wide
    if (finalWidth > constraints.maxWidth) {
      finalWidth = constraints.maxWidth;
      finalHeight = constraints.maxWidth / aspectRatio;
      console.log(`📏 Constraining width ${post.source_platform}: → ${Math.round(finalWidth)}×${Math.round(finalHeight)}`);
    }

    // Step 4: Final check - ensure height still within limits after width scaling
    if (finalHeight > constraints.maxHeight) {
      finalHeight = constraints.maxHeight;
      finalWidth = constraints.maxHeight * aspectRatio;
      console.log(`🔒 Final height constraint ${post.source_platform}: → ${Math.round(finalWidth)}×${Math.round(finalHeight)}`);
    }

    // Apply final dimensions to content
    element.style.width = `${finalWidth}px`;
    element.style.height = `${finalHeight}px`;

    // CRITICAL: Card must match content EXACTLY - no fixed dimensions
    setTimeout(() => {
      // Get actual content dimensions after rendering
      const contentRect = element.getBoundingClientRect();
      card.style.width = `${contentRect.width}px`;
      card.style.height = `${contentRect.height}px`;
      
      // Remove any conflicting styles that might add fixed dimensions
      card.style.minHeight = 'unset';
      card.style.maxHeight = 'unset';
      
      console.log(`🎯 Card EXACT match: ${post.source_platform} ${Math.round(contentRect.width)}×${Math.round(contentRect.height)}`);
    }, 50);

    // Apply to container as well
    const container = element.parentElement;
    if (container) {
      container.style.width = `${finalWidth}px`;
      container.style.height = `${finalHeight}px`;
    }

    console.log(`✨ Smart scaled ${post.source_platform}: ${naturalWidth}×${naturalHeight} → ${Math.round(finalWidth)}×${Math.round(finalHeight)} (fits: ${finalWidth <= window.innerWidth * 0.9})`);
  }

  // Platform-specific scaling logic
  const scalePlatformContent = (element: HTMLElement, post: Post) => {
    const card = element.closest('.content-card') as HTMLElement;
    if (!card) return;

    const constraints = getResponsiveConstraints();

    switch (post.source_platform) {
      case 'youtube':
        // Always 16:9, smart scale to fit screen
        const ytAspectRatio = 16 / 9;
        let ytHeight = Math.min(constraints.minHeight, constraints.maxHeight);
        let ytWidth = ytHeight * ytAspectRatio;
        
        if (ytWidth > constraints.maxWidth) {
          // Too wide, constrain by width
          ytWidth = constraints.maxWidth;
          ytHeight = ytWidth / ytAspectRatio;
        }
        
        element.style.width = `${ytWidth}px`;
        element.style.height = `${ytHeight}px`;
        
        // CRITICAL: Card matches content exactly, not fixed dimensions
        setTimeout(() => {
          const contentRect = element.getBoundingClientRect();
          card.style.width = `${contentRect.width}px`;
          card.style.height = `${contentRect.height}px`;
          
          // Remove fixed dimensions that might create whitespace
          card.style.minHeight = 'unset';
          card.style.maxHeight = 'unset';
          
          console.log(`🎯 YouTube EXACT match: ${Math.round(contentRect.width)}×${Math.round(contentRect.height)}`);
        }, 50);
        
        const ytContainer = element.parentElement;
        if (ytContainer) {
          ytContainer.style.width = `${ytWidth}px`;
          ytContainer.style.height = `${ytHeight}px`;
        }
        
        console.log(`🎥 YouTube scaled: ${Math.round(ytWidth)}×${Math.round(ytHeight)} (16:9 fit)`);
        break;
        
      case 'giphy':
        // GIFs tend to be smaller, use smart scaling
        smartScaleContent(element, post);
        break;
        
      case 'bluesky':
        // Handle Bluesky mixed content specially
        if (post.content_text && post.content_image_url) {
          // For mixed content, let the container determine size naturally
          setTimeout(() => {
            const container = element.closest('.bluesky-mixed-container') as HTMLElement;
            if (container) {
              const containerRect = container.getBoundingClientRect();
              card.style.width = `${containerRect.width}px`;
              card.style.height = `${containerRect.height}px`;
              console.log(`🦋 Bluesky mixed content sized: ${Math.round(containerRect.width)}×${Math.round(containerRect.height)}`);
            }
          }, 100);
        } else {
          // Pure image or text, use normal scaling
          smartScaleContent(element, post);
        }
        break;
        
      case 'reddit':
      case 'tumblr':
      case 'lemmy':
        // All these platforms now show media only (no captions), use normal scaling
        smartScaleContent(element, post);
        break;
        
      default:
        // Images and other content use smart scaling
        smartScaleContent(element, post);
        break;
    }
  }

  const isWelcomeCard = post.id === -999

  if (isWelcomeCard) {
    return (
      <div className="welcome-card">
        <div className="welcome-content">
          <div className="welcome-emoji">🌭</div>
          <h1>Welcome to Hotdog Diaries</h1>
          <p>{post.content_text}</p>
          <div className="swipe-hint">
            <div className="arrow">↑</div>
            <p>Swipe up to begin</p>
          </div>
        </div>
        <style jsx>{`
          .welcome-card {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
            color: white;
            text-align: center;
            padding: 32px;
          }
          .welcome-emoji {
            font-size: 72px;
            margin-bottom: 24px;
          }
          h1 {
            font-size: 32px;
            margin-bottom: 16px;
          }
          .swipe-hint {
            margin-top: 48px;
            opacity: 0.8;
          }
          .arrow {
            font-size: 24px;
            animation: bounce 2s infinite;
          }
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
          }
        `}</style>
      </div>
    )
  }

  const renderMedia = () => {
    // Debug logging to check for missing mixed content (only Bluesky shows mixed content now)
    if (['bluesky'].includes(post.source_platform)) {
      const hasBoth = !!(post.content_text && (post.content_image_url || post.content_video_url));
      console.log(`${post.source_platform.toUpperCase()} post analysis:`, {
        id: post.id,
        hasText: !!post.content_text,
        textPreview: post.content_text?.substring(0, 80) + '...',
        hasImage: !!post.content_image_url,
        hasVideo: !!post.content_video_url,
        contentType: post.content_type,
        shouldShowBoth: hasBoth,
        currentClassification: getCardClass(post),
        MISSING_CONTENT_WARNING: hasBoth && post.content_type !== 'mixed' ? 'YES - Text being hidden!' : 'No'
      });
    }

    // YouTube videos - STRICT iframe containment (no expansion allowed)
    if (post.source_platform === 'youtube' && post.content_video_url && !videoError) {
      const videoId = post.content_video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      console.log(`🎥 YouTube rendering: ID=${post.id}, videoId=${videoId}, isActive=${isActive}`)
      
      if (videoId) {
        return (
          <div className="youtube-container" data-youtube-id={videoId}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=0&mute=1&rel=0&modestbranding=1&playsinline=1&controls=1&showinfo=0&iv_load_policy=3`}
              frameBorder="0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen={false}
              sandbox="allow-scripts allow-same-origin allow-presentation"
              onLoad={(e) => scalePlatformContent(e.target as HTMLElement, post)}
              style={{
                border: 'none',
                pointerEvents: 'all',
                display: 'block'
              }}
            />
          </div>
        )
      }
    }

    // Mixed content removed - Reddit, Tumblr, and Lemmy now show media only (no captions)

    // Giphy content - preserve aspect ratio
    if (post.source_platform === 'giphy') {
      if (post.content_video_url && !videoError) {
        return (
          <div className="giphy-container">
            <video
              ref={videoRef}
              src={post.content_video_url}
              autoPlay={isActive}
              loop
              muted
              playsInline
              poster={post.content_image_url}
              onLoadedMetadata={(e) => scalePlatformContent(e.target as HTMLElement, post)}
              onError={() => setVideoError(true)}
            />
          </div>
        )
      } else if (post.content_image_url && !imageError) {
        return (
          <div className="giphy-container">
            <img 
              src={post.content_image_url}
              alt={post.content_text || 'Giphy content'}
              onLoad={(e) => scalePlatformContent(e.target as HTMLElement, post)}
              onError={() => setImageError(true)}
            />
          </div>
        )
      }
    }

    // Direct videos
    if (post.content_video_url && !videoError) {
      return (
        <div className="video-container">
          <video
            ref={videoRef}
            src={post.content_video_url}
            autoPlay={isActive}
            loop
            muted
            playsInline
            controls={false}
            poster={post.content_image_url}
            onLoadedMetadata={(e) => scalePlatformContent(e.target as HTMLElement, post)}
            onError={() => setVideoError(true)}
          />
        </div>
      )
    }

    // Images - handle both pure image posts and mixed content
    if (post.content_image_url && !imageError) {
      let imageSrc = post.content_image_url
      
      // Apply proxy for platforms that need it
      if (post.source_platform === 'pixabay') {
        const pageUrl = post.original_url
        imageSrc = `/api/proxy/pixabay-image?url=${encodeURIComponent(post.content_image_url)}&page=${encodeURIComponent(pageUrl)}`
      } else if (post.source_platform === 'bluesky') {
        imageSrc = `/api/proxy/bluesky-image?url=${encodeURIComponent(post.content_image_url)}`
      }
      
      // For Bluesky with both text and image, show mixed content
      if (post.source_platform === 'bluesky' && post.content_text) {
        console.log(`🦋 Rendering Bluesky mixed content: ${post.id}`);
        return (
          <div className="bluesky-mixed-container" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            maxHeight: '700px',
            width: 'auto'
          }}>
            {/* TEXT FIRST - Above image */}
            <div className="text-container" style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              color: '#000000',
              flexShrink: 0
            }}>
              <p style={{
                margin: 0,
                fontSize: '16px',
                lineHeight: '1.5',
                color: '#000000'
              }}>
                {post.content_text}
              </p>
              {post.original_author && (
                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '14px',
                  color: '#000000'
                }}>
                  @{post.original_author}
                </div>
              )}
            </div>
            
            {/* IMAGE BELOW TEXT */}
            <div className="image-container" style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'flex-start',
              padding: '0.5rem',
              borderRadius: '47px'
            }}>
              <img 
                src={imageSrc}
                alt={post.content_text || 'Bluesky post image'}
                loading="lazy"
                style={{
                  maxWidth: '100%',
                  width: 'auto',
                  height: '400px',
                  objectFit: 'contain'
                }}
                onLoad={(e) => {
                  // Maintain aspect ratio for container sizing
                  const img = e.target as HTMLImageElement;
                  const container = img.closest('.bluesky-mixed-container') as HTMLElement;
                  if (container) {
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    const height = 400;
                    const width = height * aspectRatio;
                    container.style.width = `${width}px`;
                    console.log(`🦋 Bluesky mixed container sized: ${width}×${height} (${aspectRatio.toFixed(2)} ratio)`);
                  }
                }}
                onError={() => {
                  console.log(`❌ Bluesky image failed to load: ${post.id} - ${imageSrc}`)
                  setImageError(true)
                }}
              />
            </div>
          </div>
        )
      }
      
      // Pure image post (no text)
      return (
        <div className="image-container">
          <img 
            src={imageSrc}
            alt={post.content_text || 'Content image'}
            loading="lazy"
            onLoad={(e) => scalePlatformContent(e.target as HTMLElement, post)}
            onError={() => {
              console.log(`❌ Image failed to load: ${post.source_platform} ${post.id}`)
              setImageError(true)
            }}
          />
        </div>
      )
    }

    // Text content - scale card to match text container
    return (
      <div 
        className={`text-container ${post.source_platform === 'bluesky' ? 'bluesky-text-container' : ''} ${post.source_platform === 'tumblr' ? 'tumblr-text-container' : ''} ${post.source_platform === 'lemmy' ? 'lemmy-text-container' : ''}`}
        style={{
          // Force proper styling for Bluesky text cards (no min-height to match others)
          ...(post.source_platform === 'bluesky' && {
            backgroundColor: '#ffffff',
            color: '#000000',
            margin: '2rem',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'left'
          }),
          // Force proper styling for Tumblr text cards to match Bluesky
          ...(post.source_platform === 'tumblr' && {
            backgroundColor: '#ffffff',
            color: '#000000',
            margin: '2rem',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'left'
          }),
          // Force proper styling for Lemmy text cards to match Bluesky/Tumblr
          ...(post.source_platform === 'lemmy' && {
            backgroundColor: '#ffffff',
            color: '#000000',
            margin: '2rem',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'left'
          })
        }}
        ref={(el) => {
          if (el) {
            // Scale text card to minimum dimensions
            setTimeout(() => {
              const card = el.closest('.content-card') as HTMLElement;
              if (card) {
                const MIN_HEIGHT = 500;
                const WIDTH = 400; // Fixed width for text readability
                
                card.style.width = `${WIDTH}px`;
                card.style.height = `${Math.max(el.offsetHeight, MIN_HEIGHT)}px`;
                
                console.log(`📝 Text card scaled: ${post.source_platform} ${WIDTH}×${Math.max(el.offsetHeight, MIN_HEIGHT)}`);
                
                // Debug specific card styling
                if (post.source_platform === 'bluesky') {
                  const computedStyles = window.getComputedStyle(card);
                  console.log(`🦋 Bluesky card ${post.id} CSS debug:`, {
                    id: post.id,
                    cardClasses: card.className,
                    margin: computedStyles.margin,
                    padding: computedStyles.padding,
                    backgroundColor: computedStyles.backgroundColor,
                    borderRadius: computedStyles.borderRadius,
                    hasCardBlueskyClass: card.className.includes('card-bluesky'),
                    textSnippet: post.content_text?.substring(0, 50)
                  });
                }
                if (post.source_platform === 'tumblr') {
                  const computedStyles = window.getComputedStyle(card);
                  console.log(`💙 Tumblr card ${post.id} CSS debug:`, {
                    id: post.id,
                    cardClasses: card.className,
                    margin: computedStyles.margin,
                    padding: computedStyles.padding,
                    backgroundColor: computedStyles.backgroundColor,
                    borderRadius: computedStyles.borderRadius,
                    hasTumblrClass: card.className.includes('tumblr-text-container'),
                    textSnippet: post.content_text?.substring(0, 50)
                  });
                }
              }
            }, 100);
          }
        }}
      >
        <div className="platform-badge" style={{
          ...(post.source_platform === 'bluesky' && {
            backgroundColor: '#f0f0f0',
            color: '#000000',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            marginBottom: '16px'
          }),
          ...(post.source_platform === 'tumblr' && {
            backgroundColor: '#f0f0f0',
            color: '#000000',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            marginBottom: '16px'
          })
        }}>
          {getPlatformIcon(post.source_platform)} {post.source_platform}
        </div>
        <div className="text-content" style={{
          ...(post.source_platform === 'bluesky' && {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            color: '#000000'
          }),
          ...(post.source_platform === 'tumblr' && {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            color: '#000000'
          })
        }}>
          <p style={{
            ...(post.source_platform === 'bluesky' && {
              color: '#000000',
              fontSize: '18px',
              lineHeight: '1.6',
              margin: 0
            }),
            ...(post.source_platform === 'tumblr' && {
              color: '#000000',
              fontSize: '18px',
              lineHeight: '1.6',
              margin: 0
            })
          }}>{post.content_text || 'No content available'}</p>
        </div>
        {post.original_author && (
          <div className="author" style={{
            ...(post.source_platform === 'bluesky' && {
              color: '#666666',
              fontSize: '14px',
              marginTop: '16px'
            })
          }}>by {post.original_author}</div>
        )}
      </div>
    )
  }

  return (
    <div className="post-content">
      {renderMedia()}
      
      <style jsx>{`
        .post-content {
          display: block;
          margin: 0;
          padding: 0;
          /* Dimensions determined by content scaling */
        }

        /* YouTube container - dimensions set by scaling */
        .youtube-container {
          display: block;
          background: black;
          margin: 0;
          padding: 0;
          /* Dimensions set by JavaScript */
        }

        .youtube-container iframe {
          display: block;
          border: none;
          margin: 0;
          padding: 0;
          /* Dimensions set by JavaScript based on minimum 500px height */
        }

        /* EMERGENCY: Prevent ANY YouTube player expansion */
        .html5-video-player {
          display: none !important;
          max-width: 400px !important;
          max-height: 225px !important;
          overflow: hidden !important;
        }

        /* Prevent YouTube API expansion */
        .ytp-player {
          max-width: 400px !important;
          max-height: 225px !important;
          overflow: hidden !important;
        }

        /* Giphy container - dimensions set by scaling */
        .giphy-container {
          display: block;
          background: black;
          margin: 0;
          padding: 0;
          /* Dimensions set by JavaScript */
        }

        .giphy-container video,
        .giphy-container img {
          display: block;
          margin: 0;
          padding: 0;
          border: 0;
          outline: 0;
          /* Dimensions set by JavaScript - no object-fit */
        }

        /* Video container - dimensions set by scaling */
        .video-container {
          display: block;
          background: black;
          margin: 0;
          padding: 0;
          /* Dimensions set by JavaScript */
        }

        .video-container video {
          display: block;
          margin: 0;
          padding: 0;
          border: 0;
          outline: 0;
          /* Dimensions set by JavaScript - no object-fit */
        }

        /* Image container - dimensions set by scaling */
        .image-container {
          display: block;
          background: black;
          margin: 0;
          padding: 0;
          /* Dimensions set by JavaScript */
        }

        .image-container img {
          display: block;
          margin: 0;
          padding: 0;
          border: 0;
          outline: 0;
          /* Dimensions set by JavaScript - no object-fit */
        }

        /* Text content - minimum height, scales as needed */
        .text-container {
          width: 100%;
          min-height: 500px; /* Minimum height for text cards */
          padding: 30px; /* Generous padding for readability */
          display: flex;
          flex-direction: column;
          justify-content: center; /* Center text vertically */
          align-items: stretch; /* Text takes full width */
          text-align: center; /* Center text for better appearance */
          background: white;
          color: #000000;
          box-sizing: border-box;
          overflow-y: auto; /* Scroll if text is very long */
        }

        .platform-badge {
          background: #f0f0f0;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .text-content {
          flex: 1; /* Take available space in text container */
          display: flex;
          align-items: flex-start; /* Align to top */
          justify-content: center;
          overflow-y: auto; /* Scroll if needed */
          width: 100%;
          margin: 16px 0; /* Space around text */
        }

        .text-content p {
          font-size: 18px;
          line-height: 1.5; /* Better readability */
          margin: 0;
          padding: 0;
          color: #000000;
          width: 100%;
          word-wrap: break-word;
          white-space: normal;
        }

        .author {
          font-size: 14px;
          color: #666;
          margin-top: 16px;
        }

        /* Mobile text adjustments */
        @media (max-width: 768px) {
          .text-container {
            padding: 16px;
          }
          
          .text-content p {
            font-size: 15px;
            line-height: 1.5;
          }
          
          .card-bluesky .text-container {
            padding: 20px 16px;
          }
          
          .card-bluesky .text-content p {
            font-size: 15px;
            line-height: 1.5;
          }
        }
      `}</style>
    </div>
  )
}