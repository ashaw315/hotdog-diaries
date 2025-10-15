/**
 * Content Posting Job - Follows scheduled_posts for Diversity Enforcement
 * Priority: scheduled_posts → fallback to refill → skip if no content
 */

import { db } from '../db'
import { createSimpleClient } from '@/utils/supabase/server'
import { getEasternSlotIndexForNow, getEasternWindowForSlot, getEasternDateString } from '../utils/time-helpers'

interface PlannedPost {
  slotIndex: number
  contentId: string
  platform?: string
  title?: string
  scheduledPostId?: string
}

interface ContentItem {
  id: number
  content_text: string
  source_platform: string
  content_type: string
  original_author?: string
  content_image_url?: string
  content_video_url?: string
}

/**
 * Get database client with environment detection
 */
async function getDbClient() {
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
  
  if (isSqlite) {
    await db.connect()
    return { db, type: 'sqlite' as const }
  } else {
    const supabase = createSimpleClient()
    return { db: supabase, type: 'supabase' as const }
  }
}

/**
 * Find scheduled post for current time slot
 */
async function findScheduledPostForSlot(dayStr: string, slotIndex: number): Promise<PlannedPost | null> {
  const { db: dbClient, type } = await getDbClient()
  
  try {
    if (type === 'sqlite') {
      const result = await db.query(`
        SELECT id, content_id, platform, title, scheduled_post_time
        FROM scheduled_posts 
        WHERE DATE(scheduled_post_time) = ? AND scheduled_slot_index = ?
        AND content_id IS NOT NULL
        LIMIT 1
      `, [dayStr, slotIndex])
      
      const row = result.rows[0]
      if (!row) return null
      
      return {
        slotIndex,
        contentId: String(row.content_id),
        platform: row.platform,
        title: row.title,
        scheduledPostId: String(row.id)
      }
    } else {
      // Supabase - try scheduled_day first, fallback to time range
      let data = null
      
      try {
        const { data: dayData, error } = await dbClient
          .from('scheduled_posts')
          .select('id, content_id, platform, title, scheduled_post_time')
          .eq('scheduled_day', dayStr)
          .eq('scheduled_slot_index', slotIndex)
          .not('content_id', 'is', null)
          .maybeSingle()
        
        if (!error) data = dayData
      } catch (e: any) {
        // Fallback to time range if scheduled_day column missing
        const { startUtc, endUtc } = getEasternWindowForSlot(slotIndex, dayStr)
        const { data: timeData } = await dbClient
          .from('scheduled_posts')
          .select('id, content_id, platform, title, scheduled_post_time')
          .gte('scheduled_post_time', startUtc)
          .lte('scheduled_post_time', endUtc)
          .eq('scheduled_slot_index', slotIndex)
          .not('content_id', 'is', null)
          .maybeSingle()
        
        data = timeData
      }
      
      if (!data) return null
      
      return {
        slotIndex,
        contentId: String(data.content_id),
        platform: data.platform,
        title: data.title,
        scheduledPostId: String(data.id)
      }
    }
  } catch (error) {
    console.error('Error finding scheduled post:', error)
    return null
  } finally {
    if (type === 'sqlite') {
      await db.disconnect()
    }
  }
}

/**
 * Get content details from content_queue
 */
async function getContentDetails(contentId: string): Promise<ContentItem | null> {
  const { db: dbClient, type } = await getDbClient()
  
  try {
    if (type === 'sqlite') {
      const result = await db.query(`
        SELECT id, content_text, source_platform, content_type, original_author,
               content_image_url, content_video_url
        FROM content_queue 
        WHERE id = ?
      `, [contentId])
      
      return result.rows[0] || null
    } else {
      const { data, error } = await dbClient
        .from('content_queue')
        .select('id, content_text, source_platform, content_type, original_author, content_image_url, content_video_url')
        .eq('id', contentId)
        .maybeSingle()
      
      return error ? null : data
    }
  } catch (error) {
    console.error('Error getting content details:', error)
    return null
  } finally {
    if (type === 'sqlite') {
      await db.disconnect()
    }
  }
}

/**
 * Mark scheduled post as actually posted
 */
async function markScheduledPostAsPosted(scheduledPostId: string): Promise<void> {
  const { db: dbClient, type } = await getDbClient()
  
  try {
    const now = new Date().toISOString()
    
    if (type === 'sqlite') {
      await db.query(`
        UPDATE scheduled_posts 
        SET actual_posted_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [now, scheduledPostId])
    } else {
      await dbClient
        .from('scheduled_posts')
        .update({ 
          actual_posted_at: now,
          updated_at: now
        })
        .eq('id', scheduledPostId)
    }
    
    console.log(`✅ Marked scheduled post ${scheduledPostId} as posted`)
  } catch (error) {
    console.error('Error marking post as posted:', error)
  } finally {
    if (type === 'sqlite') {
      await db.disconnect()
    }
  }
}

/**
 * Trigger refill for specific date if slot is empty
 */
async function safeCallRefill(dateStr: string): Promise<boolean> {
  try {
    console.log(`🔧 Triggering refill for ${dateStr}`)
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    
    const response = await fetch(`${baseUrl}/api/admin/schedule/forecast/refill?date=${dateStr}`, {
      method: 'POST',
      headers: {
        'x-admin-token': process.env.AUTH_TOKEN || '',
        'Content-Type': 'application/json',
      }
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log(`✅ Refill successful: filled ${result.filled || 0} slots`)
      return true
    } else {
      console.warn(`⚠️ Refill failed with status ${response.status}`)
      return false
    }
  } catch (error) {
    console.error('❌ Refill call failed:', error)
    return false
  }
}

/**
 * Get planned post for current time slot with auto-refill fallback
 */
export async function getPlannedPostForNow(): Promise<PlannedPost | null> {
  const slotIndex = getEasternSlotIndexForNow()
  const dayStr = getEasternDateString()
  
  console.log(`🕐 Checking for planned post: ${dayStr} slot ${slotIndex} (${['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'][slotIndex]} ET)`)
  
  // Try to find existing scheduled post
  let planned = await findScheduledPostForSlot(dayStr, slotIndex)
  
  if (planned) {
    console.log(`✅ Found planned post: content_id ${planned.contentId} from ${planned.platform}`)
    return planned
  }
  
  // If no scheduled post, try refill once
  console.log(`📅 No scheduled post found for slot ${slotIndex}, attempting refill...`)
  const refillSuccess = await safeCallRefill(dayStr)
  
  if (refillSuccess) {
    // Retry finding scheduled post after refill
    planned = await findScheduledPostForSlot(dayStr, slotIndex)
    
    if (planned) {
      console.log(`✅ Found post after refill: content_id ${planned.contentId} from ${planned.platform}`)
      return planned
    }
  }
  
  console.warn(`⚠️ No content available for ${dayStr} slot ${slotIndex} even after refill attempt`)
  return null
}

/**
 * Main posting function - enforces scheduled_posts diversity
 */
export async function postScheduledContent(): Promise<{
  success: boolean
  posted?: {
    contentId: string
    platform: string
    title: string
    slotIndex: number
  }
  error?: string
}> {
  try {
    console.log('🚀 Starting scheduled content posting job...')
    
    // Get planned content for current slot
    const planned = await getPlannedPostForNow()
    
    if (!planned) {
      return {
        success: false,
        error: 'No scheduled content available for current time slot'
      }
    }
    
    // Get full content details
    const content = await getContentDetails(planned.contentId)
    
    if (!content) {
      return {
        success: false,
        error: `Content not found in queue: ${planned.contentId}`
      }
    }
    
    console.log(`📝 Posting content: "${content.content_text?.substring(0, 50)}..." from ${content.source_platform}`)
    
    // TODO: Replace with actual platform posting logic
    // For now, we'll simulate the post
    const postResult = await simulatePost(content)
    
    if (postResult.success) {
      // Mark as posted in scheduled_posts
      if (planned.scheduledPostId) {
        await markScheduledPostAsPosted(planned.scheduledPostId)
      }
      
      // TODO: Record in posted_content table
      // await recordInPostedContent(content.id, postResult.postedAt)
      
      return {
        success: true,
        posted: {
          contentId: planned.contentId,
          platform: content.source_platform,
          title: content.content_text || 'Untitled',
          slotIndex: planned.slotIndex
        }
      }
    } else {
      return {
        success: false,
        error: postResult.error || 'Platform posting failed'
      }
    }
    
  } catch (error) {
    console.error('❌ Posting job failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Simulate posting to platform (replace with real implementation)
 */
async function simulatePost(content: ContentItem): Promise<{ success: boolean; error?: string; postedAt?: string }> {
  console.log(`🎯 [SIMULATION] Posting to ${content.source_platform}: ${content.content_text?.substring(0, 100)}...`)
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Simulate 95% success rate
  if (Math.random() > 0.05) {
    return {
      success: true,
      postedAt: new Date().toISOString()
    }
  } else {
    return {
      success: false,
      error: 'Simulated platform error'
    }
  }
}

/**
 * Entry point for GitHub Actions or cron jobs
 */
export async function runPostingJob(): Promise<void> {
  console.log('📢 Content Posting Job Started')
  console.log(`⏰ Current time: ${new Date().toISOString()}`)
  
  const result = await postScheduledContent()
  
  if (result.success && result.posted) {
    console.log(`✅ Successfully posted content from ${result.posted.platform} (slot ${result.posted.slotIndex})`)
    console.log(`📄 Title: ${result.posted.title}`)
  } else {
    console.error(`❌ Posting failed: ${result.error}`)
    process.exit(1) // Signal failure to GitHub Actions
  }
  
  console.log('📢 Content Posting Job Completed')
}