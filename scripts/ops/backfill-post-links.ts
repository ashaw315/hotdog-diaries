#!/usr/bin/env npx tsx
/**
 * Backfill Orphan Posts Job
 * 
 * For a given date, finds rows in `posted_content` with NULL `scheduled_post_id`
 * and attempts to match them to `scheduled_posts` rows using:
 * 
 * 1) Same `content_queue_id` AND slot_at_utc within +/- 30 minutes of posted_at
 * 2) Same `platform` and nearest slot within 90 minutes
 * 
 * Default dry-run mode; use --write to persist changes.
 */

import { parseISO, format, addMinutes, subMinutes } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { db } from '../../lib/db'
import { createSimpleClient } from '../../utils/supabase/server'

// Types
interface OrphanPost {
  id: number
  content_queue_id: number
  platform: string | null
  posted_at: string
  scheduled_post_id: number | null
}

interface ScheduledPost {
  id: number
  content_id: number
  platform: string
  scheduled_post_time: string
  scheduled_slot_index: number
}

interface BackfillMatch {
  orphan: OrphanPost
  matched_schedule: ScheduledPost | null
  match_reason: 'exact_content_id' | 'platform_nearest' | 'no_match'
  time_delta_minutes: number | null
}

interface BackfillResult {
  date: string
  total_orphans: number
  matches_found: number
  exact_matches: number
  platform_matches: number
  no_matches: number
  updates_applied: number
  dry_run: boolean
  matches: BackfillMatch[]
  errors: string[]
}

// Configuration
const TZ = 'America/New_York'
const EXACT_TOLERANCE_MINUTES = 30
const PLATFORM_TOLERANCE_MINUTES = 90

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    date: format(new Date(), 'yyyy-MM-dd'),
    write: false,
    verbose: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--date' && i + 1 < args.length) {
      config.date = args[i + 1]
      i++
    } else if (arg === '--write') {
      config.write = true
    } else if (arg === '--verbose') {
      config.verbose = true
    } else if (arg === '--help') {
      console.log(`
Backfill Orphan Posts Job

Usage: npx tsx scripts/ops/backfill-post-links.ts [options]

Options:
  --date YYYY-MM-DD    Target date (default: today)
  --write              Apply changes (default: dry-run)
  --verbose            Detailed output
  --help               Show this help

Examples:
  npx tsx scripts/ops/backfill-post-links.ts --date 2025-10-15
  npx tsx scripts/ops/backfill-post-links.ts --date 2025-10-15 --write
`)
      process.exit(0)
    }
  }

  return config
}

// Database detection
function getDatabaseConfig() {
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
  
  return { isVercel, isSqlite }
}

// Get UTC time range for a given ET date
function getDayUtcRange(dateStr: string) {
  const etStart = parseISO(dateStr + 'T00:00:00')
  const etEnd = parseISO(dateStr + 'T23:59:59.999')
  
  // Convert ET to UTC (simplified: ET = UTC-4 in summer, UTC-5 in winter)
  // For this tool, we'll use a conservative approach and add 4 hours
  const utcStart = addMinutes(etStart, 4 * 60).toISOString()
  const utcEnd = addMinutes(etEnd, 4 * 60).toISOString()
  
  return { utcStart, utcEnd }
}

// Query orphan posts for date range
async function getOrphanPosts(utcStart: string, utcEnd: string): Promise<OrphanPost[]> {
  const { isSqlite } = getDatabaseConfig()
  
  if (isSqlite) {
    await db.connect()
    try {
      const result = await db.query(`
        SELECT id, content_queue_id, platform, posted_at, scheduled_post_id
        FROM posted_content
        WHERE posted_at BETWEEN ? AND ?
          AND scheduled_post_id IS NULL
        ORDER BY posted_at ASC
      `, [utcStart, utcEnd])
      
      return result.rows || []
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase
    const supabase = createSimpleClient()
    const { data, error } = await supabase
      .from('posted_content')
      .select('id, content_queue_id, platform, posted_at, scheduled_post_id')
      .gte('posted_at', utcStart)
      .lte('posted_at', utcEnd)
      .is('scheduled_post_id', null)
      .order('posted_at', { ascending: true })
    
    if (error) throw error
    return data || []
  }
}

// Query scheduled posts for date range
async function getScheduledPosts(utcStart: string, utcEnd: string): Promise<ScheduledPost[]> {
  const { isSqlite } = getDatabaseConfig()
  
  if (isSqlite) {
    await db.connect()
    try {
      const result = await db.query(`
        SELECT id, content_id, platform, scheduled_post_time, scheduled_slot_index
        FROM scheduled_posts
        WHERE scheduled_post_time BETWEEN ? AND ?
        ORDER BY scheduled_post_time ASC
      `, [utcStart, utcEnd])
      
      return result.rows || []
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase
    const supabase = createSimpleClient()
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('id, content_id, platform, scheduled_post_time, scheduled_slot_index')
      .gte('scheduled_post_time', utcStart)
      .lte('scheduled_post_time', utcEnd)
      .order('scheduled_post_time', { ascending: true })
    
    if (error) throw error
    return data || []
  }
}

// Calculate time difference in minutes
function getTimeDeltaMinutes(time1: string, time2: string): number {
  const t1 = new Date(time1).getTime()
  const t2 = new Date(time2).getTime()
  return Math.abs(t1 - t2) / (1000 * 60)
}

// Find best match for an orphan post
function findBestMatch(orphan: OrphanPost, scheduledPosts: ScheduledPost[]): BackfillMatch {
  // Strategy 1: Exact content_id match within 30 minutes
  for (const sp of scheduledPosts) {
    if (sp.content_id === orphan.content_queue_id) {
      const deltaMinutes = getTimeDeltaMinutes(orphan.posted_at, sp.scheduled_post_time)
      if (deltaMinutes <= EXACT_TOLERANCE_MINUTES) {
        return {
          orphan,
          matched_schedule: sp,
          match_reason: 'exact_content_id',
          time_delta_minutes: deltaMinutes
        }
      }
    }
  }
  
  // Strategy 2: Same platform, nearest slot within 90 minutes
  if (orphan.platform) {
    let bestMatch: ScheduledPost | null = null
    let bestDelta = Number.POSITIVE_INFINITY
    
    for (const sp of scheduledPosts) {
      if (sp.platform.toLowerCase() === orphan.platform.toLowerCase()) {
        const deltaMinutes = getTimeDeltaMinutes(orphan.posted_at, sp.scheduled_post_time)
        if (deltaMinutes <= PLATFORM_TOLERANCE_MINUTES && deltaMinutes < bestDelta) {
          bestMatch = sp
          bestDelta = deltaMinutes
        }
      }
    }
    
    if (bestMatch) {
      return {
        orphan,
        matched_schedule: bestMatch,
        match_reason: 'platform_nearest',
        time_delta_minutes: bestDelta
      }
    }
  }
  
  // No match found
  return {
    orphan,
    matched_schedule: null,
    match_reason: 'no_match',
    time_delta_minutes: null
  }
}

// Apply updates to database
async function applyUpdates(matches: BackfillMatch[]): Promise<number> {
  const { isSqlite } = getDatabaseConfig()
  const updatesToApply = matches.filter(m => m.matched_schedule)
  
  if (updatesToApply.length === 0) {
    return 0
  }
  
  if (isSqlite) {
    await db.connect()
    try {
      let updated = 0
      for (const match of updatesToApply) {
        const result = await db.query(`
          UPDATE posted_content 
          SET scheduled_post_id = ?, updated_at = datetime('now')
          WHERE id = ? AND scheduled_post_id IS NULL
        `, [match.matched_schedule!.id, match.orphan.id])
        
        if (result.rowCount && result.rowCount > 0) {
          updated++
        }
      }
      return updated
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase batch update
    const supabase = createSimpleClient()
    let updated = 0
    
    for (const match of updatesToApply) {
      const { error } = await supabase
        .from('posted_content')
        .update({ 
          scheduled_post_id: match.matched_schedule!.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', match.orphan.id)
        .is('scheduled_post_id', null)
      
      if (!error) {
        updated++
      }
    }
    
    return updated
  }
}

// Generate markdown report
function generateReport(result: BackfillResult): string {
  const timestamp = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss zzz')
  
  let report = `# Backfill Report: ${result.date}\n\n`
  report += `**Generated:** ${timestamp}\n`
  report += `**Mode:** ${result.dry_run ? 'DRY RUN' : 'WRITE'}\n\n`
  
  report += `## Summary\n\n`
  report += `- **Total Orphan Posts:** ${result.total_orphans}\n`
  report += `- **Matches Found:** ${result.matches_found}\n`
  report += `- **Exact Content ID Matches:** ${result.exact_matches}\n`
  report += `- **Platform Nearest Matches:** ${result.platform_matches}\n`
  report += `- **No Matches:** ${result.no_matches}\n`
  report += `- **Updates Applied:** ${result.updates_applied}\n\n`
  
  if (result.errors.length > 0) {
    report += `## Errors\n\n`
    result.errors.forEach(error => {
      report += `- ${error}\n`
    })
    report += `\n`
  }
  
  if (result.matches.length > 0) {
    report += `## Match Details\n\n`
    report += `| Orphan ID | Content Queue ID | Platform | Posted At | Match Type | Schedule ID | Time Delta (min) |\n`
    report += `|-----------|------------------|----------|-----------|------------|-------------|------------------|\n`
    
    result.matches.forEach(match => {
      const postedAt = formatInTimeZone(new Date(match.orphan.posted_at), TZ, 'HH:mm:ss')
      const scheduleId = match.matched_schedule?.id || 'N/A'
      const timeDelta = match.time_delta_minutes?.toFixed(1) || 'N/A'
      
      report += `| ${match.orphan.id} | ${match.orphan.content_queue_id} | ${match.orphan.platform || 'null'} | ${postedAt} | ${match.match_reason} | ${scheduleId} | ${timeDelta} |\n`
    })
  }
  
  return report
}

// Save report to file
function saveReport(result: BackfillResult) {
  const auditDir = join(process.cwd(), 'ci_audit')
  mkdirSync(auditDir, { recursive: true })
  
  const filename = `backfill-${result.date}.md`
  const filepath = join(auditDir, filename)
  const report = generateReport(result)
  
  writeFileSync(filepath, report, 'utf8')
  console.log(`📄 Report saved: ${filepath}`)
}

// Main execution
async function main() {
  const config = parseArgs()
  
  console.log(`🔧 Backfill Orphan Posts Job`)
  console.log(`📅 Date: ${config.date}`)
  console.log(`💾 Mode: ${config.write ? 'WRITE' : 'DRY RUN'}`)
  console.log(`📊 Database: ${getDatabaseConfig().isSqlite ? 'SQLite' : 'Supabase'}`)
  console.log()
  
  const result: BackfillResult = {
    date: config.date,
    total_orphans: 0,
    matches_found: 0,
    exact_matches: 0,
    platform_matches: 0,
    no_matches: 0,
    updates_applied: 0,
    dry_run: !config.write,
    matches: [],
    errors: []
  }
  
  try {
    // Get date range
    const { utcStart, utcEnd } = getDayUtcRange(config.date)
    console.log(`🕒 UTC Range: ${utcStart} to ${utcEnd}`)
    
    // Get orphan posts
    const orphanPosts = await getOrphanPosts(utcStart, utcEnd)
    result.total_orphans = orphanPosts.length
    console.log(`🔍 Found ${orphanPosts.length} orphan posts`)
    
    if (orphanPosts.length === 0) {
      console.log(`✅ No orphan posts found for ${config.date}`)
      saveReport(result)
      return
    }
    
    // Get scheduled posts
    const scheduledPosts = await getScheduledPosts(utcStart, utcEnd)
    console.log(`📅 Found ${scheduledPosts.length} scheduled posts`)
    
    // Find matches
    console.log(`🔎 Matching orphan posts...`)
    result.matches = orphanPosts.map(orphan => findBestMatch(orphan, scheduledPosts))
    
    // Count match types
    result.exact_matches = result.matches.filter(m => m.match_reason === 'exact_content_id').length
    result.platform_matches = result.matches.filter(m => m.match_reason === 'platform_nearest').length
    result.no_matches = result.matches.filter(m => m.match_reason === 'no_match').length
    result.matches_found = result.exact_matches + result.platform_matches
    
    console.log(`📊 Match Results:`)
    console.log(`   - Exact content ID matches: ${result.exact_matches}`)
    console.log(`   - Platform nearest matches: ${result.platform_matches}`)
    console.log(`   - No matches: ${result.no_matches}`)
    
    // Apply updates if not dry run
    if (config.write && result.matches_found > 0) {
      console.log(`💾 Applying ${result.matches_found} updates...`)
      result.updates_applied = await applyUpdates(result.matches)
      console.log(`✅ Applied ${result.updates_applied} updates`)
    } else if (result.matches_found > 0) {
      console.log(`🔍 DRY RUN: Would apply ${result.matches_found} updates`)
      result.updates_applied = 0
    }
    
    // Show detailed matches if verbose
    if (config.verbose && result.matches.length > 0) {
      console.log(`\n📋 Detailed Matches:`)
      result.matches.forEach((match, i) => {
        console.log(`  ${i + 1}. Orphan ${match.orphan.id} (content_queue_id: ${match.orphan.content_queue_id})`)
        if (match.matched_schedule) {
          console.log(`     → Matched to schedule ${match.matched_schedule.id} (${match.match_reason})`)
          console.log(`     → Time delta: ${match.time_delta_minutes?.toFixed(1)} minutes`)
        } else {
          console.log(`     → No match found`)
        }
      })
    }
    
  } catch (error: any) {
    const errorMsg = `Backfill failed: ${error.message}`
    console.error(`❌ ${errorMsg}`)
    result.errors.push(errorMsg)
  }
  
  // Save report
  saveReport(result)
  
  // Exit with appropriate code
  if (result.errors.length > 0) {
    process.exit(1)
  } else {
    console.log(`\n🎉 Backfill completed successfully`)
    process.exit(0)
  }
}

// Execute if run directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('backfill-post-links')
if (isMainModule) {
  main().catch(err => {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  })
}

export { main as backfillOrphanPosts }