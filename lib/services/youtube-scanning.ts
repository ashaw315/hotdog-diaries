import { YouTubeService, ProcessedYouTubeVideo, YouTubeSearchOptions } from './youtube'
import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface YouTubeScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxVideosPerScan: number
  searchTerms: string[]
  videoDuration: 'any' | 'short' | 'medium' | 'long'
  publishedWithin: number // days
  minViewCount: number
  includeChannelIds?: string[]
  excludeChannelIds?: string[]
  lastScanId?: string
  lastScanTime?: Date
}

export interface YouTubePerformScanOptions {
  maxPosts: number
}

export interface YouTubePerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

// Mock data for when API key is not available
const MOCK_YOUTUBE_VIDEOS: ProcessedYouTubeVideo[] = [
  {
    id: 'mock_youtube_1',
    title: 'The Ultimate Chicago Hot Dog Taste Test',
    description: 'We visit 5 famous Chicago hot dog stands to find the ultimate Chicago-style dog! From Vienna Beef to local favorites, see which one comes out on top.',
    url: 'https://via.placeholder.com/1280x720/FF0000/FFFFFF?text=YouTube+Chicago+Hotdog',
    thumbnailUrl: 'https://via.placeholder.com/480x360/FF0000/FFFFFF?text=Chicago+Test',
    videoUrl: 'https://via.placeholder.com/1280x720/FF0000/FFFFFF?text=YouTube+Chicago+Hotdog',
    channelTitle: 'Food Quest Chicago',
    channelId: 'UCmockchicago123',
    channelUrl: 'https://youtube.com/c/foodquestchicago',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    viewCount: 125487,
    likeCount: 8942,
    commentCount: 567,
    duration: 'PT8M42S', // 8:42
    tags: ['chicago hot dog', 'food review', 'vienna beef', 'taste test', 'chicago food'],
    definition: 'hd',
    caption: true,
    categoryId: '26' // Howto & Style
  },
  {
    id: 'mock_youtube_2',
    title: 'Grilling Perfect Bratwurst - BBQ Technique',
    description: 'Learn the secrets to grilling perfect bratwurst every time! Temperature control, timing, and the best toppings for your summer BBQ.',
    url: 'https://via.placeholder.com/1280x720/00AA00/FFFFFF?text=BBQ+Bratwurst+Guide',
    thumbnailUrl: 'https://via.placeholder.com/480x360/00AA00/FFFFFF?text=BBQ+Guide',
    videoUrl: 'https://via.placeholder.com/1280x720/00AA00/FFFFFF?text=BBQ+Bratwurst+Guide',
    channelTitle: 'Grill Master Academy',
    channelId: 'UCmockgrill456',
    channelUrl: 'https://youtube.com/c/grillmasteracademy',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 18), // 18 hours ago
    viewCount: 89234,
    likeCount: 7156,
    commentCount: 423,
    duration: 'PT12M15S', // 12:15
    tags: ['bratwurst', 'grilling', 'bbq', 'cooking tutorial', 'summer grilling'],
    definition: 'hd',
    caption: true,
    categoryId: '26' // Howto & Style
  },
  {
    id: 'mock_youtube_3',
    title: 'Stadium Hot Dog Vendors - Behind the Scenes',
    description: 'Ever wonder how baseball stadium hot dog vendors prepare for game day? Go behind the scenes at Yankee Stadium to see the operation!',
    url: 'https://via.placeholder.com/1280x720/0088FF/FFFFFF?text=Stadium+Vendors',
    thumbnailUrl: 'https://via.placeholder.com/480x360/0088FF/FFFFFF?text=Stadium',
    videoUrl: 'https://via.placeholder.com/1280x720/0088FF/FFFFFF?text=Stadium+Vendors',
    channelTitle: 'Baseball Insider',
    channelId: 'UCmockbaseball789',
    channelUrl: 'https://youtube.com/c/baseballinsider',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 36), // 1.5 days ago
    viewCount: 234567,
    likeCount: 15234,
    commentCount: 1289,
    duration: 'PT15M33S', // 15:33
    tags: ['baseball', 'stadium food', 'hot dogs', 'yankee stadium', 'behind the scenes'],
    definition: 'hd',
    caption: true,
    categoryId: '17' // Sports
  },
  {
    id: 'mock_youtube_4',
    title: 'German Currywurst Recipe - Street Food at Home',
    description: 'Recreate authentic Berlin currywurst at home! Traditional recipe with homemade curry ketchup sauce and the perfect bratwurst.',
    url: 'https://via.placeholder.com/1280x720/FFAA00/FFFFFF?text=Currywurst+Recipe',
    thumbnailUrl: 'https://via.placeholder.com/480x360/FFAA00/FFFFFF?text=Currywurst',
    videoUrl: 'https://via.placeholder.com/1280x720/FFAA00/FFFFFF?text=Currywurst+Recipe',
    channelTitle: 'European Street Food',
    channelId: 'UCmockeuropean012',
    channelUrl: 'https://youtube.com/c/europeanstreetfood',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    viewCount: 67890,
    likeCount: 5432,
    commentCount: 298,
    duration: 'PT9M27S', // 9:27
    tags: ['currywurst', 'german food', 'street food', 'recipe', 'berlin'],
    definition: 'hd',
    caption: true,
    categoryId: '26' // Howto & Style
  },
  {
    id: 'mock_youtube_5',
    title: 'NYC Hot Dog Cart Tour - Best Street Dogs',
    description: 'Touring the best hot dog carts in New York City! From classic dirty water dogs to gourmet toppings, we try them all.',
    url: 'https://via.placeholder.com/1280x720/AA00AA/FFFFFF?text=NYC+Cart+Tour',
    thumbnailUrl: 'https://via.placeholder.com/480x360/AA00AA/FFFFFF?text=NYC+Tour',
    videoUrl: 'https://via.placeholder.com/1280x720/AA00AA/FFFFFF?text=NYC+Cart+Tour',
    channelTitle: 'Street Eats NYC',
    channelId: 'UCmocknyc345',
    channelUrl: 'https://youtube.com/c/streeteatenyc',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    viewCount: 156789,
    likeCount: 11234,
    commentCount: 789,
    duration: 'PT18M44S', // 18:44
    tags: ['nyc hot dogs', 'street food', 'food tour', 'new york', 'street cart'],
    definition: 'hd',
    caption: true,
    categoryId: '26' // Howto & Style
  },
  {
    id: 'mock_youtube_6',
    title: 'Hot Dog Eating Contest Training',
    description: 'Professional competitive eater shows training techniques for hot dog eating contests. Preparation for Nathan\'s Famous contest.',
    url: 'https://via.placeholder.com/1280x720/00AAAA/FFFFFF?text=Eating+Training',
    thumbnailUrl: 'https://via.placeholder.com/480x360/00AAAA/FFFFFF?text=Training',
    videoUrl: 'https://via.placeholder.com/1280x720/00AAAA/FFFFFF?text=Eating+Training',
    channelTitle: 'Competitive Eating Pro',
    channelId: 'UCmockeating678',
    channelUrl: 'https://youtube.com/c/competitiveeatingpro',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 96), // 4 days ago
    viewCount: 445677,
    likeCount: 28934,
    commentCount: 2145,
    duration: 'PT11M18S', // 11:18
    tags: ['competitive eating', 'hot dog contest', 'nathans famous', 'training', 'sports'],
    definition: 'hd',
    caption: true,
    categoryId: '17' // Sports
  },
  {
    id: 'mock_youtube_7',
    title: 'Homemade Hot Dog Sausages from Scratch',
    description: 'Making hot dog sausages completely from scratch! Grinding meat, seasoning, stuffing casings, and the final cooking process.',
    url: 'https://via.placeholder.com/1280x720/AA5500/FFFFFF?text=Homemade+Sausage',
    thumbnailUrl: 'https://via.placeholder.com/480x360/AA5500/FFFFFF?text=Homemade',
    videoUrl: 'https://via.placeholder.com/1280x720/AA5500/FFFFFF?text=Homemade+Sausage',
    channelTitle: 'Artisan Butcher',
    channelId: 'UCmockbutcher901',
    channelUrl: 'https://youtube.com/c/artisanbutcher',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 120), // 5 days ago
    viewCount: 78934,
    likeCount: 6785,
    commentCount: 445,
    duration: 'PT22M56S', // 22:56
    tags: ['homemade sausage', 'butchery', 'from scratch', 'meat processing', 'cooking'],
    definition: 'hd',
    caption: true,
    categoryId: '26' // Howto & Style
  },
  {
    id: 'mock_youtube_8',
    title: 'Korean Corn Dog Street Food Review',
    description: 'Trying Korean-style corn dogs with mozzarella cheese, rice puffs, and unique coatings! Are they better than American corn dogs?',
    url: 'https://via.placeholder.com/1280x720/FF5500/FFFFFF?text=Korean+Corn+Dog',
    thumbnailUrl: 'https://via.placeholder.com/480x360/FF5500/FFFFFF?text=Korean',
    videoUrl: 'https://via.placeholder.com/1280x720/FF5500/FFFFFF?text=Korean+Corn+Dog',
    channelTitle: 'Asian Street Food Explorer',
    channelId: 'UCmockasian234',
    channelUrl: 'https://youtube.com/c/asianstreetfoodexplorer',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 144), // 6 days ago
    viewCount: 289456,
    likeCount: 19876,
    commentCount: 1567,
    duration: 'PT7M33S', // 7:33
    tags: ['korean corn dog', 'street food', 'cheese', 'food review', 'asian food'],
    definition: 'hd',
    caption: true,
    categoryId: '26' // Howto & Style
  },
  {
    id: 'mock_youtube_9',
    title: 'Chili Cheese Dog Challenge - 5 Pound Monster',
    description: 'Attempting to eat a 5-pound chili cheese dog in under 30 minutes! This massive creation has 2 pounds of chili and a full pound of cheese.',
    url: 'https://via.placeholder.com/1280x720/AA0055/FFFFFF?text=Chili+Challenge',
    thumbnailUrl: 'https://via.placeholder.com/480x360/AA0055/FFFFFF?text=Challenge',
    videoUrl: 'https://via.placeholder.com/1280x720/AA0055/FFFFFF?text=Chili+Challenge',
    channelTitle: 'Food Challenge King',
    channelId: 'UCmockchallenge567',
    channelUrl: 'https://youtube.com/c/foodchallengeking',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 168), // 1 week ago
    viewCount: 678923,
    likeCount: 45672,
    commentCount: 3456,
    duration: 'PT24M17S', // 24:17
    tags: ['food challenge', 'chili cheese dog', 'eating challenge', 'massive food', 'competitive eating'],
    definition: 'hd',
    caption: true,
    categoryId: '24' // Entertainment
  },
  {
    id: 'mock_youtube_10',
    title: 'Gourmet Hot Dog Recipes - 5 Upscale Variations',
    description: 'Elevating the humble hot dog with gourmet ingredients! Truffle aioli, craft beer braised onions, and artisan sausages.',
    url: 'https://via.placeholder.com/1280x720/5500AA/FFFFFF?text=Gourmet+Recipes',
    thumbnailUrl: 'https://via.placeholder.com/480x360/5500AA/FFFFFF?text=Gourmet',
    videoUrl: 'https://via.placeholder.com/1280x720/5500AA/FFFFFF?text=Gourmet+Recipes',
    channelTitle: 'Chef\'s Table Home',
    channelId: 'UCmockchef890',
    channelUrl: 'https://youtube.com/c/chefstablehome',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 192), // 8 days ago
    viewCount: 123456,
    likeCount: 9876,
    commentCount: 654,
    duration: 'PT16M25S', // 16:25
    tags: ['gourmet hot dogs', 'upscale recipes', 'artisan', 'chef', 'fine dining'],
    definition: 'hd',
    caption: true,
    categoryId: '26' // Howto & Style
  },
  {
    id: 'mock_youtube_11',
    title: 'Polish Kielbasa Festival - Traditional Cooking',
    description: 'Visiting a traditional Polish kielbasa festival where families share recipes passed down for generations. Authentic preparation methods.',
    url: 'https://via.placeholder.com/1280x720/0055AA/FFFFFF?text=Polish+Festival',
    thumbnailUrl: 'https://via.placeholder.com/480x360/0055AA/FFFFFF?text=Polish',
    videoUrl: 'https://via.placeholder.com/1280x720/0055AA/FFFFFF?text=Polish+Festival',
    channelTitle: 'Cultural Food Journey',
    channelId: 'UCmockculture123',
    channelUrl: 'https://youtube.com/c/culturalfoodjourney',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 216), // 9 days ago
    viewCount: 89123,
    likeCount: 7234,
    commentCount: 478,
    duration: 'PT13M42S', // 13:42
    tags: ['polish kielbasa', 'traditional cooking', 'cultural food', 'festival', 'heritage'],
    definition: 'hd',
    caption: true,
    categoryId: '19' // Travel & Events
  },
  {
    id: 'mock_youtube_12',
    title: 'Hot Dog Science - Food Lab Experiment',
    description: 'The science behind the perfect hot dog! Testing different cooking methods, temperatures, and casings to find the optimal preparation.',
    url: 'https://via.placeholder.com/1280x720/AA5555/FFFFFF?text=Food+Science',
    thumbnailUrl: 'https://via.placeholder.com/480x360/AA5555/FFFFFF?text=Science',
    videoUrl: 'https://via.placeholder.com/1280x720/AA5555/FFFFFF?text=Food+Science',
    channelTitle: 'Food Science Lab',
    channelId: 'UCmockscience456',
    channelUrl: 'https://youtube.com/c/foodsciencelab',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 240), // 10 days ago
    viewCount: 156789,
    likeCount: 12345,
    commentCount: 867,
    duration: 'PT19M58S', // 19:58
    tags: ['food science', 'cooking experiment', 'hot dog', 'science', 'education'],
    definition: 'hd',
    caption: true,
    categoryId: '27' // Education
  }
]

export class YouTubeScanningService {
  private youtubeService: YouTubeService
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false
  private requestCount = 0
  private lastReset = Date.now()
  private readonly DAILY_QUOTA_LIMIT = 10000 // YouTube API daily quota

  constructor() {
    this.youtubeService = new YouTubeService()
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Perform a scan with options (interface for content-scanning service)
   */
  async performScan(options: YouTubePerformScanOptions): Promise<YouTubePerformScanResult> {
    console.log('🎬 YOUTUBE: performScan called with options:', options)
    try {
      const config = await this.getScanConfig()
      console.log('🎬 YOUTUBE: Config loaded:', config)
      
      // Skip config enabled check for mock mode - always allow mock data
      // if (!config || !config.isEnabled) {
      //   await logToDatabase(
      //     LogLevel.INFO,
      //     'YOUTUBE_SCAN_DISABLED',
      //     'YouTube scanning is disabled in configuration'
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

      // Check rate limits
      const rateLimitOk = this.checkRateLimit()
      console.log('🔍 YOUTUBE RATE LIMIT:', {
        rateLimitOk,
        requestCount: this.requestCount,
        limit: this.DAILY_QUOTA_LIMIT,
        lastReset: this.lastReset
      })
      
      if (!rateLimitOk) {
        console.warn('⚠️  YOUTUBE: Rate limit exceeded, using mock data')
        const mockResult = await this.performMockScan(options)
        mockResult.errors.push('DEBUG: Used mock due to rate limit')
        return mockResult
      }

      // Check if YouTube API is available
      const apiStatus = await this.youtubeService.getApiStatus()
      const useRealAPI = apiStatus.isAuthenticated && process.env.YOUTUBE_API_KEY

      console.log('🔍 YOUTUBE DEBUG:', {
        isAuthenticated: apiStatus.isAuthenticated,
        hasEnvKey: !!process.env.YOUTUBE_API_KEY,
        useRealAPI
      })

      if (!useRealAPI) {
        console.warn('⚠️  YOUTUBE: API key not configured, using mock data')
        const mockResult = await this.performMockScan(options)
        mockResult.errors.push('DEBUG: Used mock due to no API key or auth failure')
        return mockResult
      }

      // Use real YouTube API
      const realResult = await this.performRealScan(options, config)
      realResult.errors.push('DEBUG: Used real YouTube API')
      return realResult

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_SCAN_ERROR',
        `YouTube scan failed: ${errorMessage}`,
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
   * Check rate limit for YouTube API
   */
  private checkRateLimit(): boolean {
    const now = Date.now()
    const dayInMs = 24 * 60 * 60 * 1000
    
    // Reset counter if it's been more than 24 hours
    if (now - this.lastReset > dayInMs) {
      this.requestCount = 0
      this.lastReset = now
    }
    
    return this.requestCount < this.DAILY_QUOTA_LIMIT
  }

  /**
   * Increment request count for rate limiting
   */
  private incrementRequestCount(cost = 100): void {
    this.requestCount += cost
  }

  /**
   * Perform scan using mock data
   */
  private async performMockScan(options: YouTubePerformScanOptions): Promise<YouTubePerformScanResult> {
    const maxVideos = Math.min(options.maxPosts, MOCK_YOUTUBE_VIDEOS.length)
    const selectedVideos = MOCK_YOUTUBE_VIDEOS.slice(0, maxVideos)
    
    const result: YouTubePerformScanResult = {
      totalFound: selectedVideos.length,
      processed: 0,
      approved: 0,
      rejected: 0,
      duplicates: 0,
      errors: []
    }

    // Process each mock video
    for (const video of selectedVideos) {
      try {
        // Check for duplicates
        const duplicateResult = await this.duplicateDetection.checkForDuplicates({
          platform: 'youtube',
          url: video.url,
          title: video.title,
          content_hash: await this.contentProcessor.generateContentHash(video.url)
        })

        if (duplicateResult.isDuplicate) {
          result.duplicates++
          continue
        }

        // Apply content filtering
        const contentAnalysis = await this.filteringService.isValidHotdogContent({
          text: `${video.title} ${video.description}`,
          url: video.url,
          metadata: {
            tags: video.tags,
            viewCount: video.viewCount,
            channelTitle: video.channelTitle
          }
        })

        if (!contentAnalysis.is_valid_hotdog) {
          result.rejected++
          continue
        }

        // Store the content first
        const contentId = await this.saveVideoToQueue(video)
        
        if (contentId) {
          // Process with content processor using the ID
          const processingResult = await this.contentProcessor.processContent(contentId, {
            autoApprovalThreshold: 0.5, // Slightly lower threshold for YouTube videos
            autoRejectionThreshold: 0.2,
            enableDuplicateDetection: true
          })

          if (processingResult.action === 'approved') {
            result.approved++
          } else {
            result.rejected++
          }
        } else {
          result.errors.push(`Failed to save YouTube video: ${video.title}`)
        }
        result.processed++

      } catch (videoError) {
        result.errors.push(`Mock video processing error: ${videoError.message}`)
      }
    }

    await logToDatabase(
      LogLevel.INFO,
      'YOUTUBE_MOCK_SCAN_COMPLETED',
      `YouTube mock scan completed: ${result.approved} approved, ${result.rejected} rejected, ${result.duplicates} duplicates`,
      result
    )

    return result
  }

  /**
   * Perform scan using real YouTube API
   */
  private async performRealScan(options: YouTubePerformScanOptions, config: YouTubeScanConfig): Promise<YouTubePerformScanResult> {
    console.log('🎬 YOUTUBE: Starting real API scan!')
    console.log('🎬 YOUTUBE CONFIG:', config)
    
    const result: YouTubePerformScanResult = {
      totalFound: 0,
      processed: 0,
      approved: 0,
      rejected: 0,
      duplicates: 0,
      errors: []
    }

    const maxVideos = Math.min(options.maxPosts, config.maxVideosPerScan)
    console.log('🎬 YOUTUBE: Max videos to search:', maxVideos)
    
    // Search for hotdog content using different search terms
    console.log('🎬 YOUTUBE: Search terms:', config.searchTerms)
    for (const searchTerm of config.searchTerms.slice(0, 3)) { // Limit to 3 terms to avoid API limits
      console.log(`🎬 YOUTUBE: Searching for "${searchTerm}"...`)
      try {
        if (!this.checkRateLimit()) {
          result.errors.push(`YouTube API quota exceeded for term: ${searchTerm}`)
          continue
        }

        const searchOptions: YouTubeSearchOptions = {
          q: searchTerm,
          maxResults: 5, // Fixed number for testing
          type: 'video',
          order: 'relevance'
          // Removed date restriction and videoDuration to test
        }
        
        console.log('🎬 YOUTUBE: Search options:', searchOptions)

        const videos = await this.youtubeService.searchVideos(searchOptions)
        console.log(`🎬 YOUTUBE: Found ${videos.length} videos for "${searchTerm}"`)
        
        // Debug: Add search result info to errors for visibility
        result.errors.push(`DEBUG: Search "${searchTerm}" returned ${videos.length} videos`)
        if (videos.length > 0) {
          result.errors.push(`DEBUG: First video: "${videos[0].title}" by ${videos[0].channelTitle}`)
        }
        
        this.incrementRequestCount(100) // Search costs 100 quota units
        result.totalFound += videos.length

        // Process each video
        for (const video of videos) {
          try {
            // Check for duplicates
            const duplicateResult = await this.duplicateDetection.checkForDuplicates({
              platform: 'youtube',
              url: video.url,
              title: video.title,
              content_hash: await this.contentProcessor.generateContentHash(video.url)
            })

            if (duplicateResult.isDuplicate) {
              result.duplicates++
              continue
            }

            // Apply content filtering
            result.errors.push(`DEBUG: Processing video "${video.title}" (${video.viewCount} views)`)
            
            const contentAnalysis = await this.filteringService.isValidHotdogContent({
              text: `${video.title} ${video.description}`,
              url: video.url,
              metadata: {
                tags: video.tags,
                viewCount: video.viewCount,
                channelTitle: video.channelTitle
              }
            })

            if (!contentAnalysis.is_valid_hotdog) {
              result.errors.push(`DEBUG: Video "${video.title}" rejected by content filter`)
              result.rejected++
              continue
            }
            
            result.errors.push(`DEBUG: Video "${video.title}" passed content filter`)

            // Check view count threshold
            if (video.viewCount < config.minViewCount) {
              result.rejected++
              continue
            }

            // Process and store the content
            const processedContent = await this.contentProcessor.processContent({
              platform: 'youtube',
              type: 'video',
              title: video.title,
              content: video.description,
              url: video.url,
              videoUrl: video.videoUrl,
              thumbnailUrl: video.thumbnailUrl,
              author: video.channelTitle,
              authorUrl: video.channelUrl,
              publishedAt: video.publishedAt,
              metadata: {
                originalId: video.id,
                channelId: video.channelId,
                viewCount: video.viewCount,
                likeCount: video.likeCount,
                commentCount: video.commentCount,
                duration: video.duration,
                tags: video.tags,
                definition: video.definition,
                caption: video.caption,
                categoryId: video.categoryId
              }
            })

            if (processedContent.isApproved) {
              result.approved++
            } else {
              result.rejected++
            }
            result.processed++

          } catch (videoError) {
            result.errors.push(`Video processing error: ${videoError.message}`)
          }
        }

      } catch (searchError) {
        result.errors.push(`Search error for "${searchTerm}": ${searchError.message}`)
      }
    }

    await logToDatabase(
      LogLevel.INFO,
      'YOUTUBE_REAL_SCAN_COMPLETED',
      `YouTube real scan completed: ${result.approved} approved, ${result.rejected} rejected, ${result.duplicates} duplicates`,
      result
    )

    return result
  }

  /**
   * Test connection to YouTube API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const apiStatus = await this.youtubeService.getApiStatus()
      
      if (!apiStatus.isAuthenticated || !process.env.YOUTUBE_API_KEY) {
        return {
          success: false,
          message: 'YouTube API key not configured - using mock data',
          details: { 
            ...apiStatus, 
            usingMockData: true,
            quotaRemaining: this.DAILY_QUOTA_LIMIT - this.requestCount
          }
        }
      }

      if (!this.checkRateLimit()) {
        return {
          success: false,
          message: 'YouTube API quota exceeded - using mock data',
          details: { 
            ...apiStatus, 
            usingMockData: true,
            quotaUsed: this.requestCount,
            quotaLimit: this.DAILY_QUOTA_LIMIT
          }
        }
      }

      // Try a simple search to test the connection
      const testVideos = await this.youtubeService.searchVideos({
        q: 'hotdog',
        maxResults: 1,
        type: 'video'
      })
      this.incrementRequestCount(100)

      return {
        success: true,
        message: `YouTube connection successful. Found ${testVideos.length} test results.`,
        details: {
          ...apiStatus,
          testResultsCount: testVideos.length,
          usingMockData: false,
          quotaRemaining: this.DAILY_QUOTA_LIMIT - this.requestCount
        }
      }

    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        details: { 
          error: error.message, 
          usingMockData: true,
          quotaRemaining: this.DAILY_QUOTA_LIMIT - this.requestCount
        }
      }
    }
  }

  /**
   * Get or create scan configuration
   */
  async getScanConfig(): Promise<YouTubeScanConfig> {
    const defaultConfig: YouTubeScanConfig = {
      isEnabled: true,
      scanInterval: 240, // 4 hours
      maxVideosPerScan: 20,
      searchTerms: ['hotdog', 'hot dog recipe', 'bratwurst', 'sausage cooking', 'ballpark food'],
      videoDuration: 'any',
      publishedWithin: 30, // 30 days
      minViewCount: 1000,
      includeChannelIds: [],
      excludeChannelIds: []
    }

    try {
      const result = await query<any>(`
        SELECT * FROM youtube_scan_config 
        ORDER BY created_at DESC 
        LIMIT 1
      `)

      if (result.length === 0) {
        console.log('No YouTube config found, using default config')
        return defaultConfig
      }

      const dbConfig = result[0]
      
      // Map database field names (snake_case) to interface field names (camelCase)
      const mappedConfig: YouTubeScanConfig = {
        isEnabled: dbConfig.is_enabled ?? defaultConfig.isEnabled,
        scanInterval: dbConfig.scan_interval ?? defaultConfig.scanInterval,
        maxVideosPerScan: dbConfig.max_videos_per_scan ?? defaultConfig.maxVideosPerScan,
        searchTerms: Array.isArray(dbConfig.search_terms) ? dbConfig.search_terms : defaultConfig.searchTerms,
        videoDuration: dbConfig.video_duration ?? defaultConfig.videoDuration,
        publishedWithin: dbConfig.published_within ?? defaultConfig.publishedWithin,
        minViewCount: dbConfig.min_view_count ?? defaultConfig.minViewCount,
        includeChannelIds: Array.isArray(dbConfig.include_channel_ids) ? dbConfig.include_channel_ids : defaultConfig.includeChannelIds,
        excludeChannelIds: Array.isArray(dbConfig.exclude_channel_ids) ? dbConfig.exclude_channel_ids : defaultConfig.excludeChannelIds,
        lastScanTime: dbConfig.last_scan_time ? new Date(dbConfig.last_scan_time) : undefined,
        lastScanId: dbConfig.last_scan_id
      }

      console.log('YouTube config loaded:', { maxVideosPerScan: mappedConfig.maxVideosPerScan })
      return mappedConfig

    } catch (error) {
      // If table doesn't exist or query fails, return default config
      console.warn('YouTube config query failed, using default config:', error.message)
      return defaultConfig
    }
  }

  /**
   * Create default scan configuration
   */
  private async createDefaultScanConfig(): Promise<YouTubeScanConfig> {
    const config: YouTubeScanConfig = {
      isEnabled: true,
      scanInterval: 240, // 4 hours
      maxVideosPerScan: 20,
      searchTerms: ['hotdog', 'hot dog recipe', 'bratwurst', 'sausage cooking', 'ballpark food'],
      videoDuration: 'any',
      publishedWithin: 30, // 30 days
      minViewCount: 1000,
      includeChannelIds: [],
      excludeChannelIds: []
    }

    try {
      await insert('youtube_scan_config', {
        is_enabled: config.isEnabled,
        scan_interval: config.scanInterval,
        max_videos_per_scan: config.maxVideosPerScan,
        search_terms: config.searchTerms,
        video_duration: config.videoDuration,
        published_within: config.publishedWithin,
        min_view_count: config.minViewCount,
        include_channel_ids: config.includeChannelIds,
        exclude_channel_ids: config.excludeChannelIds,
        created_at: new Date(),
        updated_at: new Date()
      })

      await logToDatabase(
        LogLevel.INFO,
        'YOUTUBE_DEFAULT_CONFIG_CREATED',
        'Created default YouTube scan configuration',
        { config }
      )
    } catch (error) {
      // If we can't create the config, just return the default
      await logToDatabase(
        LogLevel.WARNING,
        'YOUTUBE_CONFIG_CREATE_FAILED',
        `Could not create YouTube scan config: ${error.message}`,
        { error: error.message }
      )
    }

    return config
  }

  /**
   * Save YouTube video to content queue
   */
  private async saveVideoToQueue(video: ProcessedYouTubeVideo): Promise<number | null> {
    try {
      const contentHash = this.generateContentHash(video.url, video.title)
      
      const result = await db.query(
        `INSERT INTO content_queue (
          content_text, content_image_url, content_video_url, content_type, 
          source_platform, original_url, original_author, content_hash, 
          content_metadata, scraped_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW()) 
        RETURNING id`,
        [
          video.title,
          video.thumbnailUrl,
          video.videoUrl,
          'video',
          'youtube',
          video.url,
          video.channelTitle,
          contentHash,
          JSON.stringify({
            originalId: video.id,
            channelId: video.channelId,
            channelUrl: video.channelUrl,
            description: video.description,
            publishedAt: video.publishedAt,
            viewCount: video.viewCount,
            likeCount: video.likeCount,
            commentCount: video.commentCount,
            duration: video.duration,
            tags: video.tags,
            definition: video.definition,
            caption: video.caption,
            categoryId: video.categoryId
          })
        ]
      )

      const contentId = result.rows[0]?.id
      if (contentId) {
        await logToDatabase(
          LogLevel.INFO,
          'YOUTUBE_VIDEO_SAVED',
          `YouTube video saved to queue: ${video.title}`,
          { contentId, videoId: video.id }
        )
      }
      
      return contentId || null

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'YOUTUBE_SAVE_ERROR',
        `Failed to save YouTube video: ${error.message}`,
        { video: video.title, error: error.message }
      )
      return null
    }
  }

  /**
   * Generate content hash for duplicate detection
   */
  private generateContentHash(url: string, title: string): string {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(`${url}:${title}`).digest('hex')
  }
}

export const youtubeScanningService = new YouTubeScanningService()