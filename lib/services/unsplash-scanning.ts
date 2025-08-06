import { UnsplashService, ProcessedUnsplashPhoto, UnsplashSearchOptions } from './unsplash'
import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface UnsplashScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxPhotosPerScan: number
  searchTerms: string[]
  orientation: 'landscape' | 'portrait' | 'squarish'
  minLikes: number
  minDownloads: number
  lastScanId?: string
  lastScanTime?: Date
}

export interface UnsplashScanResult {
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
  highestLikedPhoto?: {
    id: string
    description: string
    likes: number
    photographer: string
  }
  nextScanTime?: Date
}

export interface UnsplashScanStats {
  totalScans: number
  totalPhotosFound: number
  totalPhotosProcessed: number
  totalPhotosApproved: number
  averageLikes: number
  topPhotographers: Array<{ photographer: string; count: number; avgLikes: number }>
  topSearchTerms: Array<{ term: string; count: number; avgLikes: number }>
  scanFrequency: number
  lastScanTime?: Date
  nextScanTime?: Date
  successRate: number
  requestUsageRate: number
}

export interface UnsplashPerformScanOptions {
  maxPosts: number
}

export interface UnsplashPerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

// Mock data for when API key is not available
const MOCK_UNSPLASH_PHOTOS = [
  {
    id: 'mock_unsplash_1',
    description: 'Delicious Chicago-style hot dog with all the classic toppings',
    altDescription: 'Chicago hot dog with mustard, onions, relish, tomato, pickle, peppers',
    photoUrl: 'https://via.placeholder.com/800x600/FF6B6B/FFFFFF?text=Chicago+Hotdog',
    thumbnailUrl: 'https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=Chicago+Hotdog',
    photographer: 'Food Photographer',
    photographerUrl: 'https://unsplash.com/@foodphotographer',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    likes: 245,
    downloads: 1800,
    tags: ['hotdog', 'chicago', 'food', 'street food'],
    color: '#FF6B6B',
    width: 800,
    height: 600,
    downloadUrl: 'https://via.placeholder.com/800x600/FF6B6B/FFFFFF?text=Chicago+Hotdog'
  },
  {
    id: 'mock_unsplash_2',
    description: 'Grilled bratwurst sausages on BBQ grill with perfect char marks',
    altDescription: 'German bratwurst sausages grilling over open flames',
    photoUrl: 'https://via.placeholder.com/1000x750/4ECDC4/FFFFFF?text=BBQ+Bratwurst',
    thumbnailUrl: 'https://via.placeholder.com/400x300/4ECDC4/FFFFFF?text=BBQ+Bratwurst',
    photographer: 'Grill Master',
    photographerUrl: 'https://unsplash.com/@grillmaster',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    likes: 567,
    downloads: 3200,
    tags: ['bratwurst', 'grill', 'bbq', 'german', 'sausage'],
    color: '#4ECDC4',
    width: 1000,
    height: 750,
    downloadUrl: 'https://via.placeholder.com/1000x750/4ECDC4/FFFFFF?text=BBQ+Bratwurst'
  },
  {
    id: 'mock_unsplash_3',
    description: 'Baseball stadium hot dog with classic American toppings',
    altDescription: 'Stadium hot dog with mustard and ketchup in aluminum foil',
    photoUrl: 'https://via.placeholder.com/800x800/45B7D1/FFFFFF?text=Stadium+Hotdog',
    thumbnailUrl: 'https://via.placeholder.com/400x400/45B7D1/FFFFFF?text=Stadium+Hotdog',
    photographer: 'Sports Fan',
    photographerUrl: 'https://unsplash.com/@sportsfan',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    likes: 389,
    downloads: 2100,
    tags: ['baseball', 'stadium', 'hotdog', 'sports', 'american'],
    color: '#45B7D1',
    width: 800,
    height: 800,
    downloadUrl: 'https://via.placeholder.com/800x800/45B7D1/FFFFFF?text=Stadium+Hotdog'
  },
  {
    id: 'mock_unsplash_4',
    description: 'Gourmet artisan hot dog with truffle aioli and craft toppings',
    altDescription: 'Upscale gourmet hot dog with artisanal ingredients',
    photoUrl: 'https://via.placeholder.com/900x675/96CEB4/FFFFFF?text=Gourmet+Hotdog',
    thumbnailUrl: 'https://via.placeholder.com/400x300/96CEB4/FFFFFF?text=Gourmet+Hotdog',
    photographer: 'Fine Dining Chef',
    photographerUrl: 'https://unsplash.com/@finediningchef',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
    likes: 823,
    downloads: 4500,
    tags: ['gourmet', 'artisan', 'fine dining', 'hotdog', 'upscale'],
    color: '#96CEB4',
    width: 900,
    height: 675,
    downloadUrl: 'https://via.placeholder.com/900x675/96CEB4/FFFFFF?text=Gourmet+Hotdog'
  },
  {
    id: 'mock_unsplash_5',
    description: 'New York street vendor hot dog cart with steaming hot dogs',
    altDescription: 'NYC hot dog cart with vendor serving customers',
    photoUrl: 'https://via.placeholder.com/1200x800/FECA57/FFFFFF?text=NYC+Hotdog+Cart',
    thumbnailUrl: 'https://via.placeholder.com/400x267/FECA57/FFFFFF?text=NYC+Cart',
    photographer: 'Street Photographer',
    photographerUrl: 'https://unsplash.com/@streetphotographer',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    likes: 1204,
    downloads: 6800,
    tags: ['nyc', 'street vendor', 'hot dog', 'urban', 'new york'],
    color: '#FECA57',
    width: 1200,
    height: 800,
    downloadUrl: 'https://via.placeholder.com/1200x800/FECA57/FFFFFF?text=NYC+Hotdog+Cart'
  }
]

export class UnsplashScanningService {
  private unsplashService: UnsplashService
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false
  private scanTimer?: NodeJS.Timeout

  constructor() {
    this.unsplashService = new UnsplashService()
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Perform a single scan with options (interface for content-scanning service)
   */
  async performScan(options: UnsplashPerformScanOptions): Promise<UnsplashPerformScanResult> {
    try {
      // Get scan configuration
      const config = await this.getScanConfig()
      
      // Skip config enabled check for mock mode - always allow mock data
      // if (!config || !config.isEnabled) {
      //   await logToDatabase(
      //     LogLevel.INFO,
      //     'UNSPLASH_SCAN_DISABLED',
      //     'Unsplash scanning is disabled in configuration'
      //   )
      //   return {
      //     totalFound: 0,
      //     processed: 0,
      //     approved: 0,
      //     rejected: 0,
      //     duplicates: 0,
      //     errors: ['Scanning disabled']
      //   }
      // }

      // Check if Unsplash API is available, if not use mock data
      const apiStatus = await this.unsplashService.getApiStatus()
      const useRealAPI = apiStatus.isAuthenticated && process.env.UNSPLASH_ACCESS_KEY

      if (!useRealAPI) {
        console.warn('⚠️  UNSPLASH: API key not configured, using mock data')
        return await this.performMockScan(options)
      }

      const maxPhotos = Math.min(options.maxPosts, config.maxPhotosPerScan)
      const result: UnsplashPerformScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: []
      }

      // Search for hotdog content using different search terms
      for (const searchTerm of config.searchTerms.slice(0, 3)) { // Limit to 3 terms to avoid API limits
        try {
          const searchOptions: UnsplashSearchOptions = {
            query: searchTerm,
            maxResults: Math.floor(maxPhotos / config.searchTerms.length),
            orientation: config.orientation,
            orderBy: 'relevant'
          }

          const photos = await this.unsplashService.searchPhotos(searchOptions)
          result.totalFound += photos.length

          // Process each photo
          for (const photo of photos) {
            try {
              // Check for duplicates
              const duplicateResult = await this.duplicateDetection.checkForDuplicates({
                platform: 'unsplash',
                url: photo.photoUrl,
                title: photo.description,
                content_hash: await this.contentProcessor.generateContentHash(photo.photoUrl)
              })

              if (duplicateResult.isDuplicate) {
                result.duplicates++
                continue
              }

              // Apply content filtering
              const contentAnalysis = await this.filteringService.isValidHotdogContent({
                text: `${photo.description} ${photo.altDescription}`,
                url: photo.photoUrl,
                metadata: {
                  tags: photo.tags,
                  likes: photo.likes,
                  photographer: photo.photographer
                }
              })

              if (!contentAnalysis.is_valid_hotdog) {
                result.rejected++
                continue
              }

              // Process and store the content
              const processedContent = await this.contentProcessor.processContent({
                platform: 'unsplash',
                type: 'photo',
                title: photo.description || photo.altDescription || `Photo by ${photo.photographer}`,
                content: photo.altDescription || photo.description,
                url: photo.photoUrl,
                imageUrl: photo.photoUrl,
                thumbnailUrl: photo.thumbnailUrl,
                author: photo.photographer,
                authorUrl: photo.photographerUrl,
                publishedAt: photo.createdAt,
                metadata: {
                  originalId: photo.id,
                  likes: photo.likes,
                  downloads: photo.downloads,
                  tags: photo.tags,
                  color: photo.color,
                  width: photo.width,
                  height: photo.height,
                  downloadUrl: photo.downloadUrl
                }
              })

              if (processedContent.isApproved) {
                result.approved++
              } else {
                result.rejected++
              }
              result.processed++

            } catch (photoError) {
              result.errors.push(`Photo processing error: ${photoError.message}`)
            }
          }

        } catch (searchError) {
          result.errors.push(`Search error for "${searchTerm}": ${searchError.message}`)
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'UNSPLASH_SCAN_COMPLETED',
        `Unsplash scan completed: ${result.approved} approved, ${result.rejected} rejected, ${result.duplicates} duplicates`,
        result
      )

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await logToDatabase(
        LogLevel.ERROR,
        'UNSPLASH_SCAN_ERROR',
        `Unsplash scan failed: ${errorMessage}`,
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
   * Perform scan using mock data
   */
  private async performMockScan(options: UnsplashPerformScanOptions): Promise<UnsplashPerformScanResult> {
    const maxPhotos = Math.min(options.maxPosts, MOCK_UNSPLASH_PHOTOS.length)
    const selectedPhotos = MOCK_UNSPLASH_PHOTOS.slice(0, maxPhotos)
    
    const result: UnsplashPerformScanResult = {
      totalFound: selectedPhotos.length,
      processed: 0,
      approved: 0,
      rejected: 0,
      duplicates: 0,
      errors: []
    }

    // Process each mock photo
    for (const photo of selectedPhotos) {
      try {
        // Check for duplicates
        const duplicateResult = await this.duplicateDetection.checkForDuplicates({
          platform: 'unsplash',
          url: photo.photoUrl,
          title: photo.description,
          content_hash: await this.contentProcessor.generateContentHash(photo.photoUrl)
        })

        if (duplicateResult.isDuplicate) {
          result.duplicates++
          continue
        }

        // Apply content filtering
        const contentAnalysis = await this.filteringService.isValidHotdogContent({
          text: `${photo.description} ${photo.altDescription}`,
          url: photo.photoUrl,
          metadata: {
            tags: photo.tags,
            likes: photo.likes,
            photographer: photo.photographer
          }
        })

        if (!contentAnalysis.is_valid_hotdog) {
          result.rejected++
          continue
        }

        // Process and store the content
        const processedContent = await this.contentProcessor.processContent({
          platform: 'unsplash',
          type: 'photo',
          title: photo.description || photo.altDescription || `Photo by ${photo.photographer}`,
          content: photo.altDescription || photo.description,
          url: photo.photoUrl,
          imageUrl: photo.photoUrl,
          thumbnailUrl: photo.thumbnailUrl,
          author: photo.photographer,
          authorUrl: photo.photographerUrl,
          publishedAt: photo.createdAt,
          metadata: {
            originalId: photo.id,
            likes: photo.likes,
            downloads: photo.downloads,
            tags: photo.tags,
            color: photo.color,
            width: photo.width,
            height: photo.height,
            downloadUrl: photo.downloadUrl
          }
        })

        if (processedContent.isApproved) {
          result.approved++
        } else {
          result.rejected++
        }
        result.processed++

      } catch (photoError) {
        result.errors.push(`Mock photo processing error: ${photoError.message}`)
      }
    }

    await logToDatabase(
      LogLevel.INFO,
      'UNSPLASH_MOCK_SCAN_COMPLETED',
      `Unsplash mock scan completed: ${result.approved} approved, ${result.rejected} rejected, ${result.duplicates} duplicates`,
      result
    )

    return result
  }

  /**
   * Test connection to Unsplash API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const apiStatus = await this.unsplashService.getApiStatus()
      
      if (!apiStatus.isAuthenticated) {
        return {
          success: false,
          message: 'Unsplash API key not configured',
          details: apiStatus
        }
      }

      // Try a simple search to test the connection
      const testPhotos = await this.unsplashService.searchPhotos({
        query: 'hotdog',
        maxResults: 1
      })

      return {
        success: true,
        message: `Unsplash connection successful. Found ${testPhotos.length} test results.`,
        details: {
          apiStatus,
          testResultsCount: testPhotos.length
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

  /**
   * Get or create scan configuration
   */
  async getScanConfig(): Promise<UnsplashScanConfig> {
    const defaultConfig: UnsplashScanConfig = {
      isEnabled: true,
      scanInterval: 240, // 4 hours
      maxPhotosPerScan: 30,
      searchTerms: ['hotdog food', 'sausage grill', 'ballpark food', 'bbq hotdog', 'street food hotdog'],
      orientation: 'landscape',
      minLikes: 20,
      minDownloads: 100
    }

    try {
      const result = await query<UnsplashScanConfig>(`
        SELECT * FROM unsplash_scan_config 
        ORDER BY created_at DESC 
        LIMIT 1
      `)

      if (result.length === 0) {
        return defaultConfig
      }

      return result[0]
    } catch (error) {
      // If table doesn't exist or query fails, return default config
      console.warn('Unsplash config query failed, using default config:', error.message)
      return defaultConfig
    }
  }

  /**
   * Create default scan configuration
   */
  private async createDefaultScanConfig(): Promise<UnsplashScanConfig> {
    const config: UnsplashScanConfig = {
      isEnabled: true,
      scanInterval: 240, // 4 hours
      maxPhotosPerScan: 30,
      searchTerms: ['hotdog food', 'sausage grill', 'ballpark food', 'bbq hotdog', 'street food hotdog'],
      orientation: 'landscape',
      minLikes: 20,
      minDownloads: 100
    }

    try {
      await insert('unsplash_scan_config', {
        is_enabled: config.isEnabled,
        scan_interval: config.scanInterval,
        max_photos_per_scan: config.maxPhotosPerScan,
        search_terms: config.searchTerms,
        orientation: config.orientation,
        min_likes: config.minLikes,
        min_downloads: config.minDownloads,
        created_at: new Date(),
        updated_at: new Date()
      })

      await logToDatabase(
        LogLevel.INFO,
        'UNSPLASH_DEFAULT_CONFIG_CREATED',
        'Created default Unsplash scan configuration',
        { config }
      )
    } catch (error) {
      // If we can't create the config, just return the default
      await logToDatabase(
        LogLevel.WARNING,
        'UNSPLASH_CONFIG_CREATE_FAILED',
        `Could not create Unsplash scan config: ${error.message}`,
        { error: error.message }
      )
    }

    return config
  }
}

export const unsplashScanningService = new UnsplashScanningService()