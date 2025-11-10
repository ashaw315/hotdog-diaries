/**
 * Verify that today's scheduled content has not been posted before
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

async function verifyNewSchedule() {
  const supabase = createSimpleClient()

  const now = new Date()
  const etDate = toZonedTime(now, 'America/New_York')
  const todayET = format(etDate, 'yyyy-MM-dd')

  console.log(`\n✅ Verifying schedule for ${todayET} (ET)\n`)

  // Get pending slots
  const { data: slots, error: slotsError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, scheduled_post_time, status')
    .gte('scheduled_post_time', `${todayET}T00:00:00`)
    .lt('scheduled_post_time', `${todayET}T23:59:59`)
    .eq('status', 'pending')
    .order('scheduled_post_time')

  if (slotsError) {
    console.error('❌ Error:', slotsError)
    return
  }

  console.log(`Found ${slots?.length || 0} pending slots\n`)

  const contentIds = slots?.map(s => s.content_id).filter(Boolean) || []

  if (contentIds.length === 0) {
    console.log('⚠️ No content to verify')
    return
  }

  // Check if any are in posted_content
  const { data: posted, error: postedError } = await supabase
    .from('posted_content')
    .select('content_queue_id, posted_at, platform')
    .in('content_queue_id', contentIds)

  if (postedError) {
    console.error('❌ Error:', postedError)
    return
  }

  // Get content details
  const { data: contentDetails, error: contentError } = await supabase
    .from('content_queue')
    .select('id, source_platform, content_type, content_text')
    .in('id', contentIds)

  if (contentError) {
    console.error('❌ Error:', contentError)
    return
  }

  const contentMap = new Map(contentDetails?.map(c => [c.id, c]) || [])
  const postedSet = new Set(posted?.map(p => p.content_queue_id) || [])

  let allClear = true

  for (const slot of slots || []) {
    const content = contentMap.get(slot.content_id)
    const isPosted = postedSet.has(slot.content_id)

    console.log(`Slot ${slot.id}: ${slot.scheduled_post_time}`)
    console.log(`  Content ID: ${slot.content_id}`)

    if (content) {
      console.log(`  Platform: ${content.source_platform}`)
      console.log(`  Type: ${content.content_type}`)
      console.log(`  Text: ${content.content_text?.substring(0, 50)}...`)
    }

    if (isPosted) {
      console.log(`  ❌ ALREADY POSTED!`)
      allClear = false
    } else {
      console.log(`  ✅ Fresh content (not posted)`)
    }
    console.log()
  }

  if (allClear) {
    console.log(`\n✅ All pending slots have fresh content!\n`)
  } else {
    console.log(`\n❌ Some slots still have already-posted content\n`)
  }
}

verifyNewSchedule().catch(console.error)
