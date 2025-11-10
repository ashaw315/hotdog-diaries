/**
 * Check today's schedule
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

async function checkTodaySchedule() {
  const supabase = createSimpleClient()

  const now = new Date()
  const etDate = toZonedTime(now, 'America/New_York')
  const todayET = format(etDate, 'yyyy-MM-dd')

  console.log(`\n📅 Checking schedule for ${todayET} (ET) - Today\n`)

  // Get scheduled posts for today
  const { data: slots, error: slotsError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, scheduled_post_time, status')
    .gte('scheduled_post_time', `${todayET}T00:00:00`)
    .lt('scheduled_post_time', `${todayET}T23:59:59`)
    .order('scheduled_post_time')

  if (slotsError) {
    console.error('❌ Error fetching slots:', slotsError)
    return
  }

  console.log(`Found ${slots?.length || 0} scheduled slots for today\n`)

  if (!slots || slots.length === 0) {
    console.log('⚠️ No schedule found for today')
    return
  }

  // Check status breakdown
  const statusCounts = slots.reduce((acc, slot) => {
    acc[slot.status] = (acc[slot.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`📊 Status breakdown:`)
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`)
  }

  console.log(`\n📊 Total slots: ${slots.length}/6`)

  if (slots.length < 6) {
    console.log(`⚠️ Schedule incomplete: missing ${6 - slots.length} slot(s)`)
  } else if (slots.length === 6) {
    console.log(`✅ Schedule complete!`)
  } else {
    console.log(`⚠️ Too many slots: ${slots.length} (expected 6)`)
  }

  // Show each slot
  console.log(`\n📋 Today's slots:`)
  for (const slot of slots) {
    console.log(`  Slot ${slot.id}: ${slot.scheduled_post_time} - ${slot.status}`)
  }
}

checkTodaySchedule().catch(console.error)
