/**
 * Fix today's schedule by removing duplicate/already-posted content
 * and replacing with fresh content
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

async function fixTodaysSchedule() {
  const supabase = createSimpleClient()

  const now = new Date()
  const etDate = toZonedTime(now, 'America/New_York')
  const todayET = format(etDate, 'yyyy-MM-dd')

  console.log(`\n🔧 Fixing schedule for ${todayET} (ET)\n`)

  // 1. Find problematic slots (already posted or duplicate content_ids)
  const { data: slots, error: slotsError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning')
    .gte('scheduled_post_time', `${todayET}T00:00:00`)
    .lt('scheduled_post_time', `${todayET}T23:59:59`)
    .eq('status', 'pending')
    .order('scheduled_post_time')

  if (slotsError) {
    console.error('❌ Error fetching slots:', slotsError)
    return
  }

  console.log(`Found ${slots?.length || 0} pending slots for today\n`)

  // 2. Check which content is already posted
  const contentIds = slots?.map(s => s.content_id).filter(Boolean) || []

  if (contentIds.length === 0) {
    console.log('✅ No content to check')
    return
  }

  const { data: posted, error: postedError } = await supabase
    .from('posted_content')
    .select('content_queue_id')
    .in('content_queue_id', contentIds)

  if (postedError) {
    console.error('❌ Error checking posted_content:', postedError)
    return
  }

  const postedContentIds = new Set(posted?.map(p => p.content_queue_id) || [])

  console.log(`Found ${postedContentIds.size} content IDs already posted\n`)

  // 3. Find slots that need fixing
  const problematicSlots = slots?.filter(slot =>
    slot.content_id && postedContentIds.has(slot.content_id)
  ) || []

  if (problematicSlots.length === 0) {
    console.log('✅ No problematic slots found!')
    return
  }

  console.log(`❌ Found ${problematicSlots.length} problematic slots:\n`)

  for (const slot of problematicSlots) {
    console.log(`Slot ${slot.id}: ${slot.scheduled_post_time}`)
    console.log(`  Content ID: ${slot.content_id} (already posted)`)
    console.log(`  Will delete and let scheduler refill`)
    console.log()
  }

  // 4. Delete problematic slots
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
  console.log(`\n📅 Next steps:`)
  console.log(`  1. Run the scheduler to refill today's empty slots`)
  console.log(`  2. Verify new content is different from posted content`)
  console.log(`\n💡 You can trigger the scheduler with:`)
  console.log(`     gh workflow run scheduler.yml --field operation=refill`)
}

fixTodaysSchedule().catch(console.error)
