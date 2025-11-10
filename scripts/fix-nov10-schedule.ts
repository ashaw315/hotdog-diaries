/**
 * Fix Nov 10 schedule by:
 * 1. Deleting corrupt slots (indices 4 & 5 with wrong times)
 * 2. Running scheduler to fill missing slots (indices 2, 3, 4, 5)
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { generateDailySchedule } from '@/lib/jobs/schedule-content-production'

async function fixNov10Schedule() {
  const supabase = createSimpleClient()

  console.log('\n🔧 Fixing Nov 10 schedule\n')

  // Step 1: Delete corrupt slots (indices 4 & 5 with Nov 11 times)
  console.log('Step 1: Deleting corrupt slots...')

  const { data: corruptSlots, error: findError } = await supabase
    .from('scheduled_posts')
    .select('id, scheduled_day, scheduled_slot_index, scheduled_post_time, status')
    .eq('scheduled_day', '2025-11-10')
    .in('scheduled_slot_index', [4, 5])

  if (findError) {
    console.error('❌ Error finding corrupt slots:', findError)
    return
  }

  console.log(`Found ${corruptSlots?.length || 0} corrupt slots:`)
  for (const slot of corruptSlots || []) {
    console.log(`  - Slot ${slot.id}: index ${slot.scheduled_slot_index}, time ${slot.scheduled_post_time}`)
  }

  if (corruptSlots && corruptSlots.length > 0) {
    const { error: deleteError } = await supabase
      .from('scheduled_posts')
      .delete()
      .in('id', corruptSlots.map(s => s.id))

    if (deleteError) {
      console.error('❌ Error deleting corrupt slots:', deleteError)
      return
    }

    console.log(`✅ Deleted ${corruptSlots.length} corrupt slots\n`)
  }

  // Step 2: Run scheduler to fill missing slots
  console.log('Step 2: Running scheduler to fill missing slots...\n')

  try {
    const result = await generateDailySchedule('2025-11-10', {
      mode: 'refill-missing',
      forceRefill: true
    })

    console.log('\n✅ Scheduler completed')
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('❌ Scheduler error:', error)
  }

  // Step 3: Verify the result
  console.log('\n\nStep 3: Verifying final schedule...\n')

  const { data: finalSlots, error: verifyError } = await supabase
    .from('scheduled_posts')
    .select('id, scheduled_day, scheduled_slot_index, scheduled_post_time, status, platform')
    .eq('scheduled_day', '2025-11-10')
    .order('scheduled_slot_index')

  if (verifyError) {
    console.error('❌ Error verifying:', verifyError)
    return
  }

  console.log(`📊 Final schedule (${finalSlots?.length || 0} slots):\n`)
  console.log('Index | Time (UTC)                  | Status  | Platform')
  console.log('------+-----------------------------+---------+---------')

  for (const slot of finalSlots || []) {
    const idx = String(slot.scheduled_slot_index).padStart(5)
    const time = slot.scheduled_post_time.padEnd(27)
    const status = String(slot.status).padEnd(7)
    console.log(`${idx} | ${time} | ${status} | ${slot.platform}`)
  }

  const missing = []
  for (let i = 0; i < 6; i++) {
    if (!finalSlots?.some(s => s.scheduled_slot_index === i)) {
      missing.push(i)
    }
  }

  if (missing.length === 0) {
    console.log('\n✅ All 6 slots filled!')
  } else {
    console.log(`\n⚠️ Still missing ${missing.length} slot(s): ${missing.join(', ')}`)
  }
}

fixNov10Schedule().catch(console.error)
