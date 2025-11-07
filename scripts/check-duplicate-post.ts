/**
 * Investigate the 18:00 reddit duplicate key error
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkDuplicatePost() {
  console.log('🔍 Looking for 18:00 reddit post with duplicate key error...\n')

  const today = new Date().toISOString().split('T')[0]

  // Find reddit posts scheduled for 18:00 (22:00 UTC) today
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning, updated_at')
    .eq('platform', 'reddit')
    .gte('scheduled_post_time', `${today}T21:00:00`)
    .lte('scheduled_post_time', `${today}T23:00:00`)
    .order('scheduled_post_time', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${posts?.length || 0} reddit posts scheduled around 18:00 ET:\n`)

  if (posts && posts.length > 0) {
    for (const post of posts) {
      console.log(`\n📋 Scheduled Post ${post.id}:`)
      console.log(`  Scheduled: ${post.scheduled_post_time}`)
      console.log(`  Status: ${post.status}`)
      console.log(`  Error: ${post.reasoning || 'None'}`)
      console.log(`  Updated: ${post.updated_at}`)

      // Get content details
      if (post.content_id) {
        const { data: content } = await supabase
          .from('content_queue')
          .select('*')
          .eq('id', post.content_id)
          .single()

        if (content) {
          console.log(`\n  📄 Content Details:`)
          console.log(`  Content ID: ${content.id}`)
          console.log(`  Title: "${content.content_text}"`)
          console.log(`  Author: ${content.original_author}`)
          console.log(`  Source: ${content.source_platform}`)
          console.log(`  Is Posted: ${content.is_posted}`)
          console.log(`  Posted At: ${content.posted_at || 'Not posted'}`)

          // Check if this content has already been posted
          const { data: postedRecords, error: postedError } = await supabase
            .from('posted_content')
            .select('*')
            .eq('content_id', content.id)

          if (postedError) {
            console.error(`  ❌ Error checking posted_content:`, postedError)
          } else if (postedRecords && postedRecords.length > 0) {
            console.log(`\n  ⚠️ DUPLICATE DETECTED! This content has already been posted ${postedRecords.length} time(s):`)
            for (const record of postedRecords) {
              console.log(`    - Posted on ${record.posted_at} with scheduled_post_id: ${record.scheduled_post_id}`)
            }
          } else {
            console.log(`\n  ✅ Content has NOT been posted yet`)
          }

          // Check for other scheduled_posts with the same content_id
          const { data: duplicateSchedules, error: dupError } = await supabase
            .from('scheduled_posts')
            .select('id, scheduled_post_time, status, reasoning')
            .eq('content_id', content.id)
            .order('scheduled_post_time', { ascending: true })

          if (dupError) {
            console.error(`  ❌ Error checking duplicate schedules:`, dupError)
          } else if (duplicateSchedules && duplicateSchedules.length > 1) {
            console.log(`\n  ⚠️ MULTIPLE SCHEDULES for same content (${duplicateSchedules.length} total):`)
            for (const schedule of duplicateSchedules) {
              console.log(`    - Scheduled Post ${schedule.id}: ${schedule.scheduled_post_time} (${schedule.status})`)
              if (schedule.reasoning) {
                console.log(`      Reason: ${schedule.reasoning}`)
              }
            }
          }
        }
      }
    }
  } else {
    console.log('No posts found')
  }
}

checkDuplicatePost().catch(console.error)
