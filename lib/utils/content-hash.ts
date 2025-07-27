import crypto from 'crypto'

export interface HashableContent {
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  original_url: string
}

export class ContentHasher {
  /**
   * Generate a SHA-256 hash for content to detect duplicates
   */
  static generateHash(content: HashableContent): string {
    // Normalize content by removing whitespace and converting to lowercase
    const normalizedText = content.content_text
      ? this.normalizeText(content.content_text)
      : ''

    const normalizedImageUrl = content.content_image_url
      ? this.normalizeUrl(content.content_image_url)
      : ''

    const normalizedVideoUrl = content.content_video_url
      ? this.normalizeUrl(content.content_video_url)
      : ''

    const normalizedOriginalUrl = this.normalizeUrl(content.original_url)

    // Combine all content fields for hashing
    const combinedContent = [
      normalizedText,
      normalizedImageUrl,
      normalizedVideoUrl,
      normalizedOriginalUrl
    ].filter(Boolean).join('|')

    return crypto
      .createHash('sha256')
      .update(combinedContent, 'utf8')
      .digest('hex')
  }

  /**
   * Generate a hash based only on the original URL for loose duplicate detection
   */
  static generateUrlHash(originalUrl: string): string {
    const normalizedUrl = this.normalizeUrl(originalUrl)
    return crypto
      .createHash('sha256')
      .update(normalizedUrl, 'utf8')
      .digest('hex')
  }

  /**
   * Normalize text content for consistent hashing
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .trim()
  }

  /**
   * Normalize URLs for consistent hashing
   */
  private static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      
      // Remove common tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ref', 'source', 's', 't', 'igshid'
      ]
      
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param)
      })

      // Sort search parameters for consistency
      urlObj.searchParams.sort()

      // Remove fragment (hash)
      urlObj.hash = ''

      // Normalize path (remove trailing slashes)
      urlObj.pathname = urlObj.pathname.replace(/\/+$/, '') || '/'

      return urlObj.toString().toLowerCase()
    } catch {
      // If URL parsing fails, just normalize the string
      return url.toLowerCase().trim()
    }
  }

  /**
   * Check if two content items are likely duplicates based on similarity
   */
  static areSimilar(content1: HashableContent, content2: HashableContent): boolean {
    // Check if URLs are exactly the same (after normalization)
    const url1 = this.normalizeUrl(content1.original_url)
    const url2 = this.normalizeUrl(content2.original_url)
    
    if (url1 === url2) {
      return true
    }

    // Check if image/video URLs are the same
    if (content1.content_image_url && content2.content_image_url) {
      const img1 = this.normalizeUrl(content1.content_image_url)
      const img2 = this.normalizeUrl(content2.content_image_url)
      if (img1 === img2) {
        return true
      }
    }

    if (content1.content_video_url && content2.content_video_url) {
      const vid1 = this.normalizeUrl(content1.content_video_url)
      const vid2 = this.normalizeUrl(content2.content_video_url)
      if (vid1 === vid2) {
        return true
      }
    }

    // Check text similarity if both have text content
    if (content1.content_text && content2.content_text) {
      const text1 = this.normalizeText(content1.content_text)
      const text2 = this.normalizeText(content2.content_text)
      
      // Consider similar if normalized text is identical or very similar
      if (text1 === text2) {
        return true
      }
      
      // Check for substantial overlap (>80% similarity)
      const similarity = this.calculateTextSimilarity(text1, text2)
      if (similarity > 0.8) {
        return true
      }
    }

    return false
  }

  /**
   * Calculate text similarity using Jaccard similarity
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' ').filter(word => word.length > 2))
    const words2 = new Set(text2.split(' ').filter(word => word.length > 2))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return union.size === 0 ? 0 : intersection.size / union.size
  }

  /**
   * Generate multiple hashes for different duplicate detection strategies
   */
  static generateMultipleHashes(content: HashableContent): {
    contentHash: string
    urlHash: string
    textHash?: string
    mediaHash?: string
  } {
    const contentHash = this.generateHash(content)
    const urlHash = this.generateUrlHash(content.original_url)
    
    let textHash: string | undefined
    if (content.content_text) {
      textHash = crypto
        .createHash('sha256')
        .update(this.normalizeText(content.content_text), 'utf8')
        .digest('hex')
    }

    let mediaHash: string | undefined
    const mediaUrl = content.content_image_url || content.content_video_url
    if (mediaUrl) {
      mediaHash = crypto
        .createHash('sha256')
        .update(this.normalizeUrl(mediaUrl), 'utf8')
        .digest('hex')
    }

    return {
      contentHash,
      urlHash,
      textHash,
      mediaHash
    }
  }
}

export function generateContentHash(content: HashableContent): string {
  return ContentHasher.generateHash(content)
}

export function checkContentSimilarity(
  content1: HashableContent, 
  content2: HashableContent
): boolean {
  return ContentHasher.areSimilar(content1, content2)
}