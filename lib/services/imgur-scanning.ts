import { ContentProcessor, contentProcessor } from './content-processor'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { createSimpleClient } from '@/utils/supabase/server'

export interface ImgurImage {
  id: string
  title: string | null
  description: string | null
  datetime: number // Unix timestamp
  type: string // image/jpeg, image/png, etc.
  animated: boolean
  width: number
  height: number
  size: number
  views: number
  bandwidth: number
  vote: null | string
  favorite: boolean
  nsfw: boolean | null
  section: string | null
  account_url: string | null
  account_id: number | null
  is_ad: boolean
  in_gallery: boolean
  link: string // Direct image URL
  comment_count: number | null
  favorite_count: number | null
  ups: number | null
  downs: number | null
  points: number | null
  score: number | null
}

export interface ImgurGalleryItem {
  id: string
  title: string | null
  description: string | null
  datetime: number
  cover?: string // Cover image ID for albums
  account_url: string | null
  account_id: number | null
  privacy?: string
  layout?: string
  views: number
  link: string
  ups: number
  downs: number
  points: number
  score: number
  is_album: boolean
  vote: null | string
  favorite: boolean
  nsfw: boolean
  section: string
  comment_count: number
  favorite_count: number
  topic: string | null
  topic_id: number | null
  images_count?: number
  in_gallery: boolean
  is_ad: boolean
  tags: any[]
  ad_type: number
  ad_url: string
  in_most_viral: boolean
  images?: ImgurImage[] // For albums
}

export interface ImgurSearchResponse {
  data: ImgurGalleryItem[]
  success: boolean
  status: number
}

export interface ProcessedImgurPost {
  id: string
  title: string
  description: string
  imageUrl: string
  author: string
  link: string
  views: number
  upvotes: number
  score: number
  published: Date
  isVideo?: boolean
}

export interface ImgurScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxPostsPerScan: number
  searchTerms: string[]
  minScore: number
  lastScanTime?: Date
}

export interface ImgurPerformScanOptions {
  maxPosts: number
}

export interface ImgurPerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

export class ImgurScanningService {
  private isScanning = false
  private readonly searchTerms = [
    'hotdog', 'hot dog', 'chili dog', 'chicago dog', 'corn dog'
  ]

  constructor() {
    // Using shared contentProcessor instance
  }

  /**
   * Perform a single scan with options
   */
  async performScan(options: ImgurPerformScanOptions): Promise<ImgurPerformScanResult> {
    const maxPosts = options.maxPosts || 20
    const startTime = Date.now()
    
    try {
      await logToDatabase(
        LogLevel.INFO,
        'IMGUR_SCAN_STARTED',
        'Starting Imgur content scan',
        { maxPosts, searchTerms: this.searchTerms }
      )

      let totalFound = 0
      let processed = 0
      let approved = 0
      let rejected = 0
      let duplicates = 0
      let errors = 0

      // Search for hotdog content using multiple terms
      for (const term of this.searchTerms) {
        try {
          const items = await this.searchGallery(term, Math.ceil(maxPosts / this.searchTerms.length))
          console.log(`🔍 Found ${items.length} items for term "${term}"`)
          
          totalFound += items.length

          for (const item of items) {
            try {
              // Check if we already have this content
              const existingContent = await this.checkForExistingContent(item.id)
              if (existingContent) {
                duplicates++
                continue
              }

              // Process the item (single image or album)
              if (item.is_album && item.images_count && item.images_count > 0) {
                // Handle album with multiple images
                const albumImages = await this.getAlbumImages(item.id)
                for (const image of albumImages.slice(0, 3)) { // Limit to first 3 images per album
                  const contentId = await this.saveImageToQueue(image, item, true)
                  if (contentId) {
                    const result = await contentProcessor.processContent(contentId, {
                      autoApprovalThreshold: 0.5,
                      autoRejectionThreshold: 0.2
                    })

                    processed++
                    if (result.action === 'approved') {
                      approved++
                    } else if (result.action === 'rejected') {
                      rejected++
                    }

                    console.log(`✅ Processed Imgur album image: ${result.action} (confidence: ${result.analysis.confidence_score})`)
                  }
                }
              } else {
                // Handle single image/GIF - convert gallery item to image format
                const singleImage: ImgurImage = {
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  datetime: item.datetime,
                  type: 'image/jpeg', // Default, will be corrected by media detection
                  animated: false, // Will be detected from URL
                  width: 0,
                  height: 0,
                  size: 0,
                  views: item.views,
                  bandwidth: 0,
                  vote: item.vote,
                  favorite: item.favorite,
                  nsfw: item.nsfw,
                  section: item.section,
                  account_url: item.account_url,
                  account_id: item.account_id,
                  is_ad: item.is_ad,
                  in_gallery: item.in_gallery,
                  link: item.link,
                  comment_count: item.comment_count,
                  favorite_count: item.favorite_count,
                  ups: item.ups,
                  downs: item.downs,
                  points: item.points,
                  score: item.score
                }

                const contentId = await this.saveImageToQueue(singleImage, item, false)
                if (contentId) {
                  const result = await contentProcessor.processContent(contentId, {
                    autoApprovalThreshold: 0.5,
                    autoRejectionThreshold: 0.2
                  })

                  processed++
                  if (result.action === 'approved') {
                    approved++
                  } else if (result.action === 'rejected') {
                    rejected++
                  }

                  console.log(`✅ Processed Imgur item: ${result.action} (confidence: ${result.analysis.confidence_score})`)
                }
              }
            } catch (error) {
              console.error('Error processing individual item:', error)
              errors++
            }
          }

          // Rate limit delay
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`Error searching for term "${term}":`, error)
          errors++
        }
      }

      const duration = Date.now() - startTime
      await logToDatabase(
        LogLevel.INFO,
        'IMGUR_SCAN_COMPLETED',
        'Imgur content scan completed',
        { 
          totalFound, 
          processed, 
          approved, 
          rejected, 
          duplicates, 
          errors, 
          duration,
          successRate: processed > 0 ? (approved / processed) : 0
        }
      )

      return { 
        totalFound, 
        processed, 
        approved, 
        rejected, 
        duplicates, 
        errors: errors > 0 ? [`${errors} processing errors occurred`] : []
      }

    } catch (error) {
      const duration = Date.now() - startTime
      await logToDatabase(
        LogLevel.ERROR,
        'IMGUR_SCAN_ERROR',
        `Imgur scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : 'Unknown error', duration }
      )
      
      return {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Search Imgur gallery
   */
  private async searchGallery(searchTerm: string, limit: number = 20): Promise<ImgurGalleryItem[]> {
    try {
      const clientId = process.env.IMGUR_CLIENT_ID
      if (!clientId) {
        throw new Error('Imgur Client ID not configured')
      }

      const url = `https://api.imgur.com/3/gallery/search/time/all/0?q=${encodeURIComponent(searchTerm)}`
      
      console.log(`🔍 Searching Imgur gallery for: "${searchTerm}" (limit: ${limit})`)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Client-ID ${clientId}`,
          'User-Agent': 'HotdogDiaries/1.0',
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Imgur API error: ${response.status} ${response.statusText}`)
      }

      const data: ImgurSearchResponse = await response.json()
      
      if (!data.success) {
        throw new Error(`Imgur API returned error: ${data.status}`)
      }

      // Filter and limit results
      const relevantItems = (data.data || [])
        .filter(item => {
          // Filter out NSFW content
          if (item.nsfw) return false
          
          // Filter out ads
          if (item.is_ad) return false
          
          // Ensure it has hotdog-related content
          const text = `${item.title || ''} ${item.description || ''}`.toLowerCase()
          return this.searchTerms.some(term => text.includes(term.toLowerCase()))
        })
        .slice(0, limit)

      console.log(`📝 Found ${relevantItems.length} relevant items out of ${data.data?.length || 0} total`)
      return relevantItems

    } catch (error) {
      console.error(`Error searching Imgur gallery for "${searchTerm}":`, error)
      return []
    }
  }

  private async getAlbumImages(albumId: string): Promise<ImgurImage[]> {
    try {
      const clientId = process.env.IMGUR_CLIENT_ID
      if (!clientId) {
        throw new Error('Imgur Client ID not configured')
      }

      const url = `https://api.imgur.com/3/album/${albumId}/images`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Client-ID ${clientId}`,
          'User-Agent': 'HotdogDiaries/1.0',
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Imgur API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(`Imgur API returned error: ${data.status}`)
      }

      // Filter out NSFW images
      const safeImages = (data.data || []).filter((image: ImgurImage) => !image.nsfw)
      
      console.log(`📷 Retrieved ${safeImages.length} safe images from album ${albumId}`)
      return safeImages

    } catch (error) {
      console.error(`Error fetching album ${albumId}:`, error)
      return []
    }
  }

  private async saveImageToQueue(image: ImgurImage, parentItem: ImgurGalleryItem, isFromAlbum: boolean): Promise<number | null> {
    try {
      // Determine content type and URLs
      const isAnimated = image.animated || image.type?.includes('gif') || image.link.includes('.gif')
      let contentType = isAnimated ? 'gif' : 'image'
      const imageUrl = image.link
      let videoUrl: string | undefined

      // For GIFs, prefer MP4 if available
      if (isAnimated) {
        const mp4Url = image.link.replace(/\.gif$/, '.mp4').replace(/\.gifv$/, '.mp4')
        if (mp4Url !== image.link) {
          videoUrl = mp4Url
          contentType = 'video'
        }
      }

      // Create descriptive content text
      const title = image.title || parentItem.title || 'Hotdog content'
      const description = image.description || parentItem.description || ''
      let contentText = title
      if (description && description !== title) {
        contentText += `\n${description}`
      }

      // Add album indicator if applicable
      if (isFromAlbum) {
        contentText = `🖼️ ${contentText}`
      }

      // Add animation indicator for GIFs
      if (isAnimated) {
        contentText = `🎬 ${contentText}`
      }

      // Generate content hash for duplicate detection
      const hashInput = `imgur_${image.id}_${Date.now()}`
      const contentHash = require('crypto').createHash('md5').update(hashInput).digest('hex')

      // Calculate Imgur confidence score
      const confidenceScore = this.calculateImgurScore(
        image.views || parentItem.views,
        image.ups || parentItem.ups,
        image.downs || parentItem.downs
      )
      const isAutoApproved = (parentItem.ups > 50 && !parentItem.nsfw) // Auto-approve popular SFW content

      // Use Supabase client (same as other working scanners)
      const supabase = createSimpleClient()
      
      const contentData = {
        content_text: contentText.trim(),
        content_image_url: contentType === 'image' || contentType === 'gif' ? imageUrl : null,
        content_video_url: videoUrl || null,
        content_type: contentType,
        source_platform: 'imgur',
        original_url: isFromAlbum ? `https://imgur.com/a/${parentItem.id}#${image.id}` : `https://imgur.com/${image.id}`,
        original_author: parentItem.account_url || 'anonymous',
        content_hash: contentHash,
        content_status: 'discovered',
        confidence_score: confidenceScore,
        is_approved: isAutoApproved,
        is_rejected: false,
        is_posted: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('content_queue')
        .insert(contentData)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      const contentId = data?.id
      if (contentId) {
        console.log(`💾 Saved Imgur ${contentType} to queue: ID ${contentId}`)
        
        // Log additional metadata
        await logToDatabase(
          LogLevel.INFO,
          'IMGUR_CONTENT_SAVED',
          'Saved Imgur content to content queue',
          {
            contentId,
            imgurId: image.id,
            contentType,
            isFromAlbum,
            isAnimated,
            views: image.views || parentItem.views,
            ups: parentItem.ups
          }
        )
      }

      return contentId

    } catch (error) {
      console.error('Error saving Imgur content to queue:', error)
      await logToDatabase(
        LogLevel.ERROR,
        'IMGUR_SAVE_ERROR',
        `Failed to save Imgur content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          imgurId: image.id, 
          parentId: parentItem.id,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      )
      return null
    }
  }

  /**
   * Calculate Imgur-specific confidence score based on engagement
   */
  private calculateImgurScore(views: number = 0, ups: number = 0, downs: number = 0): number {
    // Normalize views (Imgur gets high view counts)
    const viewsNormalized = Math.min(views / 10000, 1.0) * 0.4

    // Calculate upvote ratio
    const totalVotes = ups + downs
    const upvoteRatio = totalVotes > 0 ? ups / totalVotes : 0.5
    
    // Upvote ratio contribution
    const ratioNormalized = upvoteRatio * 0.4

    // Raw upvote count (normalized)
    const upvoteNormalized = Math.min(ups / 100, 1.0) * 0.2

    const finalScore = viewsNormalized + ratioNormalized + upvoteNormalized
    
    // Ensure score is between 0.1 and 1.0
    return Math.max(0.1, Math.min(1.0, finalScore))
  }

  private async checkForExistingContent(imgurId: string): Promise<boolean> {
    try {
      const supabase = createSimpleClient()
      const { data, error } = await supabase
        .from('content_queue')
        .select('id')
        .eq('source_platform', 'imgur')
        .like('original_url', `%${imgurId}%`)
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking for existing content:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error checking for existing content:', error)
      return false
    }
  }

  /**
   * Perform a mock scan for testing without API key
   */
  private async performMockScan(options: ImgurPerformScanOptions): Promise<ImgurPerformScanResult> {
    const mockPosts: ProcessedImgurPost[] = [
      {
        id: 'mock1',
        title: 'Epic Hotdog Meme',
        description: 'When you realize hotdogs are just meat twinkies',
        imageUrl: 'https://i.imgur.com/example1.jpg',
        author: 'hotdoglover42',
        link: 'https://imgur.com/gallery/mock1',
        views: 42069,
        upvotes: 1337,
        score: 1337,
        published: new Date()
      },
      {
        id: 'mock2',
        title: 'Chicago Style Hotdog',
        description: 'The perfect Chicago dog with all the fixings',
        imageUrl: 'https://i.imgur.com/example2.jpg',
        author: 'chicagofoodie',
        link: 'https://imgur.com/gallery/mock2',
        views: 10000,
        upvotes: 500,
        score: 500,
        published: new Date()
      },
      {
        id: 'mock3',
        title: 'Hotdog Costume Fail',
        description: 'My dog dressed as a hotdog for Halloween',
        imageUrl: 'https://i.imgur.com/example3.jpg',
        author: 'dogparent',
        link: 'https://imgur.com/gallery/mock3',
        views: 25000,
        upvotes: 2000,
        score: 2000,
        published: new Date()
      }
    ]

    const result: ImgurPerformScanResult = {
      totalFound: mockPosts.length,
      processed: 0,
      approved: 0,
      rejected: 0,
      duplicates: 0,
      errors: []
    }

    // Process mock posts
    for (const post of mockPosts.slice(0, options.maxPosts)) {
      try {
        const contentData = {
          content_text: `${post.title} ${post.description}`.trim(),
          content_image_url: post.imageUrl,
          content_video_url: null,
          content_type: 'image' as const,
          source_platform: 'imgur' as const,
          original_url: post.link,
          original_author: `@${post.author} on Imgur`,
          scraped_at: new Date(),
          content_hash: this.contentProcessor.generateContentHash({
            content_text: `${post.title} ${post.description}`.trim(),
            content_image_url: post.imageUrl,
            content_video_url: null,
            original_url: post.link
          })
        }

        const insertResult = await db.query(
          `INSERT INTO content_queue (
            content_text, content_image_url, content_video_url, content_type,
            source_platform, original_url, original_author, scraped_at, content_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
          ON CONFLICT (content_hash) DO UPDATE SET updated_at = NOW()
          RETURNING id`,
          [
            contentData.content_text,
            contentData.content_image_url,
            contentData.content_video_url,
            contentData.content_type,
            contentData.source_platform,
            contentData.original_url,
            contentData.original_author,
            contentData.scraped_at,
            contentData.content_hash
          ]
        )

        const contentId = insertResult.rows[0].id

        const processingResult = await this.contentProcessor.processContent(contentId, {
          autoApprovalThreshold: 0.65,
          autoRejectionThreshold: 0.2,
          enableDuplicateDetection: true
        })

        if (processingResult.success && processingResult.action === 'approved') {
          result.approved++
        } else if (processingResult.action === 'duplicate') {
          result.duplicates++
        } else {
          result.rejected++
        }
        result.processed++

      } catch (error) {
        result.errors.push(`Mock post error: ${error.message}`)
      }
    }

    return result
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🔗 Testing Imgur API connection...')
      
      // Test with a simple search
      const testItems = await this.searchGallery('test', 1)
      
      return {
        success: true,
        message: 'Successfully connected to Imgur API',
        details: {
          testItemsFound: testItems.length,
          clientIdConfigured: !!process.env.IMGUR_CLIENT_ID
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Imgur connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  async getScanningStats(): Promise<{
    totalFound: number
    totalProcessed: number
    totalApproved: number
    totalRejected: number
    lastScanTime?: Date
    nextScanTime?: Date
    successRate: number
  }> {
    try {
      const supabase = createSimpleClient()
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('content_queue')
        .select('content_status, scraped_at, is_approved, is_rejected')
        .eq('source_platform', 'imgur')
        .gte('scraped_at', twentyFourHoursAgo)

      if (error) {
        throw error
      }

      const totalFound = data.length
      const approvedPosts = data.filter(item => item.is_approved).length
      const rejectedPosts = data.filter(item => item.is_rejected).length
      const lastScanTime = data.length > 0 
        ? new Date(Math.max(...data.map(item => new Date(item.scraped_at).getTime())))
        : undefined
      
      return {
        totalFound,
        totalProcessed: totalFound,
        totalApproved: approvedPosts,
        totalRejected: rejectedPosts,
        lastScanTime,
        nextScanTime: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
        successRate: totalFound > 0 ? approvedPosts / totalFound : 0
      }
    } catch (error) {
      console.error('Error getting Imgur scanning stats:', error)
      return {
        totalFound: 0,
        totalProcessed: 0,
        totalApproved: 0,
        totalRejected: 0,
        successRate: 0
      }
    }
  }

  async getScanConfig(): Promise<{
    isEnabled: boolean
    scanInterval: number
    lastScanTime?: Date
    nextScanTime?: Date
    searchTerms: string[]
  }> {
    try {
      const stats = await this.getScanningStats()
      
      const hasCredentials = !!process.env.IMGUR_CLIENT_ID
      
      return {
        isEnabled: hasCredentials,
        scanInterval: 6 * 60 * 60 * 1000, // 6 hours
        lastScanTime: stats.lastScanTime,
        nextScanTime: stats.nextScanTime,
        searchTerms: this.searchTerms
      }
    } catch (error) {
      console.error('Error getting Imgur scan config:', error)
      return {
        isEnabled: false,
        scanInterval: 6 * 60 * 60 * 1000,
        searchTerms: this.searchTerms
      }
    }
  }

  async startAutomatedScanning(): Promise<void> {
    try {
      await logToDatabase(
        LogLevel.INFO,
        'IMGUR_AUTO_SCAN_STARTED',
        'Starting automated Imgur scanning'
      )

      // Perform a scan
      await this.performScan({ maxPosts: 25 })
      
      console.log('✅ Imgur automated scanning started successfully')
    } catch (error) {
      console.error('Error starting Imgur automated scanning:', error)
      await logToDatabase(
        LogLevel.ERROR,
        'IMGUR_AUTO_SCAN_ERROR',
        `Failed to start automated Imgur scanning: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }
}

export const imgurScanningService = new ImgurScanningService()