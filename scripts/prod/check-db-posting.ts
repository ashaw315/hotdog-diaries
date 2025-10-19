#!/usr/bin/env tsx

/**
 * Check Supabase database for scheduled and posted content
 */

import { parseArgs } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { getTodayET, getTomorrowET, getUTCWindow } from './lib/time'

interface Args {
  date?: string
}

interface DBCheckResult {
  date: string
  tomorrow: string
  scheduleTodayCount: number
  scheduleTodayNonNull: number
  scheduleTomorrowCount: number
  scheduleTomorrowNonNull: number
  postedTodayCount: number
  flags: {
    SCHEDULE_TODAY_OK: boolean
    SCHEDULE_TOMORROW_OK: boolean
    NON_NULL_BIND_RATIO_TODAY: number
    POSTED_COUNT_TODAY: number
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: 'string' }
    }
  })

  const args: Args = {
    date: values.date || getTodayET()
  }

  const tomorrow = values.date 
    ? new Date(values.date + 'T12:00:00').toISOString().split('T')[0]
    : getTomorrowET()

  console.log(`🔍 Checking database for ${args.date} and ${tomorrow}`)

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || 'https://ulaadphxfsrihoubjdrb.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!supabaseKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Get UTC windows for today and tomorrow
  const todayWindow = getUTCWindow(args.date!)
  const tomorrowWindow = getUTCWindow(tomorrow)

  console.log(`  Today UTC: ${todayWindow.startUTC.toISOString()} to ${todayWindow.endUTC.toISOString()}`)
  console.log(`  Tomorrow UTC: ${tomorrowWindow.startUTC.toISOString()} to ${tomorrowWindow.endUTC.toISOString()}`)

  // Check scheduled_posts for today
  const { data: todaySchedule, error: todayError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, scheduled_post_time')
    .gte('scheduled_post_time', todayWindow.startUTC.toISOString())
    .lte('scheduled_post_time', todayWindow.endUTC.toISOString())

  if (todayError) {
    console.error('❌ Error querying today schedule:', todayError)
    process.exit(1)
  }

  // Check scheduled_posts for tomorrow
  const { data: tomorrowSchedule, error: tomorrowError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, scheduled_post_time')
    .gte('scheduled_post_time', tomorrowWindow.startUTC.toISOString())
    .lte('scheduled_post_time', tomorrowWindow.endUTC.toISOString())

  if (tomorrowError) {
    console.error('❌ Error querying tomorrow schedule:', tomorrowError)
    process.exit(1)
  }

  // Check posted_content for today
  const { data: todayPosted, error: postedError } = await supabase
    .from('posted_content')
    .select('id, content_queue_id, posted_at')
    .gte('posted_at', todayWindow.startUTC.toISOString())
    .lte('posted_at', todayWindow.endUTC.toISOString())

  if (postedError) {
    console.error('❌ Error querying posted content:', postedError)
    process.exit(1)
  }

  // Calculate metrics
  const scheduleTodayCount = todaySchedule?.length || 0
  const scheduleTodayNonNull = todaySchedule?.filter(s => s.content_id).length || 0
  const scheduleTomorrowCount = tomorrowSchedule?.length || 0
  const scheduleTomorrowNonNull = tomorrowSchedule?.filter(s => s.content_id).length || 0
  const postedTodayCount = todayPosted?.length || 0

  const result: DBCheckResult = {
    date: args.date!,
    tomorrow,
    scheduleTodayCount,
    scheduleTodayNonNull,
    scheduleTomorrowCount,
    scheduleTomorrowNonNull,
    postedTodayCount,
    flags: {
      SCHEDULE_TODAY_OK: scheduleTodayCount >= 6,
      SCHEDULE_TOMORROW_OK: scheduleTomorrowCount >= 6,
      NON_NULL_BIND_RATIO_TODAY: scheduleTodayCount > 0 ? scheduleTodayNonNull / scheduleTodayCount : 0,
      POSTED_COUNT_TODAY: postedTodayCount
    }
  }

  console.log('📊 Database metrics:')
  console.log(`  Today schedule: ${scheduleTodayCount} slots (${scheduleTodayNonNull} filled)`)
  console.log(`  Tomorrow schedule: ${scheduleTomorrowCount} slots (${scheduleTomorrowNonNull} filled)`)
  console.log(`  Posted today: ${postedTodayCount}`)

  // Save results
  await mkdir('ci_audit/watchdog', { recursive: true })
  await writeFile(
    'ci_audit/watchdog/db-today.json',
    JSON.stringify(result, null, 2)
  )

  // Check for issues
  if (!result.flags.SCHEDULE_TODAY_OK) {
    console.error(`❌ Today's schedule incomplete: ${scheduleTodayCount}/6 slots`)
    process.exit(1)
  }

  if (!result.flags.SCHEDULE_TOMORROW_OK) {
    console.error(`⚠️  Tomorrow's schedule incomplete: ${scheduleTomorrowCount}/6 slots`)
    // Don't exit with error for tomorrow, just warn
  }

  if (result.flags.NON_NULL_BIND_RATIO_TODAY < 0.5 && scheduleTodayCount > 0) {
    console.error(`⚠️  Low content binding: ${Math.round(result.flags.NON_NULL_BIND_RATIO_TODAY * 100)}%`)
  }

  console.log('✅ Database checks complete')
}

// ES module check for direct execution
if (process.argv[1] && process.argv[1].includes('check-db-posting')) {
  main().catch(console.error)
}

export { main as checkDBPosting }