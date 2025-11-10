/**
 * Fix tomorrow's schedule by removing duplicate/already-posted content
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { format, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

async function fixTomorrowSchedule() {
  const supabase = createSimpleClient()

  const tomorrow = addDays(new Date(), 1)
  const etDate = toZonedTime(tomorrow, 'America/New_York')
  const tomorrowET = format(etDate, 'yyyy-MM-dd')

  console.log(`\n🔧 Fixing schedule for ${tomorrowET} (ET) - Tomorrow\n`)

  // Get scheduled posts for tomorrow
  const { data: slots, error: slotsError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, scheduled_post_time, status')
    .gte('scheduled_post_time', `${tomorrowET}T00:00:00`)
    .lt('scheduled_post_time', `${tomorrowET}T23:59:59`)
    .eq('status', 'pending')
    .order('scheduled_post_time')

  if (slotsError) {
    console.error('❌ Error fetching slots:', slotsError)
    return
  }

  console.log(`Found ${slots?.length || 0} pending slots for tomorrow\n`)

  if (!slots || slots.length === 0) {
    console.log('✅ No slots to fix')
    return
  }

  // Check which content is already posted
  const contentIds = slots.map(s => s.content_id).filter(Boolean)

  const { data: posted, error: postedError } = await supabase
    .from('posted_content')
    .select('content_queue_id')
    .in('content_queue_id', contentIds)

  if (postedError) {
    console.error('❌ Error checking posted_content:', postedError)
    return
  }

  const postedContentIds = new Set(posted?.map(p => p.content_queue_id) || [])

  // Find slots with already-posted content
  const alreadyPostedSlots = slots.filter(s => s.content_id && postedContentIds.has(s.content_id))

  // Find duplicate content_ids and keep only the first occurrence
  const seenContentIds = new Set<number>()
  const duplicateSlots = []

  for (const slot of slots) {
    if (!slot.content_id) continue

    if (seenContentIds.has(slot.content_id)) {
      duplicateSlots.push(slot)
    } else {
      seenContentIds.add(slot.content_id)
    }
  }

  const problematicSlots = [...new Set([...alreadyPostedSlots, ...duplicateSlots])]

  if (problematicSlots.length === 0) {
    console.log('✅ No problematic slots found!')
    return
  }

  console.log(`❌ Found ${problematicSlots.length} problematic slots:\n`)

  for (const slot of problematicSlots) {
    const isPosted = postedContentIds.has(slot.content_id!)
    const isDuplicate = duplicateSlots.includes(slot)
    const reasons = []

    if (isPosted) reasons.push('already posted')
    if (isDuplicate) reasons.push('duplicate')

    console.log(`Slot ${slot.id}: ${slot.scheduled_post_time}`)
    console.log(`  Content ID: ${slot.content_id} (${reasons.join(', ')})`)
    console.log(`  Will delete and let scheduler refill`)
    console.log()
  }

  // Delete problematic slots
  const slotIds = problematicSlots.map(s => s.id)

  const { error: deleteError } = await supabase
    .from('scheduled_posts')
    .delete()
    .in('id', slotIds)

  if (deleteError) {
    console.error('❌ Error deleting slots:', deleteError)
    return
  }

  console.log(`✅ Deleted ${slotIds.length} problematic slots`)
  console.log(`\n📅 The nightly scheduler will refill these slots automatically at 1 AM UTC (9 PM ET tonight)`)
}

fixTomorrowSchedule().catch(console.error)
