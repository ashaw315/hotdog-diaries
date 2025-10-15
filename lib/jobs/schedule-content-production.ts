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

// Generator options type
type GenMode = "refill-missing" | "create-or-reuse"
type GenerateOptions = { mode?: GenMode; forceRefill?: boolean }

const SLOT_ET_TIMES = ["08:00", "12:00", "15:00", "18:00", "21:00", "23:30"] as const

function toEasternISO(dateYYYYMMDD: string, hhmmET: string): string {
  const [hh, mm] = hhmmET.split(":").map(Number)
  const d = new Date(`${dateYYYYMMDD}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00-04:00`) // EDT fallback
  return new Date(d).toISOString()
}

/**
 * Progressive relaxation levels for content selection
 */
const relaxLevels = [
  { allowSameTypeTwice: false, allowConsecutivePlatform: false, allowExceedDailyCap: false, name: "strict" },
  { allowSameTypeTwice: true,  allowConsecutivePlatform: false, allowExceedDailyCap: false, name: "relax-type" },
  { allowSameTypeTwice: true,  allowConsecutivePlatform: true,  allowExceedDailyCap: false, name: "relax-consecutive" },
  { allowSameTypeTwice: true,  allowConsecutivePlatform: true,  allowExceedDailyCap: true,  name: "relax-cap" },
]

/**
 * Pick candidate with progressive constraint relaxation
 */
function pickCandidateWithRelaxation(
  candidates: ContentItem[],
  alreadyChosen: ContentItem[],
  slotIndex: number,
  dateYYYYMMDD: string
): { candidate: ContentItem | null; level: string } {
  const platformUsage = new Map<string, number>()
  const typeUsage = new Map<string, number>()
  
  // Count existing usage for the day
  alreadyChosen.forEach(item => {
    platformUsage.set(item.source_platform, (platformUsage.get(item.source_platform) || 0) + 1)
    typeUsage.set(item.content_type || 'text', (typeUsage.get(item.content_type || 'text') || 0) + 1)
  })
  
  const lastItem = alreadyChosen[alreadyChosen.length - 1]
  
  // Try each relaxation level
  for (const level of relaxLevels) {
    let eligibleCandidates = [...candidates]
    
    // Filter by platform cap
    if (!level.allowExceedDailyCap) {
      eligibleCandidates = eligibleCandidates.filter(c => 
        (platformUsage.get(c.source_platform) || 0) < 2
      )
    }
    
    // Filter by consecutive platform
    if (!level.allowConsecutivePlatform && lastItem) {
      eligibleCandidates = eligibleCandidates.filter(c => 
        c.source_platform !== lastItem.source_platform
      )
    }
    
    // Filter by type alternation
    if (!level.allowSameTypeTwice && lastItem) {
      eligibleCandidates = eligibleCandidates.filter(c => 
        (c.content_type || 'text') !== (lastItem.content_type || 'text')
      )
    }
    
    if (eligibleCandidates.length > 0) {
      // Sort by priority and return best candidate
      const candidate = eligibleCandidates.sort((a, b) => 
        (b.confidence_score || 0.5) - (a.confidence_score || 0.5)
      )[0]
      
      return { candidate, level: level.name }
    }
  }
  
  // Fallback: oldest approved item (FIFO)
  if (candidates.length > 0) {
    const fallback = candidates.sort((a, b) => 
      new Date(a.created_at || '1970-01-01').getTime() - new Date(b.created_at || '1970-01-01').getTime()
    )[0]
    return { candidate: fallback, level: "fallback-fifo" }
  }
  
  return { candidate: null, level: "no-candidates" }
}

/**
 * Generate daily schedule and populate scheduled_posts table (Phase 5.12 - Hardened)
 */
export async function generateDailySchedule(dateYYYYMMDD: string, opts: GenerateOptions = {}): Promise<any> {
  const mode: GenMode = opts.mode ?? "create-or-reuse"
  const forceRefill = !!opts.forceRefill
  
  console.log(`🗓️ Generating deterministic daily schedule for ${dateYYYYMMDD} (mode: ${mode}, forceRefill: ${forceRefill})`)
  
  try {
    const targetDate = parseISO(dateYYYYMMDD + 'T12:00:00Z')
    
    // 1) Load existing rows for the date from scheduled_posts
    const existingRows = await db.query(`
      SELECT * FROM scheduled_posts 
      WHERE DATE(scheduled_post_time) = ?
      ORDER BY scheduled_slot_index
    `, [dateYYYYMMDD])
    
    console.log(`📊 Found ${existingRows.rows.length} existing scheduled posts for ${dateYYYYMMDD}`)
    
    // 2) Get available content pool (exclude already scheduled for this date)
    const alreadyScheduledIds = existingRows.rows
      .filter(row => row.content_id)
      .map(row => row.content_id)
    
    const excludeClause = alreadyScheduledIds.length > 0 
      ? `AND id NOT IN (${alreadyScheduledIds.map(() => '?').join(',')})`
      : ''
    
    const candidatesResult = await db.query(`
      SELECT * FROM content_queue 
      WHERE is_approved = TRUE 
        AND is_posted = FALSE 
        ${excludeClause}
      ORDER BY confidence_score DESC, created_at ASC
    `, alreadyScheduledIds)
    
    const candidates = candidatesResult.rows.map(row => ({
      ...row,
      status: row.content_status || 'approved',
      scheduled_for: row.scheduled_post_time,
      priority: row.confidence_score || 0.5
    })) as ContentItem[]
    
    console.log(`📊 Found ${candidates.length} eligible candidate items`)
    
    // 3) For each slot 0..5, determine if we need to fill/refill
    const slotResults: any[] = []
    const alreadyChosen: ContentItem[] = []
    
    for (let slotIndex = 0; slotIndex < SLOT_ET_TIMES.length; slotIndex++) {
      const slotTimeET = SLOT_ET_TIMES[slotIndex]
      const existingRow = existingRows.rows.find(row => row.scheduled_slot_index === slotIndex)
      
      let shouldFill = false
      let reasoning = ''
      
      if (existingRow) {
        // Check if row has both content_id and scheduled_post_time
        if (existingRow.content_id && existingRow.scheduled_post_time) {
          console.log(`✅ Slot ${slotIndex} already filled with content_id ${existingRow.content_id}`)
          // Add to already chosen for diversity calculation
          const existingContent: ContentItem = {
            id: existingRow.content_id,
            source_platform: existingRow.platform,
            content_type: existingRow.content_type,
            content_text: existingRow.title,
            confidence_score: 0.5,
            created_at: new Date().toISOString()
          } as ContentItem
          alreadyChosen.push(existingContent)
          slotResults.push({ slot: slotIndex, action: 'kept', content_id: existingRow.content_id })
          continue
        } else if (forceRefill) {
          shouldFill = true
          reasoning = 'refilling incomplete row (missing content_id or scheduled_post_time)'
        }
      } else {
        shouldFill = true
        reasoning = 'creating new row for empty slot'
      }
      
      if (shouldFill) {
        // Use progressive relaxation to pick candidate
        const { candidate, level } = pickCandidateWithRelaxation(
          candidates.filter(c => !alreadyChosen.some(chosen => chosen.id === c.id)),
          alreadyChosen,
          slotIndex,
          dateYYYYMMDD
        )
        
        if (!candidate) {
          throw new Error(`No candidate found for slot ${slotIndex} even with full relaxation`)
        }
        
        // Generate UTC time for this slot
        const slotUTC = toEasternISO(dateYYYYMMDD, slotTimeET)
        const finalReasoning = `${reasoning} (constraint level: ${level})`
        
        // UPSERT the row (insert or update based on slot index)
        if (existingRow) {
          // Update existing row
          await db.query(`
            UPDATE scheduled_posts 
            SET content_id = ?, platform = ?, content_type = ?, source = ?, title = ?,
                scheduled_post_time = ?, reasoning = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [
            candidate.id,
            candidate.source_platform,
            candidate.content_type || 'text',
            candidate.original_author || null,
            candidate.content_text?.substring(0, 100) || null,
            slotUTC,
            finalReasoning,
            existingRow.id
          ])
        } else {
          // Insert new row
          await db.query(`
            INSERT INTO scheduled_posts (
              content_id, platform, content_type, source, title,
              scheduled_post_time, scheduled_slot_index, reasoning
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            candidate.id,
            candidate.source_platform,
            candidate.content_type || 'text',
            candidate.original_author || null,
            candidate.content_text?.substring(0, 100) || null,
            slotUTC,
            slotIndex,
            finalReasoning
          ])
        }
        
        // Update content_queue
        await db.query(`
          UPDATE content_queue 
          SET scheduled_post_time = ?, content_status = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [slotUTC, 'scheduled', candidate.id])
        
        alreadyChosen.push(candidate)
        slotResults.push({ 
          slot: slotIndex, 
          action: existingRow ? 'updated' : 'created', 
          content_id: candidate.id,
          platform: candidate.source_platform,
          level 
        })
        
        console.log(`✅ Slot ${slotIndex} (${slotTimeET} ET): ${candidate.source_platform} - ${candidate.content_text?.substring(0, 30)}... (${level})`)
      }
    }
    
    console.log(`🎉 Successfully processed schedule for ${dateYYYYMMDD}`)
    
    return {
      date: dateYYYYMMDD,
      filled: slotResults.filter(r => r.action !== 'kept').length,
      mode,
      forceRefill,
      slots: slotResults
    }

  } catch (error) {
    console.error(`❌ Failed to generate schedule for ${dateYYYYMMDD}:`, error)
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