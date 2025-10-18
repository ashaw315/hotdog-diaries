#!/usr/bin/env tsx

/**
 * Assert Schedule Ready
 * 
 * Verifies that sufficient scheduled content exists for a given date.
 * Used by posting guard workflows to fail early if schedule is incomplete.
 */

import { parseArgs } from 'node:util'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { startOfDay, endOfDay, parseISO, addDays } from 'date-fns'
import { db } from '../../lib/db'

interface Args {
  tz: string
  date: string
  min: number
}

async function main() {
  const { values } = parseArgs({
    options: {
      tz: { type: 'string', default: 'America/New_York' },
      date: { type: 'string', default: 'today' },
      min: { type: 'string', default: '6' }
    }
  })

  const args: Args = {
    tz: values.tz!,
    date: values.date!,
    min: parseInt(values.min!, 10)
  }

  console.log(`🛡️ Posting Guard: Checking schedule readiness`)
  console.log(`📅 Date: ${args.date} (${args.tz})`)
  console.log(`🎯 Minimum slots required: ${args.min}`)

  try {
    await db.connect()

    // Resolve date parameter
    let targetDate: Date
    if (args.date === 'today') {
      const now = new Date()
      const localNow = formatInTimeZone(now, args.tz, 'yyyy-MM-dd')
      targetDate = parseISO(localNow)
    } else {
      targetDate = parseISO(args.date)
    }

    // Convert to UTC range for database query
    const localStart = startOfDay(targetDate)
    const localEnd = endOfDay(targetDate)
    const utcStart = toZonedTime(localStart, args.tz)
    const utcEnd = toZonedTime(localEnd, args.tz)

    console.log(`🔍 Checking range: ${utcStart.toISOString()} to ${utcEnd.toISOString()}`)

    // Count scheduled posts for the target date
    const query = `
      SELECT COUNT(*) as count 
      FROM scheduled_posts 
      WHERE scheduled_post_time >= ? 
        AND scheduled_post_time <= ?
        AND content_id IS NOT NULL
    `
    
    const result = await db.query(query, [utcStart.toISOString(), utcEnd.toISOString()])
    const scheduledCount = result.rows[0]?.count || 0

    console.log(`📊 Found ${scheduledCount} scheduled posts for ${formatInTimeZone(targetDate, args.tz, 'yyyy-MM-dd')}`)

    if (scheduledCount >= args.min) {
      console.log(`✅ PASS: Schedule has sufficient content (${scheduledCount} >= ${args.min})`)
      await db.disconnect()
      process.exit(0)
    } else {
      console.error(`❌ FAIL: Insufficient scheduled content (${scheduledCount} < ${args.min})`)
      console.error(``)
      console.error(`🚨 IMMEDIATE ACTION REQUIRED:`)
      console.error(`   1. Check content scheduler: gh workflow run content-scheduler.yml --ref main`)
      console.error(`   2. Manually schedule: pnpm tsx scripts/ops/materialize-schedule.ts --dates ${formatInTimeZone(targetDate, args.tz, 'yyyy-MM-dd')}`)
      console.error(`   3. Trigger content scanners if queue is low`)
      console.error(``)
      await db.disconnect()
      process.exit(1)
    }
  } catch (error) {
    console.error(`❌ Database error:`, error)
    await db.disconnect()
    process.exit(1)
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('assert-schedule-ready')
if (isMainModule) {
  main().catch(console.error)
}

export { main as assertScheduleReady }