import { createSimpleClient } from '../utils/supabase/server'
import { subMinutes, addMinutes } from 'date-fns'

async function diagnosPosting() {
  try {
    const supabase = createSimpleClient()

    console.log('\n🔍 POSTING SYSTEM DIAGNOSTICS\n')
    console.log('Current Time (UTC):', new Date().toISOString())
    console.log('Current Time (ET):', new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    console.log('')

    // Check last 5 posted content
    console.log('📅 LAST 5 POSTS:\n')
    const { data: lastPosts, error: postsError } = await supabase
      .from('posted_content')
      .select('id, posted_at, platform, content_queue_id, scheduled_post_id')
      .order('posted_at', { ascending: false })
      .limit(5)

    if (postsError) {
      console.error('Error fetching posted content:', postsError)
    } else if (!lastPosts || lastPosts.length === 0) {
      console.log('⚠️ NO POSTS FOUND IN DATABASE')
    } else {
      lastPosts.forEach(post => {
        console.log(`Post ID ${post.id}:`)
        console.log(`  Posted at: ${post.posted_at}`)
        console.log(`  Platform: ${post.platform}`)
        console.log(`  Content ID: ${post.content_queue_id}`)
        console.log(`  Scheduled Slot ID: ${post.scheduled_post_id}`)
        console.log('')
      })
    }

    // Check pending scheduled slots
    console.log('\n🕒 PENDING SCHEDULED SLOTS:\n')
    const { data: pendingSlots, error: pendingError } = await supabase
      .from('scheduled_posts')
      .select('id, scheduled_post_time, platform, content_id, status, created_at, reasoning')
      .eq('status', 'pending')
      .order('scheduled_post_time', { ascending: true })
      .limit(10)

    if (pendingError) {
      console.error('Error fetching pending slots:', pendingError)
    } else if (!pendingSlots || pendingSlots.length === 0) {
      console.log('⚠️ NO PENDING SLOTS FOUND')
    } else {
      console.log(`Found ${pendingSlots.length} pending slots:\n`)
      pendingSlots.forEach(slot => {
        const scheduledDate = new Date(slot.scheduled_post_time)
        const now = new Date()
        const minutesFromNow = (scheduledDate.getTime() - now.getTime()) / 1000 / 60

        console.log(`Slot ${slot.id}:`)
        console.log(`  Scheduled for: ${slot.scheduled_post_time}`)
        console.log(`  Time from now: ${minutesFromNow > 0 ? '+' : ''}${Math.round(minutesFromNow)} minutes`)
        console.log(`  Platform: ${slot.platform}`)
        console.log(`  Content ID: ${slot.content_id || 'NONE'}`)
        console.log(`  Created: ${slot.created_at}`)
        if (slot.reasoning) console.log(`  Reasoning: ${slot.reasoning}`)
        console.log('')
      })
    }

    // Test time window queries with different grace periods
    console.log('\n⏰ TIME WINDOW TESTS:\n')

    for (const graceMinutes of [5, 30, 60]) {
      const now = new Date()
      const windowStart = subMinutes(now, graceMinutes)
      const windowEnd = addMinutes(now, graceMinutes)

      console.log(`Testing ${graceMinutes}-minute grace window:`)
      console.log(`  Window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`)

      const { data: slotsInWindow, error: windowError } = await supabase
        .from('scheduled_posts')
        .select('id, scheduled_post_time, platform, content_id, status')
        .eq('status', 'pending')
        .gte('scheduled_post_time', windowStart.toISOString())
        .lte('scheduled_post_time', windowEnd.toISOString())
        .order('scheduled_post_time', { ascending: true })

      if (windowError) {
        console.error(`  Error:`, windowError)
      } else {
        console.log(`  Found ${slotsInWindow?.length || 0} slots`)
        if (slotsInWindow && slotsInWindow.length > 0) {
          slotsInWindow.forEach(slot => {
            console.log(`    - Slot ${slot.id}: ${slot.scheduled_post_time} (${slot.platform}, content_id: ${slot.content_id})`)
          })
        }
      }
      console.log('')
    }

    // Check for any failed or posting status slots
    console.log('\n❌ FAILED OR STUCK SLOTS:\n')
    const { data: problemSlots, error: problemError } = await supabase
      .from('scheduled_posts')
      .select('id, scheduled_post_time, platform, content_id, status, reasoning, updated_at')
      .in('status', ['failed', 'posting'])
      .order('updated_at', { ascending: false })
      .limit(10)

    if (problemError) {
      console.error('Error:', problemError)
    } else if (!problemSlots || problemSlots.length === 0) {
      console.log('✅ No failed or stuck slots')
    } else {
      console.log(`Found ${problemSlots.length} problem slots:\n`)
      problemSlots.forEach(slot => {
        console.log(`Slot ${slot.id}:`)
        console.log(`  Scheduled for: ${slot.scheduled_post_time}`)
        console.log(`  Status: ${slot.status}`)
        console.log(`  Platform: ${slot.platform}`)
        console.log(`  Content ID: ${slot.content_id}`)
        console.log(`  Updated: ${slot.updated_at}`)
        if (slot.reasoning) console.log(`  Reasoning: ${slot.reasoning}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error)
  }
}

diagnosPosting()
