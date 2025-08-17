import { db } from '@/lib/db'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { schedulingService } from './scheduling'
import { loggingService } from './logging'

export interface PostingResult {
  success: boolean
  contentId?: number
  error?: string
  postOrder?: number
}

export interface QueueStatus {
  totalApproved: number
  totalPending: number
  totalPosted: number
  isHealthy: boolean
  alertLevel: 'none' | 'low' | 'critical'
  message: string
}

export class PostingService {
  private static readonly MIN_QUEUE_SIZE = 5
  private static readonly CRITICAL_QUEUE_SIZE = 2

  async postContent(contentId: number, manualTrigger: boolean = false): Promise<PostingResult> {
    try {
      const client = await db.getClient()
      
      try {
        await client.query('BEGIN')

        const contentResult = await client.query(
          'SELECT * FROM content_queue WHERE id = $1 AND is_approved = true AND is_posted = false',
          [contentId]
        )

        if (contentResult.rows.length === 0) {
          await client.query('ROLLBACK')
          return {
            success: false,
            error: 'Content not found or not available for posting'
          }
        }

        const content = contentResult.rows[0]
        const postOrder = await this.calculatePostOrder()
        const now = new Date()

        await client.query(
          'UPDATE content_queue SET is_posted = true, posted_at = $1, updated_at = NOW() WHERE id = $2',
          [now, contentId]
        )

        const postedResult = await client.query(
          `INSERT INTO posted_content (content_queue_id, posted_at, post_order, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING *`,
          [contentId, now, postOrder]
        )

        await client.query('COMMIT')

        await logToDatabase(
          LogLevel.INFO,
          'Content posted successfully',
          'PostingService',
          {
            contentId,
            postOrder,
            contentType: content.content_type,
            sourcePlatform: content.source_platform,
            manualTrigger
          }
        )

        return {
          success: true,
          contentId,
          postOrder
        }

      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to post content',
        'PostingService',
        {
          contentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async ensureContentAvailable(): Promise<boolean> {
    try {
      const queueStatus = await this.getQueueStatus()
      
      if (queueStatus.totalApproved === 0) {
        await logToDatabase(
          LogLevel.ERROR,
          'No content available for posting',
          'PostingService',
          { queueStatus }
        )
        return false
      }

      if (queueStatus.alertLevel === 'critical') {
        await logToDatabase(
          LogLevel.WARN,
          'Critical queue level - very low content available',
          'PostingService',
          { queueStatus }
        )
      } else if (queueStatus.alertLevel === 'low') {
        await logToDatabase(
          LogLevel.WARN,
          'Low queue level - content running low',
          'PostingService',
          { queueStatus }
        )
      }

      return true
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to check content availability',
        'PostingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return false
    }
  }

  async handleEmptyQueue(): Promise<void> {
    try {
      const queueStatus = await this.getQueueStatus()
      
      if (queueStatus.totalApproved === 0) {
        await logToDatabase(
          LogLevel.ERROR,
          'Empty queue detected - no content available for posting',
          'PostingService',
          { queueStatus }
        )

        await schedulingService.pauseScheduling()
        
        await logToDatabase(
          LogLevel.INFO,
          'Automatic scheduling paused due to empty queue',
          'PostingService'
        )
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to handle empty queue',
        'PostingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  async getQueueStatus(): Promise<QueueStatus> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as total_approved,
          COUNT(*) FILTER (WHERE is_approved = false AND is_posted = false) as total_pending,
          COUNT(*) FILTER (WHERE is_posted = true) as total_posted
        FROM content_queue
      `)

      const stats = result.rows[0]
      const totalApproved = parseInt(stats.total_approved)
      const totalPending = parseInt(stats.total_pending)
      const totalPosted = parseInt(stats.total_posted)

      let alertLevel: 'none' | 'low' | 'critical' = 'none'
      let message = 'Queue is healthy'
      let isHealthy = true

      if (totalApproved === 0) {
        alertLevel = 'critical'
        message = 'No approved content available for posting'
        isHealthy = false
      } else if (totalApproved <= PostingService.CRITICAL_QUEUE_SIZE) {
        alertLevel = 'critical'
        message = `Critical: Only ${totalApproved} approved items remaining`
        isHealthy = false
      } else if (totalApproved <= PostingService.MIN_QUEUE_SIZE) {
        alertLevel = 'low'
        message = `Low: Only ${totalApproved} approved items remaining`
        isHealthy = true
      }

      return {
        totalApproved,
        totalPending,
        totalPosted,
        isHealthy,
        alertLevel,
        message
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get queue status',
        'PostingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )

      return {
        totalApproved: 0,
        totalPending: 0,
        totalPosted: 0,
        isHealthy: false,
        alertLevel: 'critical',
        message: 'Failed to check queue status'
      }
    }
  }

  async getPostingHistory(limit: number = 10): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          pc.*,
          cq.content_type,
          cq.source_platform,
          cq.content_text,
          cq.content_image_url,
          cq.content_video_url,
          cq.original_author,
          cq.original_url
        FROM posted_content pc
        JOIN content_queue cq ON pc.content_queue_id = cq.id
        ORDER BY pc.posted_at DESC
        LIMIT $1
      `, [limit])

      return result.rows
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get posting history',
        'PostingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return []
    }
  }

  async getPostingStats(): Promise<{
    todaysPosts: number
    thisWeeksPosts: number
    thisMonthsPosts: number
    totalPosts: number
    avgPostsPerDay: number
  }> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE posted_at >= CURRENT_DATE) as todays_posts,
          COUNT(*) FILTER (WHERE posted_at >= CURRENT_DATE - INTERVAL '7 days') as this_weeks_posts,
          COUNT(*) FILTER (WHERE posted_at >= CURRENT_DATE - INTERVAL '30 days') as this_months_posts,
          COUNT(*) as total_posts,
          ROUND(
            COUNT(*) FILTER (WHERE posted_at >= CURRENT_DATE - INTERVAL '30 days') / 30.0, 
            2
          ) as avg_posts_per_day
        FROM posted_content
      `)

      const stats = result.rows[0]
      
      return {
        todaysPosts: parseInt(stats.todays_posts),
        thisWeeksPosts: parseInt(stats.this_weeks_posts),
        thisMonthsPosts: parseInt(stats.this_months_posts),
        totalPosts: parseInt(stats.total_posts),
        avgPostsPerDay: parseFloat(stats.avg_posts_per_day)
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get posting stats',
        'PostingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )

      return {
        todaysPosts: 0,
        thisWeeksPosts: 0,
        thisMonthsPosts: 0,
        totalPosts: 0,
        avgPostsPerDay: 0
      }
    }
  }

  /**
   * Smart content selection that maintains feed diversity
   */
  async selectNextContentSmart(): Promise<any | null> {
    try {
      // Get last 24 hours of posted content for variety analysis
      const recentPosts = await this.getRecentPosts(24)
      
      // Analyze recent content types and platforms
      const recentAnalysis = this.analyzeRecentContent(recentPosts)
      
      // Determine what type of content we need next for variety
      const targetType = this.determineNextContentType(recentAnalysis)
      const avoidPlatforms = this.getRecentPlatforms(recentPosts, 6) // Avoid platforms from last 6 hours
      
      await loggingService.logInfo('PostingService', 'Smart content selection initiated', {
        recentPosts: recentPosts.length,
        targetType,
        avoidPlatforms,
        recentAnalysis
      })

      // Try to select content matching our variety requirements
      let selectedContent = await this.selectContentByType(targetType, avoidPlatforms)
      
      // Fallback 1: Try any content avoiding recent platforms
      if (!selectedContent && avoidPlatforms.length > 0) {
        selectedContent = await this.selectContentAvoidingPlatforms(avoidPlatforms)
      }
      
      // Fallback 2: Select any available content (last resort)
      if (!selectedContent) {
        selectedContent = await this.selectAnyAvailableContent()
      }

      if (selectedContent) {
        await loggingService.logInfo('PostingService', 'Smart content selected', {
          contentId: selectedContent.id,
          platform: selectedContent.source_platform,
          contentType: this.determineContentType(selectedContent),
          strategy: selectedContent.selection_strategy
        })
      } else {
        await loggingService.logWarning('PostingService', 'No content available for smart selection')
      }

      return selectedContent

    } catch (error) {
      await loggingService.logError('PostingService', 'Smart content selection failed', {}, error as Error)
      // Fallback to random selection
      return await schedulingService.selectRandomContent()
    }
  }

  /**
   * Get recent posts for analysis
   */
  private async getRecentPosts(hours: number): Promise<any[]> {
    try {
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000)
      
      const result = await db.query(`
        SELECT 
          pc.posted_at,
          pc.post_order,
          cq.source_platform,
          cq.content_image_url,
          cq.content_video_url,
          cq.content_text
        FROM posted_content pc
        JOIN content_queue cq ON pc.content_queue_id = cq.id
        WHERE pc.posted_at >= $1
        ORDER BY pc.posted_at DESC
      `, [hoursAgo])

      return result.rows

    } catch (error) {
      await loggingService.logError('PostingService', 'Failed to get recent posts', { hours }, error as Error)
      return []
    }
  }

  /**
   * Analyze recent content for patterns
   */
  private analyzeRecentContent(recentPosts: any[]): {
    contentTypes: Record<string, number>
    platforms: Record<string, number>
    lastContentType?: string
    lastPlatform?: string
  } {
    const analysis = {
      contentTypes: { video: 0, gif: 0, image: 0, text: 0 },
      platforms: {} as Record<string, number>
    }

    for (const post of recentPosts) {
      // Determine content type
      const contentType = this.determineContentType(post)
      analysis.contentTypes[contentType]++
      
      // Count platforms
      if (post.source_platform) {
        analysis.platforms[post.source_platform] = (analysis.platforms[post.source_platform] || 0) + 1
      }
    }

    // Get most recent content details
    if (recentPosts.length > 0) {
      const mostRecent = recentPosts[0]
      analysis.lastContentType = this.determineContentType(mostRecent)
      analysis.lastPlatform = mostRecent.source_platform
    }

    return analysis
  }

  /**
   * Determine content type from content object
   */
  private determineContentType(content: any): string {
    if (content.content_video_url) return 'video'
    if (content.content_image_url) {
      // Check if it's a GIF
      if (content.content_image_url.includes('.gif') || content.source_platform === 'giphy') {
        return 'gif'
      }
      return 'image'
    }
    if (content.content_text && content.content_text.trim().length > 0) return 'text'
    return 'text' // Default fallback
  }

  /**
   * Determine what content type should be posted next for variety
   */
  private determineNextContentType(analysis: {
    contentTypes: Record<string, number>
    lastContentType?: string
  }): string {
    const { contentTypes, lastContentType } = analysis
    const total = Object.values(contentTypes).reduce((sum, count) => sum + count, 0)

    // If no recent posts, use target distribution
    if (total === 0) {
      const random = Math.random()
      if (random < 0.3) return 'video'
      if (random < 0.55) return 'gif'
      if (random < 0.95) return 'image'
      return 'text'
    }

    // Calculate current percentages
    const percentages = {
      video: total > 0 ? contentTypes.video / total : 0,
      gif: total > 0 ? contentTypes.gif / total : 0,
      image: total > 0 ? contentTypes.image / total : 0,
      text: total > 0 ? contentTypes.text / total : 0
    }

    // Target distribution (same as queue manager)
    const targets = { video: 0.30, gif: 0.25, image: 0.40, text: 0.05 }

    // Avoid repeating the same type as last post
    if (lastContentType && contentTypes[lastContentType] > 0) {
      // Find most under-represented type (excluding last type if possible)
      let bestType = 'image'
      let bestScore = Infinity
      
      for (const [type, target] of Object.entries(targets)) {
        if (type === lastContentType && total >= 3) continue // Skip last type if we have enough variety
        
        const currentPercentage = percentages[type as keyof typeof percentages]
        const score = currentPercentage / target // Lower score = more needed
        
        if (score < bestScore) {
          bestScore = score
          bestType = type
        }
      }
      
      return bestType
    }

    // If no recent posts or no last type, use most needed type
    let mostNeeded = 'image'
    let lowestRatio = Infinity
    
    for (const [type, target] of Object.entries(targets)) {
      const currentPercentage = percentages[type as keyof typeof percentages]
      const ratio = currentPercentage / target
      
      if (ratio < lowestRatio) {
        lowestRatio = ratio
        mostNeeded = type
      }
    }

    return mostNeeded
  }

  /**
   * Get platforms used in recent posts to avoid repetition
   */
  private getRecentPlatforms(recentPosts: any[], hours: number): string[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    return recentPosts
      .filter(post => new Date(post.posted_at) >= cutoff)
      .map(post => post.source_platform)
      .filter(platform => platform) // Remove nulls
  }

  /**
   * Select content by preferred type, avoiding certain platforms
   */
  private async selectContentByType(contentType: string, avoidPlatforms: string[]): Promise<any | null> {
    try {
      let whereClause = `
        WHERE is_approved = true 
        AND is_posted = false
      `
      const params: any[] = []

      // Add content type filter
      if (contentType === 'video') {
        whereClause += ` AND content_video_url IS NOT NULL`
      } else if (contentType === 'gif') {
        whereClause += ` AND (content_image_url LIKE '%.gif' OR source_platform = 'giphy')`
      } else if (contentType === 'image') {
        whereClause += ` AND content_image_url IS NOT NULL AND content_image_url NOT LIKE '%.gif' AND source_platform != 'giphy'`
      } else if (contentType === 'text') {
        whereClause += ` AND content_video_url IS NULL AND content_image_url IS NULL`
      }

      // Avoid recent platforms
      if (avoidPlatforms.length > 0) {
        whereClause += ` AND source_platform NOT IN (${avoidPlatforms.map((_, i) => `$${params.length + i + 1}`).join(', ')})`
        params.push(...avoidPlatforms)
      }

      const query = `
        SELECT *, 'type_preference' as selection_strategy
        FROM content_queue
        ${whereClause}
        ORDER BY confidence_score DESC, RANDOM()
        LIMIT 1
      `

      const result = await db.query(query, params)
      return result.rows.length > 0 ? result.rows[0] : null

    } catch (error) {
      await loggingService.logError('PostingService', 'Failed to select content by type', { contentType, avoidPlatforms }, error as Error)
      return null
    }
  }

  /**
   * Select content avoiding certain platforms
   */
  private async selectContentAvoidingPlatforms(avoidPlatforms: string[]): Promise<any | null> {
    try {
      const params = avoidPlatforms
      const placeholders = avoidPlatforms.map((_, i) => `$${i + 1}`).join(', ')
      
      const query = `
        SELECT *, 'platform_avoidance' as selection_strategy
        FROM content_queue
        WHERE is_approved = true 
        AND is_posted = false
        AND source_platform NOT IN (${placeholders})
        ORDER BY confidence_score DESC, RANDOM()
        LIMIT 1
      `

      const result = await db.query(query, params)
      return result.rows.length > 0 ? result.rows[0] : null

    } catch (error) {
      await loggingService.logError('PostingService', 'Failed to select content avoiding platforms', { avoidPlatforms }, error as Error)
      return null
    }
  }

  /**
   * Select any available content (fallback)
   */
  private async selectAnyAvailableContent(): Promise<any | null> {
    try {
      const query = `
        SELECT *, 'fallback' as selection_strategy
        FROM content_queue
        WHERE is_approved = true 
        AND is_posted = false
        ORDER BY confidence_score DESC, RANDOM()
        LIMIT 1
      `

      const result = await db.query(query)
      return result.rows.length > 0 ? result.rows[0] : null

    } catch (error) {
      await loggingService.logError('PostingService', 'Failed to select any available content', {}, error as Error)
      return null
    }
  }

  async processScheduledPost(): Promise<PostingResult> {
    try {
      const isSchedulingEnabled = await schedulingService.getScheduleConfig()
      
      if (!isSchedulingEnabled.is_enabled) {
        await logToDatabase(
          LogLevel.INFO,
          'Scheduling disabled, skipping scheduled post',
          'PostingService'
        )
        return {
          success: false,
          error: 'Scheduling is disabled'
        }
      }

      const isPostingTime = await schedulingService.isPostingTime()
      
      if (!isPostingTime) {
        await logToDatabase(
          LogLevel.INFO,
          'Not posting time, skipping scheduled post',
          'PostingService'
        )
        return {
          success: false,
          error: 'Not posting time'
        }
      }

      const contentAvailable = await this.ensureContentAvailable()
      
      if (!contentAvailable) {
        await this.handleEmptyQueue()
        return {
          success: false,
          error: 'No content available for posting'
        }
      }

      const selectedContent = await this.selectNextContentSmart()
      
      if (!selectedContent) {
        await this.handleEmptyQueue()
        return {
          success: false,
          error: 'Failed to select content for posting'
        }
      }

      const result = await this.postContent(selectedContent.id, false)
      
      if (result.success) {
        await logToDatabase(
          LogLevel.INFO,
          'Scheduled post processed successfully',
          'PostingService',
          { contentId: selectedContent.id, postOrder: result.postOrder }
        )
      }

      return result
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to process scheduled post',
        'PostingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async calculatePostOrder(): Promise<number> {
    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)

    const result = await db.query(
      `SELECT COALESCE(MAX(post_order), 0) + 1 as next_order
       FROM posted_content
       WHERE posted_at >= $1 AND posted_at <= $2`,
      [startOfDay, endOfDay]
    )

    return Math.min(result.rows[0].next_order, 6)
  }
}

export const postingService = new PostingService()