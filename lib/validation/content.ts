import { ContentType, SourcePlatform } from '@/types'

export interface ContentValidationError {
  field: string
  message: string
}

export interface CreateContentRequest {
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  content_type: ContentType
  source_platform: SourcePlatform
  original_url: string
  original_author?: string
  admin_notes?: string
}

export interface UpdateContentRequest {
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  content_type?: ContentType
  admin_notes?: string
  is_approved?: boolean
}

export class ContentValidator {
  static validate(data: CreateContentRequest): ContentValidationError[] {
    const errors: ContentValidationError[] = []

    // Validate content type
    if (!Object.values(ContentType).includes(data.content_type)) {
      errors.push({
        field: 'content_type',
        message: `Invalid content type. Must be one of: ${Object.values(ContentType).join(', ')}`
      })
    }

    // Validate source platform
    if (!Object.values(SourcePlatform).includes(data.source_platform)) {
      errors.push({
        field: 'source_platform',
        message: `Invalid source platform. Must be one of: ${Object.values(SourcePlatform).join(', ')}`
      })
    }

    // Validate original URL
    if (!data.original_url || !this.isValidUrl(data.original_url)) {
      errors.push({
        field: 'original_url',
        message: 'Valid original URL is required'
      })
    }

    // Validate that at least one content field is provided
    const hasContent = data.content_text || data.content_image_url || data.content_video_url
    if (!hasContent) {
      errors.push({
        field: 'content',
        message: 'At least one of content_text, content_image_url, or content_video_url is required'
      })
    }

    // Validate content type matches provided content
    this.validateContentTypeMatches(data, errors)

    // Validate URLs if provided
    if (data.content_image_url && !this.isValidImageUrl(data.content_image_url)) {
      errors.push({
        field: 'content_image_url',
        message: 'Invalid image URL format'
      })
    }

    if (data.content_video_url && !this.isValidVideoUrl(data.content_video_url)) {
      errors.push({
        field: 'content_video_url',
        message: 'Invalid video URL format'
      })
    }

    // Validate text content length
    if (data.content_text && data.content_text.length > 5000) {
      errors.push({
        field: 'content_text',
        message: 'Content text must be 5000 characters or less'
      })
    }

    // Validate original author length
    if (data.original_author && data.original_author.length > 255) {
      errors.push({
        field: 'original_author',
        message: 'Original author must be 255 characters or less'
      })
    }

    return errors
  }

  static validateUpdate(data: UpdateContentRequest): ContentValidationError[] {
    const errors: ContentValidationError[] = []

    // Validate content type if provided
    if (data.content_type && !Object.values(ContentType).includes(data.content_type)) {
      errors.push({
        field: 'content_type',
        message: `Invalid content type. Must be one of: ${Object.values(ContentType).join(', ')}`
      })
    }

    // Validate URLs if provided
    if (data.content_image_url && !this.isValidImageUrl(data.content_image_url)) {
      errors.push({
        field: 'content_image_url',
        message: 'Invalid image URL format'
      })
    }

    if (data.content_video_url && !this.isValidVideoUrl(data.content_video_url)) {
      errors.push({
        field: 'content_video_url',
        message: 'Invalid video URL format'
      })
    }

    // Validate text content length
    if (data.content_text && data.content_text.length > 5000) {
      errors.push({
        field: 'content_text',
        message: 'Content text must be 5000 characters or less'
      })
    }

    return errors
  }

  private static validateContentTypeMatches(
    data: CreateContentRequest, 
    errors: ContentValidationError[]
  ): void {
    const { content_type, content_text, content_image_url, content_video_url } = data

    switch (content_type) {
      case ContentType.TEXT:
        if (!content_text) {
          errors.push({
            field: 'content_text',
            message: 'content_text is required for text content type'
          })
        }
        if (content_image_url || content_video_url) {
          errors.push({
            field: 'content_type',
            message: 'Text content type should not include image or video URLs'
          })
        }
        break

      case ContentType.IMAGE:
        if (!content_image_url) {
          errors.push({
            field: 'content_image_url',
            message: 'content_image_url is required for image content type'
          })
        }
        if (content_video_url) {
          errors.push({
            field: 'content_type',
            message: 'Image content type should not include video URL'
          })
        }
        break

      case ContentType.VIDEO:
        if (!content_video_url) {
          errors.push({
            field: 'content_video_url',
            message: 'content_video_url is required for video content type'
          })
        }
        if (content_image_url) {
          errors.push({
            field: 'content_type',
            message: 'Video content type should not include image URL'
          })
        }
        break

      case ContentType.MIXED:
        // Mixed content can have any combination, but must have at least one
        break
    }
  }

  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  static isValidImageUrl(url: string): boolean {
    if (!this.isValidUrl(url)) return false
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    const urlLower = url.toLowerCase()
    
    // Check if URL ends with image extension or contains image patterns
    return imageExtensions.some(ext => urlLower.includes(ext)) ||
           urlLower.includes('image') ||
           urlLower.includes('photo') ||
           urlLower.includes('picture') ||
           this.isImageHostingService(url)
  }

  static isValidVideoUrl(url: string): boolean {
    if (!this.isValidUrl(url)) return false
    
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi']
    const urlLower = url.toLowerCase()
    
    // Check if URL ends with video extension or is from known video platforms
    return videoExtensions.some(ext => urlLower.includes(ext)) ||
           this.isVideoHostingService(url)
  }

  private static isImageHostingService(url: string): boolean {
    const imageHosts = [
      'imgur.com',
      'i.redd.it',
      'pbs.twimg.com',
      'instagram.com',
      'cdn.discordapp.com',
      'media.giphy.com'
    ]
    
    return imageHosts.some(host => url.includes(host))
  }

  private static isVideoHostingService(url: string): boolean {
    const videoHosts = [
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'tiktok.com',
      'instagram.com',
      'twitter.com',
      'v.redd.it',
      'gfycat.com',
      'streamable.com'
    ]
    
    return videoHosts.some(host => url.includes(host))
  }
}

export function validateContent(data: CreateContentRequest): {
  isValid: boolean
  errors: ContentValidationError[]
} {
  const errors = ContentValidator.validate(data)
  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateContentUpdate(data: UpdateContentRequest): {
  isValid: boolean
  errors: ContentValidationError[]
} {
  const errors = ContentValidator.validateUpdate(data)
  return {
    isValid: errors.length === 0,
    errors
  }
}