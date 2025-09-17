import { ContentValidator, validateContent, validateContentUpdate } from '@/lib/validation/content'
import { ContentType, SourcePlatform } from '@/types'

describe('ContentValidator', () => {
  describe('validate', () => {
    it('should validate correct content data', () => {
      const validData = {
        content_text: 'Amazing hotdog content!',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.REDDIT,
        original_url: 'https://reddit.com/r/hotdogs/test',
        original_author: 'testuser'
      }

      const errors = ContentValidator.validate(validData)
      expect(errors).toHaveLength(0)
    })

    it('should require at least one content field', () => {
      const invalidData = {
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.REDDIT,
        original_url: 'https://reddit.com/r/hotdogs/test'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'content',
        message: 'At least one of content_text, content_image_url, or content_video_url is required'
      })
    })

    it('should validate content_type enum', () => {
      const invalidData = {
        content_text: 'Test content',
        content_type: 'invalid' as ContentType,
        source_platform: SourcePlatform.REDDIT,
        original_url: 'https://reddit.com/r/hotdogs/test'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'content_type',
        message: 'Invalid content type. Must be one of: text, image, video, gif, mixed'
      })
    })

    it('should validate source_platform enum', () => {
      const invalidData = {
        content_text: 'Test content',
        content_type: ContentType.TEXT,
        source_platform: 'invalid' as SourcePlatform,
        original_url: 'https://reddit.com/r/hotdogs/test'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'source_platform',
        message: 'Invalid source platform. Must be one of: reddit, youtube, pixabay, news, mastodon, bluesky, giphy, tumblr, lemmy'
      })
    })

    it('should validate original_url format', () => {
      const invalidData = {
        content_text: 'Test content',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.REDDIT,
        original_url: 'not-a-url'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'original_url',
        message: 'Valid original URL is required'
      })
    })

    it('should validate text content type requires text', () => {
      const invalidData = {
        content_image_url: 'https://example.com/image.jpg',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.REDDIT,
        original_url: 'https://reddit.com/r/hotdogs/test'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'content_text',
        message: 'content_text is required for text content type'
      })
      expect(errors).toContainEqual({
        field: 'content_type',
        message: 'Text content type should not include image or video URLs'
      })
    })

    it('should validate image content type requires image URL', () => {
      const invalidData = {
        content_text: 'Test content',
        content_type: ContentType.IMAGE,
        source_platform: SourcePlatform.INSTAGRAM,
        original_url: 'https://flickr.com/photos/user/123'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'content_image_url',
        message: 'content_image_url is required for image content type'
      })
    })

    it('should validate video content type requires video URL', () => {
      const invalidData = {
        content_text: 'Test content',
        content_type: ContentType.VIDEO,
        source_platform: SourcePlatform.TIKTOK,
        original_url: 'https://youtube.com/watch?v=123'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'content_video_url',
        message: 'content_video_url is required for video content type'
      })
    })

    it('should validate image URL format', () => {
      const invalidData = {
        content_image_url: 'not-an-image-url',
        content_type: ContentType.IMAGE,
        source_platform: SourcePlatform.INSTAGRAM,
        original_url: 'https://flickr.com/photos/user/123'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'content_image_url',
        message: 'Invalid image URL format'
      })
    })

    it('should validate video URL format', () => {
      const invalidData = {
        content_video_url: 'not-a-video-url',
        content_type: ContentType.VIDEO,
        source_platform: SourcePlatform.TIKTOK,
        original_url: 'https://youtube.com/watch?v=123'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'content_video_url',
        message: 'Invalid video URL format'
      })
    })

    it('should validate text content length', () => {
      const longText = 'a'.repeat(5001)
      const invalidData = {
        content_text: longText,
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.REDDIT,
        original_url: 'https://reddit.com/r/hotdogs/test'
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'content_text',
        message: 'Content text must be 5000 characters or less'
      })
    })

    it('should validate original author length', () => {
      const longAuthor = 'a'.repeat(256)
      const invalidData = {
        content_text: 'Test content',
        content_type: ContentType.TEXT,
        source_platform: SourcePlatform.REDDIT,
        original_url: 'https://reddit.com/r/hotdogs/test',
        original_author: longAuthor
      }

      const errors = ContentValidator.validate(invalidData)
      expect(errors).toContainEqual({
        field: 'original_author',
        message: 'Original author must be 255 characters or less'
      })
    })
  })

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(ContentValidator.isValidUrl('https://example.com')).toBe(true)
      expect(ContentValidator.isValidUrl('http://test.org/path')).toBe(true)
      expect(ContentValidator.isValidUrl('https://sub.domain.com/path?query=1')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(ContentValidator.isValidUrl('not-a-url')).toBe(false)
      expect(ContentValidator.isValidUrl('ftp://invalid')).toBe(false)
      expect(ContentValidator.isValidUrl('')).toBe(false)
    })
  })

  describe('isValidImageUrl', () => {
    it('should validate image URLs by extension', () => {
      expect(ContentValidator.isValidImageUrl('https://example.com/image.jpg')).toBe(true)
      expect(ContentValidator.isValidImageUrl('https://example.com/photo.jpeg')).toBe(true)
      expect(ContentValidator.isValidImageUrl('https://example.com/pic.png')).toBe(true)
      expect(ContentValidator.isValidImageUrl('https://example.com/gif.gif')).toBe(true)
      expect(ContentValidator.isValidImageUrl('https://example.com/modern.webp')).toBe(true)
    })

    it('should validate image URLs by hosting service', () => {
      expect(ContentValidator.isValidImageUrl('https://i.imgur.com/abc123')).toBe(true)
      expect(ContentValidator.isValidImageUrl('https://i.redd.it/abc123')).toBe(true)
      expect(ContentValidator.isValidImageUrl('https://pbs.twimg.com/media/abc123')).toBe(true)
    })

    it('should validate image URLs by keywords', () => {
      expect(ContentValidator.isValidImageUrl('https://example.com/image/123')).toBe(true)
      expect(ContentValidator.isValidImageUrl('https://example.com/photo/456')).toBe(true)
      expect(ContentValidator.isValidImageUrl('https://example.com/picture/789')).toBe(true)
    })

    it('should reject non-image URLs', () => {
      expect(ContentValidator.isValidImageUrl('https://example.com/document.pdf')).toBe(false)
      expect(ContentValidator.isValidImageUrl('https://example.com/video.mp4')).toBe(false)
      expect(ContentValidator.isValidImageUrl('not-a-url')).toBe(false)
    })
  })

  describe('isValidVideoUrl', () => {
    it('should validate video URLs by extension', () => {
      expect(ContentValidator.isValidVideoUrl('https://example.com/video.mp4')).toBe(true)
      expect(ContentValidator.isValidVideoUrl('https://example.com/video.webm')).toBe(true)
      expect(ContentValidator.isValidVideoUrl('https://example.com/video.ogg')).toBe(true)
    })

    it('should validate video URLs by hosting service', () => {
      expect(ContentValidator.isValidVideoUrl('https://youtube.com/watch?v=abc123')).toBe(true)
      expect(ContentValidator.isValidVideoUrl('https://youtu.be/abc123')).toBe(true)
      expect(ContentValidator.isValidVideoUrl('https://vimeo.com/123456')).toBe(true)
      expect(ContentValidator.isValidVideoUrl('https://youtube.com/watch?v=123')).toBe(true)
      expect(ContentValidator.isValidVideoUrl('https://v.redd.it/abc123')).toBe(true)
    })

    it('should reject non-video URLs', () => {
      expect(ContentValidator.isValidVideoUrl('https://example.com/document.pdf')).toBe(false)
      expect(ContentValidator.isValidVideoUrl('https://example.com/image.jpg')).toBe(false)
      expect(ContentValidator.isValidVideoUrl('not-a-url')).toBe(false)
    })
  })
})

describe('validateContent', () => {
  it('should return isValid true for valid content', () => {
    const validData = {
      content_text: 'Valid content',
      content_type: ContentType.TEXT,
      source_platform: SourcePlatform.REDDIT,
      original_url: 'https://reddit.com/r/hotdogs/test'
    }

    const result = validateContent(validData)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should return isValid false for invalid content', () => {
    const invalidData = {
      content_type: 'invalid' as ContentType,
      source_platform: SourcePlatform.REDDIT,
      original_url: 'invalid-url'
    }

    const result = validateContent(invalidData)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('validateContentUpdate', () => {
  it('should validate update data correctly', () => {
    const validUpdateData = {
      content_text: 'Updated content',
      admin_notes: 'Updated by admin',
      is_approved: true
    }

    const result = validateContentUpdate(validUpdateData)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject invalid update data', () => {
    const invalidUpdateData = {
      content_text: 'a'.repeat(5001), // Too long
      content_type: 'invalid' as ContentType
    }

    const result = validateContentUpdate(invalidUpdateData)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})