import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface UnsplashSearchOptions {
  query: string
  maxResults?: number
  orientation?: 'landscape' | 'portrait' | 'squarish'
  orderBy?: 'relevant' | 'latest'
}

export interface ProcessedUnsplashPhoto {
  id: string
  description: string
  altDescription: string
  photoUrl: string
  thumbnailUrl: string
  photographer: string
  photographerUrl: string
  downloadUrl: string
  width: number
  height: number
  likes: number
  downloads: number
  tags: string[]
  color: string
  createdAt: Date
}

export class UnsplashService {
  private static readonly API_BASE_URL = 'https://api.unsplash.com'
  private static readonly HOURLY_REQUEST_LIMIT = 5000
  
  private accessKey: string | null = null
  private requestTracker = {
    used: 0,
    remaining: 5000,
    resetTime: new Date(Date.now() + 60 * 60 * 1000)
  }

  constructor() {
    this.accessKey = process.env.UNSPLASH_ACCESS_KEY || null
    
    if (!this.accessKey) {
      console.warn('Unsplash access key not found in environment variables')
    }
  }

  async searchPhotos(options: UnsplashSearchOptions): Promise<ProcessedUnsplashPhoto[]> {
    const startTime = Date.now()
    try {
      if (!this.accessKey) {
        throw new Error('Unsplash access key not configured')
      }

      await this.checkRequestLimit()

      const searchParams = new URLSearchParams({
        query: options.query,
        per_page: Math.min(options.maxResults || 20, 30).toString(),
        orientation: options.orientation || 'landscape',
        order_by: options.orderBy || 'relevant'
      })

      const response = await fetch(
        `${UnsplashService.API_BASE_URL}/search/photos?${searchParams}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Client-ID ${this.accessKey}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      this.updateRequestUsage(1)

      const processedPhotos: ProcessedUnsplashPhoto[] = []
      
      for (const photo of data.results || []) {
        try {
          const processedPhoto = this.processUnsplashPhoto(photo)
          
          if (await this.validateUnsplashContent(processedPhoto)) {
            processedPhotos.push(processedPhoto)
          }
        } catch (error) {
          console.warn(`Failed to process Unsplash photo ${photo.id}:`, error.message)
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'UNSPLASH_SEARCH_SUCCESS',
        `Found ${processedPhotos.length} Unsplash photos for query: ${options.query}`,
        { 
          query: options.query,
          photosFound: processedPhotos.length,
          requestsUsed: this.requestTracker.used
        }
      )

      return processedPhotos

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'UNSPLASH_SEARCH_ERROR',
        `Unsplash search failed: ${error.message}`,
        { 
          query: options.query,
          error: error.message
        }
      )
      
      throw new Error(`Unsplash search failed: ${error.message}`)
    }
  }

  private processUnsplashPhoto(photo: any): ProcessedUnsplashPhoto {
    return {
      id: photo.id,
      description: photo.description || '',
      altDescription: photo.alt_description || '',
      photoUrl: photo.urls?.regular || photo.urls?.full || '',
      thumbnailUrl: photo.urls?.thumb || photo.urls?.small || '',
      photographer: photo.user?.name || 'Unknown',
      photographerUrl: photo.user?.links?.html || '',
      downloadUrl: photo.links?.download || '',
      width: photo.width || 0,
      height: photo.height || 0,
      likes: photo.likes || 0,
      downloads: photo.downloads || 0,
      tags: photo.tags?.map((tag: any) => tag.title) || [],
      color: photo.color || '#000000',
      createdAt: new Date(photo.created_at)
    }
  }

  async validateUnsplashContent(photo: ProcessedUnsplashPhoto): Promise<boolean> {
    try {
      const hotdogTerms = [
        'hotdog', 'hot dog', 'hotdogs', 'sausage', 'frankfurter', 
        'wiener', 'bratwurst', 'ballpark', 'grilling', 'bbq'
      ]

      const searchText = `${photo.description} ${photo.altDescription} ${photo.tags.join(' ')}`.toLowerCase()
      const hasHotdogTerm = hotdogTerms.some(term => searchText.includes(term))

      if (!hasHotdogTerm) {
        return false
      }

      const hasGoodEngagement = photo.likes > 20 || photo.downloads > 100
      const hasValidUrls = photo.photoUrl && photo.thumbnailUrl

      return hasValidUrls && hasGoodEngagement
    } catch (error) {
      return false
    }
  }

  getHotdogSearchTerms(): string[] {
    return [
      'hotdog food',
      'sausage grill',
      'ballpark food',
      'bbq hotdog',
      'street food hotdog'
    ]
  }

  async getApiStatus() {
    try {
      if (!this.accessKey) {
        return {
          isAuthenticated: false,
          requestsUsed: 0,
          requestsRemaining: 0,
          requestsResetTime: new Date(),
          lastError: 'Access key not configured'
        }
      }

      return {
        isAuthenticated: true,
        requestsUsed: this.requestTracker.used,
        requestsRemaining: this.requestTracker.remaining,
        requestsResetTime: this.requestTracker.resetTime,
        lastRequest: new Date()
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

  private async checkRequestLimit(): Promise<void> {
    const now = new Date()
    
    if (now >= this.requestTracker.resetTime) {
      this.requestTracker.used = 0
      this.requestTracker.remaining = UnsplashService.HOURLY_REQUEST_LIMIT
      this.requestTracker.resetTime = new Date(now.getTime() + 60 * 60 * 1000)
    }
    
    if (this.requestTracker.remaining <= 10) {
      const waitTime = this.requestTracker.resetTime.getTime() - now.getTime()
      throw new Error(`Unsplash API request limit exceeded. Reset in ${Math.ceil(waitTime / 1000 / 60)} minutes`)
    }
  }

  private updateRequestUsage(requests: number): void {
    this.requestTracker.used += requests
    this.requestTracker.remaining = Math.max(0, UnsplashService.HOURLY_REQUEST_LIMIT - this.requestTracker.used)
  }
}

export const unsplashService = new UnsplashService()