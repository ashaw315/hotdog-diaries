import { TwitterService, ProcessedTweet, TwitterSearchOptions } from './twitter'
import { FilteringService } from './filtering'
import { ContentProcessor } from './content-processor'
import { DuplicateDetectionService } from './duplicate-detection'
import { query, insert } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface TwitterScanConfig {
  isEnabled: boolean
  scanInterval: number // minutes
  maxTweetsPerScan: number
  searchQueries: string[]
  excludeRetweets: boolean
  excludeReplies: boolean
  minEngagementThreshold: number
  lastScanId?: string
  lastScanTime?: Date
}

export interface TwitterScanResult {
  scanId: string
  startTime: Date
  endTime: Date
  tweetsFound: number
  tweetsProcessed: number
  tweetsApproved: number
  tweetsRejected: number
  tweetsFlagged: number
  duplicatesFound: number
  errors: string[]
  rateLimitHit: boolean
  nextScanTime?: Date
}

export interface TwitterScanStats {
  totalScans: number
  totalTweetsFound: number
  totalTweetsProcessed: number
  totalTweetsApproved: number
  averageEngagement: number
  topHashtags: Array<{ hashtag: string; count: number }>
  topAuthors: Array<{ username: string; count: number }>
  scanFrequency: number
  lastScanTime?: Date
  nextScanTime?: Date
}

export class TwitterScanningService {
  private twitterService: TwitterService
  private filteringService: FilteringService
  private contentProcessor: ContentProcessor
  private duplicateDetection: DuplicateDetectionService
  private isScanning = false
  private scanTimer?: NodeJS.Timeout

  constructor() {
    this.twitterService = new TwitterService()
    this.filteringService = new FilteringService()
    this.contentProcessor = new ContentProcessor()
    this.duplicateDetection = new DuplicateDetectionService()
  }

  /**
   * Start automated Twitter scanning
   */
  async startAutomatedScanning(): Promise<void> {
    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        await logToDatabase(
          LogLevel.INFO,
          'TWITTER_SCAN_DISABLED',
          'Twitter scanning is disabled in configuration'
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
        'TWITTER_SCAN_STARTED',
        `Twitter scanning started with ${config.scanInterval} minute intervals`,
        { config }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TWITTER_SCAN_START_ERROR',
        `Failed to start Twitter scanning: ${error.message}`,
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Stop automated Twitter scanning
   */
  async stopAutomatedScanning(): Promise<void> {
    if (this.scanTimer) {
      clearInterval(this.scanTimer)
      this.scanTimer = undefined
    }

    await logToDatabase(
      LogLevel.INFO,
      'TWITTER_SCAN_STOPPED',
      'Twitter scanning stopped'
    )
  }

  /**
   * Perform a single Twitter scan
   */
  async performScan(): Promise<TwitterScanResult> {
    if (this.isScanning) {
      throw new Error('Scan already in progress')
    }

    this.isScanning = true
    const scanId = `scan_${Date.now()}`
    const startTime = new Date()
    const result: TwitterScanResult = {
      scanId,
      startTime,
      endTime: new Date(),
      tweetsFound: 0,
      tweetsProcessed: 0,
      tweetsApproved: 0,
      tweetsRejected: 0,
      tweetsFlagged: 0,
      duplicatesFound: 0,
      errors: [],
      rateLimitHit: false
    }

    try {
      const config = await this.getScanConfig()
      
      if (!config.isEnabled) {
        throw new Error('Twitter scanning is disabled')
      }

      let allTweets: ProcessedTweet[] = []

      // Search using configured queries
      for (const query of config.searchQueries) {
        try {
          const searchOptions: TwitterSearchOptions = {
            query,
            maxResults: Math.floor(config.maxTweetsPerScan / config.searchQueries.length),
            sinceId: config.lastScanId
          }

          const tweets = await this.twitterService.searchTweets(searchOptions)
          allTweets = allTweets.concat(tweets)

          await logToDatabase(
            LogLevel.INFO,
            'TWITTER_QUERY_SUCCESS',
            `Found ${tweets.length} tweets for query: ${query}`,
            { scanId, query, tweetsFound: tweets.length }
          )

        } catch (error) {
          result.errors.push(`Query "${query}" failed: ${error.message}`)
          
          if (error.message.includes('Rate limit')) {
            result.rateLimitHit = true
          }

          await logToDatabase(
            LogLevel.ERROR,
            'TWITTER_QUERY_ERROR',
            `Query failed: ${query} - ${error.message}`,
            { scanId, query, error: error.message }
          )
        }
      }

      result.tweetsFound = allTweets.length

      // Remove duplicates
      const uniqueTweets = this.removeDuplicateTweets(allTweets)
      result.duplicatesFound = allTweets.length - uniqueTweets.length

      // Process each tweet
      for (const tweet of uniqueTweets) {
        try {
          const processed = await this.processTweet(tweet, scanId)
          result.tweetsProcessed++

          switch (processed.status) {
            case 'approved':
              result.tweetsApproved++
              break
            case 'rejected':
              result.tweetsRejected++
              break
            case 'flagged':
              result.tweetsFlagged++
              break
          }

        } catch (error) {
          result.errors.push(`Tweet ${tweet.id} processing failed: ${error.message}`)
          
          await logToDatabase(
            LogLevel.ERROR,
            'TWITTER_TWEET_PROCESS_ERROR',
            `Failed to process tweet ${tweet.id}: ${error.message}`,
            { scanId, tweetId: tweet.id, error: error.message }
          )
        }
      }

      // Update scan configuration with latest tweet ID
      if (allTweets.length > 0) {
        const latestTweet = allTweets.reduce((latest, tweet) => 
          tweet.id > latest.id ? tweet : latest
        )
        await this.updateLastScanId(latestTweet.id)
      }

      result.endTime = new Date()
      result.nextScanTime = new Date(Date.now() + config.scanInterval * 60 * 1000)

      // Record scan results
      await this.recordScanResult(result)

      await logToDatabase(
        LogLevel.INFO,
        'TWITTER_SCAN_COMPLETED',
        `Scan completed: ${result.tweetsProcessed} processed, ${result.tweetsApproved} approved`,
        result
      )

      return result

    } catch (error) {
      result.errors.push(error.message)
      result.endTime = new Date()

      await logToDatabase(
        LogLevel.ERROR,
        'TWITTER_SCAN_ERROR',
        `Scan failed: ${error.message}`,
        { scanId, error: error.message }
      )

      throw error

    } finally {
      this.isScanning = false
    }
  }

  /**
   * Process a single tweet through the content pipeline
   */
  private async processTweet(tweet: ProcessedTweet, scanId: string): Promise<{ status: 'approved' | 'rejected' | 'flagged' }> {
    try {
      // Validate tweet content
      const isValid = await this.twitterService.validateTweetContent(tweet)
      if (!isValid) {
        return { status: 'rejected' }
      }

      // Check for duplicates in existing content
      const contentHash = await this.duplicateDetection.generateContentHash(tweet.text)
      const isDuplicate = await this.duplicateDetection.checkForDuplicates({
        content_text: tweet.text,
        content_image_url: tweet.imageUrls[0],
        content_video_url: tweet.videoUrls[0],
        content_hash: contentHash
      })

      if (isDuplicate) {
        return { status: 'rejected' }
      }

      // Add to content queue
      const contentData = {
        content_text: tweet.text,
        content_image_url: tweet.imageUrls[0] || null,
        content_video_url: tweet.videoUrls[0] || null,
        content_type: this.determineContentType(tweet),
        source_platform: 'twitter' as const,
        original_url: `https://twitter.com/${tweet.authorUsername}/status/${tweet.id}`,
        original_author: `${tweet.authorName} (@${tweet.authorUsername})`,
        scraped_at: new Date(),
        content_hash: contentHash,
        twitter_data: JSON.stringify({
          tweet_id: tweet.id,
          author_id: tweet.authorId,
          author_username: tweet.authorUsername,
          author_name: tweet.authorName,
          created_at: tweet.createdAt,
          public_metrics: tweet.publicMetrics,
          hashtags: tweet.hashtags,
          mentions: tweet.mentions,
          urls: tweet.urls,
          media_urls: tweet.mediaUrls,
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

      // Process through filtering service
      const processingResult = await this.contentProcessor.processContent(insertedContent.id)

      return { status: processingResult.status as 'approved' | 'rejected' | 'flagged' }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TWITTER_TWEET_PROCESS_ERROR',
        `Failed to process tweet ${tweet.id}: ${error.message}`,
        { 
          tweetId: tweet.id, 
          scanId, 
          error: error.message,
          tweet: {
            text: tweet.text,
            author: tweet.authorUsername
          }
        }
      )
      throw error
    }
  }

  /**
   * Determine content type based on tweet media
   */
  private determineContentType(tweet: ProcessedTweet): 'text' | 'image' | 'video' | 'mixed' {
    const hasImage = tweet.imageUrls.length > 0
    const hasVideo = tweet.videoUrls.length > 0
    const hasText = tweet.text.trim().length > 0

    if (hasVideo && hasImage) return 'mixed'
    if (hasVideo) return 'video'
    if (hasImage) return 'image'
    if (hasText) return 'text'
    
    return 'text'
  }

  /**
   * Remove duplicate tweets from array
   */
  private removeDuplicateTweets(tweets: ProcessedTweet[]): ProcessedTweet[] {
    const seen = new Set<string>()
    return tweets.filter(tweet => {
      if (seen.has(tweet.id)) {
        return false
      }
      seen.add(tweet.id)
      return true
    })
  }

  /**
   * Get current scan configuration
   */
  async getScanConfig(): Promise<TwitterScanConfig> {
    try {
      const config = await query('twitter_scan_config')
        .select('*')
        .first()

      if (!config) {
        // Return default configuration
        return {
          isEnabled: false,
          scanInterval: 30, // 30 minutes
          maxTweetsPerScan: 50,
          searchQueries: this.twitterService.getHotdogSearchQueries(),
          excludeRetweets: true,
          excludeReplies: true,
          minEngagementThreshold: 1
        }
      }

      return {
        isEnabled: config.is_enabled,
        scanInterval: config.scan_interval,
        maxTweetsPerScan: config.max_tweets_per_scan,
        searchQueries: config.search_queries || this.twitterService.getHotdogSearchQueries(),
        excludeRetweets: config.exclude_retweets,
        excludeReplies: config.exclude_replies,
        minEngagementThreshold: config.min_engagement_threshold,
        lastScanId: config.last_scan_id,
        lastScanTime: config.last_scan_time ? new Date(config.last_scan_time) : undefined
      }
    } catch (error) {
      // If table doesn't exist, return defaults
      return {
        isEnabled: false,
        scanInterval: 30,
        maxTweetsPerScan: 50,
        searchQueries: this.twitterService.getHotdogSearchQueries(),
        excludeRetweets: true,
        excludeReplies: true,
        minEngagementThreshold: 1
      }
    }
  }

  /**
   * Update scan configuration
   */
  async updateScanConfig(config: Partial<TwitterScanConfig>): Promise<void> {
    try {
      const existing = await this.getScanConfig()
      const updated = { ...existing, ...config }

      await query('twitter_scan_config')
        .upsert({
          is_enabled: updated.isEnabled,
          scan_interval: updated.scanInterval,
          max_tweets_per_scan: updated.maxTweetsPerScan,
          search_queries: updated.searchQueries,
          exclude_retweets: updated.excludeRetweets,
          exclude_replies: updated.excludeReplies,
          min_engagement_threshold: updated.minEngagementThreshold,
          last_scan_id: updated.lastScanId,
          last_scan_time: updated.lastScanTime,
          updated_at: new Date()
        })

      await logToDatabase(
        LogLevel.INFO,
        'TWITTER_CONFIG_UPDATED',
        'Twitter scan configuration updated',
        { config: updated }
      )

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'TWITTER_CONFIG_UPDATE_ERROR',
        `Failed to update Twitter configuration: ${error.message}`,
        { config, error: error.message }
      )
      throw error
    }
  }

  /**
   * Update last scan ID
   */
  private async updateLastScanId(lastScanId: string): Promise<void> {
    await this.updateScanConfig({ 
      lastScanId, 
      lastScanTime: new Date() 
    })
  }

  /**
   * Record scan result for analytics
   */
  private async recordScanResult(result: TwitterScanResult): Promise<void> {
    try {
      await insert('twitter_scan_results')
        .values({
          scan_id: result.scanId,
          start_time: result.startTime,
          end_time: result.endTime,
          tweets_found: result.tweetsFound,
          tweets_processed: result.tweetsProcessed,
          tweets_approved: result.tweetsApproved,
          tweets_rejected: result.tweetsRejected,
          tweets_flagged: result.tweetsFlagged,
          duplicates_found: result.duplicatesFound,
          errors: result.errors,
          rate_limit_hit: result.rateLimitHit,
          created_at: new Date()
        })

    } catch (error) {
      // Don't throw error here, just log it
      await logToDatabase(
        LogLevel.WARNING,
        'TWITTER_SCAN_RESULT_RECORD_ERROR',
        `Failed to record scan result: ${error.message}`,
        { scanId: result.scanId, error: error.message }
      )
    }
  }

  /**
   * Get Twitter scanning statistics
   */
  async getScanStats(): Promise<TwitterScanStats> {
    try {
      // Get basic stats from scan results
      const scanResults = await query('twitter_scan_results')
        .select([
          'COUNT(*) as total_scans',
          'SUM(tweets_found) as total_tweets_found',
          'SUM(tweets_processed) as total_tweets_processed',
          'SUM(tweets_approved) as total_tweets_approved',
          'MAX(end_time) as last_scan_time'
        ])
        .first()

      // Get configuration for next scan time
      const config = await this.getScanConfig()
      const nextScanTime = config.lastScanTime 
        ? new Date(config.lastScanTime.getTime() + config.scanInterval * 60 * 1000)
        : undefined

      return {
        totalScans: parseInt(scanResults?.total_scans || '0'),
        totalTweetsFound: parseInt(scanResults?.total_tweets_found || '0'),
        totalTweetsProcessed: parseInt(scanResults?.total_tweets_processed || '0'),
        totalTweetsApproved: parseInt(scanResults?.total_tweets_approved || '0'),
        averageEngagement: 0, // Placeholder - would need more complex query
        topHashtags: [], // Placeholder - would need hashtag analysis
        topAuthors: [], // Placeholder - would need author analysis
        scanFrequency: config.scanInterval,
        lastScanTime: scanResults?.last_scan_time ? new Date(scanResults.last_scan_time) : undefined,
        nextScanTime
      }

    } catch (error) {
      // Return default stats if tables don't exist
      return {
        totalScans: 0,
        totalTweetsFound: 0,
        totalTweetsProcessed: 0,
        totalTweetsApproved: 0,
        averageEngagement: 0,
        topHashtags: [],
        topAuthors: [],
        scanFrequency: 30,
        lastScanTime: undefined,
        nextScanTime: undefined
      }
    }
  }

  /**
   * Test Twitter API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const status = await this.twitterService.getApiStatus()
      
      if (status.isConnected) {
        return {
          success: true,
          message: 'Twitter API connection successful',
          details: status
        }
      } else {
        return {
          success: false,
          message: status.lastError || 'Failed to connect to Twitter API',
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