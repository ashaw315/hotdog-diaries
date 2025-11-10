/**
 * Check scheduled_day and scheduled_slot_index for today's slots
 */

import { createSimpleClient } from '@/utils/supabase/server'

async function checkSlotIndices() {
  const supabase = createSimpleClient()

  const { data: slots, error } = await supabase
    .from('scheduled_posts')
    .select('id, scheduled_day, scheduled_slot_index, scheduled_post_time, status, platform')
    .gte('scheduled_post_time', '2025-11-10T00:00:00')
    .lt('scheduled_post_time', '2025-11-11T00:00:00')
    .order('scheduled_post_time')

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('\n📊 Today\'s Slots (UTC 2025-11-10):\n')
  console.log('ID  | scheduled_day | slot_index | scheduled_post_time         | status | platform')
  console.log('----+---------------+------------+-----------------------------+--------+---------')

  for (const slot of slots || []) {
    const day = slot.scheduled_day || 'NULL'
    const idx = slot.scheduled_slot_index !== null ? slot.scheduled_slot_index : 'NULL'
    console.log(`${String(slot.id).padEnd(4)}| ${String(day).padEnd(13)} | ${String(idx).padEnd(10)} | ${slot.scheduled_post_time} | ${String(slot.status).padEnd(6)} | ${slot.platform}`)
  }

  // Also check by scheduled_day
  console.log('\n\n📊 Querying by scheduled_day = "2025-11-10":\n')

  const { data: daySlots, error: dayError } = await supabase
    .from('scheduled_posts')
    .select('id, scheduled_day, scheduled_slot_index, scheduled_post_time, status, platform')
    .eq('scheduled_day', '2025-11-10')
    .order('scheduled_slot_index')

  if (dayError) {
    console.error('❌ Error:', dayError)
    return
  }

  console.log(`Found ${daySlots?.length || 0} slots`)
  console.log('ID  | scheduled_day | slot_index | scheduled_post_time         | status | platform')
  console.log('----+---------------+------------+-----------------------------+--------+---------')

  for (const slot of daySlots || []) {
    const day = slot.scheduled_day || 'NULL'
    const idx = slot.scheduled_slot_index !== null ? slot.scheduled_slot_index : 'NULL'
    console.log(`${String(slot.id).padEnd(4)}| ${String(day).padEnd(13)} | ${String(idx).padEnd(10)} | ${slot.scheduled_post_time} | ${String(slot.status).padEnd(6)} | ${slot.platform}`)
  }
}

checkSlotIndices().catch(console.error)
