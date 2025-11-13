#!/usr/bin/env tsx

/**
 * Debug script to check the 8 AM slot scheduling
 */

import { createClient } from '@supabase/supabase-js'

async function check8AMSlot() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log('🔍 Checking 8 AM slot for 2025-11-13...\\n')

  // Query scheduled_posts for today
  const { data: scheduled, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('scheduled_day', '2025-11-13')
    .order('scheduled_slot_index')

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(`Found ${scheduled?.length || 0} scheduled posts for 2025-11-13:\\n`)

  scheduled?.forEach((post: any) => {
    const scheduledTime = new Date(post.scheduled_post_time)
    const nowUTC = new Date()
    const isPast = scheduledTime <= nowUTC

    console.log(`Slot ${post.scheduled_slot_index}:`)
    console.log(`  Content ID: ${post.content_id}`)
    console.log(`  Scheduled Time (UTC): ${post.scheduled_post_time}`)
    console.log(`  Scheduled Time (Local): ${scheduledTime.toLocaleString('en-US', { timeZone: 'America/New_York' })}`)
    console.log(`  Current Time (UTC): ${nowUTC.toISOString()}`)
    console.log(`  Has Passed?: ${isPast ? 'YES (would be marked as missed)' : 'NO (should be upcoming)'}`)
    console.log(`  Actual Posted At: ${post.actual_posted_at || 'Not posted'}`)
    console.log(`  Platform: ${post.platform}`)
    console.log()
  })

  // Check if there's supposed to be a slot 0 (8 AM)
  const slot0 = scheduled?.find((s: any) => s.scheduled_slot_index === 0)
  if (!slot0) {
    console.log('⚠️ No entry found for slot 0 (8 AM)!')
  } else if (new Date(slot0.scheduled_post_time) <= new Date()) {
    console.log(`⚠️ Slot 0 scheduled_post_time (${slot0.scheduled_post_time}) is in the PAST!`)
    console.log(`   This is why it's marked as "Missed"`)
    console.log(`   Expected: Around 13:00 UTC (8 AM EST)`)
  }
}

check8AMSlot()
