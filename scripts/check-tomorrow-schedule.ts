/**
 * Check tomorrow's schedule for duplicate/already-posted content
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { format, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

async function checkTomorrowSchedule() {
  const supabase = createSimpleClient()

  const tomorrow = addDays(new Date(), 1)
  const etDate = toZonedTime(tomorrow, 'America/New_York')
  const tomorrowET = format(etDate, 'yyyy-MM-dd')

  console.log(`\n📅 Checking schedule for ${tomorrowET} (ET) - Tomorrow\n`)

  // Get scheduled posts for tomorrow
  const { data: slots, error: slotsError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, scheduled_post_time, status, created_at')
    .gte('scheduled_post_time', `${tomorrowET}T00:00:00`)
    .lt('scheduled_post_time', `${tomorrowET}T23:59:59`)
    .order('scheduled_post_time')

  if (slotsError) {
    console.error('❌ Error fetching slots:', slotsError)
    return
  }

  console.log(`Found ${slots?.length || 0} scheduled slots for tomorrow\n`)

  if (!slots || slots.length === 0) {
    console.log('⚠️ No schedule found for tomorrow')
    return
  }

  // Check for duplicates within tomorrow's schedule
  const contentIdMap = new Map<number, typeof slots>()
  for (const slot of slots) {
    if (!slot.content_id) continue
    if (!contentIdMap.has(slot.content_id)) {
      contentIdMap.set(slot.content_id, [])
    }
    contentIdMap.get(slot.content_id)!.push(slot)
  }

  const duplicates = Array.from(contentIdMap.entries())
    .filter(([_, slots]) => slots.length > 1)

  if (duplicates.length > 0) {
    console.log(`❌ Found ${duplicates.length} duplicate content_id(s) within tomorrow:\n`)
    for (const [contentId, dupSlots] of duplicates) {
      console.log(`Content ID ${contentId} scheduled ${dupSlots.length} times:`)
      for (const slot of dupSlots) {
        console.log(`  - Slot ${slot.id}: ${slot.scheduled_post_time} (${slot.status})`)
      }
      console.log()
    }
  } else {
    console.log(`✅ No duplicate content_ids within tomorrow's schedule\n`)
  }

  // Check if any content has already been posted
  const contentIds = slots.map(s => s.content_id).filter(Boolean)

  const { data: posted, error: postedError } = await supabase
    .from('posted_content')
    .select('content_queue_id, posted_at, platform')
    .in('content_queue_id', contentIds)

  if (postedError) {
    console.error('❌ Error checking posted_content:', postedError)
    return
  }

  const postedSet = new Set(posted?.map(p => p.content_queue_id) || [])

  if (posted && posted.length > 0) {
    console.log(`⚠️ Found ${posted.length} content item(s) already posted:\n`)

    const problematicSlots = slots.filter(s => s.content_id && postedSet.has(s.content_id))

    for (const slot of problematicSlots) {
      const postedInfo = posted.find(p => p.content_queue_id === slot.content_id)
      console.log(`Slot ${slot.id}: ${slot.scheduled_post_time}`)
      console.log(`  Content ID: ${slot.content_id}`)
      console.log(`  Already posted: ${postedInfo?.posted_at} to ${postedInfo?.platform}`)
      console.log(`  Created at: ${slot.created_at}`)
      console.log()
    }

    console.log(`\n⚠️ Recommendation: Clean up ${problematicSlots.length} problematic slot(s) before tomorrow`)
  } else {
    console.log(`✅ None of tomorrow's content was previously posted\n`)
  }

  // Show status breakdown
  const statusCounts = slots.reduce((acc, slot) => {
    acc[slot.status] = (acc[slot.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`📊 Status breakdown:`)
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`)
  }
}

checkTomorrowSchedule().catch(console.error)
