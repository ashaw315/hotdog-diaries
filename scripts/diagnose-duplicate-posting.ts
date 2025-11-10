/**
 * Diagnose duplicate content posting issue
 * Check for duplicate content_ids in scheduled_posts for today
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

async function diagnoseDuplicatePosting() {
  const supabase = createSimpleClient()

  // Get today's date in ET timezone
  const now = new Date()
  const etDate = toZonedTime(now, 'America/New_York')
  const todayET = format(etDate, 'yyyy-MM-dd')

  console.log(`\n📅 Checking for duplicate content on ${todayET} (ET)\n`)

  // 1. Get all scheduled posts for today
  const { data: scheduled, error: schedError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning')
    .gte('scheduled_post_time', `${todayET}T00:00:00`)
    .lt('scheduled_post_time', `${todayET}T23:59:59`)
    .order('scheduled_post_time')

  if (schedError) {
    console.error('❌ Error fetching scheduled posts:', schedError)
    return
  }

  console.log(`Found ${scheduled?.length || 0} scheduled slots for today\n`)

  // 2. Group by content_id to find duplicates
  const contentIdMap = new Map<number, typeof scheduled>()

  for (const slot of scheduled || []) {
    if (!slot.content_id) continue

    if (!contentIdMap.has(slot.content_id)) {
      contentIdMap.set(slot.content_id, [])
    }
    contentIdMap.get(slot.content_id)!.push(slot)
  }

  // 3. Find duplicates
  const duplicates = Array.from(contentIdMap.entries())
    .filter(([_, slots]) => slots.length > 1)

  if (duplicates.length > 0) {
    console.log(`❌ Found ${duplicates.length} duplicate content_id(s):\n`)

    for (const [contentId, slots] of duplicates) {
      console.log(`Content ID ${contentId} scheduled ${slots.length} times:`)
      for (const slot of slots) {
        console.log(`  - Slot ${slot.id}: ${slot.scheduled_post_time} (${slot.status})`)
        if (slot.reasoning) {
          console.log(`    Reason: ${slot.reasoning.substring(0, 100)}...`)
        }
      }
      console.log()
    }
  } else {
    console.log(`✅ No duplicate content_ids found in today's schedule\n`)
  }

  // 4. Check if any of today's content was already posted
  const contentIds = Array.from(contentIdMap.keys())

  if (contentIds.length > 0) {
    const { data: alreadyPosted, error: postedError } = await supabase
      .from('posted_content')
      .select('id, content_queue_id, platform, posted_at')
      .in('content_queue_id', contentIds)

    if (postedError) {
      console.error('❌ Error checking posted_content:', postedError)
    } else if (alreadyPosted && alreadyPosted.length > 0) {
      console.log(`⚠️ Found ${alreadyPosted.length} content item(s) already posted:\n`)

      for (const posted of alreadyPosted) {
        const slots = contentIdMap.get(posted.content_queue_id) || []
        console.log(`Content ID ${posted.content_queue_id}:`)
        console.log(`  - Already posted on ${posted.posted_at} to ${posted.platform}`)
        console.log(`  - Scheduled again in slot(s): ${slots.map(s => s.id).join(', ')}`)
        console.log()
      }
    } else {
      console.log(`✅ None of today's content was previously posted\n`)
    }
  }

  // 5. Show status breakdown
  const statusCounts = (scheduled || []).reduce((acc, slot) => {
    acc[slot.status] = (acc[slot.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`📊 Status breakdown:`)
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`)
  }
}

diagnoseDuplicatePosting().catch(console.error)
