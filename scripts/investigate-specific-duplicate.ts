/**
 * Investigate the specific imgur "My Dad is Dracula" duplicate post
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function investigateSpecificDuplicate() {
  console.log('🔍 Investigating the imgur "My Dad is Dracula" duplicate post\n')

  // Find the content in content_queue
  const { data: content, error: contentError } = await supabase
    .from('content_queue')
    .select('*')
    .eq('source_platform', 'imgur')
    .ilike('content_text', '%Dracula%Corn Dog%')
    .order('created_at', { ascending: false })
    .limit(5)

  if (contentError) {
    console.error('❌ Error:', contentError)
    return
  }

  if (!content || content.length === 0) {
    console.log('❌ Could not find the imgur Dracula post')
    return
  }

  console.log(`Found ${content.length} matching post(s):\n`)

  for (const item of content) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`Content ID: ${item.id}`)
    console.log(`Content: "${item.content_text?.substring(0, 100)}..."`)
    console.log(`Created: ${item.created_at}`)
    console.log(`is_posted: ${item.is_posted}`)
    console.log(`is_approved: ${item.is_approved}`)
    console.log(`${'='.repeat(80)}\n`)

    // Check if this content has been posted before
    const { data: posted, error: postedError } = await supabase
      .from('posted_content')
      .select('*')
      .eq('content_queue_id', item.id)
      .order('created_at', { ascending: true })

    if (postedError) {
      console.error('❌ Error fetching posted history:', postedError)
      continue
    }

    if (posted && posted.length > 0) {
      console.log(`📝 Posted History (${posted.length} time(s)):`)
      posted.forEach((p, idx) => {
        console.log(`   ${idx + 1}. Posted on: ${new Date(p.created_at).toISOString()}`)
        console.log(`      Posted Content ID: ${p.id}`)
      })
    } else {
      console.log(`📝 Posted History: Never posted`)
    }

    // Check if this content is currently scheduled
    const { data: scheduled, error: scheduledError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('content_id', item.id)
      .order('scheduled_post_time', { ascending: true })

    if (scheduledError) {
      console.error('❌ Error fetching schedule:', scheduledError)
      continue
    }

    if (scheduled && scheduled.length > 0) {
      console.log(`\n📅 Schedule History (${scheduled.length} time(s)):`)
      scheduled.forEach((s, idx) => {
        console.log(`   ${idx + 1}. Scheduled for: ${s.scheduled_post_time}`)
        console.log(`      Status: ${s.status}`)
        console.log(`      Reasoning: ${s.reasoning || 'N/A'}`)
        console.log(`      Created: ${s.created_at}`)
      })
    } else {
      console.log(`\n📅 Schedule History: Never scheduled`)
    }

    // Analysis
    console.log(`\n🔍 Analysis:`)
    if (posted && posted.length > 0 && item.is_posted) {
      console.log(`   ✅ This content WAS posted (${posted.length} time(s))`)
      console.log(`   ✅ is_posted flag is correctly set to TRUE`)
    } else if (posted && posted.length > 0 && !item.is_posted) {
      console.log(`   ❌ This content WAS posted but is_posted flag is FALSE!`)
      console.log(`   🚨 This is the bug! Scheduler thinks it's available.`)
    } else {
      console.log(`   ℹ️  This content has never been posted`)
    }

    if (scheduled && scheduled.length > 1) {
      console.log(`   ⚠️  This content has been scheduled ${scheduled.length} times!`)
      const failedSchedules = scheduled.filter(s => s.status === 'failed')
      if (failedSchedules.length > 0) {
        console.log(`   ❌ ${failedSchedules.length} failed attempts (likely duplicates)`)
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`)
}

investigateSpecificDuplicate().catch(console.error)
