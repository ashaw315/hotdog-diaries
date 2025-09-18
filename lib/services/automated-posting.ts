import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

interface ContentItem {
  id: number
  content_text: string | null
  content_image_url: string | null
  content_video_url: string | null
  content_type: string
  source_platform: string
  original_url: string
  original_author: string | null
  content_status: string
  scheduled_for: string | null
  confidence_score: number | null
  created_at: string
}

interface PostingResult {
  success: boolean
  contentId: number
  platform: string
  contentType: string
  error?: string
  postedAt?: Date
}

interface SelectionOptions {
  maxItems: number
  platformBalance: boolean
  qualityThreshold: number
  avoidRecentDuplicates: boolean
  recentHours: number
}

export class AutomatedPostingService {
  private static readonly MEAL_TIMES = [
    { hour: 7, minute: 0, name: 'breakfast' },   // Breakfast
    { hour: 12, minute: 0, name: 'lunch' },     // Lunch  
    { hour: 15, minute: 0, name: 'snack' },     // Afternoon snack
    { hour: 18, minute: 0, name: 'dinner' },    // Dinner
    { hour: 20, minute: 0, name: 'evening' },   // Evening snack
    { hour: 22, minute: 0, name: 'late_night' } // Late night
  ]

  private static readonly PLATFORM_WEIGHTS = {
    reddit: 0.25,     // 25% Reddit discussions
    youtube: 0.20,    // 20% YouTube videos
    imgur: 0.18,      // 18% Imgur GIFs/images
    lemmy: 0.15,      // 15% Lemmy posts
    bluesky: 0.12,    // 12% Bluesky posts
    giphy: 0.06,      // 6% Giphy GIFs
    tumblr: 0.02,     // 2% Tumblr images
    pixabay: 0.02     // 2% Pixabay stock photos
  }

  /**
   * Main automated posting function - called by cron jobs
   */
  async runAutomatedPosting(): Promise<PostingResult[]> {
    const startTime = new Date()
    
    await logToDatabase(
      LogLevel.INFO,
      'Automated posting cycle started',
      'AutomatedPosting',
      { timestamp: startTime.toISOString() }
    )

    try {
      // Check if this is a scheduled meal time
      const currentMealTime = this.getCurrentMealTime()
      if (!currentMealTime) {
        await logToDatabase(
          LogLevel.INFO,
          'Not a scheduled meal time, skipping automated posting',
          'AutomatedPosting',
          { currentTime: startTime.toISOString() }
        )
        return []
      }

      // Get content to post
      const selectedContent = await this.selectContentForPosting({
        maxItems: 1, // Post 1 item per meal time
        platformBalance: true,
        qualityThreshold: 0.6,
        avoidRecentDuplicates: true,
        recentHours: 24
      })

      if (selectedContent.length === 0) {
        await logToDatabase(
          LogLevel.WARNING,
          'No suitable content found for automated posting',
          'AutomatedPosting',
          { mealTime: currentMealTime.name }
        )
        return []
      }

      // Post the selected content
      const results: PostingResult[] = []
      for (const content of selectedContent) {
        const result = await this.postContent(content)
        results.push(result)
      }

      const successCount = results.filter(r => r.success).length
      
      await logToDatabase(
        LogLevel.INFO,
        `Automated posting cycle completed: ${successCount}/${results.length} successful`,
        'AutomatedPosting',
        { 
          mealTime: currentMealTime.name,
          results: results.length,
          successful: successCount
        }
      )

      return results

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        `Automated posting cycle failed: ${error.message}`,
        'AutomatedPosting',
        { error: error.message, timestamp: startTime.toISOString() }
      )
      throw error
    }
  }

  /**
   * Select content for posting based on intelligent algorithm
   */
  async selectContentForPosting(options: SelectionOptions): Promise<ContentItem[]> {
    const { 
      maxItems, 
      platformBalance, 
      qualityThreshold, 
      avoidRecentDuplicates, 
      recentHours 
    } = options

    try {
      // First, try to get scheduled content for current time
      const scheduledContent = await this.getScheduledContent(maxItems)
      
      if (scheduledContent.length >= maxItems) {
        await logToDatabase(
          LogLevel.INFO,
          `Selected ${scheduledContent.length} scheduled content items`,
          'ContentSelection',
          { contentIds: scheduledContent.map(c => c.id) }
        )
        return scheduledContent
      }

      // If not enough scheduled content, fall back to approved content
      const remainingSlots = maxItems - scheduledContent.length
      const approvedContent = await this.getApprovedContent(
        remainingSlots, 
        qualityThreshold,
        avoidRecentDuplicates,
        recentHours,
        platformBalance
      )

      const selectedContent = [...scheduledContent, ...approvedContent]

      await logToDatabase(
        LogLevel.INFO,
        `Selected ${selectedContent.length} content items (${scheduledContent.length} scheduled, ${approvedContent.length} approved)`,
        'ContentSelection',
        { 
          totalSelected: selectedContent.length,
          scheduledCount: scheduledContent.length,
          approvedCount: approvedContent.length,
          contentIds: selectedContent.map(c => c.id)
        }
      )

      return selectedContent

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        `Content selection failed: ${error.message}`,
        'ContentSelection',
        { error: error.message, options }
      )
      throw error
    }
  }

  /**
   * Get scheduled content for current time window
   */
  private async getScheduledContent(maxItems: number): Promise<ContentItem[]> {
    const now = new Date()
    const windowStart = new Date(now.getTime() - 30 * 60 * 1000) // 30 minutes ago
    const windowEnd = new Date(now.getTime() + 30 * 60 * 1000)   // 30 minutes from now

    const query = `
      SELECT cq.*
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      WHERE cq.content_status = 'scheduled'
        AND cq.scheduled_for BETWEEN $1 AND $2
      ORDER BY cq.scheduled_for ASC, ca.confidence_score DESC NULLS LAST
      LIMIT $3
    `

    const result = await db.query<ContentItem>(query, [
      windowStart.toISOString(),
      windowEnd.toISOString(),
      maxItems
    ])

    return result.rows
  }

  /**
   * Get approved content with intelligent selection
   */
  private async getApprovedContent(
    maxItems: number,
    qualityThreshold: number,
    avoidRecentDuplicates: boolean,
    recentHours: number,
    platformBalance: boolean
  ): Promise<ContentItem[]> {
    const whereConditions = ["cq.content_status = 'approved'"]
    const queryParams: any[] = []

    // Quality threshold
    if (qualityThreshold > 0) {
      whereConditions.push(`(ca.confidence_score IS NULL OR ca.confidence_score >= $${queryParams.length + 1})`)
      queryParams.push(qualityThreshold)
    }

    // Avoid recent duplicates
    if (avoidRecentDuplicates) {
      const recentCutoff = new Date(Date.now() - recentHours * 60 * 60 * 1000)
      whereConditions.push(`
        NOT EXISTS (
          SELECT 1 FROM content_queue recent 
          WHERE recent.content_status = 'posted' 
            AND recent.posted_at >= $${queryParams.length + 1}
            AND (
              recent.content_hash = cq.content_hash 
              OR recent.original_url = cq.original_url
            )
        )
      `)
      queryParams.push(recentCutoff.toISOString())
    }

    const whereClause = whereConditions.join(' AND ')

    if (platformBalance) {
      // Get balanced selection across platforms
      return await this.getBalancedPlatformContent(maxItems, whereClause, queryParams)
    } else {
      // Visual-content-priority selection with platform variety
      const query = `
        WITH ranked_content AS (
          SELECT 
            cq.*,
            ca.confidence_score,
            -- Priority scoring: Visual content first, then variety, then quality
            CASE 
              WHEN cq.content_type = 'video' THEN 4
              WHEN cq.content_type = 'image' THEN 3
              WHEN cq.content_type = 'mixed' THEN 2
              ELSE 1
            END as type_priority,
            -- Platform variety scoring - deprioritize recently posted platforms
            (
              SELECT COUNT(*) 
              FROM content_queue recent 
              WHERE recent.source_platform = cq.source_platform 
              AND recent.is_posted = true
              AND recent.posted_at > NOW() - INTERVAL '24 hours'
            ) as recent_platform_posts
          FROM content_queue cq
          LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
          WHERE ${whereClause}
        )
        SELECT *
        FROM ranked_content
        ORDER BY 
          type_priority DESC,                    -- Visual content first
          recent_platform_posts ASC,            -- Platform variety
          confidence_score DESC NULLS LAST,     -- Quality
          RANDOM()                              -- Final randomization
        LIMIT $${queryParams.length + 1}
      `
      
      queryParams.push(maxItems)
      const result = await db.query<ContentItem>(query, queryParams)
      return result.rows
    }
  }

  /**
   * Get content with balanced platform representation
   */
  private async getBalancedPlatformContent(
    maxItems: number,
    whereClause: string,
    baseParams: any[]
  ): Promise<ContentItem[]> {
    const selectedContent: ContentItem[] = []

    for (const [platform, weight] of Object.entries(AutomatedPostingService.PLATFORM_WEIGHTS)) {
      const platformLimit = Math.max(1, Math.floor(maxItems * weight))
      
      if (selectedContent.length >= maxItems) break

      const query = `
        SELECT cq.*
        FROM content_queue cq
        LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
        WHERE ${whereClause}
          AND cq.source_platform = $${baseParams.length + 1}
          AND cq.id NOT IN (${selectedContent.map(c => c.id).join(',') || '0'})
        ORDER BY 
          CASE 
            WHEN cq.content_type = 'video' THEN 4
            WHEN cq.content_type = 'image' THEN 3
            WHEN cq.content_type = 'mixed' THEN 2
            ELSE 1
          END DESC,                           -- Visual content first
          ca.confidence_score DESC NULLS LAST,  -- Quality
          RANDOM()                            -- Randomization
        LIMIT $${baseParams.length + 2}
      `

      const params = [...baseParams, platform, platformLimit]
      const result = await db.query<ContentItem>(query, params)
      selectedContent.push(...result.rows)
    }

    return selectedContent.slice(0, maxItems)
  }

  /**
   * Post content and update status
   */
  async postContent(content: ContentItem): Promise<PostingResult> {
    const postingResult: PostingResult = {
      success: false,
      contentId: content.id,
      platform: content.source_platform,
      contentType: content.content_type
    }

    try {
      // Simulate posting to the public site
      // In a real implementation, this would create the actual post
      await this.createPublicPost(content)

      // Update content status to posted
      const updateResult = await db.query(
        `UPDATE content_queue 
         SET content_status = 'posted', 
             is_posted = true,
             posted_at = NOW(), 
             updated_at = NOW()
         WHERE id = $1
         RETURNING posted_at`,
        [content.id]
      )

      if (updateResult.rows.length > 0) {
        postingResult.success = true
        postingResult.postedAt = new Date(updateResult.rows[0].posted_at)

        await logToDatabase(
          LogLevel.INFO,
          `Content posted successfully: ${content.content_type} from ${content.source_platform}`,
          'AutomatedPosting',
          { 
            contentId: content.id,
            platform: content.source_platform,
            contentType: content.content_type,
            originalAuthor: content.original_author
          }
        )
      } else {
        throw new Error('Failed to update content status')
      }

    } catch (error) {
      postingResult.error = error.message

      await logToDatabase(
        LogLevel.ERROR,
        `Failed to post content: ${error.message}`,
        'AutomatedPosting',
        { 
          contentId: content.id,
          platform: content.source_platform,
          error: error.message
        }
      )
    }

    return postingResult
  }

  /**
   * Create the actual public post (placeholder for real implementation)
   */
  private async createPublicPost(content: ContentItem): Promise<void> {
    // This would integrate with your public site's posting system
    // For now, we'll just create a record in a posts table
    
    try {
      await db.query(
        `INSERT INTO posts (
          content_queue_id, 
          title, 
          content, 
          image_url, 
          video_url,
          content_type,
          source_platform,
          original_url,
          original_author,
          posted_at,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (content_queue_id) DO NOTHING`,
        [
          content.id,
          this.generatePostTitle(content),
          content.content_text,
          content.content_image_url,
          content.content_video_url,
          content.content_type,
          content.source_platform,
          content.original_url,
          content.original_author
        ]
      )
    } catch (error) {
      // If posts table doesn't exist, log but don't fail
      await logToDatabase(
        LogLevel.WARNING,
        'Posts table not found, content marked as posted but not published',
        'AutomatedPosting',
        { contentId: content.id, error: error.message }
      )
    }
  }

  /**
   * Generate appropriate title for different content types
   */
  private generatePostTitle(content: ContentItem): string {
    const platform = content.source_platform.charAt(0).toUpperCase() + content.source_platform.slice(1)
    
    switch (content.content_type) {
      case 'image':
        return `Hot Dog Photo from ${platform}`
      case 'video':
        return `Hot Dog Video from ${platform}`
      case 'text':
        return `Hot Dog Discussion from ${platform}`
      case 'mixed':
        return `Hot Dog Content from ${platform}`
      default:
        return `Hot Dog Content from ${platform}`
    }
  }

  /**
   * Check if current time matches a meal time
   */
  getCurrentMealTime(): { hour: number; minute: number; name: string } | null {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Allow 5-minute window around meal times
    for (const mealTime of AutomatedPostingService.MEAL_TIMES) {
      const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (mealTime.hour * 60 + mealTime.minute))
      if (timeDiff <= 5) {
        return mealTime
      }
    }

    return null
  }

  /**
   * Get next meal time for scheduling
   */
  getNextMealTime(): Date {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    
    // Find the next meal time
    for (const mealTime of AutomatedPostingService.MEAL_TIMES) {
      if (currentHour < mealTime.hour || 
          (currentHour === mealTime.hour && currentMinute < mealTime.minute)) {
        const nextMeal = new Date(now)
        nextMeal.setHours(mealTime.hour, mealTime.minute, 0, 0)
        return nextMeal
      }
    }
    
    // If no meal time today, schedule for first meal time tomorrow
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(AutomatedPostingService.MEAL_TIMES[0].hour, AutomatedPostingService.MEAL_TIMES[0].minute, 0, 0)
    return tomorrow
  }

  /**
   * Get posting statistics
   */
  async getPostingStats(): Promise<{
    todayPosts: number
    weekPosts: number
    successRate: number
    nextPostTime: Date
    queueHealth: {
      scheduled: number
      approved: number
      total: number
    }
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const week = new Date(today)
    week.setDate(week.getDate() - 7)

    // Get posting counts
    const postingQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE posted_at >= $1) as today_posts,
        COUNT(*) FILTER (WHERE posted_at >= $2) as week_posts,
        COUNT(*) as total_posts
      FROM content_queue
      WHERE content_status = 'posted'
    `
    const postingResult = await db.query(postingQuery, [today.toISOString(), week.toISOString()])
    const postingData = postingResult.rows[0]

    // Get queue health
    const queueQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE content_status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE content_status = 'approved') as approved,
        COUNT(*) as total
      FROM content_queue
      WHERE content_status IN ('scheduled', 'approved')
    `
    const queueResult = await db.query(queueQuery)
    const queueData = queueResult.rows[0]

    return {
      todayPosts: parseInt(postingData.today_posts) || 0,
      weekPosts: parseInt(postingData.week_posts) || 0,
      successRate: 95, // Placeholder - would calculate from actual success/failure data
      nextPostTime: this.getNextMealTime(),
      queueHealth: {
        scheduled: parseInt(queueData.scheduled) || 0,
        approved: parseInt(queueData.approved) || 0,
        total: parseInt(queueData.total) || 0
      }
    }
  }
}

export const automatedPostingService = new AutomatedPostingService()