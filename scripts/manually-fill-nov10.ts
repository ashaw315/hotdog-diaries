/**
 * Manually fill missing slots for Nov 10 by:
 * 1. Getting candidate content
 * 2. Creating scheduled_posts rows for missing indices (2, 3, 4, 5)
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { toZonedTime, format as formatTZ } from 'date-fns-tz'

const SLOT_ET_TIMES = ["08:00", "12:00", "15:00", "18:00", "21:00", "23:30"] as const

function toEasternISO(dateYYYYMMDD: string, hhmmET: string): string {
  const [hh, mm] = hhmmET.split(":").map(Number)
  const estStr = `${dateYYYYMMDD}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`
  const easternZone = "America/New_York"
  const parsed = toZonedTime(estStr, easternZone)
  return parsed.toISOString()
}

async function manuallyFillNov10() {
  const supabase = createSimpleClient()

  console.log('\n🔧 Manually filling missing slots for Nov 10\n')

  // Step 1: Get existing slots to know which indices are missing
  const { data: existing, error: existError } = await supabase
    .from('scheduled_posts')
    .select('scheduled_slot_index, content_id')
    .eq('scheduled_day', '2025-11-10')

  if (existError) {
    console.error('❌ Error checking existing:', existError)
    return
  }

  const existingIndices = new Set(existing?.map(s => s.scheduled_slot_index) || [])
  const missingIndices = [0, 1, 2, 3, 4, 5].filter(i => !existingIndices.has(i))

  console.log(`📊 Existing indices: ${Array.from(existingIndices).join(', ')}`)
  console.log(`⚠️  Missing indices: ${missingIndices.join(', ')}\n`)

  if (missingIndices.length === 0) {
    console.log('✅ No missing slots!')
    return
  }

  // Step 2: Get all already-scheduled and posted content IDs to exclude
  const { data: scheduled } = await supabase
    .from('scheduled_posts')
    .select('content_id')
    .in('status', ['pending', 'posting'])

  const { data: posted } = await supabase
    .from('posted_content')
    .select('content_queue_id')

  const excludeIds = [
    ...(scheduled?.map(s => s.content_id).filter(Boolean) || []),
    ...(posted?.map(p => p.content_queue_id).filter(Boolean) || [])
  ]

  console.log(`🚫 Excluding ${excludeIds.length} already-scheduled/posted content IDs`)

  // Step 3: Get candidate content
  let query = supabase
    .from('content_queue')
    .select('id, source_platform, content_type, content_text, original_author, confidence_score')
    .eq('is_approved', true)
    .or('is_posted.is.null,is_posted.eq.false')
    .order('confidence_score', { ascending: false })
    .limit(200)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data: candidates, error: candError } = await query

  if (candError) {
    console.error('❌ Error getting candidates:', candError)
    return
  }

  if (!candidates || candidates.length < missingIndices.length) {
    console.error(`❌ Not enough candidates! Need ${missingIndices.length}, have ${candidates?.length || 0}`)
    return
  }

  console.log(`✅ Found ${candidates.length} candidate items\n`)

  // Step 4: Create slots for missing indices
  for (let i = 0; i < missingIndices.length; i++) {
    const slotIndex = missingIndices[i]
    const slotTimeET = SLOT_ET_TIMES[slotIndex]
    const slotUTC = toEasternISO('2025-11-10', slotTimeET)
    const candidate = candidates[i]

    console.log(`Creating slot ${slotIndex} (${slotTimeET} ET):`)
    console.log(`  Content ${candidate.id}: ${candidate.source_platform} - ${candidate.content_text?.substring(0, 50)}...`)

    const { error: insertError } = await supabase
      .from('scheduled_posts')
      .insert({
        scheduled_day: '2025-11-10',
        scheduled_slot_index: slotIndex,
        scheduled_post_time: slotUTC,
        content_id: candidate.id,
        platform: candidate.source_platform,
        content_type: candidate.content_type || 'text',
        source: candidate.original_author || null,
        title: candidate.content_text?.substring(0, 100) || null,
        reasoning: 'Manual fill after corrupt slot cleanup',
        status: 'pending'
      })

    if (insertError) {
      console.error(`  ❌ Error inserting: ${insertError.message}`)
      continue
    }

    // Update content_queue
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({
        scheduled_post_time: slotUTC,
        content_status: 'scheduled'
      })
      .eq('id', candidate.id)

    if (updateError) {
      console.error(`  ⚠️  Error updating content_queue: ${updateError.message}`)
    }

    console.log(`  ✅ Created\n`)
  }

  // Step 5: Verify
  console.log('\nStep 5: Verifying final schedule...\n')

  const { data: finalSlots, error: verifyError } = await supabase
    .from('scheduled_posts')
    .select('id, scheduled_slot_index, scheduled_post_time, status, platform')
    .eq('scheduled_day', '2025-11-10')
    .order('scheduled_slot_index')

  if (verifyError) {
    console.error('❌ Error verifying:', verifyError)
    return
  }

  console.log(`📊 Final schedule (${finalSlots?.length || 0}/6 slots):\n`)
  console.log('Index | Time (UTC)                  | Status  | Platform')
  console.log('------+-----------------------------+---------+---------')

  for (const slot of finalSlots || []) {
    const idx = String(slot.scheduled_slot_index).padStart(5)
    const time = slot.scheduled_post_time.padEnd(27)
    const status = String(slot.status).padEnd(7)
    console.log(`${idx} | ${time} | ${status} | ${slot.platform}`)
  }

  const stillMissing = []
  for (let i = 0; i < 6; i++) {
    if (!finalSlots?.some(s => s.scheduled_slot_index === i)) {
      stillMissing.push(i)
    }
  }

  if (stillMissing.length === 0) {
    console.log('\n✅ All 6 slots filled!')
  } else {
    console.log(`\n⚠️ Still missing ${stillMissing.length} slot(s): ${stillMissing.join(', ')}`)
  }
}

manuallyFillNov10().catch(console.error)
