/**
 * Multi-Day Schedule Precompute + Auto-Heal
 * Generates schedules 3-7 days ahead with diversity enforcement
 */

import { generateDailySchedule } from './schedule-content-production'
import { getEasternDateRange, getEasternDateString } from '../utils/time-helpers'

interface PrecomputeOptions {
  daysAhead?: number
  forceRefill?: boolean
  healDiversityGaps?: boolean
  maxDiversityAttempts?: number
}

interface PrecomputeResult {
  datesProcessed: string[]
  filled: number
  healed: number
  errors: string[]
  diversityMetrics: {
    overallScore: number
    platformBalance: Record<string, number>
    consecutivePlatforms: number
    averageSpacing: number
  }
}

interface DiversityGap {
  date: string
  slotIndex: number
  issue: 'consecutive_platform' | 'platform_oversaturation' | 'poor_spacing'
  platform: string
  severity: number
}

const MAX_CONSECUTIVE_SAME_PLATFORM = 2
const TARGET_PLATFORM_DISTRIBUTION_VARIANCE = 0.3 // Max 30% variance between platforms
const MIN_PLATFORM_SPACING = 2 // Minimum slots between same platform

/**
 * Analyze diversity gaps across multiple days
 */
async function analyzeDiversityGaps(dateRange: string[]): Promise<DiversityGap[]> {
  const { db } = await import('../db')
  const gaps: DiversityGap[] = []
  
  try {
    await db.connect()
    
    // Get all scheduled posts for the date range
    const startDate = dateRange[0]
    const endDate = dateRange[dateRange.length - 1]
    
    const result = await db.query(`
      SELECT 
        DATE(scheduled_post_time) as day,
        scheduled_slot_index,
        platform,
        scheduled_post_time
      FROM scheduled_posts 
      WHERE DATE(scheduled_post_time) BETWEEN ? AND ?
      ORDER BY scheduled_post_time ASC
    `, [startDate, endDate])
    
    const posts = result.rows || []
    
    // Analyze consecutive platforms
    for (let i = 1; i < posts.length; i++) {
      const current = posts[i]
      const previous = posts[i - 1]
      
      if (current.platform === previous.platform) {
        // Check if they're close in time (within 2 slots)
        const timeDiff = new Date(current.scheduled_post_time).getTime() - 
                        new Date(previous.scheduled_post_time).getTime()
        const slotDiff = timeDiff / (1000 * 60 * 60 * 4) // Rough 4-hour slot spacing
        
        if (slotDiff <= MIN_PLATFORM_SPACING) {
          gaps.push({
            date: current.day,
            slotIndex: current.scheduled_slot_index,
            issue: 'consecutive_platform',
            platform: current.platform,
            severity: Math.max(1, MIN_PLATFORM_SPACING - slotDiff)
          })
        }
      }
    }
    
    // Analyze platform distribution per day
    const dayGroups = posts.reduce((acc, post) => {
      if (!acc[post.day]) acc[post.day] = []
      acc[post.day].push(post)
      return acc
    }, {} as Record<string, any[]>)
    
    for (const [date, dayPosts] of Object.entries(dayGroups)) {
      const platformCounts = dayPosts.reduce((acc, post) => {
        acc[post.platform] = (acc[post.platform] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const platforms = Object.keys(platformCounts)
      const counts = Object.values(platformCounts)
      const maxCount = Math.max(...counts)
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length
      
      // Flag oversaturated platforms (>2 posts per day or >50% above average)
      for (const [platform, count] of Object.entries(platformCounts)) {
        if (count > 2 || count > avgCount * 1.5) {
          // Find the slots with this oversaturated platform
          const platformSlots = dayPosts
            .filter(p => p.platform === platform)
            .map(p => p.scheduled_slot_index)
          
          platformSlots.forEach(slotIndex => {
            gaps.push({
              date,
              slotIndex,
              issue: 'platform_oversaturation',
              platform,
              severity: count > 2 ? 3 : 2
            })
          })
        }
      }
    }
    
    console.log(`🔍 Analyzed ${posts.length} scheduled posts, found ${gaps.length} diversity gaps`)
    return gaps
    
  } catch (error) {
    console.error('Error analyzing diversity gaps:', error)
    return []
  } finally {
    await db.disconnect()
  }
}

/**
 * Attempt to heal diversity gaps by regenerating affected days
 */
async function healDiversityGaps(gaps: DiversityGap[], maxAttempts: number = 3): Promise<number> {
  if (gaps.length === 0) return 0
  
  // Group gaps by date for batch healing
  const gapsByDate = gaps.reduce((acc, gap) => {
    if (!acc[gap.date]) acc[gap.date] = []
    acc[gap.date].push(gap)
    return acc
  }, {} as Record<string, DiversityGap[]>)
  
  let healedCount = 0
  
  for (const [date, dateGaps] of Object.entries(gapsByDate)) {
    console.log(`🔧 Attempting to heal ${dateGaps.length} diversity gaps for ${date}`)
    
    // Sort by severity (heal worst gaps first)
    const sortedGaps = dateGaps.sort((a, b) => b.severity - a.severity)
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`  📝 Healing attempt ${attempt}/${maxAttempts} for ${date}`)
        
        // Force refill to regenerate with better diversity
        await generateDailySchedule(date, { 
          mode: 'create-or-reuse', 
          forceRefill: true 
        })
        
        // Re-analyze to see if gaps were fixed
        const remainingGaps = await analyzeDiversityGaps([date])
        const dateRemainingGaps = remainingGaps.filter(g => g.date === date)
        
        if (dateRemainingGaps.length < dateGaps.length) {
          const fixed = dateGaps.length - dateRemainingGaps.length
          healedCount += fixed
          console.log(`  ✅ Healed ${fixed} gaps for ${date} (${dateRemainingGaps.length} remaining)`)
          
          if (dateRemainingGaps.length === 0) {
            break // All gaps fixed for this date
          }
        } else {
          console.log(`  ⚠️ No improvement for ${date} on attempt ${attempt}`)
        }
        
      } catch (error) {
        console.error(`  ❌ Healing attempt ${attempt} failed for ${date}:`, error)
      }
    }
  }
  
  console.log(`🏥 Healing complete: fixed ${healedCount} diversity gaps`)
  return healedCount
}

/**
 * Calculate diversity metrics across date range
 */
async function calculateDiversityMetrics(dateRange: string[]): Promise<PrecomputeResult['diversityMetrics']> {
  const { db } = await import('../db')
  
  try {
    await db.connect()
    
    const startDate = dateRange[0]
    const endDate = dateRange[dateRange.length - 1]
    
    const result = await db.query(`
      SELECT platform, COUNT(*) as count, scheduled_post_time
      FROM scheduled_posts 
      WHERE DATE(scheduled_post_time) BETWEEN ? AND ?
      ORDER BY scheduled_post_time ASC
    `, [startDate, endDate])
    
    const posts = result.rows || []
    
    // Platform balance
    const platformCounts = posts.reduce((acc, post) => {
      acc[post.platform] = (acc[post.platform] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Calculate variance in platform distribution
    const counts = Object.values(platformCounts)
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length
    const variance = counts.reduce((acc, count) => acc + Math.pow(count - avgCount, 2), 0) / counts.length
    const stdDev = Math.sqrt(variance)
    
    // Consecutive platform analysis
    let consecutiveCount = 0
    for (let i = 1; i < posts.length; i++) {
      if (posts[i].platform === posts[i - 1].platform) {
        consecutiveCount++
      }
    }
    
    // Average spacing between same platform posts
    const platformSpacing: Record<string, number[]> = {}
    posts.forEach((post, index) => {
      if (!platformSpacing[post.platform]) platformSpacing[post.platform] = []
      platformSpacing[post.platform].push(index)
    })
    
    let totalSpacing = 0
    let spacingCount = 0
    
    Object.values(platformSpacing).forEach(indices => {
      for (let i = 1; i < indices.length; i++) {
        totalSpacing += indices[i] - indices[i - 1]
        spacingCount++
      }
    })
    
    const averageSpacing = spacingCount > 0 ? totalSpacing / spacingCount : 0
    
    // Overall diversity score (0-100)
    const platformScore = Math.max(0, 50 - (stdDev / avgCount) * 100) // Lower variance = higher score
    const consecutiveScore = Math.max(0, 50 - (consecutiveCount / posts.length) * 100)
    const overallScore = Math.round(platformScore + consecutiveScore)
    
    return {
      overallScore,
      platformBalance: platformCounts,
      consecutivePlatforms: consecutiveCount,
      averageSpacing
    }
    
  } catch (error) {
    console.error('Error calculating diversity metrics:', error)
    return {
      overallScore: 0,
      platformBalance: {},
      consecutivePlatforms: 0,
      averageSpacing: 0
    }
  } finally {
    await db.disconnect()
  }
}

/**
 * Main precompute function - generates schedules with auto-heal
 */
export async function precomputeSchedule(options: PrecomputeOptions = {}): Promise<PrecomputeResult> {
  const {
    daysAhead = 7,
    forceRefill = false,
    healDiversityGaps = true,
    maxDiversityAttempts = 3
  } = options
  
  console.log(`🗓️ Precomputing schedules for next ${daysAhead} days (heal: ${healDiversityGaps})`)
  
  const result: PrecomputeResult = {
    datesProcessed: [],
    filled: 0,
    healed: 0,
    errors: [],
    diversityMetrics: {
      overallScore: 0,
      platformBalance: {},
      consecutivePlatforms: 0,
      averageSpacing: 0
    }
  }
  
  try {
    // Generate date range starting from today
    const dateRange = getEasternDateRange(daysAhead, getEasternDateString())
    console.log(`📅 Target dates: ${dateRange[0]} to ${dateRange[dateRange.length - 1]}`)
    
    // Phase 1: Generate/refill schedules for all dates
    for (const date of dateRange) {
      try {
        console.log(`📝 Processing schedule for ${date}`)
        
        const dailyResult = await generateDailySchedule(date, {
          mode: 'create-or-reuse',
          forceRefill
        })
        
        result.datesProcessed.push(date)
        result.filled += dailyResult.filled || 0
        
        console.log(`  ✅ ${date}: filled ${dailyResult.filled || 0} slots`)
        
      } catch (error) {
        const errorMsg = `Failed to process ${date}: ${error instanceof Error ? error.message : 'unknown error'}`
        result.errors.push(errorMsg)
        console.error(`  ❌ ${errorMsg}`)
      }
    }
    
    // Phase 2: Analyze and heal diversity gaps if enabled
    if (healDiversityGaps && result.datesProcessed.length > 0) {
      console.log(`🔍 Analyzing diversity gaps across ${result.datesProcessed.length} days`)
      
      const gaps = await analyzeDiversityGaps(result.datesProcessed)
      
      if (gaps.length > 0) {
        console.log(`🏥 Found ${gaps.length} diversity gaps, attempting to heal...`)
        result.healed = await healDiversityGaps(gaps, maxDiversityAttempts)
      } else {
        console.log(`✅ No significant diversity gaps found`)
      }
    }
    
    // Phase 3: Calculate final diversity metrics
    if (result.datesProcessed.length > 0) {
      result.diversityMetrics = await calculateDiversityMetrics(result.datesProcessed)
      console.log(`📊 Final diversity score: ${result.diversityMetrics.overallScore}/100`)
    }
    
    console.log(`🎉 Precompute complete: ${result.filled} slots filled, ${result.healed} gaps healed`)
    
  } catch (error) {
    const errorMsg = `Precompute failed: ${error instanceof Error ? error.message : 'unknown error'}`
    result.errors.push(errorMsg)
    console.error(`❌ ${errorMsg}`)
  }
  
  return result
}

/**
 * CLI entry point for precompute script
 */
export async function runPrecomputeScript(): Promise<void> {
  console.log('🚀 Starting Multi-Day Schedule Precompute + Auto-Heal')
  console.log(`⏰ Current time: ${new Date().toISOString()}`)
  
  const result = await precomputeSchedule({
    daysAhead: 7,
    forceRefill: false,
    healDiversityGaps: true,
    maxDiversityAttempts: 3
  })
  
  console.log('\n📋 PRECOMPUTE RESULTS:')
  console.log('=====================')
  console.log(`Dates processed: ${result.datesProcessed.length}`)
  console.log(`Slots filled: ${result.filled}`)
  console.log(`Gaps healed: ${result.healed}`)
  console.log(`Errors: ${result.errors.length}`)
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors encountered:')
    result.errors.forEach(error => console.log(`  - ${error}`))
  }
  
  console.log(`\n📊 Diversity Metrics:`)
  console.log(`Overall score: ${result.diversityMetrics.overallScore}/100`)
  console.log(`Platform balance:`, result.diversityMetrics.platformBalance)
  console.log(`Consecutive platforms: ${result.diversityMetrics.consecutivePlatforms}`)
  console.log(`Average spacing: ${result.diversityMetrics.averageSpacing.toFixed(1)}`)
  
  if (result.diversityMetrics.overallScore < 70) {
    console.log('\n⚠️ WARNING: Low diversity score detected')
    process.exit(1)
  }
  
  console.log('\n🎉 Precompute + Auto-Heal completed successfully')
}