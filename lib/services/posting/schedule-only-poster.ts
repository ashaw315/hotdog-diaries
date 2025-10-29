/**
 * Schedule-Only Posting Service
 * 
 * Enforces single source of truth: ONLY posts content from scheduled_posts table.
 * Implements atomic claiming with row locking to prevent concurrent posting.
 */

import { db } from '../../db'
import { formatISO, addMinutes, subMinutes } from 'date-fns'

export interface ScheduledSlot {
  id: number
  content_id: number | null
  platform: string
  content_type: string
  source?: string
  title?: string
  scheduled_post_time: string
  scheduled_slot_index: number
  actual_posted_at: string | null
  reasoning?: string
  status: 'pending' | 'posting' | 'posted' | 'failed'
  created_at: string
  updated_at: string
}

export interface PostingResult {
  success: boolean
  type: 'POSTED' | 'NO_SCHEDULED_CONTENT' | 'EMPTY_SCHEDULE_SLOT' | 'ERROR'
  scheduledSlotId?: number
  contentId?: number
  platform?: string
  postedAt?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface PostingConfig {
  graceMinutes: number
  enforceScheduleSourceOfTruth: boolean
}

const DEFAULT_CONFIG: PostingConfig = {
  graceMinutes: 5,
  enforceScheduleSourceOfTruth: process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH !== 'false'
}

/**
 * Get slots ready for posting within the time window
 */
async function getSlotsInTimeWindow(config: PostingConfig): Promise<ScheduledSlot[]> {
  const now = new Date()
  const windowStart = subMinutes(now, config.graceMinutes)
  const windowEnd = addMinutes(now, config.graceMinutes)

  // Detect environment: Supabase vs SQLite
  const isSupabase = !!process.env.SUPABASE_URL && process.env.NODE_ENV === 'production'

  if (isSupabase) {
    // Supabase path - use createSimpleClient
    const { createSimpleClient } = await import('@/utils/supabase/server')
    const supabase = createSimpleClient()

    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('id, content_id, platform, content_type, source, title, scheduled_post_time, scheduled_slot_index, actual_posted_at, reasoning, status, created_at, updated_at')
      .eq('status', 'pending')
      .gte('scheduled_post_time', formatISO(windowStart))
      .lte('scheduled_post_time', formatISO(windowEnd))
      .order('scheduled_post_time', { ascending: true })

    if (error) {
      console.error('❌ Error fetching slots from Supabase:', error)
      throw error
    }

    return (data || []) as ScheduledSlot[]
  } else {
    // SQLite path - use db.query
    const query = `
      SELECT
        id, content_id, platform, content_type, source, title,
        scheduled_post_time, scheduled_slot_index, actual_posted_at,
        reasoning, status, created_at, updated_at
      FROM scheduled_posts
      WHERE status = 'pending'
        AND scheduled_post_time >= ?
        AND scheduled_post_time <= ?
      ORDER BY scheduled_post_time ASC
    `

    const result = await db.query(query, [
      formatISO(windowStart),
      formatISO(windowEnd)
    ])

    return result.rows as ScheduledSlot[]
  }
}

/**
 * Atomically claim a scheduled slot for posting
 * Uses database-specific locking strategies
 */
async function claimSlotForPosting(slotId: number): Promise<boolean> {
  const isSupabase = !!process.env.SUPABASE_URL && process.env.NODE_ENV === 'production'

  if (isSupabase) {
    // Supabase: Use optimistic locking with status check
    try {
      const { createSimpleClient } = await import('@/utils/supabase/server')
      const supabase = createSimpleClient()

      // Try to update the slot from pending to posting
      // If another process already claimed it, this will return 0 rows updated
      const { data, error } = await supabase
        .from('scheduled_posts')
        .update({
          status: 'posting',
          updated_at: new Date().toISOString()
        })
        .eq('id', slotId)
        .eq('status', 'pending')  // Only update if still pending
        .select()

      if (error) {
        console.error('❌ Error claiming slot:', error)
        return false
      }

      // If no rows were updated, another process claimed it first
      return (data && data.length > 0)
    } catch (error) {
      console.error('Supabase claim error:', error)
      return false
    }
  } else {
    // SQLite: Use transaction with rowcount verification
    try {
      const updateResult = await db.query(`
        UPDATE scheduled_posts 
        SET status = 'posting', updated_at = datetime('now')
        WHERE id = ? AND status = 'pending'
      `, [slotId])
      
      return updateResult.rowCount === 1
    } catch (error) {
      console.error('SQLite claim error:', error)
      return false
    }
  }
}

/**
 * Get content details for a scheduled slot
 */
async function getContentForSlot(contentId: number): Promise<any> {
  const isSupabase = !!process.env.SUPABASE_URL && process.env.NODE_ENV === 'production'

  if (isSupabase) {
    const { createSimpleClient } = await import('@/utils/supabase/server')
    const supabase = createSimpleClient()

    const { data, error } = await supabase
      .from('content_queue')
      .select('id, content_text, content_type, source_platform, content_image_url, content_video_url, original_url, original_author, confidence_score')
      .eq('id', contentId)
      .single()

    if (error) {
      console.error('❌ Error fetching content:', error)
      return null
    }

    return data
  } else {
    const query = `
      SELECT
        id, content_text, content_type, source_platform,
        content_image_url, content_video_url, original_url,
        original_author, confidence_score
      FROM content_queue
      WHERE id = ?
    `

    const result = await db.query(query, [contentId])
    return result.rows[0] || null
  }
}

/**
 * Record successful posting in posted_content and update scheduled_posts
 */
async function recordSuccessfulPost(slot: ScheduledSlot, contentId: number): Promise<void> {
  const now = new Date()
  const postedAt = formatISO(now)

  const isSupabase = !!process.env.SUPABASE_URL && process.env.NODE_ENV === 'production'

  if (isSupabase) {
    // Supabase path
    const { createSimpleClient } = await import('@/utils/supabase/server')
    const supabase = createSimpleClient()

    // Insert into posted_content
    const { error: insertError } = await supabase
      .from('posted_content')
      .insert({
        content_queue_id: contentId,
        scheduled_post_id: slot.id,
        platform: slot.platform,
        posted_at: postedAt,
        post_order: Date.now()
      })

    if (insertError) {
      console.error('❌ Error inserting into posted_content:', insertError)
      throw insertError
    }

    // Update scheduled_posts
    const { error: updateError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'posted',
        actual_posted_at: postedAt,
        updated_at: postedAt
      })
      .eq('id', slot.id)

    if (updateError) {
      console.error('❌ Error updating scheduled_posts:', updateError)
      throw updateError
    }
  } else {
    // SQLite transaction (basic)
    await db.query(`
      INSERT INTO posted_content
      (content_queue_id, scheduled_post_id, platform, posted_at, post_order)
      VALUES (?, ?, ?, ?, ?)
    `, [contentId, slot.id, slot.platform, postedAt, Date.now()])

    await db.query(`
      UPDATE scheduled_posts
      SET status = 'posted', actual_posted_at = ?, updated_at = ?
      WHERE id = ?
    `, [postedAt, postedAt, slot.id])
  }
}

/**
 * Revert slot status on posting failure
 */
async function revertSlotToPending(slotId: number, error: string): Promise<void> {
  const isSupabase = !!process.env.SUPABASE_URL && process.env.NODE_ENV === 'production'

  if (isSupabase) {
    const { createSimpleClient } = await import('@/utils/supabase/server')
    const supabase = createSimpleClient()

    const { error: updateError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'pending',
        reasoning: `Posting failed: ${error}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', slotId)

    if (updateError) {
      console.error('❌ Error reverting slot to pending:', updateError)
    }
  } else {
    await db.query(`
      UPDATE scheduled_posts
      SET status = 'pending', reasoning = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [`Posting failed: ${error}`, slotId])
  }
}

/**
 * Simulate platform-specific posting (placeholder)
 */
async function postToPlatform(content: any, platform: string): Promise<void> {
  // In a real implementation, this would call platform-specific APIs
  console.log(`🚀 Posting to ${platform}: ${content.content_text?.substring(0, 50)}...`)
  
  // Simulate posting delay and potential failure
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Simulate 5% failure rate for testing
  if (Math.random() < 0.05) {
    throw new Error(`Simulated ${platform} API error`)
  }
}

/**
 * Main posting function that enforces scheduled_posts as source of truth
 */
export async function postFromSchedule(config: Partial<PostingConfig> = {}): Promise<PostingResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Feature flag check
  if (!finalConfig.enforceScheduleSourceOfTruth) {
    console.log('⚠️ ENFORCE_SCHEDULE_SOURCE_OF_TRUTH is disabled')
    return {
      success: false,
      type: 'ERROR',
      error: 'Schedule source of truth enforcement is disabled'
    }
  }

  try {
    await db.connect()
    
    // 1. Get slots in time window
    const slots = await getSlotsInTimeWindow(finalConfig)
    
    if (slots.length === 0) {
      console.log('📭 NO_SCHEDULED_CONTENT: No slots in time window')
      return {
        success: true,
        type: 'NO_SCHEDULED_CONTENT'
      }
    }
    
    // 2. Try to claim the first available slot
    for (const slot of slots) {
      // Check if slot has content assigned
      if (!slot.content_id) {
        console.log(`⚪ EMPTY_SCHEDULE_SLOT: Slot ${slot.id} has no content_id`)
        return {
          success: true,
          type: 'EMPTY_SCHEDULE_SLOT',
          scheduledSlotId: slot.id,
          platform: slot.platform
        }
      }
      
      // Try to claim the slot atomically
      const claimed = await claimSlotForPosting(slot.id)
      if (!claimed) {
        console.log(`🔒 Slot ${slot.id} already claimed, trying next...`)
        continue
      }
      
      try {
        // 3. Get content details
        const content = await getContentForSlot(slot.content_id)
        if (!content) {
          throw new Error(`Content ${slot.content_id} not found in content_queue`)
        }
        
        // 4. Post to platform
        await postToPlatform(content, slot.platform)
        
        // 5. Record successful posting
        await recordSuccessfulPost(slot, slot.content_id)
        
        console.log(`✅ Successfully posted slot ${slot.id} (content ${slot.content_id}) to ${slot.platform}`)
        
        return {
          success: true,
          type: 'POSTED',
          scheduledSlotId: slot.id,
          contentId: slot.content_id,
          platform: slot.platform,
          postedAt: formatISO(new Date()),
          metadata: {
            scheduledFor: slot.scheduled_post_time,
            slotIndex: slot.scheduled_slot_index,
            contentPreview: content.content_text?.substring(0, 100)
          }
        }
        
      } catch (postingError) {
        // Revert slot status on failure
        const errorMessage = postingError instanceof Error ? postingError.message : 'Unknown error'
        await revertSlotToPending(slot.id, errorMessage)
        
        console.error(`❌ Failed to post slot ${slot.id}:`, errorMessage)
        
        return {
          success: false,
          type: 'ERROR',
          scheduledSlotId: slot.id,
          contentId: slot.content_id,
          platform: slot.platform,
          error: errorMessage
        }
      }
    }
    
    // If we get here, all slots were already claimed
    console.log('🔒 All available slots already claimed by other processes')
    return {
      success: true,
      type: 'NO_SCHEDULED_CONTENT'
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Posting service error:', errorMessage)
    
    return {
      success: false,
      type: 'ERROR',
      error: errorMessage
    }
  } finally {
    await db.disconnect()
  }
}

/**
 * Health check for the posting service
 */
export async function checkPostingHealth(): Promise<{
  healthy: boolean
  nextSlotDue?: string
  pendingSlots: number
  errors: string[]
}> {
  const errors: string[] = []
  
  try {
    await db.connect()
    
    // Check for next pending slot
    const nextSlotResult = await db.query(`
      SELECT scheduled_post_time, platform, content_id
      FROM scheduled_posts 
      WHERE status = 'pending'
      ORDER BY scheduled_post_time ASC 
      LIMIT 1
    `)
    
    // Count pending slots
    const countResult = await db.query(`
      SELECT COUNT(*) as count 
      FROM scheduled_posts 
      WHERE status = 'pending'
    `)
    
    const nextSlot = nextSlotResult.rows[0]
    const pendingCount = countResult.rows[0]?.count || 0
    
    return {
      healthy: true,
      nextSlotDue: nextSlot?.scheduled_post_time,
      pendingSlots: pendingCount,
      errors
    }
    
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error')
    return {
      healthy: false,
      pendingSlots: 0,
      errors
    }
  } finally {
    await db.disconnect()
  }
}