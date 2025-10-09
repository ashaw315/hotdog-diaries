/**
 * Production-Compatible Intelligent Content Scheduler Service
 * Updated for Phase 5.12 to populate scheduled_posts table for deterministic forecasting
 */

import { db } from '../db'
import { createSimpleClient } from '@/utils/supabase/server'
import { ContentItem, ScheduledContentItem, ContentScheduleResult, SourcePlatform } from '../../types'
import { parseISO, format, setHours, setMinutes, setSeconds, addHours, startOfDay, endOfDay } from 'date-fns'

// Scheduling configuration - Phase 5.12 standardized slots
const POSTS_PER_DAY = 6
const SLOT_TIMES_ET = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'] // Eastern Time

// Timezone utility functions (Phase 5.12 compatibility)
const toET = (dateInput: Date | string): Date => {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  // Temporary fallback: Eastern Time is UTC-4 (EDT)
  return addHours(date, -4)
}

const toUTC = (dateET: Date): Date => {
  // Convert ET back to UTC
  return addHours(dateET, 4)
}

/**
 * Group array elements by a key function
 */
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item)
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

/**
 * Get the next available approved content grouped by platform (PRODUCTION SCHEMA)
 */
async function getAvailableContent(): Promise<Record<string, ContentItem[]>> {
  try {
    // Use production-compatible field names
    const result = await db.query(`
      SELECT * FROM content_queue 
      WHERE is_approved = TRUE 
        AND is_posted = FALSE 
        AND (scheduled_post_time IS NULL OR scheduled_post_time <= datetime('now'))
      ORDER BY confidence_score DESC, created_at ASC
    `)

    console.log(`📊 Found ${result.rows.length} eligible items for scheduling`)
    
    const content = result.rows.map(row => ({
      ...row,
      // Map production fields to expected interface
      status: row.content_status || 'approved',
      scheduled_for: row.scheduled_post_time,
      priority: row.confidence_score || 0.5
    })) as ContentItem[]
    
    return groupBy(content, (item) => item.source_platform)
  } catch (error) {
    console.error('Error fetching available content:', error)
    return {}
  }
}

/**
 * Get recently posted content to enforce platform diversity
 */
async function getRecentlyPostedPlatforms(lookbackDays: number = 1): Promise<string[]> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
    
    const result = await db.query(`
      SELECT DISTINCT source_platform
      FROM content_queue
      WHERE is_posted = TRUE 
        AND updated_at >= ?
      ORDER BY updated_at DESC
    `, [cutoffDate.toISOString()])

    return result.rows.map((row: any) => row.source_platform)
  } catch (error) {
    console.error('Error fetching recently posted platforms:', error)
    return []
  }
}

/**
 * Select content with weighted platform diversity enforcement
 */
function selectDiverseContent(
  contentByPlatform: Record<string, ContentItem[]>, 
  recentPlatforms: string[],
  count: number
): ContentItem[] {
  const selected: ContentItem[] = []
  const availablePlatforms = Object.keys(contentByPlatform).filter(
    platform => contentByPlatform[platform].length > 0
  )

  if (availablePlatforms.length === 0) {
    return selected
  }

  console.log(`🎯 Implementing weighted platform balancing for ${count} posts across ${availablePlatforms.length} platforms`)

  // Initialize platform usage tracking
  const platformUsage = new Map<string, number>()
  availablePlatforms.forEach(platform => platformUsage.set(platform, 0))

  // Create a working copy of content to avoid mutation
  const workingContent = { ...contentByPlatform }
  Object.keys(workingContent).forEach(platform => {
    workingContent[platform] = [...workingContent[platform]]
  })

  // Platform daily cap (Phase 5.12 requirement)
  const PLATFORM_DAILY_CAP = 2

  // Diversity algorithm with strict caps and alternation
  let lastPlatform: string | null = null
  let lastType: string | null = null

  while (selected.length < count && Object.values(workingContent).some(arr => arr.length > 0)) {
    // Find platforms that haven't hit the daily cap
    const availableNow = availablePlatforms
      .filter(platform => workingContent[platform].length > 0)
      .filter(platform => (platformUsage.get(platform) || 0) < PLATFORM_DAILY_CAP)

    if (availableNow.length === 0) {
      // Relax cap if needed
      const anyAvailable = availablePlatforms.filter(platform => workingContent[platform].length > 0)
      if (anyAvailable.length === 0) break
      availableNow.push(...anyAvailable)
    }

    // Apply diversity constraints
    let candidates = availableNow

    // 1. Platform diversity (avoid consecutive same platform)
    if (lastPlatform) {
      const nonRepeat = candidates.filter(p => p !== lastPlatform)
      if (nonRepeat.length > 0) {
        candidates = nonRepeat
      }
    }

    // 2. Sort by usage (prefer underused platforms)
    candidates.sort((a, b) => {
      const usageA = platformUsage.get(a) || 0
      const usageB = platformUsage.get(b) || 0
      
      if (usageA !== usageB) {
        return usageA - usageB
      }
      
      // Prefer platforms not used recently
      const aIsRecent = recentPlatforms.includes(a)
      const bIsRecent = recentPlatforms.includes(b)
      if (aIsRecent !== bIsRecent) {
        return aIsRecent ? 1 : -1
      }
      
      return workingContent[b].length - workingContent[a].length
    })

    const nextPlatform = candidates[0]
    
    // Select content from this platform, preferring type alternation
    const platformContent = workingContent[nextPlatform]
    let candidate: ContentItem | undefined

    if (lastType && platformContent.length > 1) {
      // Try to find different content type
      const differentType = platformContent.find(c => c.content_type !== lastType)
      if (differentType) {
        candidate = differentType
        // Remove from array
        const index = platformContent.indexOf(differentType)
        platformContent.splice(index, 1)
      }
    }
    
    if (!candidate) {
      candidate = platformContent.shift() // Take first available
    }

    if (candidate) {
      selected.push(candidate)
      platformUsage.set(nextPlatform, (platformUsage.get(nextPlatform) || 0) + 1)
      lastPlatform = nextPlatform
      lastType = candidate.content_type
      
      console.log(`✅ Selected from ${nextPlatform}: "${candidate.content_text?.substring(0, 30)}..." (usage now: ${platformUsage.get(nextPlatform)})`)
    }
  }

  // Log final distribution
  const finalDistribution = Object.fromEntries(
    availablePlatforms.map(platform => [platform, platformUsage.get(platform) || 0])
  )
  console.log(`🎯 Final platform distribution:`, finalDistribution)

  return selected
}

/**
 * Generate daily schedule and populate scheduled_posts table (Phase 5.12)
 */
export async function generateDailySchedule(dateISO: string): Promise<void> {
  console.log(`🗓️ Generating deterministic daily schedule for ${dateISO}`)
  
  try {
    const targetDate = parseISO(dateISO + 'T12:00:00Z')
    
    // Check if schedule already exists for this date
    const existingCheck = await db.query(`
      SELECT COUNT(*) as count FROM scheduled_posts 
      WHERE DATE(scheduled_post_time) = ?
    `, [dateISO])
    
    if (existingCheck.rows[0]?.count > 0) {
      console.log(`📅 Schedule already exists for ${dateISO}, skipping generation`)
      return
    }

    // Get available content
    const contentByPlatform = await getAvailableContent()
    const recentPlatforms = await getRecentlyPostedPlatforms(1)
    
    // Select diverse content
    const selectedContent = selectDiverseContent(contentByPlatform, recentPlatforms, POSTS_PER_DAY)
    
    if (selectedContent.length === 0) {
      console.log(`⚠️ No content available for ${dateISO}`)
      return
    }

    // Generate schedule entries for each slot
    for (let slotIndex = 0; slotIndex < SLOT_TIMES_ET.length; slotIndex++) {
      const content = selectedContent[slotIndex]
      if (!content) continue // Skip if not enough content

      const slotTimeET = SLOT_TIMES_ET[slotIndex]
      const [hours, minutes] = slotTimeET.split(':').map(Number)
      
      // Create ET time for the slot
      const slotET = setSeconds(setMinutes(setHours(targetDate, hours), minutes), 0)
      
      // Convert to UTC for storage
      const slotUTC = toUTC(slotET)
      
      // Determine reasoning based on selection criteria
      let reasoning = 'selected based on queue priority'
      if (slotIndex > 0) {
        const prevContent = selectedContent[slotIndex - 1]
        if (prevContent) {
          if (content.source_platform !== prevContent.source_platform) {
            reasoning = `selected to avoid repeating platform '${prevContent.source_platform}'`
          }
          if (content.content_type !== prevContent.content_type) {
            reasoning += ` and alternate type '${prevContent.content_type}'`
          }
        }
      }

      // Insert into scheduled_posts table
      await db.query(`
        INSERT INTO scheduled_posts (
          content_id, platform, content_type, source, title,
          scheduled_post_time, scheduled_slot_index, reasoning
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        content.id,
        content.source_platform,
        content.content_type || 'text',
        content.original_author || null,
        content.content_text?.substring(0, 100) || null,
        slotUTC.toISOString(),
        slotIndex,
        reasoning
      ])

      // Update content_queue with schedule info (maintain compatibility)
      await db.query(`
        UPDATE content_queue 
        SET scheduled_post_time = ?, content_status = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [slotUTC.toISOString(), 'scheduled', content.id])

      console.log(`✅ Scheduled slot ${slotIndex} (${slotTimeET} ET): ${content.source_platform} - ${content.content_text?.substring(0, 30)}...`)
    }

    console.log(`🎉 Successfully generated schedule for ${dateISO} with ${selectedContent.length} posts`)

  } catch (error) {
    console.error(`❌ Failed to generate schedule for ${dateISO}:`, error)
    throw error
  }
}

/**
 * Main scheduling function - schedules next batch of content (PRODUCTION COMPATIBLE)
 * Updated for Phase 5.12 to use generateDailySchedule
 */
export async function scheduleNextBatch(
  daysAhead: number = 7,
  postsPerDay: number = POSTS_PER_DAY
): Promise<ContentScheduleResult> {
  const result: ContentScheduleResult = {
    scheduled: [],
    skipped: [],
    errors: [],
    summary: {
      totalScheduled: 0,
      totalDays: 0,
      platformDistribution: {}
    }
  }

  try {
    console.log(`🗓️ Starting PRODUCTION content scheduling for next ${daysAhead} days...`)

    // Schedule content for each day using the new deterministic method
    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + dayOffset)
      const dateISO = format(targetDate, 'yyyy-MM-dd')
      
      try {
        await generateDailySchedule(dateISO)
        result.summary.totalDays++
        
        // Count scheduled items for this day
        const scheduledCount = await db.query(`
          SELECT COUNT(*) as count FROM scheduled_posts 
          WHERE DATE(scheduled_post_time) = ?
        `, [dateISO])
        
        const count = scheduledCount.rows[0]?.count || 0
        result.summary.totalScheduled += count
        
      } catch (error) {
        result.errors.push(`Failed to schedule ${dateISO}: ${error.message}`)
      }
    }

    // Calculate platform distribution from scheduled_posts
    const distributionResult = await db.query(`
      SELECT platform, COUNT(*) as count
      FROM scheduled_posts 
      WHERE scheduled_post_time >= datetime('now')
      GROUP BY platform
    `)
    
    result.summary.platformDistribution = Object.fromEntries(
      distributionResult.rows.map((row: any) => [row.platform, row.count])
    )

    console.log(`🎉 PRODUCTION Scheduling completed:`)
    console.log(`   📈 Total scheduled: ${result.summary.totalScheduled}`)
    console.log(`   📅 Days scheduled: ${result.summary.totalDays}`)
    console.log(`   🎯 Platform distribution:`, result.summary.platformDistribution)

  } catch (error) {
    result.errors.push(`Scheduling failed: ${error.message}`)
    console.error('❌ Scheduling failed:', error)
  }

  return result
}