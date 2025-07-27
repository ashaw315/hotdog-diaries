import { ContentHasher, generateContentHash, checkContentSimilarity } from '@/lib/utils/content-hash'

describe('ContentHasher', () => {
  describe('generateHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = {
        content_text: 'Amazing hotdog content!',
        original_url: 'https://twitter.com/user/status/123'
      }

      const hash1 = ContentHasher.generateHash(content)
      const hash2 = ContentHasher.generateHash(content)

      expect(hash1).toBe(hash2)
      expect(typeof hash1).toBe('string')
      expect(hash1.length).toBe(64) // SHA-256 produces 64 character hex string
    })

    it('should generate different hash for different content', () => {
      const content1 = {
        content_text: 'First hotdog content',
        original_url: 'https://twitter.com/user/status/123'
      }

      const content2 = {
        content_text: 'Second hotdog content',
        original_url: 'https://twitter.com/user/status/456'
      }

      const hash1 = ContentHasher.generateHash(content1)
      const hash2 = ContentHasher.generateHash(content2)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle all content types', () => {
      const content = {
        content_text: 'Text content',
        content_image_url: 'https://example.com/image.jpg',
        content_video_url: 'https://youtube.com/watch?v=abc123',
        original_url: 'https://twitter.com/user/status/123'
      }

      const hash = ContentHasher.generateHash(content)
      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(64)
    })

    it('should normalize text content', () => {
      const content1 = {
        content_text: 'Amazing   HOTDOG  content!!!',
        original_url: 'https://twitter.com/user/status/123'
      }

      const content2 = {
        content_text: 'amazing hotdog content',
        original_url: 'https://twitter.com/user/status/123'
      }

      const hash1 = ContentHasher.generateHash(content1)
      const hash2 = ContentHasher.generateHash(content2)

      expect(hash1).toBe(hash2)
    })

    it('should normalize URLs', () => {
      const content1 = {
        content_text: 'Test content',
        original_url: 'https://Twitter.com/User/Status/123?utm_source=test&ref=abc'
      }

      const content2 = {
        content_text: 'Test content',
        original_url: 'https://twitter.com/user/status/123'
      }

      const hash1 = ContentHasher.generateHash(content1)
      const hash2 = ContentHasher.generateHash(content2)

      expect(hash1).toBe(hash2)
    })
  })

  describe('generateUrlHash', () => {
    it('should generate hash from URL only', () => {
      const url = 'https://twitter.com/user/status/123'
      const hash = ContentHasher.generateUrlHash(url)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(64)
    })

    it('should normalize URLs for URL hash', () => {
      const url1 = 'https://Twitter.com/User/Status/123?utm_source=test'
      const url2 = 'https://twitter.com/user/status/123'

      const hash1 = ContentHasher.generateUrlHash(url1)
      const hash2 = ContentHasher.generateUrlHash(url2)

      expect(hash1).toBe(hash2)
    })
  })

  describe('areSimilar', () => {
    it('should detect identical URLs', () => {
      const content1 = {
        content_text: 'Different text 1',
        original_url: 'https://twitter.com/user/status/123'
      }

      const content2 = {
        content_text: 'Different text 2',
        original_url: 'https://twitter.com/user/status/123'
      }

      const similar = ContentHasher.areSimilar(content1, content2)
      expect(similar).toBe(true)
    })

    it('should detect identical image URLs', () => {
      const content1 = {
        content_text: 'First post',
        content_image_url: 'https://imgur.com/abc123.jpg',
        original_url: 'https://twitter.com/user/status/123'
      }

      const content2 = {
        content_text: 'Second post',
        content_image_url: 'https://imgur.com/abc123.jpg',
        original_url: 'https://twitter.com/user/status/456'
      }

      const similar = ContentHasher.areSimilar(content1, content2)
      expect(similar).toBe(true)
    })

    it('should detect identical video URLs', () => {
      const content1 = {
        content_text: 'First video',
        content_video_url: 'https://youtube.com/watch?v=abc123',
        original_url: 'https://twitter.com/user/status/123'
      }

      const content2 = {
        content_text: 'Second video',
        content_video_url: 'https://youtube.com/watch?v=abc123',
        original_url: 'https://twitter.com/user/status/456'
      }

      const similar = ContentHasher.areSimilar(content1, content2)
      expect(similar).toBe(true)
    })

    it('should detect identical text content', () => {
      const content1 = {
        content_text: 'Amazing hotdog content!',
        original_url: 'https://twitter.com/user/status/123'
      }

      const content2 = {
        content_text: 'Amazing   HOTDOG  content!!!',
        original_url: 'https://twitter.com/user/status/456'
      }

      const similar = ContentHasher.areSimilar(content1, content2)
      expect(similar).toBe(true)
    })

    it('should detect similar text content', () => {
      const content1 = {
        content_text: 'amazing delicious hotdog content from restaurant',
        original_url: 'https://twitter.com/user/status/123'
      }

      const content2 = {
        content_text: 'amazing delicious hotdog content from restaurant today',
        original_url: 'https://twitter.com/user/status/456'
      }

      const similar = ContentHasher.areSimilar(content1, content2)
      expect(similar).toBe(true) // Should be >80% similar
    })

    it('should not detect dissimilar content', () => {
      const content1 = {
        content_text: 'Amazing hotdog content',
        original_url: 'https://twitter.com/user/status/123'
      }

      const content2 = {
        content_text: 'Completely different pizza content',
        original_url: 'https://instagram.com/p/different'
      }

      const similar = ContentHasher.areSimilar(content1, content2)
      expect(similar).toBe(false)
    })
  })

  describe('generateMultipleHashes', () => {
    it('should generate all hash types', () => {
      const content = {
        content_text: 'Test content',
        content_image_url: 'https://imgur.com/abc123.jpg',
        original_url: 'https://twitter.com/user/status/123'
      }

      const hashes = ContentHasher.generateMultipleHashes(content)

      expect(hashes.contentHash).toBeTruthy()
      expect(hashes.urlHash).toBeTruthy()
      expect(hashes.textHash).toBeTruthy()
      expect(hashes.mediaHash).toBeTruthy()
      
      expect(typeof hashes.contentHash).toBe('string')
      expect(typeof hashes.urlHash).toBe('string')
      expect(typeof hashes.textHash).toBe('string')
      expect(typeof hashes.mediaHash).toBe('string')
    })

    it('should not generate text hash when no text', () => {
      const content = {
        content_image_url: 'https://imgur.com/abc123.jpg',
        original_url: 'https://twitter.com/user/status/123'
      }

      const hashes = ContentHasher.generateMultipleHashes(content)

      expect(hashes.contentHash).toBeTruthy()
      expect(hashes.urlHash).toBeTruthy()
      expect(hashes.textHash).toBeUndefined()
      expect(hashes.mediaHash).toBeTruthy()
    })

    it('should not generate media hash when no media', () => {
      const content = {
        content_text: 'Text only content',
        original_url: 'https://twitter.com/user/status/123'
      }

      const hashes = ContentHasher.generateMultipleHashes(content)

      expect(hashes.contentHash).toBeTruthy()
      expect(hashes.urlHash).toBeTruthy()
      expect(hashes.textHash).toBeTruthy()
      expect(hashes.mediaHash).toBeUndefined()
    })
  })
})

describe('generateContentHash', () => {
  it('should be convenience function for ContentHasher.generateHash', () => {
    const content = {
      content_text: 'Test content',
      original_url: 'https://twitter.com/user/status/123'
    }

    const hash1 = generateContentHash(content)
    const hash2 = ContentHasher.generateHash(content)

    expect(hash1).toBe(hash2)
  })
})

describe('checkContentSimilarity', () => {
  it('should be convenience function for ContentHasher.areSimilar', () => {
    const content1 = {
      content_text: 'Test content',
      original_url: 'https://twitter.com/user/status/123'
    }

    const content2 = {
      content_text: 'Test content',
      original_url: 'https://twitter.com/user/status/123'
    }

    const similar1 = checkContentSimilarity(content1, content2)
    const similar2 = ContentHasher.areSimilar(content1, content2)

    expect(similar1).toBe(similar2)
    expect(similar1).toBe(true)
  })
})