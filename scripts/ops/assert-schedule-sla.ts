#!/usr/bin/env tsx

/**
 * Assert Schedule SLA
 * 
 * Checks that both today and tomorrow have sufficient scheduled content.
 * Runs at 06:10 ET to catch scheduling failures before first posting.
 */

import { parseArgs } from 'node:util'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { startOfDay, endOfDay, parseISO, addDays } from 'date-fns'
import { db } from '../../lib/db'
import { createClient } from '@supabase/supabase-js'

interface Args {
  tz: string
  today: number
  tomorrow: number
}

// Check if Supabase is available
const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { values } = parseArgs({
    options: {
      tz: { type: 'string', default: 'America/New_York' },
      today: { type: 'string', default: '6' },
      tomorrow: { type: 'string', default: '6' }
    }
  })

  const args: Args = {
    tz: values.tz!,
    today: parseInt(values.today!, 10),
    tomorrow: parseInt(values.tomorrow!, 10)
  }

  console.log(`🕐 SLA Guard: Checking schedule compliance at ${new Date().toISOString()}`)
  console.log(`📍 Timezone: ${args.tz}`)
  console.log(`🎯 Required: Today=${args.today}, Tomorrow=${args.tomorrow}`)

  try {
    if (!useSupabase) {
      await db.connect()
    }

    // Get local dates
    const now = new Date()
    const todayLocal = formatInTimeZone(now, args.tz, 'yyyy-MM-dd')
    const tomorrowLocal = formatInTimeZone(addDays(now, 1), args.tz, 'yyyy-MM-dd')

    const todayDate = parseISO(todayLocal)
    const tomorrowDate = parseISO(tomorrowLocal)

    console.log(`📅 Checking: ${todayLocal} (today) and ${tomorrowLocal} (tomorrow)`)

    // Check today's schedule
    const todayCount = await checkDateSchedule(todayDate, args.tz, 'today')
    const tomorrowCount = await checkDateSchedule(tomorrowDate, args.tz, 'tomorrow')

    let failures: string[] = []

    if (todayCount < args.today) {
      failures.push(`Today: ${todayCount}/${args.today}`)
    }

    if (tomorrowCount < args.tomorrow) {
      failures.push(`Tomorrow: ${tomorrowCount}/${args.tomorrow}`)
    }

    if (failures.length === 0) {
      console.log(`✅ SLA PASS: Both days have sufficient content`)
      console.log(`   Today: ${todayCount}/${args.today}`)
      console.log(`   Tomorrow: ${tomorrowCount}/${args.tomorrow}`)
      if (!useSupabase) await db.disconnect()
      process.exit(0)
    } else {
      console.error(`❌ SLA FAIL: ${failures.join(', ')}`)
      console.error(``)
      console.error(`🚨 URGENT ACTIONS:`)
      console.error(`   1. Trigger scheduler: gh workflow run scheduler.yml --ref main`)
      console.error(`   2. Manual schedule: pnpm tsx scripts/ops/materialize-schedule.ts --dates ${todayLocal},${tomorrowLocal}`)
      console.error(`   3. Check queue levels: pnpm tsx scripts/ops/check-queue-readiness.ts`)
      console.error(`   4. If queue low, trigger scanners: gh workflow run scan-*.yml --ref main`)
      console.error(``)
      if (!useSupabase) await db.disconnect()
      process.exit(1)
    }
  } catch (error) {
    console.error(`❌ SLA check failed:`, error)
    if (!useSupabase) await db.disconnect()
    process.exit(1)
  }
}

async function checkDateSchedule(date: Date, tz: string, label: string): Promise<number> {
  const localStart = startOfDay(date)
  const localEnd = endOfDay(date)
  const utcStart = toZonedTime(localStart, tz)
  const utcEnd = toZonedTime(localEnd, tz)

  let count = 0

  if (useSupabase) {
    // Use Supabase client for CI/production
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error, count: resultCount } = await supabase
      .from('scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_post_time', utcStart.toISOString())
      .lte('scheduled_post_time', utcEnd.toISOString())
      .not('content_id', 'is', null)

    if (error) {
      console.error(`❌ Supabase query error for ${label}:`, error)
      throw error
    }

    count = resultCount || 0
  } else {
    // Use db.query for local development
    const query = `
      SELECT COUNT(*) as count
      FROM scheduled_posts
      WHERE scheduled_post_time >= ?
        AND scheduled_post_time <= ?
        AND content_id IS NOT NULL
    `

    const result = await db.query(query, [utcStart.toISOString(), utcEnd.toISOString()])
    count = result.rows[0]?.count || 0
  }

  console.log(`📊 ${label}: ${count} scheduled posts`)
  return count
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('assert-schedule-sla')
if (isMainModule) {
  main().catch(console.error)
}

export { main as assertScheduleSLA }