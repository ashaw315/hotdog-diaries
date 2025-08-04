import { FlickrService, ProcessedFlickrPhoto, FlickrSearchOptions } from './flickr'
import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { flickrMonitoringService } from './flickr-monitoring'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface FlickrScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxPhotosPerScan: number
  searchTerms: string[]
  license: string // Creative Commons license filter
  publishedWithin: number // days
  minViews: number
  contentType: 'photos' | 'screenshots' | 'other'
  safeSearch: 'safe' | 'moderate' | 'restricted'
  lastScanId?: string
  lastScanTime?: Date
}

export interface FlickrScanResult {
  scanId: string
  startTime: Date
  endTime: Date
  photosFound: number
  photosProcessed: number
  photosApproved: number
  photosRejected: number
  photosFlagged: number
  duplicatesFound: number
  errors: string[]
  requestsUsed: number
  searchTermsUsed: string[]
  highestViewedPhoto?: {
    id: string
    title: string
    views: number
    ownerName: string
  }
  nextScanTime?: Date
}

export interface FlickrScanStats {
  totalScans: number
  totalPhotosFound: number
  totalPhotosProcessed: number
  totalPhotosApproved: number
  averageViews: number
  topOwners: Array<{ ownerName: string; count: number; avgViews: number }>
  topSearchTerms: Array<{ term: string; count: number; avgViews: number }>
  scanFrequency: number
  lastScanTime?: Date
  nextScanTime?: Date
  successRate: number
  requestUsageRate: number
}

export class FlickrScanningService {
  private flickrService: FlickrService
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false
  private scanTimer?: NodeJS.Timeout

  constructor() {
    this.flickrService = new FlickrService()
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Start automated Flickr scanning
   */
  async startAutomatedScanning(): Promise<void> {
    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        await logToDatabase(
          LogLevel.INFO,
          'FLICKR_SCAN_DISABLED',
          'Flickr scanning is disabled in configuration'
        )
        return
      }

      // Check if Flickr API is available
      const apiStatus = await this.flickrService.getApiStatus()
      if (!apiStatus.isAuthenticated) {
        await logToDatabase(
          LogLevel.WARNING,
          'FLICKR_NOT_AUTHENTICATED',
          'Flickr scanning cannot start: API not authenticated'
        )
        return
      }

      // Clear existing timer
      if (this.scanTimer) {
        clearInterval(this.scanTimer)
      }

      // Set up periodic scanning
      const intervalMs = config.scanInterval * 60 * 1000 // Convert minutes to milliseconds
      this.scanTimer = setInterval(async () => {
        if (!this.isScanning) {
          await this.performScan()
        }
      }, intervalMs)

      // Perform initial scan
      await this.performScan()

      await logToDatabase(
        LogLevel.INFO,
        'FLICKR_SCAN_STARTED',
        `Flickr scanning started with ${config.scanInterval} minute intervals`,
        { config }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'FLICKR_SCAN_START_ERROR',
        `Failed to start Flickr scanning: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Stop automated Flickr scanning
   */
  async stopAutomatedScanning(): Promise<void> {
    if (this.scanTimer) {
      clearInterval(this.scanTimer)
      this.scanTimer = undefined
    }

    await logToDatabase(
      LogLevel.INFO,
      'FLICKR_SCAN_STOPPED',
      'Flickr scanning stopped'
    )
  }

  /**
   * Perform a single Flickr scan
   */
  async performScan(): Promise<FlickrScanResult> {
    if (this.isScanning) {
      throw new Error('Flickr scan already in progress')
    }

    this.isScanning = true
    const scanId = `flickr_scan_${Date.now()}`
    const startTime = new Date()
    const result: FlickrScanResult = {
      scanId,
      startTime,
      endTime: new Date(),
      photosFound: 0,
      photosProcessed: 0,
      photosApproved: 0,
      photosRejected: 0,
      photosFlagged: 0,
      duplicatesFound: 0,
      errors: [],
      requestsUsed: 0,
      searchTermsUsed: []
    }

    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        throw new Error('Flickr scanning is disabled')
      }

      // Check API status and rate limits
      const apiStatus = await this.flickrService.getApiStatus()
      if (!apiStatus.isAuthenticated) {
        throw new Error('Flickr API not authenticated')
      }

      if (apiStatus.requestsRemaining < 50) {
        throw new Error(`Flickr API requests too low: ${apiStatus.requestsRemaining} remaining`)
      }

      let allPhotos: ProcessedFlickrPhoto[] = []
      result.searchTermsUsed = config.searchTerms

      // Search each configured search term
      for (const searchTerm of config.searchTerms) {
        try {
          const searchOptions: FlickrSearchOptions = {
            query: searchTerm,
            maxResults: Math.floor(config.maxPhotosPerScan / config.searchTerms.length),
            sort: 'interestingness-desc', // Use Flickr's interestingness algorithm
            license: config.license,
            contentType: config.contentType,
            safeSearch: config.safeSearch,
            minUploadDate: new Date(Date.now() - config.publishedWithin * 24 * 60 * 60 * 1000)
          }

          const photos = await this.flickrService.searchPhotos(searchOptions)
          allPhotos = allPhotos.concat(photos)

          await logToDatabase(
            LogLevel.INFO,
            'FLICKR_SEARCH_TERM_SUCCESS',
            `Found ${photos.length} Flickr photos for search term: ${searchTerm}`,
            { scanId, searchTerm, photosFound: photos.length }
          )

        } catch (error) {
          result.errors.push(`Search term "${searchTerm}" failed: ${error.message}`)
          
          await logToDatabase(
            LogLevel.ERROR,
            'FLICKR_SEARCH_TERM_ERROR',
            `Search term failed: ${searchTerm} - ${error.message}`,
            { scanId, searchTerm, error: error.message }
          )
        }
      }

      result.photosFound = allPhotos.length

      // Remove duplicates and filter by view count
      const uniquePhotos = this.removeDuplicatePhotos(allPhotos)
      result.duplicatesFound = allPhotos.length - uniquePhotos.length

      // Filter by minimum view count
      const filteredPhotos = uniquePhotos.filter(photo => photo.views >= config.minViews)

      // Track highest viewed photo
      if (filteredPhotos.length > 0) {
        const highestViewed = filteredPhotos.reduce((max, photo) =>
          photo.views > max.views ? photo : max
        )
        result.highestViewedPhoto = {
          id: highestViewed.id,
          title: highestViewed.title,
          views: highestViewed.views,
          ownerName: highestViewed.ownerName
        }
      }

      // Process each photo through the content pipeline
      for (const photo of filteredPhotos) {
        try {
          const processed = await this.processFlickrPhoto(photo, scanId)
          result.photosProcessed++

          switch (processed.status) {
            case 'approved':
              result.photosApproved++
              break
            case 'rejected':
              result.photosRejected++
              break
            case 'flagged':
              result.photosFlagged++
              break
          }

        } catch (error) {
          result.errors.push(`Photo ${photo.id} processing failed: ${error.message}`)
          
          await logToDatabase(
            LogLevel.ERROR,
            'FLICKR_PHOTO_PROCESS_ERROR',
            `Failed to process Flickr photo ${photo.id}: ${error.message}`,
            { scanId, photoId: photo.id, error: error.message }
          )
        }
      }

      // Get request usage
      const finalApiStatus = await this.flickrService.getApiStatus()
      result.requestsUsed = finalApiStatus.requestsUsed

      // Update scan configuration with latest scan info
      await this.updateLastScanTime()

      result.endTime = new Date()
      result.nextScanTime = new Date(Date.now() + config.scanInterval * 60 * 1000)

      // Record scan results
      await this.recordScanResult(result)

      await logToDatabase(
        LogLevel.INFO,
        'FLICKR_SCAN_COMPLETED',
        `Flickr scan completed: ${result.photosProcessed} processed, ${result.photosApproved} approved`,
        result
      )

      // Record scan completion for monitoring
      await flickrMonitoringService.recordScanCompletion(
        result.photosProcessed,
        true,
        result.errors
      )

      return result

    } catch (error) {
      result.errors.push(error.message)
      result.endTime = new Date()

      await logToDatabase(
        LogLevel.ERROR,
        'FLICKR_SCAN_ERROR',
        `Flickr scan failed: ${error.message}`,
        { scanId, error: error.message }
      )

      // Record scan failure for monitoring
      await flickrMonitoringService.recordScanCompletion(
        result.photosProcessed,
        false,
        result.errors
      )

      throw error

    } finally {
      this.isScanning = false
    }
  }

  /**
   * Process a single Flickr photo through the content pipeline
   */
  private async processFlickrPhoto(photo: ProcessedFlickrPhoto, scanId: string): Promise<{ status: 'approved' | 'rejected' | 'flagged' }> {
    try {
      // Validate Flickr photo content
      const isValid = await this.flickrService.validateFlickrContent(photo)
      if (!isValid) {
        return { status: 'rejected' }
      }

      // Check for duplicates in existing content
      const contentText = `${photo.title}\n${photo.description}`.trim()
      const contentHash = await this.duplicateDetection.generateContentHash(contentText)
      const isDuplicate = await this.duplicateDetection.checkForDuplicates({
        content_text: contentText,
        content_image_url: photo.photoUrl,
        content_hash: contentHash
      })

      if (isDuplicate) {
        return { status: 'rejected' }
      }

      // Determine content type - photos with descriptions are mixed content
      const contentType = contentText.length > 50 ? 'mixed' : 'image'

      // Add to content queue
      const contentData = {
        content_text: contentText,
        content_image_url: photo.photoUrl,
        content_video_url: null,
        content_type: contentType,
        source_platform: 'flickr' as const,
        original_url: `https://www.flickr.com/photos/${photo.ownerId}/${photo.id}/`,
        original_author: photo.ownerName,
        scraped_at: new Date(),
        content_hash: contentHash,
        flickr_data: JSON.stringify({
          photo_id: photo.id,
          owner_id: photo.ownerId,
          owner_name: photo.ownerName,
          owner_url: photo.ownerUrl,
          date_taken: photo.dateTaken,
          date_posted: photo.datePosted,
          views: photo.views,
          comments: photo.comments,
          favorites: photo.favorites,
          tags: photo.tags,
          license: photo.license,
          license_name: photo.licenseName,
          license_url: photo.licenseUrl,
          thumbnail_url: photo.thumbnailUrl,
          medium_url: photo.mediumUrl,
          large_url: photo.largeUrl,
          is_public: photo.isPublic,
          farm: photo.farm,
          server: photo.server,
          secret: photo.secret,
          scan_id: scanId
        })
      }

      const insertedContent = await insert('content_queue')
        .values(contentData)
        .returning(['id'])
        .first()

      if (!insertedContent) {
        throw new Error('Failed to insert content into queue')
      }

      // Process through content processor
      const processingResult = await this.contentProcessor.processContent(insertedContent.id, {
        autoApprovalThreshold: 0.6, // Standard threshold for image content
        autoRejectionThreshold: 0.3
      })

      return { status: processingResult.action as 'approved' | 'rejected' | 'flagged' }

    } catch (error) {
      await logToDatabase(  
        LogLevel.ERROR,
        'FLICKR_PHOTO_PROCESS_ERROR',
        `Failed to process Flickr photo ${photo.id}: ${error.message}`,
        { 
          photoId: photo.id, 
          scanId, 
          error: error.message,
          photo: {
            title: photo.title.substring(0, 100),
            ownerName: photo.ownerName,
            views: photo.views
          }
        }
      )
      throw error
    }
  }

  /**
   * Remove duplicate photos from array
   */
  private removeDuplicatePhotos(photos: ProcessedFlickrPhoto[]): ProcessedFlickrPhoto[] {
    const seen = new Set<string>()
    return photos.filter(photo => {
      if (seen.has(photo.id)) {
        return false
      }
      seen.add(photo.id)
      return true
    })
  }

  /**
   * Get current scan configuration
   */
  async getScanConfig(): Promise<FlickrScanConfig> {
    try {
      const config = await query('flickr_scan_config')
        .select('*')
        .first()

      if (!config) {
        // Return default configuration
        return {
          isEnabled: false,
          scanInterval: 180, // 3 hours
          maxPhotosPerScan: 15,
          searchTerms: this.flickrService.getHotdogSearchTerms(),
          license: '1,2,3,4,5,6,9,10', // Creative Commons licenses
          publishedWithin: 30, // Last month
          minViews: 100,
          contentType: 'photos',
          safeSearch: 'safe'
        }
      }

      return {
        isEnabled: config.is_enabled,
        scanInterval: config.scan_interval,
        maxPhotosPerScan: config.max_photos_per_scan,
        searchTerms: config.search_terms || this.flickrService.getHotdogSearchTerms(),
        license: config.license || '1,2,3,4,5,6,9,10',
        publishedWithin: config.published_within || 30,
        minViews: config.min_views || 100,
        contentType: config.content_type || 'photos',
        safeSearch: config.safe_search || 'safe',
        lastScanId: config.last_scan_id,
        lastScanTime: config.last_scan_time ? new Date(config.last_scan_time) : undefined
      }
    } catch (error) {
      // If table doesn't exist, return defaults
      return {
        isEnabled: false,
        scanInterval: 180,
        maxPhotosPerScan: 15,
        searchTerms: this.flickrService.getHotdogSearchTerms(),
        license: '1,2,3,4,5,6,9,10',
        publishedWithin: 30,
        minViews: 100,
        contentType: 'photos',
        safeSearch: 'safe'
      }
    }
  }

  /**
   * Update scan configuration
   */
  async updateScanConfig(config: Partial<FlickrScanConfig>): Promise<void> {
    try {
      const existing = await this.getScanConfig()
      const updated = { ...existing, ...config }

      await query('flickr_scan_config')
        .upsert({
          is_enabled: updated.isEnabled,
          scan_interval: updated.scanInterval,
          max_photos_per_scan: updated.maxPhotosPerScan,
          search_terms: updated.searchTerms,
          license: updated.license,
          published_within: updated.publishedWithin,
          min_views: updated.minViews,
          content_type: updated.contentType,
          safe_search: updated.safeSearch,
          last_scan_id: updated.lastScanId,
          last_scan_time: updated.lastScanTime,
          updated_at: new Date()
        })

      await logToDatabase(
        LogLevel.INFO,
        'FLICKR_CONFIG_UPDATED',
        'Flickr scan configuration updated',
        { config: updated }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'FLICKR_CONFIG_UPDATE_ERROR',
        `Failed to update Flickr configuration: ${error.message}`,
        { config, error: error.message }
      )
      throw error
    }
  }

  /**
   * Update last scan time
   */
  private async updateLastScanTime(): Promise<void> {
    await this.updateScanConfig({ 
      lastScanTime: new Date() 
    })
  }

  /**
   * Record scan result for analytics
   */
  private async recordScanResult(result: FlickrScanResult): Promise<void> {
    try {
      await insert('flickr_scan_results')
        .values({
          scan_id: result.scanId,
          start_time: result.startTime,
          end_time: result.endTime,
          photos_found: result.photosFound,
          photos_processed: result.photosProcessed,
          photos_approved: result.photosApproved,
          photos_rejected: result.photosRejected,
          photos_flagged: result.photosFlagged,
          duplicates_found: result.duplicatesFound,
          search_terms_used: result.searchTermsUsed,
          highest_views: result.highestViewedPhoto?.views || 0,
          requests_used: result.requestsUsed,
          errors: result.errors,
          created_at: new Date()
        })

    } catch (error) {
      // Don't throw error here, just log it
      await logToDatabase(
        LogLevel.WARNING,
        'FLICKR_SCAN_RESULT_RECORD_ERROR',
        `Failed to record Flickr scan result: ${error.message}`,
        { scanId: result.scanId, error: error.message }
      )
    }
  }

  /**
   * Test Flickr API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const status = await this.flickrService.getApiStatus()
      
      if (status.isAuthenticated) {
        return {
          success: true,
          message: 'Flickr API connection successful',
          details: status
        }
      } else {
        return {
          success: false,
          message: status.lastError || 'Flickr API not authenticated',
          details: status
        }
      }

    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        details: { error: error.message }
      }
    }
  }
}

export const flickrScanningService = new FlickrScanningService()