#!/usr/bin/env tsx

/**
 * Materialize Schedule
 * 
 * Creates scheduled_posts rows for specified dates, even when content queue is low.
 * Ensures schedule slots exist for reliable posting, fills with available content.
 */

import { parseArgs } from 'node:util'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { parseISO, format } from 'date-fns'
import { db } from '../../lib/db'

interface Args {
  dates: string[]
  tz: string
  force: boolean
}

interface SlotConfig {
  slot_index: number
  time_et: string
  time_utc: string
}

interface MaterializationMetrics {
  dates_processed: number
  rows_created: number
  rows_filled: number
  rows_empty: number
  errors: string[]
}

// Standard posting times in ET
const POSTING_SLOTS = [
  { slot_index: 0, time_et: '08:00' }, // Breakfast
  { slot_index: 1, time_et: '12:00' }, // Lunch
  { slot_index: 2, time_et: '15:00' }, // Snack
  { slot_index: 3, time_et: '18:00' }, // Dinner
  { slot_index: 4, time_et: '21:00' }, // Evening
  { slot_index: 5, time_et: '23:30' }  // Late Night
]

async function main() {
  const { values } = parseArgs({
    options: {
      dates: { type: 'string', default: '' },
      tz: { type: 'string', default: 'America/New_York' },
      force: { type: 'boolean', default: false }
    }
  })

  const args: Args = {
    dates: values.dates ? values.dates.split(',').map(d => d.trim()) : [],
    tz: values.tz!,
    force: values.force!
  }

  if (args.dates.length === 0) {
    console.error('❌ No dates provided. Use --dates YYYY-MM-DD or --dates YYYY-MM-DD,YYYY-MM-DD')
    process.exit(1)
  }

  console.log(`📅 Materializing schedule for ${args.dates.length} date(s)`)
  console.log(`📍 Timezone: ${args.tz}`)
  console.log(`🔄 Force mode: ${args.force ? 'ON' : 'OFF'}`)
  
  const metrics: MaterializationMetrics = {
    dates_processed: 0,
    rows_created: 0,
    rows_filled: 0,
    rows_empty: 0,
    errors: []
  }

  try {
    await db.connect()

    for (const dateStr of args.dates) {
      console.log(`\n📆 Processing ${dateStr}...`)
      
      try {
        const dateMetrics = await materializeDate(dateStr, args.tz, args.force)
        
        metrics.dates_processed++
        metrics.rows_created += dateMetrics.rows_created
        metrics.rows_filled += dateMetrics.rows_filled
        metrics.rows_empty += dateMetrics.rows_empty
        
        console.log(`   ✅ ${dateStr}: Created ${dateMetrics.rows_created}, Filled ${dateMetrics.rows_filled}, Empty ${dateMetrics.rows_empty}`)
        
      } catch (error) {
        const errorMsg = `${dateStr}: ${error instanceof Error ? error.message : String(error)}`
        metrics.errors.push(errorMsg)
        console.error(`   ❌ ${errorMsg}`)
      }
    }

    // Print final metrics
    console.log(`\n📊 Materialization Summary:`)
    console.log(`   Dates processed: ${metrics.dates_processed}/${args.dates.length}`)
    console.log(`   Total rows created: ${metrics.rows_created}`)
    console.log(`   Rows filled with content: ${metrics.rows_filled}`)
    console.log(`   Empty rows (awaiting content): ${metrics.rows_empty}`)
    
    if (metrics.errors.length > 0) {
      console.log(`   Errors: ${metrics.errors.length}`)
      metrics.errors.forEach(error => console.log(`     - ${error}`))
    }

    await db.disconnect()
    
    // Exit with error if any dates failed
    process.exit(metrics.errors.length > 0 ? 1 : 0)
    
  } catch (error) {
    console.error('❌ Materialization failed:', error)
    await db.disconnect()
    process.exit(1)
  }
}

async function materializeDate(dateStr: string, tz: string, force: boolean) {
  const date = parseISO(dateStr)
  const metrics = { rows_created: 0, rows_filled: 0, rows_empty: 0 }
  
  // Generate slot configurations for this date
  const slots = POSTING_SLOTS.map(slot => ({
    slot_index: slot.slot_index,
    time_et: slot.time_et,
    time_utc: convertETtoUTC(dateStr, slot.time_et, tz)
  }))

  for (const slot of slots) {
    const existing = await checkExistingSlot(slot.time_utc)
    
    if (existing && !force) {
      console.log(`     📋 ${slot.time_et}: Already exists (ID ${existing.id})`)
      continue
    }

    if (existing && force) {
      // Update existing empty slot
      if (!existing.content_id) {
        const content = await findBestContent(slot.slot_index)
        await updateSlot(existing.id, content)
        
        if (content) {
          metrics.rows_filled++
          console.log(`     🔄 ${slot.time_et}: Updated with content ${content.id}`)
        } else {
          metrics.rows_empty++
          console.log(`     🔄 ${slot.time_et}: Updated but no content available`)
        }
      }
      continue
    }

    // Create new slot
    const content = await findBestContent(slot.slot_index)
    const newSlotId = await createSlot(slot, content)
    
    metrics.rows_created++
    
    if (content) {
      metrics.rows_filled++
      console.log(`     ✨ ${slot.time_et}: Created with content ${content.id}`)
    } else {
      metrics.rows_empty++
      console.log(`     ⚪ ${slot.time_et}: Created empty (awaiting content)`)
    }
  }

  return metrics
}

function convertETtoUTC(dateStr: string, timeET: string, tz: string): string {
  const datetimeET = `${dateStr}T${timeET}:00`
  const zonedTime = toZonedTime(parseISO(datetimeET), tz)
  return zonedTime.toISOString()
}

async function checkExistingSlot(scheduledTime: string) {
  const query = `
    SELECT id, content_id, scheduled_post_time
    FROM scheduled_posts 
    WHERE scheduled_post_time = ?
  `
  const result = await db.query(query, [scheduledTime])
  return result.rows[0] || null
}

async function findBestContent(slotIndex: number) {
  // Find highest confidence approved content that's not already scheduled
  const query = `
    SELECT id, source_platform, content_type, confidence_score
    FROM content_queue cq
    WHERE is_approved = true 
      AND COALESCE(is_posted, false) = false
      AND COALESCE(ingest_priority, 0) >= 0
      AND NOT EXISTS (
        SELECT 1 FROM scheduled_posts sp 
        WHERE sp.content_id = cq.id
      )
    ORDER BY confidence_score DESC, created_at ASC
    LIMIT 1
  `
  
  const result = await db.query(query)
  return result.rows[0] || null
}

async function createSlot(slot: SlotConfig, content: any) {
  const query = `
    INSERT INTO scheduled_posts (
      content_id,
      platform,
      content_type,
      scheduled_post_time,
      scheduled_slot_index,
      reasoning,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `
  
  const reasoning = content 
    ? `Auto-selected: confidence=${content.confidence_score}, platform=${content.source_platform}`
    : 'awaiting_refill'
    
  const values = [
    content?.id || null,
    content?.source_platform || null,
    content?.content_type || null,
    slot.time_utc,
    slot.slot_index,
    reasoning
  ]
  
  const result = await db.query(query, values)
  return result.insertId || result.rowCount
}

async function updateSlot(slotId: number, content: any) {
  const query = `
    UPDATE scheduled_posts 
    SET 
      content_id = ?,
      platform = ?,
      content_type = ?,
      reasoning = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `
  
  const reasoning = content 
    ? `Auto-filled: confidence=${content.confidence_score}, platform=${content.source_platform}`
    : 'awaiting_refill'
    
  const values = [
    content?.id || null,
    content?.source_platform || null,
    content?.content_type || null,
    reasoning,
    slotId
  ]
  
  await db.query(query, values)
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('materialize-schedule')
if (isMainModule) {
  main().catch(console.error)
}

export { main as materializeSchedule }