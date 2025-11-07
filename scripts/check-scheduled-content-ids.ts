/**
 * Check if today's scheduled content IDs are actually posted
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkScheduledContentIds() {
  console.log('🔍 Checking scheduled content IDs for today...\n')

  const today = '2025-11-07'

  // Get today's scheduled posts
  const { data: scheduled, error } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning')
    .gte('scheduled_post_time', `${today}T00:00:00`)
    .lt('scheduled_post_time', `${today}T23:59:59`)
    .order('scheduled_post_time', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${scheduled?.length || 0} scheduled posts for today\n`)

  for (const post of scheduled || []) {
    const time = new Date(post.scheduled_post_time).toISOString().split('T')[1].substring(0, 5)
    console.log(`\n⏰ ${time} UTC - ${post.platform} (Post ${post.id})`)
    console.log(`   Status: ${post.status}`)

    if (post.content_id) {
      // Check content_queue
      const { data: content } = await supabase
        .from('content_queue')
        .select('id, is_posted, is_approved, content_text, source_platform')
        .eq('id', post.content_id)
        .single()

      if (content) {
        console.log(`   Content ID: ${content.id}`)
        console.log(`   Is Posted: ${content.is_posted}`)
        console.log(`   Is Approved: ${content.is_approved}`)
        console.log(`   Text: "${content.content_text?.substring(0, 50)}..."`)

        // Check if posted_content exists
        const { data: postedRecords } = await supabase
          .from('posted_content')
          .select('id, posted_at, platform')
          .eq('content_queue_id', content.id)

        if (postedRecords && postedRecords.length > 0) {
          console.log(`   ⚠️ POSTED ${postedRecords.length} time(s):`)
          for (const record of postedRecords) {
            console.log(`      - ${record.posted_at} on ${record.platform}`)
          }
        } else {
          console.log(`   ✅ Never posted`)
        }

        // Check when this schedule was created
        const { data: scheduleDetails } = await supabase
          .from('scheduled_posts')
          .select('created_at, updated_at')
          .eq('id', post.id)
          .single()

        if (scheduleDetails) {
          console.log(`   📅 Schedule created: ${scheduleDetails.created_at}`)
          console.log(`   📅 Schedule updated: ${scheduleDetails.updated_at}`)
        }
      } else {
        console.log(`   ❌ Content ${post.content_id} not found!`)
      }
    }
  }

  console.log('\n\n📊 Summary:')
  const duplicates = scheduled?.filter(s => s.status === 'failed' && s.reasoning?.includes('already been posted')) || []
  const ready = scheduled?.filter(s => s.status === 'pending' && !s.reasoning?.includes('already been posted')) || []

  console.log(`   ⚠️ Duplicate schedules (already posted): ${duplicates.length}`)
  console.log(`   ✅ Ready to post (new content): ${ready.length}`)
}

checkScheduledContentIds().catch(console.error)
