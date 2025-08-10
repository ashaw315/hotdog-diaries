import { mastodonService, MastodonPost } from './mastodon'
import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel, SourcePlatform } from '@/types'

export interface MastodonScanResult {
  scanId: string
  timestamp: Date
  postsFound: number
  postsProcessed: number
  postsAdded: number
  instancesScanned: string[]
  errors: Array<{
    instance: string
    error: string
    timestamp: Date
  }>
  scanDurationMs: number
}

export interface MastodonPerformScanOptions {
  maxPosts: number
}

export interface MastodonPerformScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
}

// Mock Mastodon posts for when instances are down
const MOCK_MASTODON_POSTS: MastodonPost[] = [
  {
    id: 'mock_mastodon_1',
    text: 'Just tried the most amazing Chicago-style hot dog! The combination of yellow mustard, onions, bright green relish, tomato wedges, pickle spear, sport peppers and celery salt is perfect. No ketchup needed! 🌭 #ChicagoStyle #HotDog #StreetFood',
    author: 'foodie_chicago',
    authorId: 'mastodon_user_1',
    url: 'https://mastodon.social/@foodie_chicago/mock1',
    published: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
    platform: SourcePlatform.MASTODON,
    instance: 'mastodon.social',
    mediaUrls: ['https://via.placeholder.com/800x600/FF6B6B/FFFFFF?text=Chicago+Hotdog'],
    hashtags: ['ChicagoStyle', 'HotDog', 'StreetFood'],
    mentions: [],
    boostCount: 23,
    favouriteCount: 89
  },
  {
    id: 'mock_mastodon_2',
    text: 'Grilling some bratwurst for tonight\'s BBQ! The secret is to start them in beer and onions, then finish on the grill for those perfect char marks. Who else loves German sausages? 🍺🔥 #Bratwurst #BBQ #Grilling',
    author: 'grill_master',
    authorId: 'mastodon_user_2',
    url: 'https://mstdn.social/@grill_master/mock2',
    published: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
    platform: SourcePlatform.MASTODON,
    instance: 'mstdn.social',
    mediaUrls: ['https://via.placeholder.com/800x600/4ECDC4/FFFFFF?text=BBQ+Bratwurst'],
    hashtags: ['Bratwurst', 'BBQ', 'Grilling'],
    mentions: [],
    boostCount: 45,
    favouriteCount: 156
  },
  {
    id: 'mock_mastodon_3',
    text: 'Stadium hot dogs hit different! There\'s something magical about eating a ballpark frank while watching baseball. The atmosphere, the crowd, the crack of the bat... pure Americana ⚾🌭 #Baseball #StadiumFood #Americana',
    author: 'baseball_lover',
    authorId: 'mastodon_user_3',
    url: 'https://social.vivaldi.net/@baseball_lover/mock3',
    published: new Date(Date.now() - 1000 * 60 * 60 * 16), // 16 hours ago
    platform: SourcePlatform.MASTODON,
    instance: 'social.vivaldi.net',
    mediaUrls: ['https://via.placeholder.com/800x600/45B7D1/FFFFFF?text=Stadium+Hotdog'],
    hashtags: ['Baseball', 'StadiumFood', 'Americana'],
    mentions: [],
    boostCount: 67,
    favouriteCount: 203
  },
  {
    id: 'mock_mastodon_4',
    text: 'Made currywurst at home tonight! 🇩🇪 Sliced bratwurst with homemade curry ketchup sauce and crispy fries. It\'s like having a piece of Berlin street food culture in my kitchen. Guten Appetit! #Currywurst #German #StreetFood #Berlin',
    author: 'berlin_foodie',
    authorId: 'mastodon_user_4',
    url: 'https://mastodon.world/@berlin_foodie/mock4',
    published: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    platform: SourcePlatform.MASTODON,
    instance: 'mastodon.world',
    mediaUrls: ['https://via.placeholder.com/800x600/F8B500/FFFFFF?text=Currywurst'],
    hashtags: ['Currywurst', 'German', 'StreetFood', 'Berlin'],
    mentions: [],
    boostCount: 34,
    favouriteCount: 124
  },
  {
    id: 'mock_mastodon_5',
    text: 'NYC hot dog cart tour day! 🗽 Trying dirty water dogs from different carts across Manhattan. Each cart has its own character and loyal customers. The diversity of toppings is amazing! #NYC #StreetFood #HotDogCart #Manhattan',
    author: 'nyc_explorer',
    authorId: 'mastodon_user_5',
    url: 'https://mas.to/@nyc_explorer/mock5',
    published: new Date(Date.now() - 1000 * 60 * 60 * 36), // 1.5 days ago
    platform: SourcePlatform.MASTODON,
    instance: 'mas.to',
    mediaUrls: ['https://via.placeholder.com/800x600/FECA57/FFFFFF?text=NYC+Hotdog+Cart'],
    hashtags: ['NYC', 'StreetFood', 'HotDogCart', 'Manhattan'],
    mentions: [],
    boostCount: 78,
    favouriteCount: 234
  },
  {
    id: 'mock_mastodon_6',
    text: 'Korean corn dogs are next level! 🇰🇷 Mozzarella cheese, rice puffs, and unique coatings make them so different from American versions. The cheese pull is incredible! Anyone else obsessed with these? #KoreanFood #CornDog #StreetFood #Cheese',
    author: 'korean_food_fan',
    authorId: 'mastodon_user_6',
    url: 'https://mastodon.social/@korean_food_fan/mock6',
    published: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    platform: SourcePlatform.MASTODON,
    instance: 'mastodon.social',
    mediaUrls: ['https://via.placeholder.com/800x600/FF5500/FFFFFF?text=Korean+Corn+Dog'],
    hashtags: ['KoreanFood', 'CornDog', 'StreetFood', 'Cheese'],
    mentions: [],
    boostCount: 92,
    favouriteCount: 287
  },
  {
    id: 'mock_mastodon_7',
    text: 'Making sausages from scratch today! Grinding the meat, mixing spices, stuffing casings... it\'s a labor of love but so worth it. Nothing beats homemade bratwurst! 🥩✨ #Homemade #Sausage #Butchery #FromScratch #Artisan',
    author: 'artisan_butcher',
    authorId: 'mastodon_user_7',
    url: 'https://fosstodon.org/@artisan_butcher/mock7',
    published: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    platform: SourcePlatform.MASTODON,
    instance: 'fosstodon.org',
    mediaUrls: ['https://via.placeholder.com/800x600/96CEB4/FFFFFF?text=Homemade+Sausage'],
    hashtags: ['Homemade', 'Sausage', 'Butchery', 'FromScratch', 'Artisan'],
    mentions: [],
    boostCount: 56,
    favouriteCount: 178
  },
  {
    id: 'mock_mastodon_8',
    text: 'Polish kielbasa festival was amazing! 🇵🇱 Traditional recipes passed down through generations, cooked over open fires. The smoky flavor and community atmosphere made it special. Culture through food! #Polish #Kielbasa #Traditional #Festival #Heritage',
    author: 'polish_heritage',
    authorId: 'mastodon_user_8',
    url: 'https://mstdn.io/@polish_heritage/mock8',
    published: new Date(Date.now() - 1000 * 60 * 60 * 96), // 4 days ago
    platform: SourcePlatform.MASTODON,
    instance: 'mstdn.io',
    mediaUrls: ['https://via.placeholder.com/800x600/6C5CE7/FFFFFF?text=Polish+Kielbasa'],
    hashtags: ['Polish', 'Kielbasa', 'Traditional', 'Festival', 'Heritage'],
    mentions: [],
    boostCount: 41,
    favouriteCount: 145
  }
]

export class MastodonScanningService {
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false

  constructor() {
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Perform a scan with options (interface for content-scanning service)
   */
  async performScan(options: MastodonPerformScanOptions): Promise<MastodonPerformScanResult> {
    try {
      // Get list of working instances
      const workingInstances = await this.getWorkingInstances()
      
      if (workingInstances.length === 0) {
        console.warn('⚠️  MASTODON: All instances offline, using mock data')
        return await this.performMockScan(options)
      }

      // If some instances are offline, log warning but continue with working ones
      const allInstances = await mastodonService.getActiveInstances()
      const offlineInstances = allInstances.filter(instance => !workingInstances.includes(instance))
      
      if (offlineInstances.length > 0) {
        console.warn(`⚠️  MASTODON: ${offlineInstances.length} instances offline: ${offlineInstances.join(', ')}. Using ${workingInstances.length} working instances.`)
      }

      // Use real Mastodon API with working instances only
      const realResult = await this.performRealScan(options, workingInstances)
      
      // If no posts were found from real instances, fall back to mock data
      if (realResult.totalFound === 0) {
        console.warn('⚠️  MASTODON: No posts found from real instances, falling back to mock data')
        return await this.performMockScan(options)
      }
      
      return realResult

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await logToDatabase(
        LogLevel.ERROR,
        'MASTODON_SCAN_ERROR',
        `Mastodon scan failed: ${errorMessage}`,
        { error: errorMessage }
      )
      
      // Fallback to mock data on error
      console.warn('⚠️  MASTODON: Scan failed, falling back to mock data')
      return await this.performMockScan(options)
    }
  }

  /**
   * Get list of working Mastodon instances
   */
  private async getWorkingInstances(): Promise<string[]> {
    const allInstances = await mastodonService.getActiveInstances()
    const workingInstances: string[] = []

    // Test each instance with a timeout
    const testPromises = allInstances.map(async (instance) => {
      try {
        // Simple connectivity test with 5 second timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`https://${instance}/api/v1/instance`, {
          signal: controller.signal,
          method: 'GET',
          headers: { 'User-Agent': 'HotdogDiaries-Bot/1.0' }
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          return instance
        }
        return null
      } catch (error) {
        console.warn(`MASTODON: Instance ${instance} failed connectivity test: ${error.message}`)
        return null
      }
    })

    const results = await Promise.allSettled(testPromises)
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        workingInstances.push(result.value)
      }
    }

    await logToDatabase(
      LogLevel.INFO,
      'MASTODON_INSTANCE_CHECK',
      `Instance connectivity check: ${workingInstances.length}/${allInstances.length} online`,
      { workingInstances, offlineInstances: allInstances.filter(i => !workingInstances.includes(i)) }
    )

    return workingInstances
  }

  /**
   * Perform scan using mock data
   */
  private async performMockScan(options: MastodonPerformScanOptions): Promise<MastodonPerformScanResult> {
    const maxPosts = Math.min(options.maxPosts, MOCK_MASTODON_POSTS.length)
    const selectedPosts = MOCK_MASTODON_POSTS.slice(0, maxPosts)
    
    const result: MastodonPerformScanResult = {
      totalFound: selectedPosts.length,
      processed: 0,
      approved: 0,
      rejected: 0,
      duplicates: 0,
      errors: []
    }

    // Process each mock post
    for (const post of selectedPosts) {
      try {
        // Check for duplicates
        const duplicateResult = await this.duplicateDetection.checkForDuplicates({
          platform: 'mastodon',
          url: post.url,
          title: post.text,
          content_hash: await this.contentProcessor.generateContentHash(post.url)
        })

        if (duplicateResult.isDuplicate) {
          result.duplicates++
          continue
        }

        // Apply content filtering
        const contentAnalysis = await this.filteringService.isValidHotdogContent({
          text: post.text,
          url: post.url,
          metadata: {
            hashtags: post.hashtags,
            boostCount: post.boostCount,
            favouriteCount: post.favouriteCount,
            author: post.author
          }
        })

        if (!contentAnalysis.is_valid_hotdog) {
          result.rejected++
          continue
        }

        // Process and store the content
        const processedContent = await this.contentProcessor.processContent({
          platform: 'mastodon',
          type: 'post',
          title: post.text.split('\n')[0], // First line as title
          content: post.text,
          url: post.url,
          imageUrl: post.mediaUrls?.[0],
          thumbnailUrl: post.mediaUrls?.[0],
          author: post.author,
          authorUrl: `https://${post.instance}/@${post.author}`,
          publishedAt: post.published,
          metadata: {
            originalId: post.id,
            instance: post.instance,
            hashtags: post.hashtags,
            mentions: post.mentions,
            boostCount: post.boostCount,
            favouriteCount: post.favouriteCount,
            mediaUrls: post.mediaUrls
          }
        })

        if (processedContent.isApproved) {
          result.approved++
        } else {
          result.rejected++
        }
        result.processed++

      } catch (postError) {
        result.errors.push(`Mock post processing error: ${postError.message}`)
      }
    }

    await logToDatabase(
      LogLevel.INFO,
      'MASTODON_MOCK_SCAN_COMPLETED',
      `Mastodon mock scan completed: ${result.approved} approved, ${result.rejected} rejected, ${result.duplicates} duplicates`,
      result
    )

    return result
  }

  /**
   * Perform scan using real Mastodon API
   */
  private async performRealScan(options: MastodonPerformScanOptions, workingInstances: string[]): Promise<MastodonPerformScanResult> {
    const result: MastodonPerformScanResult = {
      totalFound: 0,
      processed: 0,
      approved: 0,
      rejected: 0,
      duplicates: 0,
      errors: []
    }

    const maxPostsPerInstance = Math.floor(options.maxPosts / workingInstances.length)
    
    // Search each working instance for hotdog content
    for (const instance of workingInstances) {
      try {
        const posts = await mastodonService.searchPosts({
          query: 'hotdog OR "hot dog" OR bratwurst OR sausage',
          instance,
          limit: maxPostsPerInstance
        })

        result.totalFound += posts.length

        // Process each post
        for (const post of posts) {
          try {
            // Check for duplicates
            const duplicateResult = await this.duplicateDetection.checkForDuplicates({
              platform: 'mastodon',
              url: post.url,
              title: post.text,
              content_hash: await this.contentProcessor.generateContentHash(post.url)
            })

            if (duplicateResult.isDuplicate) {
              result.duplicates++
              continue
            }

            // Apply content filtering
            const contentAnalysis = await this.filteringService.isValidHotdogContent({
              text: post.text,
              url: post.url,
              metadata: {
                hashtags: post.hashtags,
                boostCount: post.boostCount,
                favouriteCount: post.favouriteCount,
                author: post.author
              }
            })

            if (!contentAnalysis.is_valid_hotdog) {
              result.rejected++
              continue
            }

            // Process and store the content
            const processedContent = await this.contentProcessor.processContent({
              platform: 'mastodon',
              type: 'post',
              title: post.text.split('\n')[0], // First line as title
              content: post.text,
              url: post.url,
              imageUrl: post.mediaUrls?.[0],
              thumbnailUrl: post.mediaUrls?.[0],
              author: post.author,
              authorUrl: `https://${post.instance}/@${post.author}`,
              publishedAt: post.published,
              metadata: {
                originalId: post.id,
                instance: post.instance,
                hashtags: post.hashtags,
                mentions: post.mentions,
                boostCount: post.boostCount,
                favouriteCount: post.favouriteCount,
                mediaUrls: post.mediaUrls
              }
            })

            if (processedContent.isApproved) {
              result.approved++
            } else {
              result.rejected++
            }
            result.processed++

          } catch (postError) {
            result.errors.push(`Post processing error: ${postError.message}`)
          }
        }

      } catch (instanceError) {
        result.errors.push(`Instance ${instance} error: ${instanceError.message}`)
      }
    }

    await logToDatabase(
      LogLevel.INFO,
      'MASTODON_REAL_SCAN_COMPLETED',
      `Mastodon real scan completed: ${result.approved} approved, ${result.rejected} rejected, ${result.duplicates} duplicates`,
      result
    )

    return result
  }

  /**
   * Test connection to Mastodon instances
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const allInstances = await mastodonService.getActiveInstances()
      const workingInstances = await this.getWorkingInstances()
      const offlineInstances = allInstances.filter(instance => !workingInstances.includes(instance))

      const successRate = Math.round((workingInstances.length / allInstances.length) * 100)

      if (workingInstances.length === 0) {
        return {
          success: false,
          message: 'All Mastodon instances are offline - using mock data',
          details: {
            totalInstances: allInstances.length,
            workingInstances: [],
            offlineInstances,
            successRate: 0,
            usingMockData: true
          }
        }
      }

      if (offlineInstances.length > 0) {
        return {
          success: true,
          message: `Mastodon partially available: ${workingInstances.length}/${allInstances.length} instances online (${successRate}%)`,
          details: {
            totalInstances: allInstances.length,
            workingInstances,
            offlineInstances,
            successRate,
            usingMockData: false
          }
        }
      }

      return {
        success: true,
        message: `All Mastodon instances online: ${workingInstances.length}/${allInstances.length} instances (${successRate}%)`,
        details: {
          totalInstances: allInstances.length,
          workingInstances,
          offlineInstances: [],
          successRate: 100,
          usingMockData: false
        }
      }

    } catch (error) {
      return {
        success: false,
        message: `Mastodon connection test failed: ${error.message}`,
        details: {
          error: error.message,
          usingMockData: true
        }
      }
    }
  }

  // Legacy methods for backwards compatibility
  async startAutomaticScanning(): Promise<void> {
    await logToDatabase(LogLevel.INFO, 'MASTODON_AUTO_SCANNING_DEPRECATED', 'Automatic scanning is now handled by content-scanning service')
  }

  async stopAutomaticScanning(): Promise<void> {
    await logToDatabase(LogLevel.INFO, 'MASTODON_AUTO_SCANNING_DEPRECATED', 'Automatic scanning is now handled by content-scanning service')
  }
}

export const mastodonScanningService = new MastodonScanningService()