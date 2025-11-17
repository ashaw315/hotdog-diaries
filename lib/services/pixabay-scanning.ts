import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface PixabayPhoto {
  id: number
  tags: string
  views: number
  likes: number
  downloads: number
  webformatURL: string
  previewURL: string
  user: string
  pageURL: string
  type: string
  webformatWidth: number
  webformatHeight: number
}

export interface PixabaySearchResponse {
  total: number
  totalHits: number
  hits: PixabayPhoto[]
}

export interface ProcessedPixabayPhoto {
  id: string
  description: string
  tags: string[]
  views: number
  likes: number
  downloads: number
  photoUrl: string
  thumbnailUrl: string
  photographer: string
  pageUrl: string
  createdAt: Date
  width: number
  height: number
}

export interface PixabayScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxPhotosPerScan: number
  searchTerms: string[]
  minLikes: number
  minDownloads: number
  lastScanId?: string
  lastScanTime?: Date
}

export interface PixabayPerformScanOptions {
  maxPosts: number
}

export interface PixabayPerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

export class PixabayScanningService {
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false
  private currentPages: Map<string, number> = new Map() // Track current page per search term

  constructor() {
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Perform a single scan with options (interface for content-scanning service)
   */
  async performScan(options: PixabayPerformScanOptions): Promise<PixabayPerformScanResult> {
    try {
      // Get scan configuration
      const config = await this.getScanConfig()

      // Check if Pixabay API is available
      const apiKey = process.env.PIXABAY_API_KEY

      if (!apiKey) {
        console.warn('⚠️  PIXABAY: API key not configured, skipping scan')
        return {
          totalFound: 0,
          processed: 0,
          approved: 0,
          rejected: 0,
          duplicates: 0,
          errors: ['API key not configured']
        }
      }

      const maxPhotos = Math.min(options.maxPosts, config?.maxPhotosPerScan || 30)
      const result: PixabayPerformScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: []
      }

      // Randomly select 4-5 search terms for variety
      const numTerms = 4 + Math.floor(Math.random() * 2) // 4 or 5 terms
      const allTerms = config?.searchTerms || ['hotdog']
      const selectedTerms = allTerms
        .sort(() => Math.random() - 0.5) // Shuffle
        .slice(0, numTerms) // Take 4-5 terms

      // Search for hotdog content using selected search terms
      for (const searchTerm of selectedTerms) {
        try {
          const photos = await this.searchPhotos(searchTerm, Math.floor(maxPhotos / selectedTerms.length))
          result.totalFound += photos.length

          await logToDatabase(
            LogLevel.INFO,
            'PIXABAY_SEARCH_TERM_SUCCESS',
            `Found ${photos.length} photos for search term: ${searchTerm}`,
            { searchTerm, photosFound: photos.length }
          )

          // Process each photo
          for (const photo of photos) {
            try {
              console.log('⚠️ PIXABAY DEBUG: Skipping pre-insertion duplicate check - letting ContentProcessor handle it')

              // Apply content filtering
              const contentAnalysis = await this.filteringService.isValidHotdogContent({
                text: `${photo.description} ${photo.tags.join(' ')}`,
                url: photo.photoUrl,
                metadata: {
                  tags: photo.tags,
                  likes: photo.likes,
                  photographer: photo.photographer
                }
              })

              if (!contentAnalysis.is_valid_hotdog) {
                result.rejected++
                await logToDatabase(
                  LogLevel.DEBUG,
                  'PIXABAY_POST_VALIDATION_FAILED',
                  `Post validation failed: ${photo.description}`,
                  { title: photo.description, photoId: photo.id }
                )
                continue
              }

              await logToDatabase(
                LogLevel.DEBUG,
                'PIXABAY_POST_VALIDATION_PASSED',
                `Post validation passed: ${photo.description}`,
                { title: photo.description, photoId: photo.id }
              )

              // Determine content type
              await logToDatabase(
                LogLevel.DEBUG,
                'PIXABAY_DETERMINING_CONTENT_TYPE',
                `Determining content type for: ${photo.description}`,
                { photoId: photo.id }
              )

              const contentType = 'image' // Pixabay only provides images
              
              await logToDatabase(
                LogLevel.DEBUG,
                'PIXABAY_CONTENT_TYPE_DETERMINED',
                `Content type determined as: ${contentType} for: ${photo.description}`,
                { photoId: photo.id, contentType }
              )

              // Prepare content data for hash generation
              const contentForHash = {
                content_text: photo.description,
                content_image_url: photo.photoUrl,
                content_video_url: null,
                original_url: photo.pageUrl
              }

              // Prepare content data for database insertion
              const contentData = {
                content_text: photo.description,
                content_image_url: photo.photoUrl,
                content_video_url: null,
                content_type: contentType,
                source_platform: 'pixabay',
                original_url: photo.pageUrl,
                original_author: `Photo by ${photo.photographer} on Pixabay`,
                scraped_at: new Date(),
                content_hash: this.contentProcessor.generateContentHash(contentForHash)
              }

              await logToDatabase(
                LogLevel.DEBUG,
                'PIXABAY_CONTENT_INSERT_ATTEMPT',
                `Attempting to insert content: ${photo.description}`,
                { photoId: photo.id, contentData: JSON.stringify(contentData) }
              )

              // DETAILED DEBUGGING: Log exact data before insertion
              console.log('🔍 PIXABAY DEBUG: About to insert content:', {
                title: contentData.content_text,
                platform: contentData.source_platform,
                source_url: contentData.original_url,
                image_url: contentData.content_image_url,
                hasHash: !!contentData.content_hash,
                contentType: contentData.content_type,
                scraped_at: contentData.scraped_at
              });

              let insertResult
              let contentId
              try {
                // Use direct db.query instead of query builder to avoid issues
                const { db } = await import('@/lib/db')
                const insertQuery = `
                  INSERT INTO content_queue (
                    content_text, content_image_url, content_video_url, content_type,
                    source_platform, original_url, original_author, 
                    scraped_at, content_hash
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                  ON CONFLICT (content_hash) DO UPDATE SET updated_at = NOW()
                  RETURNING id, content_text, source_platform
                `
                
                const insertValues = [
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
                
                console.log('🗃️ PIXABAY DEBUG: Using direct db.query for insertion')
                insertResult = await db.query(insertQuery, insertValues)
                
                if (!insertResult.rows || insertResult.rows.length === 0) {
                  throw new Error('Insert returned no rows')
                }
                
                const insertedRecord = insertResult.rows[0]
                contentId = insertedRecord.id
                
                console.log('✅ PIXABAY DEBUG: Direct insertion successful:', {
                  contentId,
                  insertedRecord,
                  rowCount: insertResult.rowCount
                })

                await logToDatabase(
                  LogLevel.DEBUG,
                  'PIXABAY_CONTENT_INSERT_SUCCESS',
                  `Successfully inserted content: ${photo.description}`,
                  { photoId: photo.id, contentId, insertResult: JSON.stringify(insertResult) }
                )
              } catch (insertError) {
                console.error('❌ PIXABAY DEBUG: Insert FAILED:', insertError)
                console.error('❌ PIXABAY DEBUG: Failed data was:', contentData)
                
                await logToDatabase(
                  LogLevel.ERROR,
                  'PIXABAY_CONTENT_INSERT_FAILED',
                  `Failed to insert content: ${insertError.message}`,
                  { 
                    photoId: photo.id, 
                    error: insertError.message,
                    contentData: JSON.stringify(contentData),
                    stack: insertError.stack
                  }
                )
                
                // Skip this photo and continue to next
                result.errors.push(`Insert failed for photo ${photo.id}: ${insertError.message}`)
                continue
              }

              await logToDatabase(
                LogLevel.DEBUG,
                'PIXABAY_CALLING_CONTENT_PROCESSOR',
                `About to call ContentProcessor.processContent for content ID: ${contentId}`,
                { contentId }
              )

              // Process the content with ContentProcessor  
              console.log('⚙️ PIXABAY DEBUG: Calling ContentProcessor for contentId:', contentId)
              
              const processingResult = await this.contentProcessor.processContent(contentId, {
                autoApprovalThreshold: 0.6,  // Lower threshold for Pixabay hotdog content
                autoRejectionThreshold: 0.2,
                enableDuplicateDetection: true  // Enable duplicate detection 
              })

              console.log('🔍 PIXABAY DEBUG: ContentProcessor result:', {
                contentId,
                success: processingResult.success,
                action: processingResult.action,
                confidence: processingResult.analysis.confidence_score,
                isValidHotdog: processingResult.analysis.is_valid_hotdog,
                isSpam: processingResult.analysis.is_spam,
                isInappropriate: processingResult.analysis.is_inappropriate,
                isUnrelated: processingResult.analysis.is_unrelated
              })

              // Check if record still exists after processing
              const { db } = await import('@/lib/db')
              const postProcessVerify = await db.query(
                'SELECT id, is_approved FROM content_queue WHERE id = $1',
                [contentId]
              )
              
              console.log('📊 PIXABAY DEBUG: Post-processing verification:', {
                contentId,
                recordStillExists: postProcessVerify.rows.length > 0,
                recordData: postProcessVerify.rows[0] || null
              })

              await logToDatabase(
                LogLevel.DEBUG,
                'PIXABAY_CONTENT_PROCESSOR_RESULT',
                `ContentProcessor returned: ${JSON.stringify(processingResult)}`,
                { contentId, processingResult }
              )

              if (processingResult.success && processingResult.action === 'approved') {
                result.approved++
              } else {
                result.rejected++
              }
              result.processed++

            } catch (photoError) {
              const errorMessage = photoError instanceof Error ? photoError.message : 'Unknown photo error'
              result.errors.push(`Photo processing error: ${errorMessage}`)
              await logToDatabase(
                LogLevel.ERROR,
                'PIXABAY_PHOTO_PROCESSING_ERROR',
                `Error processing photo ${photo.id}: ${errorMessage}`,
                { photoId: photo.id, error: errorMessage }
              )
            }
          }

        } catch (searchError) {
          const errorMessage = searchError instanceof Error ? searchError.message : 'Unknown search error'
          result.errors.push(`Search error for "${searchTerm}": ${errorMessage}`)
          await logToDatabase(
            LogLevel.ERROR,
            'PIXABAY_SEARCH_ERROR',
            `Error searching for "${searchTerm}": ${errorMessage}`,
            { searchTerm, error: errorMessage }
          )
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'PIXABAY_SCAN_COMPLETED',
        `Pixabay scan completed: ${result.processed} processed, ${result.approved} approved`,
        { 
          scanId: `pixabay_scan_${Date.now()}`,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          photosFound: result.totalFound,
          photosProcessed: result.processed,
          photosApproved: result.approved,
          photosRejected: result.rejected,
          photosFlagged: 0,
          duplicatesFound: result.duplicates,
          errors: result.errors,
          nextScanTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Next scan in 30 minutes
          rateLimitHit: false
        }
      )

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await logToDatabase(
        LogLevel.ERROR,
        'PIXABAY_SCAN_ERROR',
        `Pixabay scan failed: ${errorMessage}`,
        { error: errorMessage }
      )
      
      return {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Search photos on Pixabay
   */
  private async searchPhotos(searchTerm: string, maxResults: number): Promise<ProcessedPixabayPhoto[]> {
    const apiKey = process.env.PIXABAY_API_KEY
    if (!apiKey) {
      throw new Error('Pixabay API key not configured')
    }

    // Get current page for this term (default to 1)
    const currentPage = this.currentPages.get(searchTerm) || 1

    // Randomly vary the order parameter for diversity
    const orderOptions = ['popular', 'latest']
    const order = orderOptions[Math.floor(Math.random() * orderOptions.length)]

    const url = new URL('https://pixabay.com/api/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('q', searchTerm)
    url.searchParams.set('image_type', 'photo')
    url.searchParams.set('per_page', Math.min(maxResults, 200).toString()) // Pixabay max is 200
    url.searchParams.set('safesearch', 'true')
    url.searchParams.set('order', order)
    url.searchParams.set('page', currentPage.toString())

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status} ${response.statusText}`)
    }

    const data: PixabaySearchResponse = await response.json()

    // Update page for next scan (reset to 1 after reaching page 10)
    const nextPage = currentPage >= 10 ? 1 : currentPage + 1
    this.currentPages.set(searchTerm, nextPage)

    return data.hits.map(hit => ({
      id: hit.id.toString(),
      description: this.generateDescription(hit.tags, hit.user),
      tags: hit.tags.split(', ').filter(tag => tag.trim()),
      views: hit.views,
      likes: hit.likes || 0,
      downloads: hit.downloads,
      photoUrl: hit.previewURL, // Use previewURL to avoid hotlink protection
      thumbnailUrl: hit.previewURL,
      photographer: hit.user,
      pageUrl: hit.pageURL,
      createdAt: new Date(),
      width: hit.webformatWidth,
      height: hit.webformatHeight
    }))
  }

  /**
   * Generate a description from tags and user
   */
  private generateDescription(tags: string, user: string): string {
    const tagList = tags.split(', ').slice(0, 3) // Take first 3 tags
    return `${tagList.join(', ')} - Photo by ${user}`
  }

  /**
   * Test connection to Pixabay API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const apiKey = process.env.PIXABAY_API_KEY
      
      if (!apiKey) {
        return {
          success: false,
          message: 'Pixabay API key not configured'
        }
      }

      // Try a simple search to test the connection
      const testPhotos = await this.searchPhotos('hotdog', 1)

      return {
        success: true,
        message: `Pixabay connection successful. Found ${testPhotos.length} test results.`,
        details: {
          testResultsCount: testPhotos.length
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Connection test failed: ${errorMessage}`,
        details: { error: errorMessage }
      }
    }
  }

  /**
   * Get or create scan configuration
   */
  async getScanConfig(): Promise<PixabayScanConfig> {
    const defaultConfig: PixabayScanConfig = {
      isEnabled: true,
      scanInterval: 240, // 4 hours
      maxPhotosPerScan: 40, // Increased from 30 for more variety
      searchTerms: [
        'hotdog',
        'hot dog',
        'hotdogs',
        'corn dog',
        'chicago dog',
        'chili dog',
        'hot dog stand',
        'ballpark hotdog',
        'frankfurter hot dog',
        'bratwurst sausage'
      ],
      minLikes: 5,
      minDownloads: 50
    }

    try {
      const result = await query<PixabayScanConfig>(`
        SELECT * FROM pixabay_scan_config 
        ORDER BY created_at DESC 
        LIMIT 1
      `)

      if (result.length === 0) {
        return defaultConfig
      }

      return result[0]
    } catch (error) {
      // If table doesn't exist or query fails, return default config
      console.warn('Pixabay config query failed, using default config:', error.message)
      return defaultConfig
    }
  }
}

export const pixabayScanningService = new PixabayScanningService()