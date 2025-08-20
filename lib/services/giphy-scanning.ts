import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { createSimpleClient } from '@/utils/supabase/server'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { loadEnv } from '@/lib/env'

// Ensure environment variables are loaded
loadEnv()

export interface GiphyGif {
  id: string
  title: string
  url: string // Giphy page URL
  slug: string
  bitly_gif_url: string
  bitly_url: string
  embed_url: string
  username: string
  source: string
  source_tld: string
  source_post_url: string
  is_sticker: number
  import_datetime: string
  trending_datetime: string
  rating: string // g, pg, pg-13, r
  content_url: string
  tags: string[]
  featured_tags: string[]
  user?: {
    avatar_url: string
    banner_image: string
    banner_url: string
    profile_url: string
    username: string
    display_name: string
  }
  images: {
    original: {
      height: string
      width: string
      size: string
      url: string
      mp4_size?: string
      mp4?: string
      webp_size?: string
      webp?: string
    }
    downsized_medium: {
      height: string
      width: string
      size: string
      url: string
    }
    fixed_height_small: {
      height: string
      width: string
      size: string
      url: string
      mp4_size?: string
      mp4?: string
      webp_size?: string
      webp?: string
    }
    preview_gif: {
      height: string
      width: string
      size: string
      url: string
    }
  }
}

export interface GiphySearchResponse {
  data: GiphyGif[]
  pagination: {
    total_count: number
    count: number
    offset: number
  }
  meta: {
    status: number
    msg: string
    response_id: string
  }
}

export interface GiphyScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxGifsPerScan: number
  searchTerms: string[]
  lastScanTime?: Date
  lastSearchTermIndex: number
  dailyRequestCount: number
  hourlyRequestCount: number
  lastRequestReset: Date
}

export interface GiphyPerformScanOptions {
  maxPosts: number
}

export interface GiphyPerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

// Mock GIF data for when API fails or is unavailable
const MOCK_GIPHY_GIFS: GiphyGif[] = [
  {
    id: 'mock_giphy_1',
    title: 'Hot Dog Eating Contest Champion',
    url: 'https://giphy.com/gifs/hotdog-eating-contest-mock1',
    slug: 'hot-dog-eating-contest-champion-mock1',
    bitly_gif_url: 'https://gph.is/mock1',
    bitly_url: 'https://gph.is/mock1',
    embed_url: 'https://giphy.com/embed/mock1',
    username: 'foodiegifs',
    source: '',
    source_tld: '',
    source_post_url: '',
    is_sticker: 0,
    import_datetime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    trending_datetime: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    rating: 'g',
    content_url: '',
    tags: ['hotdog', 'eating', 'contest', 'food'],
    featured_tags: ['hotdog', 'food'],
    images: {
      original: {
        height: '480',
        width: '640',
        size: '2547329',
        url: 'https://via.placeholder.com/640x480/FF6B6B/FFFFFF?text=Hot+Dog+Contest',
        mp4: 'https://via.placeholder.com/640x480/FF6B6B/FFFFFF?text=Hot+Dog+Contest.mp4'
      },
      downsized_medium: {
        height: '360',
        width: '480',
        size: '1547329',
        url: 'https://via.placeholder.com/480x360/FF6B6B/FFFFFF?text=Hot+Dog+Contest'
      },
      fixed_height_small: {
        height: '100',
        width: '133',
        size: '247329',
        url: 'https://via.placeholder.com/133x100/FF6B6B/FFFFFF?text=Hot+Dog+Contest'
      },
      preview_gif: {
        height: '180',
        width: '240',
        size: '547329',
        url: 'https://via.placeholder.com/240x180/FF6B6B/FFFFFF?text=Hot+Dog+Contest'
      }
    }
  },
  {
    id: 'mock_giphy_2',
    title: 'Chicago Style Hot Dog Animation',
    url: 'https://giphy.com/gifs/chicago-hotdog-style-mock2',
    slug: 'chicago-style-hot-dog-animation-mock2',
    bitly_gif_url: 'https://gph.is/mock2',
    bitly_url: 'https://gph.is/mock2',
    embed_url: 'https://giphy.com/embed/mock2',
    username: 'chicagofood',
    source: '',
    source_tld: '',
    source_post_url: '',
    is_sticker: 0,
    import_datetime: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    trending_datetime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    rating: 'g',
    content_url: '',
    tags: ['chicago', 'hotdog', 'style', 'mustard', 'relish'],
    featured_tags: ['chicago', 'hotdog'],
    images: {
      original: {
        height: '400',
        width: '600',
        size: '1847329',
        url: 'https://via.placeholder.com/600x400/4ECDC4/FFFFFF?text=Chicago+Style',
        mp4: 'https://via.placeholder.com/600x400/4ECDC4/FFFFFF?text=Chicago+Style.mp4'
      },
      downsized_medium: {
        height: '300',
        width: '450',
        size: '1147329',
        url: 'https://via.placeholder.com/450x300/4ECDC4/FFFFFF?text=Chicago+Style'
      },
      fixed_height_small: {
        height: '100',
        width: '150',
        size: '347329',
        url: 'https://via.placeholder.com/150x100/4ECDC4/FFFFFF?text=Chicago+Style'
      },
      preview_gif: {
        height: '160',
        width: '240',
        size: '647329',
        url: 'https://via.placeholder.com/240x160/4ECDC4/FFFFFF?text=Chicago+Style'
      }
    }
  },
  {
    id: 'mock_giphy_3',
    title: 'Bratwurst Grilling Perfect Loop',
    url: 'https://giphy.com/gifs/bratwurst-grilling-perfect-mock3',
    slug: 'bratwurst-grilling-perfect-loop-mock3',
    bitly_gif_url: 'https://gph.is/mock3',
    bitly_url: 'https://gph.is/mock3',
    embed_url: 'https://giphy.com/embed/mock3',
    username: 'grillmaster',
    source: '',
    source_tld: '',
    source_post_url: '',
    is_sticker: 0,
    import_datetime: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
    trending_datetime: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    rating: 'g',
    content_url: '',
    tags: ['bratwurst', 'grilling', 'bbq', 'sausage'],
    featured_tags: ['bratwurst', 'grilling'],
    images: {
      original: {
        height: '320',
        width: '480',
        size: '1247329',
        url: 'https://via.placeholder.com/480x320/45B7D1/FFFFFF?text=Bratwurst+Grill',
        mp4: 'https://via.placeholder.com/480x320/45B7D1/FFFFFF?text=Bratwurst+Grill.mp4'
      },
      downsized_medium: {
        height: '240',
        width: '360',
        size: '847329',
        url: 'https://via.placeholder.com/360x240/45B7D1/FFFFFF?text=Bratwurst+Grill'
      },
      fixed_height_small: {
        height: '100',
        width: '150',
        size: '247329',
        url: 'https://via.placeholder.com/150x100/45B7D1/FFFFFF?text=Bratwurst+Grill'
      },
      preview_gif: {
        height: '128',
        width: '192',
        size: '447329',
        url: 'https://via.placeholder.com/192x128/45B7D1/FFFFFF?text=Bratwurst+Grill'
      }
    }
  },
  {
    id: 'mock_giphy_4',
    title: 'Corn Dog Fair Food Celebration',
    url: 'https://giphy.com/gifs/corndog-fair-food-mock4',
    slug: 'corn-dog-fair-food-celebration-mock4',
    bitly_gif_url: 'https://gph.is/mock4',
    bitly_url: 'https://gph.is/mock4',
    embed_url: 'https://giphy.com/embed/mock4',
    username: 'fairfoodlover',
    source: '',
    source_tld: '',
    source_post_url: '',
    is_sticker: 0,
    import_datetime: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
    trending_datetime: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    rating: 'g',
    content_url: '',
    tags: ['corn dog', 'fair', 'food', 'celebration', 'carnival'],
    featured_tags: ['corn dog', 'fair'],
    images: {
      original: {
        height: '360',
        width: '540',
        size: '1647329',
        url: 'https://via.placeholder.com/540x360/F8B500/FFFFFF?text=Corn+Dog+Fair',
        mp4: 'https://via.placeholder.com/540x360/F8B500/FFFFFF?text=Corn+Dog+Fair.mp4'
      },
      downsized_medium: {
        height: '270',
        width: '405',
        size: '1047329',
        url: 'https://via.placeholder.com/405x270/F8B500/FFFFFF?text=Corn+Dog+Fair'
      },
      fixed_height_small: {
        height: '100',
        width: '150',
        size: '247329',
        url: 'https://via.placeholder.com/150x100/F8B500/FFFFFF?text=Corn+Dog+Fair'
      },
      preview_gif: {
        height: '144',
        width: '216',
        size: '547329',
        url: 'https://via.placeholder.com/216x144/F8B500/FFFFFF?text=Corn+Dog+Fair'
      }
    }
  },
  {
    id: 'mock_giphy_5',
    title: 'Chili Dog Loading Animation',
    url: 'https://giphy.com/gifs/chili-dog-loading-mock5',
    slug: 'chili-dog-loading-animation-mock5',
    bitly_gif_url: 'https://gph.is/mock5',
    bitly_url: 'https://gph.is/mock5',
    embed_url: 'https://giphy.com/embed/mock5',
    username: 'animatedfoods',
    source: '',
    source_tld: '',
    source_post_url: '',
    is_sticker: 0,
    import_datetime: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    trending_datetime: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
    rating: 'g',
    content_url: '',
    tags: ['chili dog', 'loading', 'animation', 'spicy'],
    featured_tags: ['chili dog', 'animation'],
    images: {
      original: {
        height: '300',
        width: '400',
        size: '1347329',
        url: 'https://via.placeholder.com/400x300/FF5500/FFFFFF?text=Chili+Dog',
        mp4: 'https://via.placeholder.com/400x300/FF5500/FFFFFF?text=Chili+Dog.mp4'
      },
      downsized_medium: {
        height: '225',
        width: '300',
        size: '847329',
        url: 'https://via.placeholder.com/300x225/FF5500/FFFFFF?text=Chili+Dog'
      },
      fixed_height_small: {
        height: '100',
        width: '133',
        size: '247329',
        url: 'https://via.placeholder.com/133x100/FF5500/FFFFFF?text=Chili+Dog'
      },
      preview_gif: {
        height: '120',
        width: '160',
        size: '447329',
        url: 'https://via.placeholder.com/160x120/FF5500/FFFFFF?text=Chili+Dog'
      }
    }
  }
]

export class GiphyScanningService {
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false

  // Rate limit management: 42 requests/hour, 1000/day
  private static readonly HOURLY_LIMIT = 42
  private static readonly DAILY_LIMIT = 1000
  
  // Search terms rotation for variety within rate limits
  private static readonly SEARCH_TERMS = [
    'hotdog',
    'hot dog', 
    'corn dog',
    'chicago style hotdog',
    'bratwurst',
    'chili dog'
  ]

  constructor() {
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Main scan method following the standard interface
   */
  async performScan(options: GiphyPerformScanOptions): Promise<GiphyPerformScanResult> {
    try {
      console.log(`🚀 Starting Giphy performScan with options:`, options)
      
      // Get scan configuration
      const config = await this.getScanConfig()
      console.log(`⚙️  Retrieved scan config:`, {
        isEnabled: config.isEnabled,
        maxGifsPerScan: config.maxGifsPerScan,
        searchTerms: config.searchTerms,
        lastSearchTermIndex: config.lastSearchTermIndex
      })

      // Check if Giphy API is available
      const apiKey = process.env.GIPHY_API_KEY
      console.log(`🔑 API Key status: ${apiKey ? 'Present' : 'Missing'}`)

      if (!apiKey) {
        console.warn('⚠️  GIPHY: API key not configured, using mock data')
        return this.performMockScan(options)
      }

      // Check rate limits
      const canMakeRequest = await this.checkRateLimit()
      console.log(`⏱️  Rate limit check result: ${canMakeRequest ? 'OK' : 'Exceeded'}`)
      if (!canMakeRequest) {
        console.warn('⚠️  GIPHY: Rate limit exceeded, using mock data')
        return this.performMockScan(options)
      }

      const maxPosts = Math.min(options.maxPosts, config?.maxGifsPerScan || 30)
      const result: GiphyPerformScanResult = {
        totalFound: 0,
        processed: 0,
        approved: 0,
        rejected: 0,
        duplicates: 0,
        errors: []
      }

      await logToDatabase(
        LogLevel.INFO,
        'GIPHY_SCAN_STARTED',
        'Starting Giphy content scan',
        { maxPosts, searchTerms: GiphyScanningService.SEARCH_TERMS }
      )

      // Smart search rotation: use only 1-2 searches per scan to conserve API calls
      const searchesToPerform = Math.min(2, Math.ceil(maxPosts / 25))
      const gifsPerSearch = Math.ceil(maxPosts / searchesToPerform)

      for (let i = 0; i < searchesToPerform; i++) {
        const termIndex = (config.lastSearchTermIndex + i) % GiphyScanningService.SEARCH_TERMS.length
        const searchTerm = GiphyScanningService.SEARCH_TERMS[termIndex]

        try {
          const gifs = await this.searchGifs(searchTerm, gifsPerSearch)
          console.log(`🔍 Found ${gifs.length} GIFs for term "${searchTerm}"`)
          
          result.totalFound += gifs.length

          // Process each GIF
          for (const gif of gifs) {
            try {
              // Check for duplicates
              const duplicateResult = await this.duplicateDetection.checkForDuplicates({
                platform: 'giphy',
                url: gif.url,
                title: gif.title,
                content_hash: await this.contentProcessor.generateContentHash(gif.url)
              })

              if (duplicateResult.isDuplicate) {
                result.duplicates++
                continue
              }

              // Apply content filtering
              const contentAnalysis = await this.filteringService.isValidHotdogContent({
                text: gif.title,
                url: gif.url,
                metadata: {
                  tags: gif.tags,
                  rating: gif.rating,
                  username: gif.username,
                  trending_datetime: gif.trending_datetime
                }
              })

              if (!contentAnalysis.is_valid_hotdog) {
                result.rejected++
                continue
              }

              // Save to content queue
              console.log(`💾 Attempting to save GIF to queue: ${gif.title} (ID: ${gif.id})`)
              const contentId = await this.saveGifToQueue(gif)
              
              if (contentId) {
                console.log(`✅ Successfully saved GIF with content ID: ${contentId}`)
                
                // Process with content processor using the correct method signature
                console.log(`🔄 Processing content ID ${contentId} through content processor`)
                const processingResult = await this.contentProcessor.processContent(contentId, {
                  autoApprovalThreshold: 0.30, // Very generous for GIFs - they often have simple titles  
                  autoRejectionThreshold: 0.10,
                  enableDuplicateDetection: true
                })

                console.log(`📊 Processing result for content ID ${contentId}:`, {
                  success: processingResult.success,
                  action: processingResult.action,
                  contentId: contentId,
                  confidence: processingResult.confidence,
                  errors: processingResult.errors
                })

                if (processingResult.success && processingResult.action === 'approved') {
                  result.approved++
                } else if (processingResult.action === 'duplicate') {
                  result.duplicates++
                } else {
                  result.rejected++
                }
                result.processed++

                console.log(`✅ Processed Giphy GIF: ${processingResult.action} (success: ${processingResult.success})`)
              } else {
                console.error(`❌ Failed to save GIF to queue: ${gif.title} (ID: ${gif.id})`)
                result.errors.push(`Failed to save GIF to database: ${gif.title}`)
              }
            } catch (postError) {
              result.errors.push(`GIF processing error: ${postError instanceof Error ? postError.message : 'Unknown error'}`)
            }
          }

          // Update search term index for rotation
          await this.updateSearchTermIndex((config.lastSearchTermIndex + 1) % GiphyScanningService.SEARCH_TERMS.length)

          // Small delay between searches to be respectful
          if (i < searchesToPerform - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }

        } catch (searchError) {
          result.errors.push(`Search error for "${searchTerm}": ${searchError instanceof Error ? searchError.message : 'Unknown error'}`)
        }
      }

      // Update rate limit tracking
      await this.updateRateLimit(searchesToPerform)

      await logToDatabase(
        LogLevel.INFO,
        'GIPHY_SCAN_COMPLETED',
        'Giphy content scan completed',
        { 
          totalFound: result.totalFound,
          processed: result.processed,
          approved: result.approved,
          rejected: result.rejected,
          duplicates: result.duplicates,
          errors: result.errors,
          successRate: result.processed > 0 ? (result.approved / result.processed) : 0
        }
      )

      console.log(`📊 GIPHY SCAN SUMMARY:`, {
        totalFound: result.totalFound,
        processed: result.processed,
        approved: result.approved,
        rejected: result.rejected,
        duplicates: result.duplicates,
        errors: result.errors,
        successRate: result.processed > 0 ? (result.approved / result.processed) : 0,
        path: 'Real API'
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await logToDatabase(
        LogLevel.ERROR,
        'GIPHY_SCAN_ERROR',
        `Giphy scan failed: ${errorMessage}`,
        { error: errorMessage }
      )
      
      // Fallback to mock data on error
      console.warn('⚠️  GIPHY: Scan failed, falling back to mock data')
      return this.performMockScan(options)
    }
  }

  /**
   * Search Giphy API for GIFs
   */
  private async searchGifs(query: string, limit: number = 25): Promise<GiphyGif[]> {
    const apiKey = process.env.GIPHY_API_KEY
    if (!apiKey) {
      throw new Error('Giphy API key not configured')
    }

    const url = 'https://api.giphy.com/v1/gifs/search'
    const params = new URLSearchParams({
      api_key: apiKey,
      q: query,
      limit: limit.toString(),
      offset: '0'
    })

    console.log(`🔍 Searching Giphy for: "${query}" (limit: ${limit})`)

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HotdogDiaries/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Giphy API error: ${response.status} ${response.statusText}`)
    }

    const data: GiphySearchResponse = await response.json()
    
    // Filter GIFs to ensure they have required formats
    const validGifs = data.data.filter(gif => 
      gif.images.downsized_medium?.url && 
      gif.images.original?.url &&
      gif.title &&
      !gif.is_sticker // Exclude stickers
    )

    console.log(`📝 Found ${validGifs.length} valid GIFs out of ${data.data.length} total`)
    return validGifs
  }

  /**
   * Save GIF to content queue using Supabase
   */
  private async saveGifToQueue(gif: GiphyGif): Promise<number | null> {
    try {
      console.log(`🔍 Starting saveGifToQueue for GIF: ${gif.title} (ID: ${gif.id})`)
      
      // Generate content hash for duplicate detection
      const hashInput = `${gif.url}|${gif.title}|${gif.images.downsized_medium.url}`
      const contentHash = require('crypto').createHash('sha256').update(hashInput).digest('hex')
      console.log(`🔑 Generated content hash: ${contentHash}`)

      // Use Supabase client
      const supabase = createSimpleClient()
      
      // Prepare data for insertion
      const insertData = {
        content_text: gif.title,
        content_image_url: gif.images.downsized_medium.url,
        content_video_url: gif.images.original.mp4 || null,
        content_type: 'image', // Use 'image' instead of 'gif' to match expected format
        source_platform: 'giphy',
        original_url: gif.url,
        original_author: gif.username || 'Anonymous',
        content_hash: contentHash,
        content_status: 'discovered',
        confidence_score: this.calculateConfidenceScore(gif),
        is_approved: true, // Auto-approve Giphy content as requested
        is_rejected: false,
        is_posted: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log(`📝 Inserting GIF to Supabase:`, {
        title: insertData.content_text,
        image_url: insertData.content_image_url,
        video_url: insertData.content_video_url,
        type: insertData.content_type,
        platform: insertData.source_platform,
        author: insertData.original_author,
        hash: insertData.content_hash,
        approved: insertData.is_approved
      })

      const { data, error } = await supabase
        .from('content_queue')
        .insert(insertData)
        .select('id')
        .single()

      if (error) {
        console.error(`❌ Supabase insertion error:`, error)
        throw new Error(`Supabase error: ${error.message}`)
      }

      const contentId = data?.id
      if (contentId) {
        console.log(`✅ Successfully inserted GIF with ID: ${contentId}`)
        
        await logToDatabase(
          LogLevel.INFO,
          'GIPHY_CONTENT_SAVED',
          'Saved Giphy GIF to content queue',
          {
            contentId,
            giphyId: gif.id,
            title: gif.title,
            username: gif.username,
            rating: gif.rating,
            tags: gif.tags,
            contentHash: contentHash
          }
        )
      }

      return contentId

    } catch (error) {
      console.error(`❌ Error saving Giphy GIF to queue - GIF ID: ${gif.id}, Title: ${gif.title}`)
      
      // Extract comprehensive error details
      const errorDetails: any = {
        message: 'Unknown error',
        name: 'UnknownError',
        stack: undefined,
        code: undefined,
        constraint: undefined,
        detail: undefined,
        hint: undefined,
        position: undefined,
        internalPosition: undefined,
        internalQuery: undefined,
        where: undefined,
        schema: undefined,
        table: undefined,
        column: undefined,
        dataType: undefined,
        severity: undefined
      }

      if (error instanceof Error) {
        errorDetails.message = error.message
        errorDetails.name = error.name
        errorDetails.stack = error.stack
        
        // Extract PostgreSQL/SQLite specific error properties
        const pgError = error as any
        if (pgError.code) errorDetails.code = pgError.code
        if (pgError.constraint) errorDetails.constraint = pgError.constraint
        if (pgError.detail) errorDetails.detail = pgError.detail
        if (pgError.hint) errorDetails.hint = pgError.hint
        if (pgError.position) errorDetails.position = pgError.position
        if (pgError.internalPosition) errorDetails.internalPosition = pgError.internalPosition
        if (pgError.internalQuery) errorDetails.internalQuery = pgError.internalQuery
        if (pgError.where) errorDetails.where = pgError.where
        if (pgError.schema) errorDetails.schema = pgError.schema
        if (pgError.table) errorDetails.table = pgError.table
        if (pgError.column) errorDetails.column = pgError.column
        if (pgError.dataType) errorDetails.dataType = pgError.dataType
        if (pgError.severity) errorDetails.severity = pgError.severity
      } else if (typeof error === 'object' && error !== null) {
        // Handle non-Error objects
        Object.keys(error).forEach(key => {
          errorDetails[key] = (error as any)[key]
        })
        errorDetails.message = String(error)
      } else {
        errorDetails.message = String(error)
      }

      console.error(`❌ Detailed SQLite/PostgreSQL Error Information:`, errorDetails)
      console.error(`❌ Raw error object:`, error)
      console.error(`❌ Error typeof:`, typeof error)
      console.error(`❌ Error constructor:`, error?.constructor?.name)
      
      await logToDatabase(
        LogLevel.ERROR,
        'GIPHY_SAVE_ERROR',
        `Failed to save Giphy GIF: ${errorDetails.message}`,
        { 
          giphyId: gif.id,
          title: gif.title,
          errorDetails: errorDetails,
          rawError: String(error),
          errorType: typeof error,
          errorConstructor: error?.constructor?.name
        }
      )
      return null
    }
  }

  /**
   * Calculate confidence score based on Giphy-specific metrics
   */
  private calculateConfidenceScore(gif: GiphyGif): number {
    let confidence = 0.6 // Higher base score for GIFs (was 0.5)

    // Trending recency (newer trending = higher score)
    if (gif.trending_datetime) {
      const trendingAge = Date.now() - new Date(gif.trending_datetime).getTime()
      const hoursAgo = trendingAge / (1000 * 60 * 60)
      if (hoursAgo < 24) confidence += 0.2
      else if (hoursAgo < 72) confidence += 0.1
    }

    // Title relevance to hotdogs (more generous scoring)
    const title = gif.title.toLowerCase()
    const hotdogKeywords = ['hot dog', 'hotdog', 'bratwurst', 'sausage', 'corn dog', 'chili dog', 'chicago', 'frankfurter', 'dog', 'food', 'eating', 'grill', 'bbq']
    const relevantKeywords = hotdogKeywords.filter(keyword => title.includes(keyword))
    confidence += Math.min(relevantKeywords.length * 0.15, 0.4) // Increased from 0.1 to 0.15, max from 0.3 to 0.4

    // Tag relevance (more generous scoring)
    const relevantTags = gif.tags.filter(tag => 
      hotdogKeywords.some(keyword => tag.toLowerCase().includes(keyword))
    )
    confidence += Math.min(relevantTags.length * 0.1, 0.25) // Increased from 0.05 to 0.1, max from 0.15 to 0.25

    // Has both GIF and MP4 versions
    if (gif.images.original.mp4 && gif.images.downsized_medium.url) {
      confidence += 0.1
    }

    // Quality indicators (more generous)
    if (gif.username && gif.username !== '') confidence += 0.1 // Increased from 0.05
    if (gif.rating === 'g') confidence += 0.1 // Increased from 0.05, family-friendly content
    
    // Boost for any food-related terms
    const foodTerms = ['food', 'eat', 'lunch', 'dinner', 'snack', 'cooking', 'grill', 'bbq', 'meat']
    const hasFoodTerm = foodTerms.some(term => 
      title.includes(term) || gif.tags.some(tag => tag.toLowerCase().includes(term))
    )
    if (hasFoodTerm) confidence += 0.1

    return Math.min(Math.max(confidence, 0.3), 1) // Minimum 0.3, max 1.0
  }

  /**
   * Perform scan using mock data
   */
  private async performMockScan(options: GiphyPerformScanOptions): Promise<GiphyPerformScanResult> {
    console.log(`🎭 Starting performMockScan with options:`, options)
    const maxPosts = Math.min(options.maxPosts, MOCK_GIPHY_GIFS.length)
    const selectedGifs = MOCK_GIPHY_GIFS.slice(0, maxPosts)
    console.log(`🎭 Processing ${selectedGifs.length} mock GIFs (max: ${maxPosts}, available: ${MOCK_GIPHY_GIFS.length})`)
    
    const result: GiphyPerformScanResult = {
      totalFound: selectedGifs.length,
      processed: 0,
      approved: 0,
      rejected: 0,
      duplicates: 0,
      errors: []
    }

    // Process each mock GIF
    for (const gif of selectedGifs) {
      try {
        // Check for duplicates
        const duplicateResult = await this.duplicateDetection.checkForDuplicates({
          platform: 'giphy',
          url: gif.url,
          title: gif.title,
          content_hash: await this.contentProcessor.generateContentHash(gif.url)
        })

        if (duplicateResult.isDuplicate) {
          result.duplicates++
          continue
        }

        // Apply content filtering
        const contentAnalysis = await this.filteringService.isValidHotdogContent({
          text: gif.title,
          url: gif.url,
          metadata: {
            tags: gif.tags,
            rating: gif.rating,
            username: gif.username
          }
        })

        if (!contentAnalysis.is_valid_hotdog) {
          result.rejected++
          continue
        }

        // Save to content queue first
        console.log(`💾 [MOCK] Attempting to save mock GIF to queue: ${gif.title} (ID: ${gif.id})`)
        const contentId = await this.saveGifToQueue(gif)
        if (contentId) {
          console.log(`✅ [MOCK] Successfully saved mock GIF with content ID: ${contentId}`)
          
          // Process with content processor to create analysis
          console.log(`🔄 [MOCK] Processing mock content ID ${contentId} through content processor`)
          const processingResult = await this.contentProcessor.processContent(contentId, {
            autoApprovalThreshold: 0.40, // Much lower for GIFs - they often have simple titles
            autoRejectionThreshold: 0.15,
            enableDuplicateDetection: true
          })

          console.log(`📊 [MOCK] Processing result for content ID ${contentId}:`, {
            success: processingResult.success,
            action: processingResult.action,
            contentId: contentId,
            confidence: processingResult.confidence,
            errors: processingResult.errors
          })

          if (processingResult.action === 'approved') {
            result.approved++
          } else {
            result.rejected++
          }
        } else {
          console.error(`❌ [MOCK] Failed to save mock GIF to queue: ${gif.title} (ID: ${gif.id})`)
          result.rejected++
        }
        result.processed++

      } catch (postError) {
        result.errors.push(`Mock GIF processing error: ${postError instanceof Error ? postError.message : 'Unknown error'}`)
      }
    }

    await logToDatabase(
      LogLevel.INFO,
      'GIPHY_MOCK_SCAN_COMPLETED',
      `Giphy mock scan completed: ${result.approved} approved, ${result.rejected} rejected, ${result.duplicates} duplicates`,
      result
    )

    console.log(`📊 GIPHY MOCK SCAN SUMMARY:`, {
      totalFound: result.totalFound,
      processed: result.processed,
      approved: result.approved,
      rejected: result.rejected,
      duplicates: result.duplicates,
      errors: result.errors,
      successRate: result.processed > 0 ? (result.approved / result.processed) : 0,
      path: 'Mock Data'
    })

    return result
  }

  /**
   * Check rate limits before making API requests
   */
  private async checkRateLimit(): Promise<boolean> {
    try {
      const config = await this.getScanConfig()
      const now = new Date()
      const hoursSinceReset = (now.getTime() - config.lastRequestReset.getTime()) / (1000 * 60 * 60)

      // Reset counters if it's been more than an hour
      if (hoursSinceReset >= 1) {
        await this.resetRateLimit()
        return true
      }

      // Check if we're within limits
      return config.hourlyRequestCount < GiphyScanningService.HOURLY_LIMIT && 
             config.dailyRequestCount < GiphyScanningService.DAILY_LIMIT
    } catch (error) {
      console.error('Error checking rate limit:', error)
      return false
    }
  }

  /**
   * Update rate limit counters (simplified - just log for now)
   */
  private async updateRateLimit(requestCount: number): Promise<void> {
    console.log(`📊 Giphy API requests made: ${requestCount}`)
    // Simplified for now - just track in logs
  }

  /**
   * Reset rate limit counters
   */
  private async resetRateLimit(): Promise<void> {
    try {
      await db.query(
        `INSERT INTO giphy_scan_config (
          hourly_request_count, daily_request_count, last_request_reset, updated_at
        ) VALUES (0, 0, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          hourly_request_count = 0,
          last_request_reset = NOW(),
          updated_at = NOW()`
      )
    } catch (error) {
      console.error('Error resetting rate limit:', error)
    }
  }

  /**
   * Update search term index for rotation
   */
  private async updateSearchTermIndex(newIndex: number): Promise<void> {
    try {
      await db.query(
        `INSERT INTO giphy_scan_config (
          last_search_term_index, updated_at
        ) VALUES ($1, NOW())
        ON CONFLICT (id) DO UPDATE SET
          last_search_term_index = $1,
          updated_at = NOW()`,
        [newIndex]
      )
    } catch (error) {
      console.error('Error updating search term index:', error)
    }
  }

  /**
   * Get scan configuration
   */
  async getScanConfig(): Promise<GiphyScanConfig> {
    try {
      const result = await db.query(`
        SELECT 
          is_enabled,
          scan_interval,
          max_gifs_per_scan,
          search_terms,
          last_scan_time,
          last_search_term_index,
          daily_request_count,
          hourly_request_count,
          last_request_reset
        FROM giphy_scan_config 
        ORDER BY updated_at DESC 
        LIMIT 1
      `)

      if (result.rows.length === 0) {
        // Return default config
        return {
          isEnabled: true,
          scanInterval: 4 * 60, // 4 hours
          maxGifsPerScan: 30,
          searchTerms: GiphyScanningService.SEARCH_TERMS,
          lastSearchTermIndex: 0,
          dailyRequestCount: 0,
          hourlyRequestCount: 0,
          lastRequestReset: new Date()
        }
      }

      const row = result.rows[0]
      return {
        isEnabled: row.is_enabled,
        scanInterval: row.scan_interval,
        maxGifsPerScan: row.max_gifs_per_scan,
        searchTerms: row.search_terms || GiphyScanningService.SEARCH_TERMS,
        lastScanTime: row.last_scan_time,
        lastSearchTermIndex: row.last_search_term_index || 0,
        dailyRequestCount: row.daily_request_count || 0,
        hourlyRequestCount: row.hourly_request_count || 0,
        lastRequestReset: row.last_request_reset || new Date()
      }
    } catch (error) {
      console.error('Failed to load Giphy config from database:', error)
      // Fallback to default config
      return {
        isEnabled: !!process.env.GIPHY_API_KEY,
        scanInterval: 4 * 60,
        maxGifsPerScan: 30,
        searchTerms: GiphyScanningService.SEARCH_TERMS,
        lastSearchTermIndex: 0,
        dailyRequestCount: 0,
        hourlyRequestCount: 0,
        lastRequestReset: new Date()
      }
    }
  }

  /**
   * Get scanning statistics
   */
  async getScanningStats(): Promise<{
    totalGifsFound: number
    gifsProcessed: number
    gifsApproved: number
    gifsRejected: number
    lastScanTime?: Date
    nextScanTime?: Date
    successRate: number
  }> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_gifs,
          COUNT(*) FILTER (WHERE content_status = 'posted') as approved_gifs,
          COUNT(*) FILTER (WHERE content_status = 'rejected') as rejected_gifs,
          MAX(scraped_at) as last_scan_time
        FROM content_queue 
        WHERE source_platform = 'giphy'
        AND scraped_at >= NOW() - INTERVAL '24 hours'
      `)

      const stats = result.rows[0]
      const totalGifs = parseInt(stats.total_gifs) || 0
      const approvedGifs = parseInt(stats.approved_gifs) || 0
      const rejectedGifs = parseInt(stats.rejected_gifs) || 0
      
      return {
        totalGifsFound: totalGifs,
        gifsProcessed: totalGifs,
        gifsApproved: approvedGifs,
        gifsRejected: rejectedGifs,
        lastScanTime: stats.last_scan_time || undefined,
        nextScanTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        successRate: totalGifs > 0 ? approvedGifs / totalGifs : 0
      }
    } catch (error) {
      console.error('Error getting Giphy scanning stats:', error)
      return {
        totalGifsFound: 0,
        gifsProcessed: 0,
        gifsApproved: 0,
        gifsRejected: 0,
        successRate: 0
      }
    }
  }

  /**
   * Test connection to Giphy API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const apiKey = process.env.GIPHY_API_KEY
      if (!apiKey) {
        return {
          success: false,
          message: 'Giphy API key not configured'
        }
      }

      console.log('🔗 Testing Giphy API connection...')
      
      // Test with a simple search
      const testGifs = await this.searchGifs('test', 1)
      
      return {
        success: true,
        message: `Successfully connected to Giphy API`,
        details: {
          testGifsFound: testGifs.length,
          rateLimitStatus: await this.checkRateLimit() ? 'OK' : 'Limited'
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Giphy connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  /**
   * Start automated scanning
   */
  async startAutomatedScanning(): Promise<void> {
    try {
      await logToDatabase(
        LogLevel.INFO,
        'GIPHY_AUTO_SCAN_STARTED',
        'Starting automated Giphy scanning'
      )

      // Perform a scan
      await this.performScan({ maxPosts: 30 })
      
      console.log('✅ Giphy automated scanning started successfully')
    } catch (error) {
      console.error('Error starting Giphy automated scanning:', error)
      await logToDatabase(
        LogLevel.ERROR,
        'GIPHY_AUTO_SCAN_ERROR',
        `Failed to start automated Giphy scanning: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }
}

export const giphyScanningService = new GiphyScanningService()