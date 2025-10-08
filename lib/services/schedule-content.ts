/**
 * Intelligent Content Scheduler Service
 * Implements deterministic platform-diverse scheduling for 6 posts per day
 */

import { db } from '../db'
import { ContentItem, ScheduledContentItem, ContentScheduleResult, ContentStatus, SourcePlatform } from '../../types'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// Enable dayjs plugins
dayjs.extend(utc)
dayjs.extend(timezone)

// Scheduling configuration
const POSTS_PER_DAY = 6
const POSTING_TIMES = [
  '08:00', // 8 AM
  '10:30', // 10:30 AM  
  '13:00', // 1 PM
  '15:30', // 3:30 PM
  '18:00', // 6 PM
  '20:30'  // 8:30 PM
]

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
 * Get the next available approved content grouped by platform
 */
async function getAvailableContent(): Promise<Record<string, ContentItem[]>> {
  try {
    const result = await db.query(`
      SELECT * FROM content_queue 
      WHERE is_approved = TRUE 
        AND is_posted = FALSE 
        AND status = 'approved'
        AND (scheduled_for IS NULL OR scheduled_for <= datetime('now'))
      ORDER BY priority DESC, confidence_score DESC, created_at ASC
    `)

    const content = result.rows as ContentItem[]
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
    const cutoffDate = dayjs().subtract(lookbackDays, 'day').format('YYYY-MM-DD HH:mm:ss')
    
    const result = await db.query(`
      SELECT DISTINCT cq.source_platform
      FROM content_queue cq
      JOIN posted_content pc ON cq.id = pc.content_queue_id
      WHERE pc.posted_at >= ?
      ORDER BY pc.posted_at DESC
    `, [cutoffDate])

    return result.rows.map((row: any) => row.source_platform)
  } catch (error) {
    console.error('Error fetching recently posted platforms:', error)
    return []
  }
}

/**
 * Select content with weighted platform diversity enforcement
 * Ensures roughly even distribution across all platforms
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

  // Calculate target count per platform for balanced selection
  const totalAvailable = availablePlatforms.reduce(
    (sum, platform) => sum + contentByPlatform[platform].length, 0
  )
  const targetPerPlatform = Math.max(1, Math.floor(count / availablePlatforms.length))
  
  console.log(`📊 Target per platform: ${targetPerPlatform}, Total available: ${totalAvailable}`)

  // Initialize platform usage tracking
  const platformUsage = new Map<string, number>()
  availablePlatforms.forEach(platform => platformUsage.set(platform, 0))

  // Create a working copy of content to avoid mutation
  const workingContent = { ...contentByPlatform }
  Object.keys(workingContent).forEach(platform => {
    workingContent[platform] = [...workingContent[platform]]
  })

  // Weighted selection algorithm - ensures roughly even distribution
  while (selected.length < count && Object.values(workingContent).some(arr => arr.length > 0)) {
    // Sort platforms by current usage (ascending) to prioritize underused platforms
    const sortedPlatforms = availablePlatforms
      .filter(platform => workingContent[platform].length > 0)
      .sort((a, b) => {
        const usageA = platformUsage.get(a) || 0
        const usageB = platformUsage.get(b) || 0
        
        // Primary sort: by usage count (less used first)
        if (usageA !== usageB) {
          return usageA - usageB
        }
        
        // Secondary sort: prioritize platforms not used recently
        const aIsRecent = recentPlatforms.includes(a)
        const bIsRecent = recentPlatforms.includes(b)
        if (aIsRecent !== bIsRecent) {
          return aIsRecent ? 1 : -1
        }
        
        // Tertiary sort: by available content count (more available first)
        return workingContent[b].length - workingContent[a].length
      })

    if (sortedPlatforms.length === 0) {
      break
    }

    // Select from the platform with lowest usage
    const nextPlatform = sortedPlatforms[0]
    const candidate = workingContent[nextPlatform].shift() // Remove from working set

    if (candidate) {
      selected.push(candidate)
      platformUsage.set(nextPlatform, (platformUsage.get(nextPlatform) || 0) + 1)
      
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
 * Schedule content for a specific day
 */
async function scheduleDayContent(
  targetDate: dayjs.Dayjs,
  contentByPlatform: Record<string, ContentItem[]>,
  recentPlatforms: string[]
): Promise<{ scheduled: ScheduledContentItem[], errors: string[] }> {
  const scheduled: ScheduledContentItem[] = []
  const errors: string[] = []

  try {
    // Select diverse content for the day
    const selectedContent = selectDiverseContent(
      contentByPlatform, 
      recentPlatforms, 
      POSTS_PER_DAY
    )

    if (selectedContent.length === 0) {
      errors.push(`No approved content available for ${targetDate.format('YYYY-MM-DD')}`)
      return { scheduled, errors }
    }

    // Schedule each piece of content at specific times
    for (let i = 0; i < Math.min(selectedContent.length, POSTS_PER_DAY); i++) {
      const content = selectedContent[i]
      const postTime = POSTING_TIMES[i]
      const scheduledTime = targetDate
        .hour(parseInt(postTime.split(':')[0]))
        .minute(parseInt(postTime.split(':')[1]))
        .second(0)
        .millisecond(0)

      const scheduledItem: ScheduledContentItem = {
        ...content,
        scheduled_for: scheduledTime.toISOString(),
        status: ContentStatus.SCHEDULED,
        priority: content.priority || 0
      }

      // Update database with schedule
      await db.query(`
        UPDATE content_queue 
        SET scheduled_for = ?, status = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [
        scheduledTime.format('YYYY-MM-DD HH:mm:ss'),
        ContentStatus.SCHEDULED,
        content.id
      ])

      scheduled.push(scheduledItem)

      // Remove this content from available pools to avoid double-scheduling
      const platform = content.source_platform
      if (contentByPlatform[platform]) {
        contentByPlatform[platform] = contentByPlatform[platform].filter(
          item => item.id !== content.id
        )
      }
    }

    if (selectedContent.length < POSTS_PER_DAY) {
      errors.push(
        `Only ${selectedContent.length} content items available for ${targetDate.format('YYYY-MM-DD')} (target: ${POSTS_PER_DAY})`
      )
    }

  } catch (error) {
    errors.push(`Failed to schedule content for ${targetDate.format('YYYY-MM-DD')}: ${error.message}`)
  }

  return { scheduled, errors }
}

/**
 * Main scheduling function - schedules next batch of content
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
    console.log(`🗓️ Starting content scheduling for next ${daysAhead} days...`)

    // Get available content grouped by platform
    const contentByPlatform = await getAvailableContent()
    const availablePlatforms = Object.keys(contentByPlatform)
    
    console.log(`📊 Available platforms: ${availablePlatforms.length}`)
    console.log(`📊 Platform distribution:`, Object.fromEntries(
      availablePlatforms.map(p => [p, contentByPlatform[p].length])
    ))

    if (availablePlatforms.length === 0) {
      result.errors.push('No approved content available for scheduling')
      return result
    }

    // Get recently posted platforms for diversity enforcement
    const recentPlatforms = await getRecentlyPostedPlatforms(1)
    console.log(`🕒 Recently used platforms: ${recentPlatforms.join(', ')}`)

    // Schedule content for each day
    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const targetDate = dayjs().add(dayOffset, 'day').startOf('day')
      
      // Check if this day already has scheduled content
      const existingScheduled = await db.query(`
        SELECT COUNT(*) as count
        FROM content_queue
        WHERE DATE(scheduled_for) = ? AND status = 'scheduled'
      `, [targetDate.format('YYYY-MM-DD')])

      const alreadyScheduled = existingScheduled.rows[0]?.count || 0
      if (alreadyScheduled >= postsPerDay) {
        console.log(`⏭️ Skipping ${targetDate.format('YYYY-MM-DD')} - already has ${alreadyScheduled} scheduled posts`)
        continue
      }

      // Schedule content for this day
      const dayResult = await scheduleDayContent(
        targetDate,
        contentByPlatform,
        recentPlatforms
      )

      result.scheduled.push(...dayResult.scheduled)
      result.errors.push(...dayResult.errors)
      
      if (dayResult.scheduled.length > 0) {
        result.summary.totalDays++
        console.log(`✅ Scheduled ${dayResult.scheduled.length} posts for ${targetDate.format('YYYY-MM-DD')}`)
      }
    }

    // Calculate summary statistics
    result.summary.totalScheduled = result.scheduled.length
    result.summary.platformDistribution = result.scheduled.reduce((dist, item) => {
      const platform = item.source_platform
      dist[platform] = (dist[platform] || 0) + 1
      return dist
    }, {} as Record<string, number>)

    console.log(`🎉 Scheduling completed:`)
    console.log(`   📈 Total scheduled: ${result.summary.totalScheduled}`)
    console.log(`   📅 Days scheduled: ${result.summary.totalDays}`)
    console.log(`   🎯 Platform distribution:`, result.summary.platformDistribution)

    // Enhanced diversity diagnostics
    console.log(`\n🧮 Diversity Analysis:`)
    const platforms = Object.keys(result.summary.platformDistribution)
    const counts = Object.values(result.summary.platformDistribution)
    const maxCount = Math.max(...counts)
    const minCount = Math.min(...counts)
    const variance = maxCount - minCount
    
    console.table(result.summary.platformDistribution)
    console.log(`   📊 Platform variance: ${variance} (max: ${maxCount}, min: ${minCount})`)
    console.log(`   🎯 Diversity score: ${variance <= 1 ? 'EXCELLENT' : variance <= 2 ? 'GOOD' : 'NEEDS_IMPROVEMENT'}`)
    
    if (variance > 2) {
      console.log(`   ⚠️  Platform imbalance detected - consider content rebalancing`)
    }

    if (result.errors.length > 0) {
      console.log(`\n⚠️ Warnings/Errors:`)
      result.errors.forEach(error => console.log(`   - ${error}`))
    }

  } catch (error) {
    result.errors.push(`Scheduling failed: ${error.message}`)
    console.error('❌ Scheduling failed:', error)
  }

  return result
}

/**
 * Get upcoming scheduled content
 */
export async function getUpcomingSchedule(days: number = 7): Promise<ScheduledContentItem[]> {
  try {
    const endDate = dayjs().add(days, 'day').format('YYYY-MM-DD HH:mm:ss')
    
    const result = await db.query(`
      SELECT * FROM content_queue
      WHERE status = 'scheduled' 
        AND scheduled_for >= datetime('now')
        AND scheduled_for <= ?
      ORDER BY scheduled_for ASC
    `, [endDate])

    return result.rows.map(row => ({
      ...row,
      status: row.status as ContentStatus,
      scheduled_for: row.scheduled_for
    })) as ScheduledContentItem[]

  } catch (error) {
    console.error('Error fetching upcoming schedule:', error)
    return []
  }
}

/**
 * Cancel scheduled content (return to approved status)
 */
export async function cancelScheduledContent(contentId: number): Promise<boolean> {
  try {
    const result = await db.query(`
      UPDATE content_queue 
      SET scheduled_for = NULL, status = 'approved', updated_at = datetime('now')
      WHERE id = ? AND status = 'scheduled'
    `, [contentId])

    return result.rowCount > 0
  } catch (error) {
    console.error('Error canceling scheduled content:', error)
    return false
  }
}

/**
 * Reschedule content to a new time
 */
export async function rescheduleContent(
  contentId: number, 
  newScheduleTime: Date | string
): Promise<boolean> {
  try {
    const scheduleTime = dayjs(newScheduleTime).format('YYYY-MM-DD HH:mm:ss')
    
    const result = await db.query(`
      UPDATE content_queue 
      SET scheduled_for = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'scheduled'
    `, [scheduleTime, contentId])

    return result.rowCount > 0
  } catch (error) {
    console.error('Error rescheduling content:', error)
    return false
  }
}