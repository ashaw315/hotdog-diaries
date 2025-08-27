/**
 * Media Utilities for Hotdog Diaries
 * 
 * Comprehensive media handling for all platforms including URL transformations,
 * format detection, and embed generation.
 */

import { SourcePlatform, ContentType } from '@/types'

export interface MediaInfo {
  type: 'image' | 'video' | 'gif' | 'iframe' | 'unsupported'
  url: string
  embedUrl?: string
  thumbnailUrl?: string
  platform: SourcePlatform
  originalUrl?: string
  width?: number
  height?: number
  isDirectMedia: boolean
  requiresIframe: boolean
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&#\?\/]+)/i,
    /youtube\.com\/v\/([^&#\?\/]+)/i,
    /youtube\.com\/watch\?.*v=([^&#]+)/i
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Convert YouTube URL to embed format
 */
export function getYouTubeEmbedUrl(url: string, options: {
  autoplay?: boolean
  muted?: boolean
  controls?: boolean
  modestbranding?: boolean
} = {}): string | null {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) return null

  const params = new URLSearchParams({
    autoplay: options.autoplay ? '1' : '0',
    mute: options.muted !== false ? '1' : '0',
    controls: options.controls !== false ? '1' : '0',
    modestbranding: options.modestbranding !== false ? '1' : '0',
    rel: '0',
    playsinline: '1',
    showinfo: '0',
    iv_load_policy: '3',
    enablejsapi: '1',
    origin: typeof window !== 'undefined' ? window.location.origin : ''
  })

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * Convert Imgur URLs to direct media URLs
 */
export function getImgurDirectUrl(url: string): string {
  if (!url) return url

  // Already a direct image/video URL
  if (url.match(/i\.imgur\.com.*\.(jpg|jpeg|png|gif|mp4|webm)$/i)) {
    return url
  }

  // Convert imgur.com/ID to i.imgur.com/ID.extension
  const imgurIdMatch = url.match(/imgur\.com\/([a-zA-Z0-9]+)(?:\.[a-zA-Z]+)?/i)
  if (imgurIdMatch) {
    const id = imgurIdMatch[1]
    // Default to .jpg, but this should be determined by content analysis
    return `https://i.imgur.com/${id}.jpg`
  }

  // Convert .gifv to .mp4 for better browser compatibility
  if (url.endsWith('.gifv')) {
    return url.replace('.gifv', '.mp4')
  }

  return url
}

/**
 * Get Giphy direct media URL from various Giphy URL formats
 */
export function getGiphyDirectUrl(url: string): string {
  if (!url) return url

  // Already a direct media URL
  if (url.includes('media.giphy.com') && url.match(/\.(gif|mp4|webp)$/i)) {
    return url
  }

  // Extract Giphy ID and construct media URL
  const giphyIdMatch = url.match(/giphy\.com\/(?:gifs\/|media\/)?(?:[^\/]+\/)*([a-zA-Z0-9]+)/i)
  if (giphyIdMatch) {
    const id = giphyIdMatch[1]
    // Use MP4 for better mobile compatibility
    return `https://media.giphy.com/media/${id}/giphy.mp4`
  }

  return url
}

/**
 * Convert Reddit media URLs to direct formats
 */
export function getRedditDirectUrl(url: string): string {
  if (!url) return url

  // v.redd.it videos - these need special handling
  if (url.includes('v.redd.it')) {
    // Return as-is for now, needs Reddit API integration
    return url
  }

  // i.redd.it images are already direct
  if (url.includes('i.redd.it')) {
    return url
  }

  // Reddit gallery URLs - extract direct image
  const redditGalleryMatch = url.match(/reddit\.com\/gallery\/([^\/\?]+)/i)
  if (redditGalleryMatch) {
    // This would need Reddit API to get actual images
    return url
  }

  return url
}

/**
 * Ensure URL uses HTTPS
 */
export function ensureHttps(url: string): string {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

/**
 * Detect media type from URL
 */
export function detectMediaType(url: string): 'image' | 'video' | 'gif' | 'unknown' {
  if (!url) return 'unknown'

  const lowerUrl = url.toLowerCase()

  // Video formats
  if (lowerUrl.match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?|$)/i)) {
    return 'video'
  }

  // GIF formats (treat as video for better performance)
  if (lowerUrl.match(/\.(gif|gifv)(\?|$)/i)) {
    return 'gif'
  }

  // Image formats
  if (lowerUrl.match(/\.(jpg|jpeg|png|webp|bmp|svg)(\?|$)/i)) {
    return 'image'
  }

  // Platform-specific detection
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'video'
  }

  if (lowerUrl.includes('giphy.com')) {
    return 'gif'
  }

  return 'unknown'
}

/**
 * Get optimized media info for a given URL and platform
 */
export function getMediaInfo(
  url: string, 
  platform: SourcePlatform, 
  contentType?: ContentType
): MediaInfo {
  if (!url) {
    return {
      type: 'unsupported',
      url: '',
      platform,
      isDirectMedia: false,
      requiresIframe: false
    }
  }

  let processedUrl = ensureHttps(url)
  let embedUrl: string | undefined
  let type: MediaInfo['type'] = 'unsupported'
  let isDirectMedia = false
  let requiresIframe = false

  // Platform-specific processing
  switch (platform) {
    case 'youtube' as SourcePlatform:
      const videoId = extractYouTubeVideoId(processedUrl)
      if (videoId) {
        embedUrl = getYouTubeEmbedUrl(processedUrl, { 
          autoplay: false, 
          muted: true, 
          controls: true 
        })
        type = 'video'
        requiresIframe = true
      }
      break

    case 'imgur' as SourcePlatform:
      processedUrl = getImgurDirectUrl(processedUrl)
      const imgurMediaType = detectMediaType(processedUrl)
      type = imgurMediaType === 'unknown' ? 'image' : imgurMediaType
      isDirectMedia = true
      break

    case 'giphy' as SourcePlatform:
      processedUrl = getGiphyDirectUrl(processedUrl)
      type = 'gif'
      isDirectMedia = true
      break

    case 'reddit' as SourcePlatform:
      processedUrl = getRedditDirectUrl(processedUrl)
      type = detectMediaType(processedUrl)
      isDirectMedia = !processedUrl.includes('reddit.com')
      break

    case 'pixabay' as SourcePlatform:
    case 'tumblr' as SourcePlatform:
    case 'bluesky' as SourcePlatform:
    case 'lemmy' as SourcePlatform:
    default:
      type = detectMediaType(processedUrl)
      isDirectMedia = true
      break
  }

  // Override with content type if provided
  if (contentType === ContentType.VIDEO) {
    type = 'video'
  } else if (contentType === ContentType.IMAGE) {
    type = type === 'gif' ? 'gif' : 'image'
  }

  return {
    type,
    url: processedUrl,
    embedUrl,
    platform,
    originalUrl: url,
    isDirectMedia,
    requiresIframe,
    // Default dimensions - should be overridden by actual media
    width: type === 'video' ? 480 : undefined,
    height: type === 'video' ? 270 : undefined
  }
}

/**
 * Generate responsive iframe HTML for embeds
 */
export function generateIframeHtml(
  embedUrl: string, 
  options: {
    width?: number
    height?: number
    className?: string
    title?: string
  } = {}
): string {
  const {
    width = 480,
    height = 270,
    className = 'media-embed',
    title = 'Media embed'
  } = options

  return `
    <div class="embed-container" style="position: relative; width: 100%; height: 0; padding-bottom: ${(height/width) * 100}%;">
      <iframe 
        src="${embedUrl}"
        class="${className}"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        title="${title}"
        loading="lazy"
      ></iframe>
    </div>
  `.trim()
}

/**
 * Get fallback placeholder for failed media
 */
export function getMediaFallback(platform: SourcePlatform, mediaType: string): {
  url: string
  text: string
} {
  const platformEmojis: Record<string, string> = {
    youtube: '📺',
    giphy: '🎭',
    imgur: '📸',
    reddit: '🤖',
    pixabay: '🎨',
    tumblr: '📱',
    bluesky: '🦋',
    lemmy: '🔗',
    mastodon: '🐘'
  }

  const emoji = platformEmojis[platform] || '🌐'
  const text = `${emoji} ${mediaType} from ${platform}`

  // Use encodeURIComponent instead of btoa to handle Unicode characters
  const svgContent = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#f3f4f6"/>
      <text x="200" y="120" text-anchor="middle" font-family="Arial" font-size="48">${emoji}</text>
      <text x="200" y="180" text-anchor="middle" font-family="Arial" font-size="16" fill="#6b7280">
        ${mediaType} from ${platform}
      </text>
      <text x="200" y="200" text-anchor="middle" font-family="Arial" font-size="12" fill="#9ca3af">
        Media temporarily unavailable
      </text>
    </svg>
  `

  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`,
    text
  }
}

/**
 * Check if URL is a valid media URL
 */
export function isValidMediaUrl(url: string): boolean {
  if (!url) return false
  
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Get loading placeholder for media
 */
export function getLoadingPlaceholder(width: number = 400, height: number = 300): string {
  const svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f3f4f6"/>
      <circle cx="${width/2}" cy="${height/2}" r="20" fill="none" stroke="#6b7280" stroke-width="2">
        <animate attributeName="stroke-dasharray" dur="2s" values="0 126;63 63;0 126" repeatCount="indefinite"/>
        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-63;-126" repeatCount="indefinite"/>
      </circle>
      <text x="${width/2}" y="${height/2 + 40}" text-anchor="middle" font-family="Arial" font-size="12" fill="#6b7280">
        Loading...
      </text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`
}