#!/usr/bin/env tsx

import { db } from '@/lib/db'
import * as fs from 'fs/promises'
import * as path from 'path'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { parseISO, formatISO, format } from 'date-fns'

interface TableInfo {
  scheduleTable: string
  historyTable: string  
  queueTable: string
}

interface ScheduledSlot {
  id: number
  slot_at_utc: string
  slot_local_tz?: string
  content_queue_id: number | null
  platform: string
  status: string
  created_at: string
}

interface PostedItem {
  id: number
  content_queue_id: number
  posted_at: string
  platform: string
  content_text?: string
  original_author?: string
}

interface ReportFlags {
  MISSING_SCHEDULE_ROW: number
  EMPTY_SLOT: number
  POSTED_WITHOUT_SCHEDULE: number
  SLOT_TIMEZONE_DRIFT: number
  CONTENT_MISMATCH: number
}

const UI_TIMEZONE = 'America/New_York'

async function detectTableNames(): Promise<TableInfo> {
  try {
    // Check if we're using SQLite or PostgreSQL
    const testQuery = await db.query("SELECT 1 as test")
    
    // Try to detect database type and check for tables
    let scheduleTable = ''
    let historyTable = ''
    let queueTable = 'content_queue' // This seems consistent
    
    try {
      // Check for scheduled_posts table (newer)
      await db.query("SELECT 1 FROM scheduled_posts LIMIT 1")
      scheduleTable = 'scheduled_posts'
    } catch {
      try {
        // Check for posting_schedule table (alternative)
        await db.query("SELECT 1 FROM posting_schedule LIMIT 1") 
        scheduleTable = 'posting_schedule'
      } catch {
        scheduleTable = ''
      }
    }
    
    try {
      // Check for posting_history table
      await db.query("SELECT 1 FROM posting_history LIMIT 1")
      historyTable = 'posting_history'
    } catch {
      try {
        // Check for posted_content table (alternative)
        await db.query("SELECT 1 FROM posted_content LIMIT 1")
        historyTable = 'posted_content'
      } catch {
        historyTable = ''
      }
    }
    
    // Verify content_queue exists
    try {
      await db.query("SELECT 1 FROM content_queue LIMIT 1")
    } catch {
      queueTable = ''
    }
    
    return { scheduleTable, historyTable, queueTable }
  } catch (error) {
    throw new Error(`Failed to detect table names: ${error}`)
  }
}

async function getScheduledSlots(tableInfo: TableInfo, date: string): Promise<ScheduledSlot[]> {
  if (!tableInfo.scheduleTable) return []
  
  let query: string
  let params: any[]
  
  if (tableInfo.scheduleTable === 'scheduled_posts') {
    // Format: scheduled_post_time, content_id  
    query = `
      SELECT 
        id,
        scheduled_post_time as slot_at_utc,
        'America/New_York' as slot_local_tz,
        content_id as content_queue_id,
        platform,
        CASE WHEN actual_posted_at IS NOT NULL THEN 'posted' ELSE 'scheduled' END as status,
        created_at
      FROM ${tableInfo.scheduleTable}
      WHERE DATE(scheduled_post_time) = ?
      ORDER BY scheduled_post_time
    `
    params = [date]
  } else {
    // Format: slot_at_utc, slot_local_tz
    query = `
      SELECT 
        id,
        slot_at_utc,
        slot_local_tz,
        content_queue_id,
        platform,
        status,
        created_at
      FROM ${tableInfo.scheduleTable}  
      WHERE DATE(slot_at_utc) = ?
      ORDER BY slot_at_utc
    `
    params = [date]
  }
  
  try {
    const result = await db.query(query, params)
    return result.rows as ScheduledSlot[]
  } catch (error) {
    console.error(`Error querying ${tableInfo.scheduleTable}:`, error)
    return []
  }
}

async function getPostedItems(tableInfo: TableInfo, date: string): Promise<PostedItem[]> {
  if (!tableInfo.historyTable || !tableInfo.queueTable) return []
  
  let query: string
  let params: any[]
  
  if (tableInfo.historyTable === 'posted_content') {
    // Use posted_content table structure
    query = `
      SELECT 
        pc.id,
        pc.content_queue_id,
        pc.posted_at,
        cq.source_platform as platform,
        cq.content_text,
        cq.original_author
      FROM ${tableInfo.historyTable} pc
      JOIN ${tableInfo.queueTable} cq ON pc.content_queue_id = cq.id
      WHERE DATE(pc.posted_at) = ?
      ORDER BY pc.posted_at
    `
  } else {
    // Use posting_history table structure  
    query = `
      SELECT 
        ph.id,
        ph.content_queue_id,
        ph.performed_at as posted_at,
        ph.platform,
        cq.content_text,
        cq.original_author
      FROM ${tableInfo.historyTable} ph
      JOIN ${tableInfo.queueTable} cq ON ph.content_queue_id = cq.id
      WHERE ph.action = 'posted' 
        AND DATE(ph.performed_at) = ?
      ORDER BY ph.performed_at
    `
  }
  
  params = [date]
  
  try {
    const result = await db.query(query, params)
    return result.rows as PostedItem[]
  } catch (error) {
    console.error(`Error querying ${tableInfo.historyTable}:`, error)
    return []
  }
}

function normalizeTimestamp(timestamp: string, targetTz: string): string {
  try {
    const utcDate = parseISO(timestamp)
    return formatInTimeZone(utcDate, targetTz, 'yyyy-MM-dd HH:mm:ss zzz')
  } catch {
    return timestamp
  }
}

function analyzeFlags(scheduled: ScheduledSlot[], posted: PostedItem[]): ReportFlags {
  const flags: ReportFlags = {
    MISSING_SCHEDULE_ROW: 0,
    EMPTY_SLOT: 0, 
    POSTED_WITHOUT_SCHEDULE: 0,
    SLOT_TIMEZONE_DRIFT: 0,
    CONTENT_MISMATCH: 0
  }
  
  // Count empty slots
  flags.EMPTY_SLOT = scheduled.filter(s => !s.content_queue_id).length
  
  // Find posted items without schedule
  for (const postedItem of posted) {
    const hasSchedule = scheduled.some(s => 
      s.content_queue_id === postedItem.content_queue_id
    )
    if (!hasSchedule) {
      flags.POSTED_WITHOUT_SCHEDULE++
    }
  }
  
  // Find content mismatches (scheduled content != posted content for same slot)
  for (const slot of scheduled) {
    if (slot.content_queue_id) {
      const matchingPost = posted.find(p => {
        const slotTime = parseISO(slot.slot_at_utc)
        const postTime = parseISO(p.posted_at)
        const timeDiff = Math.abs(slotTime.getTime() - postTime.getTime())
        return timeDiff < 3600000 // Within 1 hour
      })
      
      if (matchingPost && matchingPost.content_queue_id !== slot.content_queue_id) {
        flags.CONTENT_MISMATCH++
      }
    }
  }
  
  return flags
}

function generateMarkdownReport(
  date: string, 
  scheduled: ScheduledSlot[], 
  posted: PostedItem[],
  flags: ReportFlags,
  tableInfo: TableInfo
): string {
  const now = new Date()
  
  let report = `# Forecast vs Posted Report - ${date}\n\n`
  report += `**Generated:** ${formatISO(now)}\n`
  report += `**UI Timezone:** ${UI_TIMEZONE}\n`
  report += `**Tables Used:** ${tableInfo.scheduleTable || 'N/A'}, ${tableInfo.historyTable || 'N/A'}, ${tableInfo.queueTable || 'N/A'}\n\n`
  
  // Summary
  report += `## Summary\n\n`
  report += `- **Scheduled Slots:** ${scheduled.length}\n`
  report += `- **Posted Items:** ${posted.length}\n`
  report += `- **Empty Slots:** ${flags.EMPTY_SLOT}\n`
  report += `- **Content Mismatches:** ${flags.CONTENT_MISMATCH}\n`
  report += `- **Posted Without Schedule:** ${flags.POSTED_WITHOUT_SCHEDULE}\n\n`
  
  // Flag Summary
  report += `## Flags Summary\n\n`
  report += `| Flag | Count | Description |\n`
  report += `|------|-------|-------------|\n`
  report += `| EMPTY_SLOT | ${flags.EMPTY_SLOT} | Scheduled slots with no content assigned |\n`
  report += `| CONTENT_MISMATCH | ${flags.CONTENT_MISMATCH} | Scheduled content differs from posted content |\n`
  report += `| POSTED_WITHOUT_SCHEDULE | ${flags.POSTED_WITHOUT_SCHEDULE} | Content posted without corresponding schedule slot |\n`
  report += `| MISSING_SCHEDULE_ROW | ${flags.MISSING_SCHEDULE_ROW} | Expected schedule rows missing |\n`
  report += `| SLOT_TIMEZONE_DRIFT | ${flags.SLOT_TIMEZONE_DRIFT} | Timezone inconsistencies detected |\n\n`
  
  // Detailed Schedule vs Posted
  report += `## Detailed Analysis\n\n`
  report += `| Local Time | Scheduled | Posted | Status | Notes |\n`
  report += `|------------|-----------|--------|--------|---------|\n`
  
  // Group posted items by hour for easier matching
  const postedByHour = new Map<string, PostedItem[]>()
  for (const item of posted) {
    const localTime = normalizeTimestamp(item.posted_at, UI_TIMEZONE)
    const hour = localTime.substring(0, 13) // YYYY-MM-DD HH
    if (!postedByHour.has(hour)) postedByHour.set(hour, [])
    postedByHour.get(hour)!.push(item)
  }
  
  for (const slot of scheduled) {
    const localTime = normalizeTimestamp(slot.slot_at_utc, UI_TIMEZONE)
    const shortTime = localTime.substring(11, 16) // HH:MM
    
    let scheduledInfo = 'Empty'
    if (slot.content_queue_id) {
      scheduledInfo = `ID:${slot.content_queue_id} (${slot.platform})`
    }
    
    // Find matching posted items
    const slotHour = localTime.substring(0, 13)
    const matchingPosts = postedByHour.get(slotHour) || []
    
    let postedInfo = 'None'
    let status = '❌'
    let notes = ''
    
    if (matchingPosts.length > 0) {
      const exactMatch = matchingPosts.find(p => p.content_queue_id === slot.content_queue_id)
      if (exactMatch) {
        postedInfo = `ID:${exactMatch.content_queue_id} (${exactMatch.platform})`
        status = '✅'
      } else {
        postedInfo = matchingPosts.map(p => `ID:${p.content_queue_id} (${p.platform})`).join(', ')
        status = '⚠️'
        notes = 'Content mismatch'
      }
    } else if (!slot.content_queue_id) {
      status = '⚪' // Empty slot, no expectation
    }
    
    if (!slot.content_queue_id) {
      notes += notes ? '; Empty slot' : 'Empty slot'
    }
    
    report += `| ${shortTime} | ${scheduledInfo} | ${postedInfo} | ${status} | ${notes} |\n`
  }
  
  // Orphaned posts (posted without schedule)
  const orphanedPosts = posted.filter(p => 
    !scheduled.some(s => s.content_queue_id === p.content_queue_id)
  )
  
  if (orphanedPosts.length > 0) {
    report += `\n## Orphaned Posts (No Schedule)\n\n`
    report += `| Time | Content | Platform | Notes |\n`
    report += `|------|---------|----------|-------|\n`
    
    for (const post of orphanedPosts) {
      const localTime = normalizeTimestamp(post.posted_at, UI_TIMEZONE).substring(11, 16)
      const preview = post.content_text?.substring(0, 50) || 'N/A'
      report += `| ${localTime} | ID:${post.content_queue_id} "${preview}..." | ${post.platform} | Posted without schedule |\n`
    }
  }
  
  return report
}

async function main() {
  const args = process.argv.slice(2)
  let targetDate = args[0]
  
  if (!targetDate) {
    // Default to today in America/New_York timezone
    const now = new Date()
    targetDate = formatInTimeZone(now, UI_TIMEZONE, 'yyyy-MM-dd')
  }
  
  console.log(`🔍 Generating forecast vs posted report for ${targetDate}`)
  
  try {
    await db.connect()
    
    // Detect available tables
    const tableInfo = await detectTableNames()
    
    if (!tableInfo.queueTable) {
      console.error(`❌ ERROR: content_queue table not found`)
      console.error(`\nTable Detection Results:`)
      console.error(`- Schedule table: ${tableInfo.scheduleTable || 'NOT FOUND'}`)
      console.error(`- History table: ${tableInfo.historyTable || 'NOT FOUND'}`)
      console.error(`- Queue table: ${tableInfo.queueTable || 'NOT FOUND'}`)
      console.error(`\nGuidance:`)
      console.error(`- Ensure database is properly migrated`)
      console.error(`- Check that content_queue table exists`)
      console.error(`- Verify DATABASE_URL is correctly set`)
      process.exit(1)
    }
    
    if (!tableInfo.scheduleTable && !tableInfo.historyTable) {
      console.error(`❌ ERROR: No schedule or history tables found`)
      console.error(`\nExpected tables:`)
      console.error(`- scheduled_posts (preferred) or posting_schedule`)
      console.error(`- posting_history (preferred) or posted_content`)
      console.error(`- content_queue (required)`)
      console.error(`\nFound:`)
      console.error(`- Schedule: ${tableInfo.scheduleTable || 'MISSING'}`)
      console.error(`- History: ${tableInfo.historyTable || 'MISSING'}`)
      console.error(`- Queue: ${tableInfo.queueTable || 'MISSING'}`)
      process.exit(1)
    }
    
    console.log(`📊 Using tables: schedule=${tableInfo.scheduleTable}, history=${tableInfo.historyTable}, queue=${tableInfo.queueTable}`)
    
    // Get data
    const [scheduled, posted] = await Promise.all([
      getScheduledSlots(tableInfo, targetDate),
      getPostedItems(tableInfo, targetDate)
    ])
    
    console.log(`📅 Found ${scheduled.length} scheduled slots, ${posted.length} posted items`)
    
    // Analyze flags
    const flags = analyzeFlags(scheduled, posted)
    
    // Generate report
    const report = generateMarkdownReport(targetDate, scheduled, posted, flags, tableInfo)
    
    // Save report
    const outputDir = path.join(process.cwd(), 'ci_audit')
    await fs.mkdir(outputDir, { recursive: true })
    
    const outputPath = path.join(outputDir, `forecast_vs_posted-${targetDate}.md`)
    await fs.writeFile(outputPath, report)
    
    console.log(`📄 Report saved to: ${outputPath}`)
    
    // Print summary
    const totalFlags = Object.values(flags).reduce((sum, count) => sum + count, 0)
    console.log(`\n📋 Summary: ${totalFlags} total flags - EMPTY_SLOT:${flags.EMPTY_SLOT}, CONTENT_MISMATCH:${flags.CONTENT_MISMATCH}, POSTED_WITHOUT_SCHEDULE:${flags.POSTED_WITHOUT_SCHEDULE}, MISSING_SCHEDULE_ROW:${flags.MISSING_SCHEDULE_ROW}, SLOT_TIMEZONE_DRIFT:${flags.SLOT_TIMEZONE_DRIFT}`)
    
  } catch (error) {
    console.error(`❌ Error generating report:`, error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Execute if this file is run directly
main().catch(console.error)