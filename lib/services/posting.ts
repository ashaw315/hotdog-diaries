import { db } from '@/lib/db'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { schedulingService } from './scheduling'

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

      const selectedContent = await schedulingService.selectRandomContent()
      
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