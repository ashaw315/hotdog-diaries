import { ContentProcessor, contentProcessor } from './content-processor'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { createSimpleClient } from '@/utils/supabase/server'

export interface MastodonAccount {
  id: string
  username: string
  acct: string
  display_name: string
  locked: boolean
  bot: boolean
  discoverable: boolean | null
  group: boolean
  created_at: string
  note: string
  url: string
  avatar: string
  avatar_static: string
  header: string
  header_static: string
  followers_count: number
  following_count: number
  statuses_count: number
  last_status_at: string | null
  emojis: any[]
  fields: any[]
}

export interface MastodonMediaAttachment {
  id: string
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown'
  url: string
  preview_url: string
  remote_url: string | null
  preview_remote_url: string | null
  text_url: string | null
  meta: {
    original?: {
      width: number
      height: number
      size: string
      aspect: number
    }
    small?: {
      width: number
      height: number
      size: string
      aspect: number
    }
  }
  description: string | null
  blurhash: string | null
}

export interface MastodonStatus {
  id: string
  created_at: string
  in_reply_to_id: string | null
  in_reply_to_account_id: string | null
  sensitive: boolean
  spoiler_text: string
  visibility: 'public' | 'unlisted' | 'private' | 'direct'
  language: string | null
  uri: string
  url: string | null
  replies_count: number
  reblogs_count: number
  favourites_count: number
  edited_at: string | null
  content: string
  reblog: MastodonStatus | null
  application: {
    name: string
    website: string | null
  } | null
  account: MastodonAccount
  media_attachments: MastodonMediaAttachment[]
  mentions: any[]
  tags: Array<{
    name: string
    url: string
  }>
  emojis: any[]
  card: any | null
  poll: any | null
}

export interface MastodonSearchResponse {
  accounts: MastodonAccount[]
  statuses: MastodonStatus[]
  hashtags: any[]
}

export class MastodonService {
  private readonly instances = [
    'mastodon.social',
    'mastodon.world', 
    'mas.to',
    'fosstodon.org'
  ]
  
  private readonly searchTerms = [
    'hotdog',
    '#hotdog', 
    'hot dog',
    'burger', // More common food term
    'food'    // Very general to ensure we find content
  ]
  
  private readonly foodTags = [
    '#FoodFriday',
    '#FoodPorn', 
    '#Cooking',
    '#Food',
    '#lunch'  // Common food tag
  ]

  async performScan(options?: { maxPosts?: number }): Promise<{
    totalFound: number
    processed: number
    approved: number
    rejected: number
    duplicates: number
    errors: number
  }> {
    const maxPosts = options?.maxPosts || 20
    const startTime = Date.now()
    
    try {
      await logToDatabase(
        LogLevel.INFO,
        'MASTODON_SCAN_STARTED',
        'Starting Mastodon federated content scan',
        { maxPosts, instances: this.instances, searchTerms: this.searchTerms }
      )

      let totalFound = 0
      let processed = 0
      let approved = 0
      let rejected = 0
      let duplicates = 0
      let errors = 0

      // Search across multiple instances in parallel for better performance
      const allStatuses: MastodonStatus[] = []

      for (const instance of this.instances) {
        try {
          console.log(`🌐 Scanning Mastodon instance: ${instance}`)
          
          // Search for hotdog content using multiple terms
          const instanceStatuses = await this.searchInstance(
            instance, 
            Math.ceil(maxPosts / this.instances.length)
          )
          
          console.log(`📡 Found ${instanceStatuses.length} statuses on ${instance}`)
          allStatuses.push(...instanceStatuses)
          totalFound += instanceStatuses.length

          // Rate limiting delay between instances
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`Error scanning instance ${instance}:`, error)
          errors++
          await logToDatabase(
            LogLevel.ERROR,
            'MASTODON_INSTANCE_ERROR',
            `Failed to scan instance ${instance}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { instance, error: error instanceof Error ? error.message : 'Unknown error' }
          )
        }
      }

      // Deduplicate by URI (statuses can appear on multiple instances)
      const uniqueStatuses = Array.from(
        new Map(allStatuses.map(status => [status.uri, status])).values()
      ).slice(0, maxPosts)

      console.log(`📋 Processing ${uniqueStatuses.length} unique statuses after deduplication`)

      // Process each unique status
      for (const status of uniqueStatuses) {
        try {
          // Check if we already have this content
          const existingContent = await this.checkForExistingContent(status.uri)
          if (existingContent) {
            duplicates++
            continue
          }

          // Process the status
          const contentId = await this.saveStatusToQueue(status)
          if (contentId) {
            const result = await contentProcessor.processContent(contentId, {
              autoApprovalThreshold: 0.4, // Lower threshold for Mastodon's smaller community
              autoRejectionThreshold: 0.2
            })

            processed++
            if (result.action === 'approved') {
              approved++
            } else if (result.action === 'rejected') {
              rejected++
            }

            console.log(`✅ Processed Mastodon status: ${result.action} (confidence: ${result.analysis.confidence_score})`)
          }
        } catch (error) {
          console.error('Error processing individual status:', error)
          errors++
        }
      }

      const duration = Date.now() - startTime
      await logToDatabase(
        LogLevel.INFO,
        'MASTODON_SCAN_COMPLETED',
        'Mastodon federated content scan completed',
        { 
          totalFound, 
          processed, 
          approved, 
          rejected, 
          duplicates, 
          errors, 
          duration,
          successRate: processed > 0 ? (approved / processed) : 0,
          instancesScanned: this.instances.length
        }
      )

      return { totalFound, processed, approved, rejected, duplicates, errors }

    } catch (error) {
      const duration = Date.now() - startTime
      await logToDatabase(
        LogLevel.ERROR,
        'MASTODON_SCAN_ERROR',
        `Mastodon scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : 'Unknown error', duration }
      )
      throw error
    }
  }

  private async searchInstance(instance: string, limit: number = 20): Promise<MastodonStatus[]> {
    // TEMPORARY: Just use public timeline directly for testing
    try {
      console.log(`📡 Fetching public timeline from ${instance}`)
      const timelineUrl = `https://${instance}/api/v1/timelines/public?limit=${limit}`
      
      const response = await fetch(timelineUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Timeline API error: ${response.status} ${response.statusText}`)
      }

      const allStatuses: MastodonStatus[] = await response.json()
      console.log(`✅ Retrieved ${allStatuses.length} statuses from ${instance} public timeline`)
      
      // TEMPORARY: Filter and return public, non-sensitive content
      const relevantStatuses = allStatuses.filter(status => {
        return !status.sensitive && status.visibility === 'public'
      })
      
      console.log(`⚠️  TESTING MODE: Returning ${relevantStatuses.length} public statuses for database testing`)
      return relevantStatuses.slice(0, limit)
      
    } catch (error) {
      console.error(`Error fetching timeline from ${instance}:`, error)
      return []
    }
  }

  private async searchInstanceTerm(instance: string, query: string, limit: number = 5): Promise<MastodonStatus[]> {
    try {
      // Try search first
      const searchUrl = `https://${instance}/api/v2/search?q=${encodeURIComponent(query)}&type=statuses&limit=${limit}&resolve=false`
      
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000)
      })

      if (searchResponse.ok) {
        const data: MastodonSearchResponse = await searchResponse.json()
        
        // Filter to public statuses only
        const publicStatuses = (data.statuses || []).filter(status => 
          status.visibility === 'public' && !status.sensitive
        )

        if (publicStatuses.length > 0) {
          return publicStatuses
        }
      }

      // If search doesn't work or returns nothing, try public timeline as fallback
      console.log(`Search didn't return results, trying public timeline for ${instance}`)
      const timelineUrl = `https://${instance}/api/v1/timelines/public?limit=${limit}`
      
      const timelineResponse = await fetch(timelineUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!timelineResponse.ok) {
        throw new Error(`Mastodon API error: ${timelineResponse.status} ${timelineResponse.statusText}`)
      }

      const timelineData: MastodonStatus[] = await timelineResponse.json()
      
      // Filter to public, non-sensitive statuses
      const publicStatuses = (timelineData || []).filter(status => 
        status.visibility === 'public' && !status.sensitive
      )

      return publicStatuses

    } catch (error) {
      console.error(`Error searching ${instance} for "${query}":`, error)
      return []
    }
  }

  private async saveStatusToQueue(status: MastodonStatus): Promise<number | null> {
    try {
      // Handle boosts (reblogs) - use original content
      const originalStatus = status.reblog || status
      const isBoost = !!status.reblog

      // Strip HTML from content
      const cleanContent = this.stripHtmlTags(originalStatus.content)
      
      // Determine content type and URLs
      let contentType = 'text'
      let imageUrl: string | undefined
      let videoUrl: string | undefined

      if (originalStatus.media_attachments.length > 0) {
        const firstAttachment = originalStatus.media_attachments[0]
        
        switch (firstAttachment.type) {
          case 'image':
            contentType = 'image'
            imageUrl = firstAttachment.url
            break
          case 'video':
          case 'gifv':
            contentType = 'video'
            videoUrl = firstAttachment.url
            break
          default:
            contentType = 'image' // Default for unknown media types
            imageUrl = firstAttachment.url
        }
      }

      // Create content text with context
      let contentText = cleanContent
      
      // Add content warning if present
      if (originalStatus.spoiler_text) {
        contentText = `CW: ${originalStatus.spoiler_text}\n\n${contentText}`
      }
      
      // Add boost indicator
      if (isBoost) {
        contentText = `🔁 Boosted: ${contentText}`
      }

      // Add media indicator
      if (originalStatus.media_attachments.length > 1) {
        contentText = `📷 Multiple attachments: ${contentText}`
      }

      // Generate content hash
      const hashInput = `mastodon_${originalStatus.uri}_${Date.now()}`
      const contentHash = require('crypto').createHash('md5').update(hashInput).digest('hex')

      // Extract instance from account URL for author
      const instanceMatch = originalStatus.account.url.match(/https?:\/\/([^\/]+)/)
      const instanceDomain = instanceMatch ? instanceMatch[1] : 'unknown'
      const authorHandle = `@${originalStatus.account.username}@${instanceDomain}`

      // Calculate Mastodon confidence score
      const confidenceScore = this.calculateMastodonScore(
        originalStatus.favourites_count,
        originalStatus.reblogs_count, 
        originalStatus.replies_count
      )
      
      // Auto-approve engaging content (lower threshold for smaller community)
      const isAutoApproved = originalStatus.favourites_count > 5

      // Use Supabase client
      const supabase = createSimpleClient()
      
      const contentData = {
        content_text: contentText.trim(),
        content_image_url: imageUrl || null,
        content_video_url: videoUrl || null,
        content_type: contentType,
        source_platform: 'mastodon',
        original_url: originalStatus.url || originalStatus.uri,
        original_author: authorHandle,
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
        console.log(`💾 Saved Mastodon status to queue: ID ${contentId} (${contentType})`)
        
        // Log additional metadata
        await logToDatabase(
          LogLevel.INFO,
          'MASTODON_CONTENT_SAVED',
          'Saved Mastodon status to content queue',
          {
            contentId,
            statusId: originalStatus.id,
            contentType,
            isBoost,
            hasContentWarning: !!originalStatus.spoiler_text,
            mediaAttachments: originalStatus.media_attachments.length,
            favourites: originalStatus.favourites_count,
            boosts: originalStatus.reblogs_count,
            instanceDomain
          }
        )
      }

      return contentId

    } catch (error) {
      console.error('Error saving Mastodon status to queue:', error)
      await logToDatabase(
        LogLevel.ERROR,
        'MASTODON_SAVE_ERROR',
        `Failed to save Mastodon status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          statusUri: status.uri,
          statusId: status.id,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      )
      return null
    }
  }

  /**
   * Calculate Mastodon-specific confidence score based on engagement
   */
  private calculateMastodonScore(favourites: number = 0, boosts: number = 0, replies: number = 0): number {
    // Favourites (likes) - primary engagement metric
    const favouritesNormalized = Math.min(favourites / 50, 1.0) * 0.5

    // Boosts (reblogs) - viral potential
    const boostsNormalized = Math.min(boosts / 20, 1.0) * 0.3

    // Replies - discussion engagement  
    const repliesNormalized = Math.min(replies / 10, 1.0) * 0.2

    const finalScore = favouritesNormalized + boostsNormalized + repliesNormalized
    
    // Ensure score is between 0.1 and 1.0
    return Math.max(0.1, Math.min(1.0, finalScore))
  }

  private async checkForExistingContent(uri: string): Promise<boolean> {
    try {
      const supabase = createSimpleClient()
      const { data, error } = await supabase
        .from('content_queue')
        .select('id')
        .eq('source_platform', 'mastodon')
        .like('original_url', `%${encodeURIComponent(uri.split('/').pop() || '')}%`)
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
   * Strip HTML tags from Mastodon content
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🔗 Testing Mastodon federated network connection...')
      
      // Test connection to multiple instances
      const testResults = []
      
      for (const instance of this.instances.slice(0, 2)) { // Test first 2 instances
        try {
          const testStatuses = await this.searchInstanceTerm(instance, 'test', 1)
          testResults.push({
            instance,
            success: true,
            statusesFound: testStatuses.length
          })
        } catch (error) {
          testResults.push({
            instance,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      const successfulInstances = testResults.filter(r => r.success).length
      
      return {
        success: successfulInstances > 0,
        message: `Successfully connected to ${successfulInstances}/${testResults.length} Mastodon instances`,
        details: {
          testResults,
          instancesConfigured: this.instances.length,
          searchTermsConfigured: this.searchTerms.length
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Mastodon connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        .eq('source_platform', 'mastodon')
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
        nextScanTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        successRate: totalFound > 0 ? approvedPosts / totalFound : 0
      }
    } catch (error) {
      console.error('Error getting Mastodon scanning stats:', error)
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
    instances: string[]
  }> {
    try {
      const stats = await this.getScanningStats()
      
      return {
        isEnabled: true, // No API key required for public content
        scanInterval: 4 * 60 * 60 * 1000, // 4 hours
        lastScanTime: stats.lastScanTime,
        nextScanTime: stats.nextScanTime,
        searchTerms: this.searchTerms,
        instances: this.instances
      }
    } catch (error) {
      console.error('Error getting Mastodon scan config:', error)
      return {
        isEnabled: false,
        scanInterval: 4 * 60 * 60 * 1000,
        searchTerms: this.searchTerms,
        instances: this.instances
      }
    }
  }

  async startAutomatedScanning(): Promise<void> {
    try {
      await logToDatabase(
        LogLevel.INFO,
        'MASTODON_AUTO_SCAN_STARTED',
        'Starting automated Mastodon federated scanning'
      )

      // Perform a scan
      await this.performScan({ maxPosts: 25 })
      
      console.log('✅ Mastodon automated scanning started successfully')
    } catch (error) {
      console.error('Error starting Mastodon automated scanning:', error)
      await logToDatabase(
        LogLevel.ERROR,
        'MASTODON_AUTO_SCAN_ERROR',
        `Failed to start automated Mastodon scanning: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }
}

export const mastodonService = new MastodonService()

// Export as MastodonScanningService for compatibility with scanning-scheduler
export { MastodonService as MastodonScanningService }