import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface ScheduledPost {
  id: number
  content_queue_id: number
  scheduled_for: Date
  status: 'pending' | 'posted' | 'failed' | 'skipped'
}

export interface PostingContent {
  id: number
  content_text: string
  content_image_url?: string
  content_video_url?: string
  content_type: string
  source_platform: string
  original_url: string
  original_author?: string
}

export class PostingScheduler {
  // Posting times: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
  private static readonly POSTING_HOURS = [0, 4, 8, 12, 16, 20]
  private static readonly POSTS_PER_DAY = 6
  private static readonly MIN_HOURS_BETWEEN_POSTS = 3.5

  /**
   * Calculate the next scheduled posting time
   */
  static getNextScheduledTime(fromTime: Date = new Date()): Date {
    const now = new Date(fromTime)
    const currentHour = now.getUTCHours()
    const currentMinutes = now.getUTCMinutes()
    
    // Find the next posting hour
    let nextHour = this.POSTING_HOURS.find(hour => {
      if (hour > currentHour) return true
      if (hour === currentHour && currentMinutes < 55) return true // Allow 5 min before
      return false
    })
    
    // If no posting hour found today, use first hour tomorrow
    const nextDate = new Date(now)
    if (nextHour === undefined) {
      nextHour = this.POSTING_HOURS[0]
      nextDate.setUTCDate(nextDate.getUTCDate() + 1)
    }
    
    // Set the exact time
    nextDate.setUTCHours(nextHour, 0, 0, 0)
    
    console.log(`[POSTING] Next scheduled time: ${nextDate.toISOString()} (from ${fromTime.toISOString()})`)
    return nextDate
  }

  /**
   * Check if we're within a posting window (±5 minutes)
   */
  static isWithinPostingWindow(time: Date = new Date()): boolean {
    const now = new Date(time)
    const currentHour = now.getUTCHours()
    const currentMinutes = now.getUTCMinutes()
    
    const isPostingHour = this.POSTING_HOURS.includes(currentHour)
    const isWithinWindow = currentMinutes <= 5 || currentMinutes >= 55
    
    return isPostingHour && isWithinWindow
  }

  /**
   * Select content for posting with platform diversity
   */
  static async selectContentForPosting(): Promise<PostingContent | null> {
    try {
      // Get the last few posted items to ensure platform diversity
      const recentPostsResult = await db.query(`
        SELECT source_platform 
        FROM content_queue 
        WHERE is_posted = true 
        ORDER BY posted_at DESC 
        LIMIT 3
      `)
      
      const recentPlatforms = recentPostsResult.rows.map(r => r.source_platform)
      
      // Select content prioritizing:
      // 1. Not recently posted platforms
      // 2. Higher priority content
      // 3. Older approved content
      const contentResult = await db.query<PostingContent>(`
        SELECT 
          id, content_text, content_image_url, content_video_url,
          content_type, source_platform, original_url, original_author
        FROM content_queue
        WHERE is_approved = true 
          AND is_posted = false
          AND (posting_attempt_count < 3 OR posting_attempt_count IS NULL)
          ${recentPlatforms.length > 0 ? 'AND source_platform NOT IN ($1)' : ''}
        ORDER BY 
          posting_priority DESC,
          scraped_at ASC
        LIMIT 1
      `, recentPlatforms.length > 0 ? [recentPlatforms[0]] : [])
      
      if (contentResult.rows.length === 0) {
        // Fallback: get any approved content
        const fallbackResult = await db.query<PostingContent>(`
          SELECT 
            id, content_text, content_image_url, content_video_url,
            content_type, source_platform, original_url, original_author
          FROM content_queue
          WHERE is_approved = true 
            AND is_posted = false
            AND (posting_attempt_count < 3 OR posting_attempt_count IS NULL)
          ORDER BY 
            posting_priority DESC,
            scraped_at ASC
          LIMIT 1
        `)
        
        return fallbackResult.rows[0] || null
      }
      
      return contentResult.rows[0]
    } catch (error) {
      console.error('[POSTING] Error selecting content:', error)
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to select content for posting',
        'PostingScheduler',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return null
    }
  }

  /**
   * Schedule content for the next available slot
   */
  static async scheduleNextPost(contentId: number): Promise<ScheduledPost | null> {
    try {
      const nextTime = this.getNextScheduledTime()
      
      const result = await db.query<ScheduledPost>(`
        INSERT INTO posting_schedule (content_queue_id, scheduled_for, status, created_at)
        VALUES ($1, $2, 'pending', NOW())
        ON CONFLICT (content_queue_id, scheduled_for) DO NOTHING
        RETURNING id, content_queue_id, scheduled_for, status
      `, [contentId, nextTime])
      
      if (result.rows.length > 0) {
        // Update content_queue with scheduled time
        await db.query(`
          UPDATE content_queue 
          SET scheduled_post_time = $1 
          WHERE id = $2
        `, [nextTime, contentId])
        
        console.log(`[POSTING] Scheduled content ${contentId} for ${nextTime.toISOString()}`)
        return result.rows[0]
      }
      
      return null
    } catch (error) {
      console.error('[POSTING] Error scheduling post:', error)
      return null
    }
  }

  /**
   * Execute a scheduled post (marks as posted for now)
   */
  static async executeScheduledPost(contentId: number): Promise<boolean> {
    const client = await db.getClient()
    
    try {
      await client.query('BEGIN')
      
      // Update posting attempt count
      await client.query(`
        UPDATE content_queue 
        SET 
          posting_attempt_count = COALESCE(posting_attempt_count, 0) + 1,
          last_posting_attempt = NOW()
        WHERE id = $1
      `, [contentId])
      
      // For now, just mark as posted (actual social media posting would go here)
      const updateResult = await client.query(`
        UPDATE content_queue 
        SET 
          is_posted = true,
          posted_at = NOW()
        WHERE id = $1 AND is_approved = true
        RETURNING id, source_platform, content_type
      `, [contentId])
      
      if (updateResult.rows.length === 0) {
        throw new Error('Content not found or not approved')
      }
      
      const content = updateResult.rows[0]
      
      // Record in posting history
      await client.query(`
        INSERT INTO posting_history (
          content_queue_id, posted_at, platform, success, response_data
        ) VALUES ($1, NOW(), $2, true, $3)
      `, [contentId, content.source_platform, { message: 'Successfully posted' }])
      
      // Update posting schedule
      await client.query(`
        UPDATE posting_schedule 
        SET 
          status = 'posted',
          posted_at = NOW()
        WHERE content_queue_id = $1 AND status = 'pending'
      `, [contentId])
      
      await client.query('COMMIT')
      
      console.log(`[POSTING] Successfully posted content ${contentId} from ${content.source_platform}`)
      await logToDatabase(
        LogLevel.INFO,
        'Content posted successfully',
        'PostingScheduler',
        { 
          contentId, 
          platform: content.source_platform,
          contentType: content.content_type 
        }
      )
      
      return true
    } catch (error) {
      await client.query('ROLLBACK')
      
      console.error('[POSTING] Error executing post:', error)
      
      // Record failure in history
      await db.query(`
        INSERT INTO posting_history (
          content_queue_id, posted_at, platform, success, response_data
        ) VALUES ($1, NOW(), 'unknown', false, $2)
      `, [contentId, { error: error instanceof Error ? error.message : 'Unknown error' }])
      
      // Update posting schedule
      await db.query(`
        UPDATE posting_schedule 
        SET 
          status = 'failed',
          failure_reason = $2
        WHERE content_queue_id = $1 AND status = 'pending'
      `, [contentId, error instanceof Error ? error.message : 'Unknown error'])
      
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to post content',
        'PostingScheduler',
        { 
          contentId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      )
      
      return false
    } finally {
      client.release()
    }
  }

  /**
   * Check if we've posted recently (within MIN_HOURS_BETWEEN_POSTS)
   */
  static async hasPostedRecently(): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM content_queue
        WHERE is_posted = true
          AND posted_at > NOW() - INTERVAL '${this.MIN_HOURS_BETWEEN_POSTS} hours'
      `)
      
      return parseInt(result.rows[0].count) > 0
    } catch (error) {
      console.error('[POSTING] Error checking recent posts:', error)
      return true // Err on the side of caution
    }
  }

  /**
   * Get posting statistics
   */
  static async getPostingStats() {
    try {
      const [lastPost, todayCount, last24h] = await Promise.all([
        // Last successful post
        db.query(`
          SELECT posted_at, source_platform 
          FROM content_queue 
          WHERE is_posted = true 
          ORDER BY posted_at DESC 
          LIMIT 1
        `),
        
        // Posts today (UTC)
        db.query(`
          SELECT COUNT(*) as count 
          FROM content_queue 
          WHERE is_posted = true 
            AND posted_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
        `),
        
        // Posts in last 24 hours
        db.query(`
          SELECT COUNT(*) as count 
          FROM content_queue 
          WHERE is_posted = true 
            AND posted_at > NOW() - INTERVAL '24 hours'
        `)
      ])
      
      const nextScheduledTime = this.getNextScheduledTime()
      
      return {
        lastPostTime: lastPost.rows[0]?.posted_at || null,
        lastPostPlatform: lastPost.rows[0]?.source_platform || null,
        nextScheduledTime,
        postsToday: parseInt(todayCount.rows[0]?.count || 0),
        postsLast24Hours: parseInt(last24h.rows[0]?.count || 0),
        postsPerDay: this.POSTS_PER_DAY
      }
    } catch (error) {
      console.error('[POSTING] Error getting stats:', error)
      return {
        lastPostTime: null,
        lastPostPlatform: null,
        nextScheduledTime: this.getNextScheduledTime(),
        postsToday: 0,
        postsLast24Hours: 0,
        postsPerDay: this.POSTS_PER_DAY
      }
    }
  }
}

export const postingScheduler = new PostingScheduler()