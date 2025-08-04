import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { flickrMonitoringService } from './flickr-monitoring'

export interface FlickrSearchOptions {
  query: string
  maxResults?: number
  sort?: 'relevance' | 'date-posted-desc' | 'date-posted-asc' | 'date-taken-desc' | 'date-taken-asc' | 'interestingness-desc' | 'interestingness-asc'
  license?: string // Creative Commons licenses
  minUploadDate?: Date
  maxUploadDate?: Date
  contentType?: 'photos' | 'screenshots' | 'other'
  safeSearch?: 'safe' | 'moderate' | 'restricted'
}

export interface ProcessedFlickrPhoto {
  id: string
  title: string
  description: string
  photoUrl: string
  thumbnailUrl: string
  mediumUrl: string
  largeUrl?: string
  ownerName: string
  ownerId: string
  ownerUrl: string
  dateTaken?: Date
  datePosted: Date
  views: number
  comments: number
  favorites: number
  tags: string[]
  license: string
  licenseName: string
  licenseUrl?: string
  isPublic: boolean
  isFamily: boolean
  isFriend: boolean
  farm: number
  server: string
  secret: string
}

export interface FlickrApiStatus {
  isAuthenticated: boolean
  requestsUsed: number
  requestsRemaining: number
  requestsResetTime: Date
  lastError?: string
  lastRequest?: Date
}

export class FlickrService {
  private static readonly API_BASE_URL = 'https://www.flickr.com/services/rest/'
  private static readonly HOURLY_REQUEST_LIMIT = 3600 // Flickr API free limit
  
  private apiKey: string | null = null
  private requestTracker = {
    used: 0,
    remaining: 3600,
    resetTime: new Date(Date.now() + 60 * 60 * 1000) // Reset hourly
  }

  constructor() {
    this.apiKey = process.env.FLICKR_API_KEY || null
    
    if (!this.apiKey) {
      console.warn('Flickr API key not found in environment variables')
    }
  }

  /**
   * Search Flickr for hotdog-related photos
   */
  async searchPhotos(options: FlickrSearchOptions): Promise<ProcessedFlickrPhoto[]> {
    const startTime = Date.now()
    try {
      if (!this.apiKey) {
        throw new Error('Flickr API key not configured')
      }

      await this.checkRequestLimit()

      const searchParams = new URLSearchParams({
        method: 'flickr.photos.search',
        api_key: this.apiKey,
        text: options.query,
        format: 'json',
        nojsoncallback: '1',
        per_page: Math.min(options.maxResults || 25, 100).toString(),
        sort: options.sort || 'relevance',
        content_type: options.contentType || 'photos',
        safe_search: options.safeSearch || 'safe',
        extras: 'description,license,date_upload,date_taken,owner_name,icon_server,original_format,last_update,geo,tags,machine_tags,o_dims,views,media,path_alias,url_sq,url_t,url_s,url_q,url_m,url_n,url_z,url_c,url_l,url_o'
      })

      // Add license filter for Creative Commons content
      if (options.license) {
        searchParams.append('license', options.license)
      } else {
        // Default to Creative Commons licenses (1,2,3,4,5,6,9,10)
        searchParams.append('license', '1,2,3,4,5,6,9,10')
      }

      if (options.minUploadDate) {
        searchParams.append('min_upload_date', Math.floor(options.minUploadDate.getTime() / 1000).toString())
      }

      if (options.maxUploadDate) {
        searchParams.append('max_upload_date', Math.floor(options.maxUploadDate.getTime() / 1000).toString())
      }

      const response = await fetch(`${FlickrService.API_BASE_URL}?${searchParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Flickr API error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      this.updateRequestUsage(1)

      if (data.stat !== 'ok') {
        throw new Error(`Flickr API error: ${data.message || 'Unknown error'}`)
      }

      // Process photos
      const processedPhotos: ProcessedFlickrPhoto[] = []
      
      for (const photo of data.photos?.photo || []) {
        try {
          const processedPhoto = await this.processFlickrPhoto(photo)
          
          // Validate content for hotdog relevance
          if (await this.validateFlickrContent(processedPhoto)) {
            processedPhotos.push(processedPhoto)
          }
        } catch (error) {
          console.warn(`Failed to process Flickr photo ${photo.id}:`, error.message)
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'FLICKR_SEARCH_SUCCESS',
        `Found ${processedPhotos.length} Flickr photos for query: ${options.query}`,
        { 
          query: options.query,
          photosFound: processedPhotos.length,
          requestsUsed: this.requestTracker.used
        }
      )

      // Record successful request for monitoring
      const requestTime = Date.now() - startTime
      await flickrMonitoringService.recordApiRequest(true, requestTime)

      return processedPhotos

    } catch (error) {
      // Record failed request for monitoring
      const requestTime = Date.now() - startTime
      const errorType = error.message.includes('limit') ? 'rate_limit' : 
                       error.message.includes('key') ? 'auth_error' : 'api_error'
      await flickrMonitoringService.recordApiRequest(false, requestTime, errorType)

      if (error.message.includes('limit')) {
        await flickrMonitoringService.recordRateLimitHit(this.requestTracker.resetTime)
      }

      await logToDatabase(
        LogLevel.ERROR,
        'FLICKR_SEARCH_ERROR',
        `Flickr search failed: ${error.message}`,
        { 
          query: options.query,
          error: error.message
        }
      )
      
      throw new Error(`Flickr search failed: ${error.message}`)
    }
  }

  /**
   * Get photo information by ID
   */
  async getPhotoInfo(photoId: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Flickr API key not configured')
    }

    try {
      await this.checkRequestLimit()

      const params = new URLSearchParams({
        method: 'flickr.photos.getInfo',
        api_key: this.apiKey,
        photo_id: photoId,
        format: 'json',
        nojsoncallback: '1'
      })

      const response = await fetch(`${FlickrService.API_BASE_URL}?${params}`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`Failed to get photo info: ${response.statusText}`)
      }

      const data = await response.json()
      this.updateRequestUsage(1)

      if (data.stat !== 'ok') {
        throw new Error(`Flickr API error: ${data.message}`)
      }

      return data.photo

    } catch (error) {
      console.warn(`Failed to get Flickr photo info for ${photoId}:`, error.message)
      return null
    }
  }

  /**
   * Process Flickr photo data into structured format
   */
  private async processFlickrPhoto(photo: any): Promise<ProcessedFlickrPhoto> {
    try {
      // Get license information
      const licenseInfo = this.getLicenseInfo(photo.license)

      return {
        id: photo.id,
        title: photo.title || '',
        description: photo.description?._content || '',
        photoUrl: photo.url_o || photo.url_l || photo.url_c || photo.url_z || photo.url_m || photo.url_s || '',
        thumbnailUrl: photo.url_t || photo.url_sq || '',
        mediumUrl: photo.url_m || photo.url_s || '',
        largeUrl: photo.url_l || photo.url_c || photo.url_z,
        ownerName: photo.ownername || 'Unknown',
        ownerId: photo.owner,
        ownerUrl: `https://www.flickr.com/people/${photo.owner}/`,
        dateTaken: photo.datetaken ? new Date(photo.datetaken) : undefined,
        datePosted: new Date(parseInt(photo.dateupload) * 1000),
        views: parseInt(photo.views || '0'),
        comments: parseInt(photo.comments || '0'),
        favorites: parseInt(photo.faves || '0'),
        tags: photo.tags ? photo.tags.split(' ').filter(Boolean) : [],
        license: photo.license,
        licenseName: licenseInfo.name,
        licenseUrl: licenseInfo.url,
        isPublic: photo.ispublic === 1,
        isFamily: photo.isfamily === 1,
        isFriend: photo.isfriend === 1,
        farm: photo.farm,
        server: photo.server,
        secret: photo.secret
      }

    } catch (error) {
      throw new Error(`Failed to process Flickr photo: ${error.message}`)
    }
  }

  /**
   * Validate Flickr content for hotdog relevance
   */
  async validateFlickrContent(photo: ProcessedFlickrPhoto): Promise<boolean> {
    try {
      // Check for hotdog-related terms in title, description, and tags
      const hotdogTerms = [
        'hotdog', 'hot dog', 'hotdogs', 'hot dogs',
        'frankfurter', 'wiener', 'bratwurst', 'sausage',
        'ballpark frank', 'chili dog', 'corn dog', 'weiner',
        'hot-dog', 'hotdogs', 'grilled sausage', 'bbq sausage'
      ]

      const searchText = `${photo.title} ${photo.description} ${photo.tags.join(' ')}`.toLowerCase()
      const hasHotdogTerm = hotdogTerms.some(term => searchText.includes(term))

      if (!hasHotdogTerm) {
        return false
      }

      // Must have proper Creative Commons license
      if (!photo.license || photo.license === '0') {
        return false // All Rights Reserved
      }

      // Must be public
      if (!photo.isPublic) {
        return false
      }

      // Check for inappropriate content indicators
      const inappropriateTerms = [
        'nude', 'naked', 'nsfw', 'adult', 'porn', 'xxx',
        'sexy', 'erotic', 'explicit', 'mature'
      ]

      const hasInappropriateContent = inappropriateTerms.some(term =>
        searchText.includes(term)
      )

      if (hasInappropriateContent) {
        return false
      }

      // Prefer photos with some engagement or recent uploads
      const hasGoodEngagement = photo.views > 50 || photo.favorites > 5 || photo.comments > 1
      const isRecentEnough = photo.datePosted > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Within last year
      const hasValidUrls = photo.photoUrl && photo.thumbnailUrl

      return hasValidUrls && (hasGoodEngagement || isRecentEnough)

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'FLICKR_VALIDATION_ERROR',
        `Flickr content validation failed: ${error.message}`,
        { photoId: photo.id, error: error.message }
      )
      return false
    }
  }

  /**
   * Get Creative Commons license information
   */
  private getLicenseInfo(licenseId: string): { name: string; url?: string } {
    const licenses: Record<string, { name: string; url?: string }> = {
      '0': { name: 'All Rights Reserved' },
      '1': { 
        name: 'Attribution-NonCommercial-ShareAlike', 
        url: 'https://creativecommons.org/licenses/by-nc-sa/2.0/' 
      },
      '2': { 
        name: 'Attribution-NonCommercial', 
        url: 'https://creativecommons.org/licenses/by-nc/2.0/' 
      },
      '3': { 
        name: 'Attribution-NonCommercial-NoDerivs', 
        url: 'https://creativecommons.org/licenses/by-nc-nd/2.0/' 
      },
      '4': { 
        name: 'Attribution', 
        url: 'https://creativecommons.org/licenses/by/2.0/' 
      },
      '5': { 
        name: 'Attribution-ShareAlike', 
        url: 'https://creativecommons.org/licenses/by-sa/2.0/' 
      },
      '6': { 
        name: 'Attribution-NoDerivs', 
        url: 'https://creativecommons.org/licenses/by-nd/2.0/' 
      },
      '7': { name: 'No known copyright restrictions' },
      '8': { name: 'United States Government Work' },
      '9': { name: 'Public Domain Dedication (CC0)' },
      '10': { name: 'Public Domain Mark' }
    }

    return licenses[licenseId] || { name: 'Unknown License' }
  }

  /**
   * Get hotdog-focused search terms for Flickr
   */
  getHotdogSearchTerms(): string[] {
    return [
      'hotdog',
      'hot dog',
      'bratwurst',
      'frankfurter',
      'wiener',
      'sausage grill',
      'ballpark food',
      'bbq hotdog',
      'grilled sausage',
      'street food hotdog',
      'chili dog',
      'corn dog'
    ]
  }

  /**
   * Get Flickr API status and request usage
   */
  async getApiStatus(): Promise<FlickrApiStatus> {
    try {
      if (!this.apiKey) {
        return {
          isAuthenticated: false,
          requestsUsed: 0,
          requestsRemaining: 0,
          requestsResetTime: new Date(),
          lastError: 'API key not configured'
        }
      }

      // Test connection with a simple API call
      const testParams = new URLSearchParams({
        method: 'flickr.test.echo',
        api_key: this.apiKey,
        format: 'json',
        nojsoncallback: '1'
      })

      const response = await fetch(`${FlickrService.API_BASE_URL}?${testParams}`, {
        method: 'GET'
      })

      const isAuthenticated = response.ok
      if (response.ok) {
        const data = await response.json()
        if (data.stat === 'ok') {
          this.updateRequestUsage(1)
        }
      }

      return {
        isAuthenticated: isAuthenticated,
        requestsUsed: this.requestTracker.used,
        requestsRemaining: this.requestTracker.remaining,
        requestsResetTime: this.requestTracker.resetTime,
        lastRequest: new Date(),
        lastError: isAuthenticated ? undefined : `HTTP ${response.status}`
      }

    } catch (error) {
      return {
        isAuthenticated: false,
        requestsUsed: this.requestTracker.used,
        requestsRemaining: this.requestTracker.remaining,
        requestsResetTime: this.requestTracker.resetTime,
        lastError: error.message,
        lastRequest: new Date()
      }
    }
  }

  /**
   * Check request limit before making API calls
   */
  private async checkRequestLimit(): Promise<void> {
    const now = new Date()
    
    // Reset request counter if hour has passed
    if (now >= this.requestTracker.resetTime) {
      this.requestTracker.used = 0
      this.requestTracker.remaining = FlickrService.HOURLY_REQUEST_LIMIT
      this.requestTracker.resetTime = new Date(now.getTime() + 60 * 60 * 1000)
    }
    
    if (this.requestTracker.remaining <= 10) { // Reserve 10 requests minimum
      const waitTime = this.requestTracker.resetTime.getTime() - now.getTime()
      throw new Error(`Flickr API request limit exceeded. Reset in ${Math.ceil(waitTime / 1000 / 60)} minutes`)
    }
  }

  /**
   * Update request usage tracking
   */
  private updateRequestUsage(requests: number): void {
    this.requestTracker.used += requests
    this.requestTracker.remaining = Math.max(0, FlickrService.HOURLY_REQUEST_LIMIT - this.requestTracker.used)
  }

  /**
   * Build photo URL from farm, server, id, secret
   */
  static buildPhotoUrl(farm: number, server: string, id: string, secret: string, size = 'z'): string {
    return `https://farm${farm}.staticflickr.com/${server}/${id}_${secret}_${size}.jpg`
  }

  /**
   * Build photo page URL
   */
  static buildPhotoPageUrl(userId: string, photoId: string): string {
    return `https://www.flickr.com/photos/${userId}/${photoId}/`
  }
}

export const flickrService = new FlickrService()