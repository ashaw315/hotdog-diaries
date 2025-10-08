/**
 * Enhanced Posting Service
 * Handles both manual and scheduled content posting with platform diversity
 */

import { db } from '../db'
import { ContentItem, ScheduledContentItem, ContentStatus } from '../../types'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export interface PostingResult {
  success: boolean
  contentId?: number
  contentText?: string
  platform?: string
  postedAt?: string
  timeSlot?: string
  error?: string
  postOrder?: number
}

export interface BatchPostingResult {
  posted: PostingResult[]
  errors: string[]
  summary: {
    totalPosted: number
    platformDistribution: Record<string, number>
  }
}

/**
 * Get the next available approved content for posting
 * Prioritizes scheduled content that's due, then falls back to general approved content
 */
async function getNextContentToPost(): Promise<ContentItem | null> {
  try {
    // First, check for scheduled content that's due
    const scheduledResult = await db.query(`
      SELECT * FROM content_queue
      WHERE status = 'scheduled' 
        AND scheduled_for <= datetime('now')
        AND is_posted = FALSE
      ORDER BY scheduled_for ASC, priority DESC
      LIMIT 1
    `)

    if (scheduledResult.rows && scheduledResult.rows.length > 0) {
      console.log('📅 Found scheduled content due for posting')
      return scheduledResult.rows[0] as ContentItem
    }

    // Fallback to any approved content (for manual posting)
    const approvedResult = await db.query(`
      SELECT * FROM content_queue
      WHERE is_approved = TRUE 
        AND is_posted = FALSE 
        AND status = 'approved'
      ORDER BY confidence_score DESC, created_at ASC
      LIMIT 1
    `)

    if (approvedResult.rows && approvedResult.rows.length > 0) {
      console.log('📝 Found approved content for manual posting')
      return approvedResult.rows[0] as ContentItem
    }

    return null
  } catch (error) {
    console.error('Error fetching next content to post:', error)
    return null
  }
}

/**
 * Get multiple scheduled content items that are due for posting
 */
async function getScheduledContentDue(limit: number = 6): Promise<ScheduledContentItem[]> {
  try {
    const result = await db.query(`
      SELECT * FROM content_queue
      WHERE status = 'scheduled' 
        AND scheduled_for <= datetime('now')
        AND is_posted = FALSE
      ORDER BY scheduled_for ASC, priority DESC
      LIMIT ?
    `, [limit])

    return result.rows.map(row => ({
      ...row,
      status: row.status as ContentStatus
    })) as ScheduledContentItem[]
  } catch (error) {
    console.error('Error fetching scheduled content due:', error)
    return []
  }
}

/**
 * Get the next available post order number
 */
async function getNextPostOrder(): Promise<number> {
  try {
    const result = await db.query(`
      SELECT COALESCE(MAX(post_order), 0) + 1 as next_order
      FROM posted_content
    `)
    return result.rows[0]?.next_order || 1
  } catch (error) {
    console.error('Error getting next post order:', error)
    return Date.now() // Fallback to timestamp
  }
}

/**
 * Post a single piece of content
 */
export async function postContent(
  content: ContentItem,
  isScheduled: boolean = false
): Promise<PostingResult> {
  const result: PostingResult = { success: false }

  try {
    const now = new Date()
    const timeSlot = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const postOrder = await getNextPostOrder()

    // Mark content as posted
    await db.query(`
      UPDATE content_queue 
      SET is_posted = ?, posted_at = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [1, now.toISOString(), ContentStatus.POSTED, content.id])

    // Record in posted_content table
    await db.query(`
      INSERT INTO posted_content (content_queue_id, posted_at, post_order, scheduled_time)
      VALUES (?, ?, ?, ?)
    `, [
      content.id, 
      now.toISOString(), 
      postOrder,
      isScheduled ? content.scheduled_for : null
    ])

    // Log the posting action
    await db.query(`
      INSERT INTO system_logs (log_level, message, component, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'info',
      `Content posted: ${content.content_text?.substring(0, 50)}...`,
      'posting-service',
      JSON.stringify({
        contentId: content.id,
        platform: content.source_platform,
        isScheduled,
        timeSlot,
        postOrder,
        scheduledFor: content.scheduled_for || null
      }),
      now.toISOString()
    ])

    result.success = true
    result.contentId = content.id
    result.contentText = content.content_text?.substring(0, 100) + (content.content_text && content.content_text.length > 100 ? '...' : '')
    result.platform = content.source_platform
    result.postedAt = now.toISOString()
    result.timeSlot = timeSlot
    result.postOrder = postOrder

    console.log(`✅ Posted content ${content.id} from ${content.source_platform} (${isScheduled ? 'scheduled' : 'manual'})`)

  } catch (error) {
    result.error = `Failed to post content ${content.id}: ${error.message}`
    console.error(result.error)

    // Log the error
    try {
      await db.query(`
        INSERT INTO system_logs (log_level, message, component, metadata, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'error',
        `Failed to post content: ${error.message}`,
        'posting-service',
        JSON.stringify({
          contentId: content.id,
          platform: content.source_platform,
          error: error.message,
          isScheduled
        }),
        new Date().toISOString()
      ])
    } catch (logError) {
      console.error('Failed to log posting error:', logError)
    }
  }

  return result
}

/**
 * Post the next available content (scheduled or approved)
 */
export async function postNextContent(): Promise<PostingResult> {
  try {
    await db.connect()

    const content = await getNextContentToPost()
    if (!content) {
      return {
        success: false,
        error: 'No approved content available to post'
      }
    }

    const isScheduled = content.status === ContentStatus.SCHEDULED
    return await postContent(content, isScheduled)

  } catch (error) {
    return {
      success: false,
      error: `Failed to post next content: ${error.message}`
    }
  } finally {
    await db.disconnect()
  }
}

/**
 * Post all scheduled content that is due
 */
export async function postScheduledContentDue(): Promise<BatchPostingResult> {
  const result: BatchPostingResult = {
    posted: [],
    errors: [],
    summary: {
      totalPosted: 0,
      platformDistribution: {}
    }
  }

  try {
    await db.connect()

    console.log('🕒 Checking for scheduled content due for posting...')
    
    const scheduledContent = await getScheduledContentDue(10) // Get up to 10 items
    
    if (scheduledContent.length === 0) {
      console.log('📭 No scheduled content due for posting')
      return result
    }

    console.log(`📋 Found ${scheduledContent.length} scheduled content items due for posting`)

    // Post each scheduled item
    for (const content of scheduledContent) {
      try {
        const postResult = await postContent(content, true)
        result.posted.push(postResult)

        if (postResult.success) {
          result.summary.totalPosted++
          const platform = postResult.platform!
          result.summary.platformDistribution[platform] = 
            (result.summary.platformDistribution[platform] || 0) + 1
        } else {
          result.errors.push(postResult.error || `Failed to post content ${content.id}`)
        }
      } catch (error) {
        const errorMsg = `Failed to post scheduled content ${content.id}: ${error.message}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    console.log(`✅ Posted ${result.summary.totalPosted} scheduled content items`)
    if (result.errors.length > 0) {
      console.log(`⚠️ ${result.errors.length} errors occurred`)
    }

  } catch (error) {
    result.errors.push(`Failed to process scheduled content: ${error.message}`)
    console.error('Error in postScheduledContentDue:', error)
  } finally {
    await db.disconnect()
  }

  return result
}

/**
 * Mark failed scheduled content for retry or manual review
 */
export async function markScheduledContentFailed(
  contentId: number, 
  error: string
): Promise<boolean> {
  try {
    await db.connect()

    await db.query(`
      UPDATE content_queue 
      SET status = ?, admin_notes = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'scheduled'
    `, [ContentStatus.FAILED, `Auto-posting failed: ${error}`, contentId])

    console.log(`❌ Marked content ${contentId} as failed`)
    return true
  } catch (dbError) {
    console.error(`Failed to mark content ${contentId} as failed:`, dbError)
    return false
  } finally {
    await db.disconnect()
  }
}

/**
 * Get posting statistics for monitoring
 */
export async function getPostingStats(days: number = 7): Promise<{
  totalPosted: number
  scheduledPosted: number
  manualPosted: number
  platformDistribution: Record<string, number>
  dailyBreakdown: Array<{
    date: string
    count: number
    scheduled: number
    manual: number
  }>
}> {
  try {
    await db.connect()

    const cutoffDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD')

    // Get overall stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_posted,
        COUNT(CASE WHEN pc.scheduled_time IS NOT NULL THEN 1 END) as scheduled_posted,
        COUNT(CASE WHEN pc.scheduled_time IS NULL THEN 1 END) as manual_posted
      FROM posted_content pc
      WHERE DATE(pc.posted_at) >= ?
    `, [cutoffDate])

    // Get platform distribution
    const platformResult = await db.query(`
      SELECT 
        cq.source_platform,
        COUNT(*) as count
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      WHERE DATE(pc.posted_at) >= ?
      GROUP BY cq.source_platform
      ORDER BY count DESC
    `, [cutoffDate])

    // Get daily breakdown
    const dailyResult = await db.query(`
      SELECT 
        DATE(pc.posted_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN pc.scheduled_time IS NOT NULL THEN 1 END) as scheduled,
        COUNT(CASE WHEN pc.scheduled_time IS NULL THEN 1 END) as manual
      FROM posted_content pc
      WHERE DATE(pc.posted_at) >= ?
      GROUP BY DATE(pc.posted_at)
      ORDER BY date DESC
    `, [cutoffDate])

    const stats = statsResult.rows[0] || { total_posted: 0, scheduled_posted: 0, manual_posted: 0 }
    
    const platformDistribution = platformResult.rows.reduce((acc, row) => {
      acc[row.source_platform] = row.count
      return acc
    }, {} as Record<string, number>)

    return {
      totalPosted: stats.total_posted,
      scheduledPosted: stats.scheduled_posted,
      manualPosted: stats.manual_posted,
      platformDistribution,
      dailyBreakdown: dailyResult.rows
    }

  } catch (error) {
    console.error('Error fetching posting stats:', error)
    return {
      totalPosted: 0,
      scheduledPosted: 0,
      manualPosted: 0,
      platformDistribution: {},
      dailyBreakdown: []
    }
  } finally {
    await db.disconnect()
  }
}