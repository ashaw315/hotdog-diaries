'use client'

import { useEffect, useState, useRef } from 'react'

interface ContentItem {
  id: number
  platform: string
  contentType: string
  contentText: string | null
  contentImageUrl: string | null
  contentVideoUrl: string | null
  originalUrl: string
}

// Helper to determine card class based on content
function getCardClass(item: ContentItem): string {
  if (item.contentType === 'video' && item.platform === 'youtube') return 'card-youtube'
  if (item.contentType === 'gif' || item.platform === 'giphy') return 'card-gif'
  if (item.contentType === 'image' && !item.contentText) return 'card-image'
  if (item.contentType === 'text' || (!item.contentImageUrl && !item.contentVideoUrl)) return 'card-text'
  if (item.contentImageUrl && item.contentText) return 'card-mixed'
  return 'card-default'
}

export default function TestAdaptivePage() {
  // 🚨 EMERGENCY CIRCUIT BREAKER
  console.log('🚨 PAGE COMPONENT STARTING')
  
  // Add render counter to detect infinite loops
  const renderCount = useRef(0)
  renderCount.current++
  console.log(`🔄 Render #${renderCount.current}`)
  
  if (renderCount.current > 50) {
    console.error('🔥 INFINITE RENDER DETECTED')
    return (
      <div style={{ padding: '20px', color: 'red', fontSize: '24px' }}>
        <h1>🔥 INFINITE RENDER LOOP DETECTED</h1>
        <p>Render count: {renderCount.current}</p>
        <p>Component stopped to prevent browser crash</p>
      </div>
    )
  }

  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showDebugInfo, setShowDebugInfo] = useState(true)
  const [showWhitespaceDebug, setShowWhitespaceDebug] = useState(false)
  const [showSizeDebug, setShowSizeDebug] = useState(false)
  const [cardSizes, setCardSizes] = useState<{[key: number]: any}>({})

  useEffect(() => {
    // Ensure page can scroll - override any CSS that might prevent scrolling
    document.body.style.setProperty('overflow', 'auto', 'important')
    document.body.style.setProperty('overflow-y', 'auto', 'important')
    document.body.style.setProperty('height', 'auto', 'important')
    document.body.style.setProperty('position', 'static', 'important')
    document.body.style.setProperty('width', 'auto', 'important')
    document.documentElement.style.setProperty('overflow', 'auto', 'important')
    document.documentElement.style.setProperty('height', 'auto', 'important')
    
    // Cleanup function to restore original CSS
    return () => {
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('overflow-y')
      document.body.style.removeProperty('height')
      document.body.style.removeProperty('position')
      document.body.style.removeProperty('width')
      document.documentElement.style.removeProperty('overflow')
      document.documentElement.style.removeProperty('height')
    }
  }, [])

  useEffect(() => {
    fetchContent()
  }, [])

  // FORCE STYLING FIXES via JavaScript (since CSS isn't being applied)
  useEffect(() => {
    if (content.length > 0) {
      const timer = setTimeout(() => {
        try {
          content.forEach((item) => {
            const cardElement = document.querySelector(`[data-card-id="${item.id}"]`) as HTMLElement
            if (!cardElement) return

            // Fix YouTube iframe sizing
            if (item.platform === 'youtube') {
              const iframe = cardElement.querySelector('iframe') as HTMLIFrameElement
              if (iframe) {
                iframe.style.width = '400px'
                iframe.style.height = '225px'
                console.log(`🎥 Fixed YouTube iframe: ${item.id}`)
              }
              // Also fix the card size
              cardElement.style.width = '400px'
              cardElement.style.height = '225px'
            }

            // Fix Bluesky text color
            if (item.platform === 'bluesky') {
              const textContainer = cardElement.querySelector('.text-container') as HTMLElement
              if (textContainer) {
                textContainer.style.color = '#000000'
                textContainer.style.backgroundColor = 'white'
                
                const pElement = textContainer.querySelector('p') as HTMLElement
                if (pElement) {
                  pElement.style.color = '#000000'
                  pElement.style.fontSize = '16px'
                }
                console.log(`📝 Fixed Bluesky text color: ${item.id}`)
              }
            }
          })
        } catch (error) {
          console.error('❌ Error applying style fixes:', error)
        }
      }, 200) // Small delay to ensure elements are rendered

      return () => clearTimeout(timer)
    }
  }, [content])

  // DISABLED AUTO-SIZING TO PREVENT SERVER CRASHES
  // useEffect(() => {
  //   console.log('⏭️ Auto-sizing disabled to prevent server crashes')
  // }, [content])

  // DISABLED COMPLEX MEASUREMENTS TO PREVENT SERVER CRASHES
  // useEffect(() => {
  //   console.log('⏭️ Complex measurements disabled to prevent server crashes')
  // }, [showSizeDebug, content])

  // Improved content measurement for all types
  const measureContent = (cardElement: HTMLElement, platform: string) => {
    const img = cardElement.querySelector('img') as HTMLImageElement
    const video = cardElement.querySelector('video') as HTMLVideoElement
    const iframe = cardElement.querySelector('iframe') as HTMLIFrameElement
    const textContainer = cardElement.querySelector('.text-container') as HTMLElement
    
    // For media content (images, videos, iframes)
    if (img && img.complete && img.naturalWidth > 0) {
      return {
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height,
        type: 'image'
      }
    }
    
    if (video && video.videoWidth > 0) {
      return {
        width: video.getBoundingClientRect().width,
        height: video.getBoundingClientRect().height,
        type: 'video'
      }
    }
    
    if (iframe) {
      return {
        width: iframe.getBoundingClientRect().width,
        height: iframe.getBoundingClientRect().height,
        type: 'iframe'
      }
    }
    
    // For text content - use scrollHeight for actual text size
    if (textContainer) {
      // SPECIAL HANDLING for text measurement
      const isBluesky = platform === 'bluesky'
      
      if (isBluesky) {
        // Force proper width for Bluesky before measuring height
        textContainer.style.width = '400px'
        textContainer.style.whiteSpace = 'normal'
        textContainer.style.wordWrap = 'break-word'
        textContainer.style.overflowWrap = 'break-word'
        
        // Force layout recalculation
        textContainer.offsetHeight
        
        const actualHeight = textContainer.scrollHeight
        const actualWidth = textContainer.offsetWidth
        
        console.log('📏 Bluesky text measurement after fixing width:', {
          width: actualWidth,
          height: actualHeight,
          scrollHeight: textContainer.scrollHeight,
          offsetHeight: textContainer.offsetHeight,
          text: textContainer.innerText?.substring(0, 50) + '...'
        })
        
        return {
          width: actualWidth,
          height: actualHeight,
          type: 'text'
        }
      } else {
        // Default text measurement for other platforms
        const style = window.getComputedStyle(textContainer)
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        
        return {
          width: Math.min(textContainer.offsetWidth, 500), // Reasonable max width
          height: textContainer.scrollHeight, // Actual content height including all text
          type: 'text'
        }
      }
    }
    
    return null
  }

  // EMERGENCY SIMPLE AUTO-SIZING (no hangs, basic functionality)
  const applySimpleAutoSizing = () => {
    console.log('🔧 Running simple auto-sizing (emergency mode)')
    
    try {
      content.slice(0, 16).forEach((item, index) => { // Max 16 cards
        const cardElement = document.querySelector(`[data-card-id="${item.id}"]`) as HTMLElement
        if (!cardElement) return

        // Simple Bluesky text fix only
        if (item.platform === 'bluesky') {
          cardElement.style.width = '432px'
          cardElement.style.height = '120px' // Fixed height
          cardElement.style.fontSize = '16px'
          cardElement.style.lineHeight = '1.4'
          cardElement.style.background = 'white'
          
          const textContainer = cardElement.querySelector('.text-container') as HTMLElement
          if (textContainer) {
            textContainer.style.color = '#000000'
            textContainer.style.fontSize = '16px'
            textContainer.style.backgroundColor = 'white'
          }
        }
      })
      console.log('✅ Simple auto-sizing completed')
    } catch (error) {
      console.error('❌ Even simple auto-sizing failed:', error)
    }
  }

  // Text measurement cache to avoid repeated calculations
  const textMeasurementCache = new Map<string, {width: number, height: number}>()

  // Optimized auto-sizing with batched DOM operations
  const applyOptimizedAutoSizing = () => {
    // SAFETY GUARDS
    if (!content || content.length === 0) {
      console.log('⏭️ No content to size')
      return
    }

    console.time('⚡ Optimized Auto-sizing')
    const startTime = performance.now()
    console.log(`⚡ Optimized auto-sizing for ${content.length} cards...`)

    try {
      // STEP 1: Batch all DOM reads (no writes to prevent reflows)
      const readStart = performance.now()
      const measurements = content.slice(0, 20).map((item, index) => { // Limit to 20 cards max
        if (!item || !item.id) {
          console.warn(`⚠️ Invalid item at index ${index}:`, item)
          return null
        }

        const cardElement = document.querySelector(`[data-card-id="${item.id}"]`) as HTMLElement
        if (!cardElement) {
          console.warn(`⚠️ Card element not found for ID: ${item.id}`)
          return null
        }

        // Fast measurement without DOM writes
        const measurement = measureContentOptimized(cardElement, item.platform, item.contentText || '')
        if (!measurement) {
          console.warn(`⚠️ Could not measure content for ${item.platform}`)
          return null
        }

        return { cardElement, item, measurement }
      }).filter(Boolean) as Array<{cardElement: HTMLElement, item: any, measurement: any}>

    const readEnd = performance.now()
    console.log(`📖 DOM reads: ${(readEnd - readStart).toFixed(2)}ms`)

      // STEP 2: Batch all DOM writes using requestAnimationFrame
      if (measurements.length === 0) {
        console.log('⏭️ No measurements to apply')
        console.timeEnd('⚡ Optimized Auto-sizing')
        return
      }

      console.log(`📝 Applying styles to ${measurements.length} cards`)
      
      requestAnimationFrame(() => {
        try {
          const writeStart = performance.now()
          
          measurements.forEach(({ cardElement, item, measurement }, index) => {
            if (!measurement || !cardElement) {
              console.warn(`⚠️ Skipping card ${index} - missing data`)
              return
            }

            try {
              // Batch style changes in single cssText assignment (faster than individual properties)
              if (item.platform === 'bluesky' && measurement.type === 'text') {
                // Optimized Bluesky text styling
                cardElement.style.cssText = `width: 432px !important; height: ${measurement.height}px !important; font-size: 16px; line-height: 1.4; background: white;`
                
                // Fix text container in single operation
                const textContainer = cardElement.querySelector('.text-container') as HTMLElement
                if (textContainer) {
                  textContainer.style.cssText = 'width: 400px; height: auto; color: #000000; background-color: white; font-size: 16px; line-height: 1.4; white-space: normal; word-wrap: break-word;'
                  
                  const pElement = textContainer.querySelector('p') as HTMLElement
                  if (pElement) {
                    pElement.style.cssText = 'color: #000000; font-size: 16px; line-height: 1.4; margin: 0; padding: 0; display: block; white-space: normal; word-wrap: break-word;'
                  }
                }
              } else {
                // Other platforms - simple sizing
                cardElement.style.cssText = `width: ${measurement.width}px; height: ${measurement.height}px;`
              }
            } catch (styleError) {
              console.error(`❌ Error styling card ${index}:`, styleError)
            }
          })

          const writeEnd = performance.now()
          const totalTime = writeEnd - startTime
          console.log(`✍️ DOM writes: ${(writeEnd - writeStart).toFixed(2)}ms`)
          console.log(`🏁 Optimized sizing: ${totalTime.toFixed(2)}ms total (${(totalTime / measurements.length).toFixed(2)}ms/card)`)
          console.timeEnd('⚡ Optimized Auto-sizing')
        } catch (writeError) {
          console.error('❌ Error in DOM writes:', writeError)
          console.timeEnd('⚡ Optimized Auto-sizing')
        }
      })
    } catch (error) {
      console.error('❌ Error in optimized auto-sizing:', error)
      console.timeEnd('⚡ Optimized Auto-sizing')
    }
  }

  // Optimized content measurement with caching
  const measureContentOptimized = (cardElement: HTMLElement, platform: string, text: string) => {
    const img = cardElement.querySelector('img') as HTMLImageElement
    const video = cardElement.querySelector('video') as HTMLVideoElement
    const iframe = cardElement.querySelector('iframe') as HTMLIFrameElement
    const textContainer = cardElement.querySelector('.text-container') as HTMLElement
    
    // For media content (fast path)
    if (img && img.complete && img.naturalWidth > 0) {
      const rect = img.getBoundingClientRect()
      return { width: rect.width, height: rect.height, type: 'image' }
    }
    
    if (video && video.videoWidth > 0) {
      const rect = video.getBoundingClientRect()
      return { width: rect.width, height: rect.height, type: 'video' }
    }
    
    if (iframe) {
      const rect = iframe.getBoundingClientRect()
      return { width: rect.width, height: rect.height, type: 'iframe' }
    }
    
    // For text content with caching
    if (textContainer) {
      const cacheKey = `${platform}_${text.substring(0, 100)}`
      
      if (textMeasurementCache.has(cacheKey)) {
        return { ...textMeasurementCache.get(cacheKey)!, type: 'text' }
      }
      
      // Measure text (only if not cached)
      if (platform === 'bluesky') {
        // Quick Bluesky measurement - assume 400px width, calculate height
        const measurement = { width: 400, height: Math.max(80, Math.ceil(text.length / 50) * 20 + 32) }
        textMeasurementCache.set(cacheKey, measurement)
        return { ...measurement, type: 'text' }
      } else {
        // Default text measurement
        const measurement = { width: Math.min(textContainer.offsetWidth, 500), height: textContainer.scrollHeight }
        textMeasurementCache.set(cacheKey, measurement)
        return { ...measurement, type: 'text' }
      }
    }
    
    return null
  }

  // Auto-apply exact sizing (runs automatically - legacy version for debugging)
  const applyAutoExactSizing = () => {
    console.time('🎯 Auto-sizing Performance')
    const startTime = performance.now()
    console.log(`🎯 Auto-applying exact sizing for ${content.length} cards...`)
    
    content.forEach((item, index) => {
      const itemStart = performance.now()
      const cardElement = document.querySelector(`[data-card-id="${item.id}"]`) as HTMLElement
      
      if (cardElement) {
        const measurement = measureContent(cardElement, item.platform)
        
        if (measurement) {
          console.log(`🎯 Auto-sizing ${item.platform} ${item.contentType} (${measurement.type}): ${measurement.width}×${measurement.height}`)
          
          // Special handling for Bluesky text to ensure proper sizing
          if (item.platform === 'bluesky' && measurement.type === 'text') {
            // Set proper width and height for Bluesky text
            cardElement.style.width = '432px' // 400px content + 32px padding
            cardElement.style.height = `${measurement.height}px`
            
            // Ensure text container has proper dimensions and visibility
            const textContainer = cardElement.querySelector('.text-container') as HTMLElement
            if (textContainer) {
              textContainer.style.width = '400px'
              textContainer.style.height = 'auto'
              textContainer.style.whiteSpace = 'normal'
              textContainer.style.wordWrap = 'break-word'
              textContainer.style.color = '#000000' // Force black text
              textContainer.style.backgroundColor = 'white' // Force white background
              textContainer.style.fontSize = '16px' // Force visible font size
              textContainer.style.lineHeight = '1.4' // Force readable line height
              
              // Also fix the p element
              const pElement = textContainer.querySelector('p') as HTMLElement
              if (pElement) {
                pElement.style.color = '#000000'
                pElement.style.fontSize = '16px'
                pElement.style.lineHeight = '1.4'
                pElement.style.margin = '0'
                pElement.style.padding = '0'
                pElement.style.display = 'block'
                pElement.style.whiteSpace = 'normal'
                pElement.style.wordWrap = 'break-word'
              }
            }
            
            console.log(`📝 Bluesky text sized: 432×${measurement.height} (content: ${measurement.width}×${measurement.height})`)
          } else {
            cardElement.style.width = `${measurement.width}px`
            cardElement.style.height = `${measurement.height}px`
          }
        } else {
          console.log(`⚠️ Could not measure content for ${item.platform} ${item.contentType}`)
        }
        
        const itemEnd = performance.now()
        console.log(`📊 Card ${index + 1}/${content.length} (${item.platform}): ${(itemEnd - itemStart).toFixed(2)}ms`)
      }
    })
    
    const endTime = performance.now()
    console.log(`🏁 Auto-sizing completed: ${(endTime - startTime).toFixed(2)}ms total for ${content.length} cards`)
    console.timeEnd('🎯 Auto-sizing Performance')
  }

  // Optimized individual image load handler
  const handleImageLoad = (cardId: number) => {
    const startTime = performance.now()
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement
    const item = content.find(c => c.id === cardId)
    
    if (cardElement && item) {
      // Fast measurement for single card
      const measurement = measureContentOptimized(cardElement, item.platform, item.contentText || '')
      if (measurement) {
        // Single cssText assignment for performance
        requestAnimationFrame(() => {
          cardElement.style.cssText = `width: ${measurement.width}px; height: ${measurement.height}px;`
          const endTime = performance.now()
          console.log(`🖼️ Image ${item.platform} resized: ${measurement.width}×${measurement.height} (${(endTime - startTime).toFixed(2)}ms)`)
        })
      }
    }
  }

  // Manual force exact sizing (for testing/debugging)
  const forceExactSizing = () => {
    content.forEach((item) => {
      const cardElement = document.querySelector(`[data-card-id="${item.id}"]`) as HTMLElement
      
      // Platform-specific content selection for exact sizing
      let contentElement: HTMLElement | null = null
      
      if (item.platform === 'youtube') {
        contentElement = cardElement?.querySelector('iframe') as HTMLElement
      } else if (item.platform === 'bluesky') {
        contentElement = cardElement?.querySelector('.text-container') as HTMLElement
      } else {
        contentElement = cardElement?.querySelector('img, video, iframe') as HTMLElement
      }
      
      if (cardElement && contentElement) {
        // For YouTube, force card to match iframe size exactly
        if (item.platform === 'youtube' && contentElement instanceof HTMLIFrameElement) {
          const applyExactSize = () => {
            const contentRect = contentElement.getBoundingClientRect()
            if (contentRect.width > 0 && contentRect.height > 0) {
              console.log(`🎯 YouTube exact sizing: ${contentRect.width}×${contentRect.height}`)
              cardElement.style.width = `${contentRect.width}px`
              cardElement.style.height = `${contentRect.height}px`
            }
          }
          // YouTube iframes are usually ready immediately
          setTimeout(applyExactSize, 100)
        }
        
        // For Bluesky, ensure card matches text container size
        else if (item.platform === 'bluesky') {
          const contentRect = contentElement.getBoundingClientRect()
          if (contentRect.width > 0 && contentRect.height > 0) {
            console.log(`🎯 Bluesky exact sizing: ${contentRect.width}×${contentRect.height}`)
            cardElement.style.width = `${contentRect.width}px`
            cardElement.style.height = `${contentRect.height}px`
          }
        }
        
        // For other media content
        else if (contentElement instanceof HTMLImageElement || contentElement instanceof HTMLVideoElement) {
          const applyExactSize = () => {
            const contentRect = contentElement.getBoundingClientRect()
            if (contentRect.width > 0 && contentRect.height > 0) {
              console.log(`🎯 Setting exact size for ${item.platform} ${item.contentType}: ${contentRect.width}×${contentRect.height}`)
              cardElement.style.width = `${contentRect.width}px`
              cardElement.style.height = `${contentRect.height}px`
            }
          }
          
          if (contentElement instanceof HTMLImageElement) {
            if (contentElement.complete) {
              applyExactSize()
            } else {
              contentElement.onload = applyExactSize
            }
          } else if (contentElement instanceof HTMLVideoElement) {
            if (contentElement.videoWidth > 0) {
              applyExactSize()
            } else {
              contentElement.onloadedmetadata = applyExactSize
            }
          }
        }
      }
    })
  }

  const measureCardSizes = () => {
    const sizes: {[key: number]: any} = {}
    
    content.forEach((item) => {
      const cardElement = document.querySelector(`[data-card-id="${item.id}"]`) as HTMLElement
      
      // SMART CONTENT SELECTION - handle platform-specific cases
      let contentElement: HTMLElement | null = null
      
      if (item.platform === 'youtube') {
        // For YouTube, measure the iframe (not potential title elements)
        contentElement = cardElement?.querySelector('iframe') as HTMLElement
        if (!contentElement) {
          contentElement = cardElement?.querySelector('.youtube-container') as HTMLElement
        }
      } else if (item.platform === 'bluesky') {
        // For Bluesky, prioritize text-container or fallback to full card content
        contentElement = cardElement?.querySelector('.text-container') as HTMLElement
        if (!contentElement) {
          contentElement = cardElement?.querySelector('.text-content, p') as HTMLElement
        }
      } else {
        // Default behavior for other platforms
        contentElement = cardElement?.querySelector('img, video, iframe, .text-container') as HTMLElement
      }
      
      if (cardElement && contentElement) {
        const cardRect = cardElement.getBoundingClientRect()
        const contentRect = contentElement.getBoundingClientRect()
        
        // Get computed styles for detailed analysis
        const cardComputed = window.getComputedStyle(cardElement)
        const contentComputed = window.getComputedStyle(contentElement)
        
        // For images and videos, get natural dimensions too
        let naturalDimensions = null
        if (contentElement instanceof HTMLImageElement) {
          naturalDimensions = {
            width: contentElement.naturalWidth,
            height: contentElement.naturalHeight
          }
        } else if (contentElement instanceof HTMLVideoElement) {
          naturalDimensions = {
            width: contentElement.videoWidth,
            height: contentElement.videoHeight
          }
        }
        
        // Calculate precise differences
        const exactWidthDiff = cardRect.width - contentRect.width
        const exactHeightDiff = cardRect.height - contentRect.height
        
        sizes[item.id] = {
          card: {
            width: Math.round(cardRect.width),
            height: Math.round(cardRect.height),
            exactWidth: cardRect.width,
            exactHeight: cardRect.height
          },
          content: {
            width: Math.round(contentRect.width),
            height: Math.round(contentRect.height),
            exactWidth: contentRect.width,
            exactHeight: contentRect.height
          },
          natural: naturalDimensions,
          whitespace: {
            horizontal: Math.round(exactWidthDiff),
            vertical: Math.round(exactHeightDiff),
            exactHorizontal: exactWidthDiff,
            exactVertical: exactHeightDiff
          },
          cardStyles: {
            padding: cardComputed.padding,
            margin: cardComputed.margin,
            border: cardComputed.border,
            borderWidth: cardComputed.borderWidth,
            boxSizing: cardComputed.boxSizing,
            display: cardComputed.display,
            lineHeight: cardComputed.lineHeight,
            fontSize: cardComputed.fontSize
          },
          contentStyles: {
            padding: contentComputed.padding,
            margin: contentComputed.margin,
            border: contentComputed.border,
            borderWidth: contentComputed.borderWidth,
            boxSizing: contentComputed.boxSizing,
            display: contentComputed.display,
            lineHeight: contentComputed.lineHeight,
            fontSize: contentComputed.fontSize,
            verticalAlign: contentComputed.verticalAlign
          },
          contentType: item.contentType,
          platform: item.platform
        }
        
        // Detailed console logging for debugging
        console.log(`🔍 DETAILED ANALYSIS - ${item.platform} ${item.contentType} (ID: ${item.id})`)
        console.log(`📏 Card: ${cardRect.width.toFixed(2)}×${cardRect.height.toFixed(2)}`)
        console.log(`🖼️ Content: ${contentRect.width.toFixed(2)}×${contentRect.height.toFixed(2)}`)
        console.log(`⚪ Whitespace: ${exactWidthDiff.toFixed(2)}×${exactHeightDiff.toFixed(2)}px`)
        console.log(`🎯 Card Styles:`, {
          padding: cardComputed.padding,
          border: cardComputed.borderWidth,
          boxSizing: cardComputed.boxSizing
        })
        console.log(`🎯 Content Styles:`, {
          margin: contentComputed.margin,
          padding: contentComputed.padding,
          display: contentComputed.display,
          verticalAlign: contentComputed.verticalAlign
        })

        // SPECIFIC DEBUGGING FOR PROBLEMATIC PLATFORMS
        if (item.platform === 'youtube') {
          console.log(`🟥 YOUTUBE DEBUG:`)
          const youtubeContainer = cardElement.querySelector('.youtube-container')
          const iframe = cardElement.querySelector('iframe')
          const titleElement = cardElement.querySelector('.youtube-title, .title, h3, p')
          console.log(`  - Container: ${youtubeContainer ? youtubeContainer.getBoundingClientRect().width.toFixed(2) + '×' + youtubeContainer.getBoundingClientRect().height.toFixed(2) : 'not found'}`)
          console.log(`  - Iframe: ${iframe ? iframe.getBoundingClientRect().width.toFixed(2) + '×' + iframe.getBoundingClientRect().height.toFixed(2) : 'not found'}`)
          console.log(`  - Title element: ${titleElement ? 'FOUND - ' + titleElement.getBoundingClientRect().height.toFixed(2) + 'px tall' : 'NOT FOUND'}`)
          if (titleElement) {
            console.log(`  - Title text: "${titleElement.textContent?.substring(0, 50)}..."`)
          }
          console.log(`  - All children:`, Array.from(cardElement.children).map(el => ({ 
            tag: el.tagName, 
            class: el.className, 
            height: el.getBoundingClientRect().height.toFixed(2) + 'px'
          })))
        }

        if (item.platform === 'bluesky') {
          console.log(`🦋 BLUESKY DEBUG:`)
          const textContainer = cardElement.querySelector('.text-container')
          const textContent = cardElement.querySelector('.text-content, p')
          console.log(`  - Card actual text: "${cardElement.textContent?.substring(0, 100)}..."`)
          console.log(`  - Card scrollHeight: ${cardElement.scrollHeight}px (vs getBoundingClientRect: ${cardRect.height.toFixed(2)}px)`)
          console.log(`  - Text container: ${textContainer ? textContainer.getBoundingClientRect().width.toFixed(2) + '×' + textContainer.getBoundingClientRect().height.toFixed(2) : 'not found'}`)
          console.log(`  - Text content elem: ${textContent ? textContent.getBoundingClientRect().width.toFixed(2) + '×' + textContent.getBoundingClientRect().height.toFixed(2) : 'not found'}`)
          
          // DEBUG TEXT CONSTRAINTS AND VISIBILITY
          if (textContainer) {
            const computed = window.getComputedStyle(textContainer)
            console.log(`  - Text container constraints:`, {
              width: computed.width,
              maxWidth: computed.maxWidth,
              minWidth: computed.minWidth,
              whiteSpace: computed.whiteSpace,
              overflow: computed.overflow,
              wordWrap: computed.wordWrap,
              overflowWrap: computed.overflowWrap,
              height: computed.height,
              scrollHeight: textContainer.scrollHeight + 'px',
              fontSize: computed.fontSize,
              lineHeight: computed.lineHeight,
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              display: computed.display
            })
            
            // Check if text content exists
            const pElement = textContainer.querySelector('p')
            console.log(`  - P element:`, {
              exists: !!pElement,
              text: pElement?.textContent?.substring(0, 100),
              innerHTML: pElement?.innerHTML?.substring(0, 100),
              display: pElement ? window.getComputedStyle(pElement).display : 'none',
              fontSize: pElement ? window.getComputedStyle(pElement).fontSize : 'none'
            })
          }
          
          console.log(`  - Number of children: ${cardElement.children.length}`)
          console.log(`  - All children:`, Array.from(cardElement.children).map(el => ({ 
            tag: el.tagName, 
            class: el.className, 
            height: el.getBoundingClientRect().height.toFixed(2) + 'px'
          })))
        }

        console.log(`---`)
      }
    })
    
    setCardSizes(sizes)
    console.log('📐 Complete card size measurements:', sizes)
  }

  const fetchContent = async () => {
    try {
      const response = await fetch('/api/test/platform-display?offset=0')
      if (!response.ok) throw new Error('Failed to fetch content')
      
      const data = await response.json()
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
    } catch (err) {
      console.error('Error fetching content:', err)
    } finally {
      setLoading(false)
    }
  }

  const renderContent = (item: ContentItem) => {
    const { contentType, contentImageUrl, contentVideoUrl, contentText } = item

    // YouTube videos - 16:9 aspect ratio
    if (item.platform === 'youtube' && contentVideoUrl) {
      const videoId = contentVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      if (videoId) {
        return (
          <div className="youtube-container">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )
      }
    }

    // Giphy - preserve aspect ratio
    if (item.platform === 'giphy' && contentVideoUrl) {
      return (
        <div className="giphy-container">
          <video
            autoPlay
            loop
            muted
            playsInline
            onError={() => console.log(`❌ Video failed to load: ${item.platform} ${item.id}`)}
          >
            <source src={contentVideoUrl} type="video/mp4" />
          </video>
        </div>
      )
    }

    // Images - contain instead of cover
    if (contentImageUrl && contentType === 'image') {
      let imageSrc = contentImageUrl
      
      if (item.platform === 'pixabay') {
        const pageUrl = item.originalUrl
        imageSrc = `/api/proxy/pixabay-image?url=${encodeURIComponent(contentImageUrl)}&page=${encodeURIComponent(pageUrl)}`
      } else if (item.platform === 'bluesky') {
        imageSrc = `/api/proxy/bluesky-image?url=${encodeURIComponent(contentImageUrl)}`
      }
      
      return (
        <div className="image-container">
          <img 
            src={imageSrc} 
            alt={contentText || 'Content image'}
            loading="lazy"
            onError={() => console.log(`❌ Image failed to load: ${item.platform} ${item.id}`)}
          />
        </div>
      )
    }

    // Text content
    return (
      <div className="text-container">
        <p>{contentText || 'No text content'}</p>
      </div>
    )
  }

  if (loading) return <div>Loading adaptive test...</div>

  return (
    <div className="test-page">
      <div className="controls">
        <h1>🌭 Adaptive Card Test - Perfect Fit</h1>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowDebugInfo(!showDebugInfo)}>
            {showDebugInfo ? 'Hide' : 'Show'} Debug Info
          </button>
          <button onClick={() => setShowWhitespaceDebug(!showWhitespaceDebug)}>
            {showWhitespaceDebug ? 'Hide' : 'Show'} Whitespace Debug
          </button>
          <button onClick={() => setShowSizeDebug(!showSizeDebug)}>
            {showSizeDebug ? 'Hide' : 'Show'} Size Debug
          </button>
          <button onClick={forceExactSizing} style={{ background: '#28a745' }}>
            🔧 Re-apply Sizing (Debug)
          </button>
        </div>
      </div>

      <div className="content-grid">
        {content.map((item) => (
          <div key={item.id} className="card-container">
            <div 
              className={`content-card ${getCardClass(item)} ${showDebugInfo ? 'debug' : ''} ${showWhitespaceDebug ? 'whitespace-debug' : ''} ${showSizeDebug ? 'size-debug' : ''}`}
              data-card-id={item.id}
              data-platform={item.platform}
            >
              {showDebugInfo && (
                <div className="debug-info">
                  {item.platform} - {item.contentType} - {getCardClass(item)} - Perfect Fit Mode
                </div>
              )}
              {showSizeDebug && cardSizes[item.id] && (
                <div className="size-debug-info">
                  <div>📏 Card: {cardSizes[item.id].card.width}×{cardSizes[item.id].card.height}</div>
                  <div>🖼️ Content: {cardSizes[item.id].content.width}×{cardSizes[item.id].content.height}</div>
                  {cardSizes[item.id].natural && (
                    <div>🔍 Natural: {cardSizes[item.id].natural.width}×{cardSizes[item.id].natural.height}</div>
                  )}
                  <div>⚪ Whitespace: {cardSizes[item.id].whitespace.horizontal}×{cardSizes[item.id].whitespace.vertical}px</div>
                  <div>🎯 Exact: {cardSizes[item.id].whitespace.exactHorizontal?.toFixed(2)}×{cardSizes[item.id].whitespace.exactVertical?.toFixed(2)}px</div>
                  {cardSizes[item.id].cardStyles?.border !== '0px none rgb(0, 0, 0)' && (
                    <div>🔲 Border: {cardSizes[item.id].cardStyles?.borderWidth}</div>
                  )}
                  {cardSizes[item.id].cardStyles?.padding !== '0px' && (
                    <div>📦 Padding: {cardSizes[item.id].cardStyles?.padding}</div>
                  )}
                </div>
              )}
              {renderContent(item)}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .test-page {
          min-height: 100vh;
          background: #f0f0f0;
          padding: 20px;
        }

        .controls {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: white;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          z-index: 100;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        h1 {
          margin: 0;
          font-size: 24px;
        }

        button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .content-grid {
          margin-top: 80px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 40px;
          max-width: 1400px;
          margin-left: auto;
          margin-right: auto;
        }

        .card-container {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 0;
          margin: 0;
        }

        /* Base adaptive card - SURGICAL precision sizing */
        .content-card {
          width: fit-content; /* Let card size to content width */
          min-width: 200px; /* Minimum for text readability */
          max-width: 500px; /* Maximum for layout control */
          height: fit-content; /* Perfect content fit */
          min-height: unset; /* Remove minimum height */
          max-height: 90vh; /* Keep reasonable maximum */
          background: black;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          padding: 0 !important; /* Force no padding */
          margin: 0 !important; /* Force no margins */
          border: 0 !important; /* Force no border */
          box-sizing: border-box;
          font-size: 0 !important; /* Eliminate font-based spacing */
          line-height: 0 !important; /* Eliminate line-height spacing */
        }

        .content-card.debug {
          border: 3px solid red;
          background: white;
        }

        .content-card.whitespace-debug {
          border: 2px solid lime;
          position: relative;
        }

        .content-card.whitespace-debug::after {
          content: 'NO WHITESPACE';
          position: absolute;
          bottom: 5px;
          right: 5px;
          background: lime;
          color: black;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: bold;
          border-radius: 2px;
          z-index: 20;
        }

        .content-card.size-debug {
          border: 2px solid orange;
        }

        .size-debug-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 165, 0, 0.95);
          color: black;
          padding: 8px;
          font-size: 11px;
          font-family: monospace;
          z-index: 25;
          line-height: 1.2;
        }

        .size-debug-info div {
          margin: 1px 0;
          font-weight: bold;
        }

        .debug-info {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 0, 0, 0.8);
          color: white;
          padding: 8px;
          font-size: 12px;
          z-index: 10;
        }

        /* Platform-specific cards - tight fitting */
        .card-youtube {
          width: 400px !important; /* Match YouTube container */
          height: 225px !important; /* Match YouTube container */
          background: black;
          /* Ensure no extra elements cause height issues */
        }
        
        /* Hide any title/text elements in YouTube cards that cause extra height */
        .card-youtube .youtube-title,
        .card-youtube .title,
        .card-youtube h3,
        .card-youtube p:not(.debug-info p) {
          display: none !important;
        }

        .card-gif {
          height: fit-content;
          max-height: 70vh;
        }

        .card-image {
          height: fit-content;
          max-height: 80vh;
        }

        .card-text {
          height: fit-content; /* No minimum height */
          max-height: 60vh;
          background: white;
        }

        /* Special handling for Bluesky text cards */
        .card-text[data-platform="bluesky"] {
          min-height: 80px; /* Ensure readable minimum for Bluesky posts */
        }

        /* Content containers */
        .youtube-container {
          position: relative;
          width: 400px; /* Standard YouTube width */
          height: 225px; /* Standard 16:9 ratio (400/16*9) */
          background: black;
        }

        .youtube-container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 400px; /* Match card width exactly */
          height: 225px; /* Match card height exactly */
          border: none;
        }

        .giphy-container,
        .image-container {
          width: fit-content; /* Let container size to content */
          height: fit-content; /* Fit content height */
          display: block; /* Block to eliminate spacing */
          background: black;
          padding: 0 !important; /* Force no padding */
          margin: 0 !important; /* Force no margins */
          border: 0 !important; /* Force no border */
          box-sizing: border-box;
          line-height: 0 !important; /* Remove line-height spacing */
          font-size: 0 !important; /* Remove font-based spacing */
          position: relative; /* Prevent margin collapse */
        }

        .giphy-container video,
        .image-container img {
          width: auto; /* Natural width - no forcing */
          height: auto; /* Natural height - no forcing */
          object-fit: contain; /* Preserve aspect ratio */
          max-width: 500px; /* Reasonable maximum */
          display: block !important; /* Force block display */
          margin: 0 !important; /* Force no margins */
          padding: 0 !important; /* Force no padding */
          border: 0 !important; /* Force no border */
          outline: 0 !important; /* Force no outline */
          vertical-align: top !important; /* Remove baseline spacing */
          box-sizing: border-box !important; /* Consistent box model */
        }

        .text-container {
          width: fit-content; /* Let text determine width */
          min-width: 200px; /* Minimum for readability */
          max-width: 500px; /* Maximum for layout */
          height: auto; /* Auto height - no forced fit-content */
          padding: 12px; /* Minimal padding for readability */
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #333;
          background: white;
          min-height: auto; /* No minimum height - let content determine */
          box-sizing: border-box;
        }

        /* Enhanced Bluesky text containers - FORCE proper text wrapping */
        [data-platform="bluesky"] .text-container {
          min-height: auto; /* Let JavaScript handle sizing */
          padding: 16px; /* More padding for social content */
          width: 400px !important; /* Fixed readable width */
          min-width: 400px !important; /* Prevent shrinking */
          max-width: 400px !important; /* Prevent expanding */
          white-space: normal !important; /* Enable wrapping */
          word-wrap: break-word !important; /* Break long words */
          overflow-wrap: break-word !important; /* Modern word breaking */
          height: auto !important; /* Let height expand with content */
          background: white !important; /* Visible background */
          color: #000000 !important; /* BLACK text for visibility */
          font-size: 16px !important; /* Visible font size */
          line-height: 1.4 !important; /* Readable line height */
          display: flex !important; /* Ensure container displays */
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          opacity: 1 !important; /* Ensure not transparent */
          z-index: 10 !important; /* Bring to front */
        }

        /* Force Bluesky cards to proper width and fix text visibility */
        .content-card[data-platform="bluesky"] {
          width: 432px !important; /* 400px + 32px padding */
          min-width: 432px !important;
          font-size: 16px !important; /* Restore font size - override the 0px */
          line-height: 1.4 !important; /* Restore line height - override the 0 */
          background: white !important; /* Ensure background for text cards */
        }

        /* Ensure Bluesky text paragraphs wrap properly and are visible */
        [data-platform="bluesky"] .text-container p {
          white-space: normal !important;
          width: 100% !important;
          display: block !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          font-size: 16px !important; /* Visible font size */
          line-height: 1.4 !important; /* Readable line height */
          color: #000000 !important; /* BLACK text for visibility */
          margin: 0 !important;
          padding: 0 !important;
        }

        .text-container p {
          font-size: 16px;
          line-height: 1.4; /* Tighter line height */
          margin: 0; /* Remove default margins */
          padding: 0; /* No padding */
        }

        /* Visual comparison with old style */
        .old-style {
          object-fit: cover !important;
        }
      `}</style>
    </div>
  )
}