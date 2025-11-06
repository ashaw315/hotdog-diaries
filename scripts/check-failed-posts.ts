/**
 * Check for failed scheduled posts and diagnose issues
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkFailedPosts() {
  console.log('🔍 Checking for failed posts...\n')

  // Check scheduled_posts with "posting" or "failed" status
  const { data: scheduledPosts, error: scheduledError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning, actual_posted_at')
    .in('status', ['posting', 'failed'])
    .order('scheduled_post_time', { ascending: false })
    .limit(20)

  if (scheduledError) {
    console.error('❌ Error fetching scheduled posts:', scheduledError)
    return
  }

  console.log(`Found ${scheduledPosts?.length || 0} posts with posting/failed status\n`)

  if (scheduledPosts && scheduledPosts.length > 0) {
    for (const post of scheduledPosts) {
      console.log(`\n📋 Scheduled Post ${post.id}:`)
      console.log(`  Platform: ${post.platform}`)
      console.log(`  Content ID: ${post.content_id}`)
      console.log(`  Scheduled: ${post.scheduled_post_time}`)
      console.log(`  Status: ${post.status}`)
      console.log(`  Reasoning: ${post.reasoning || 'None'}`)

      // Check if content exists
      if (post.content_id) {
        const { data: content, error: contentError } = await supabase
          .from('content_queue')
          .select('id, content_text, source_platform, content_image_url, content_video_url')
          .eq('id', post.content_id)
          .single()

        if (contentError) {
          console.log(`  ❌ Content error: ${contentError.message}`)
        } else if (!content) {
          console.log(`  ❌ Content not found!`)
        } else {
          console.log(`  ✅ Content exists: ${content.content_text?.substring(0, 50)}...`)
          console.log(`  - Platform: ${content.source_platform}`)
          console.log(`  - Has image: ${!!content.content_image_url}`)
          console.log(`  - Has video: ${!!content.content_video_url}`)
        }
      } else {
        console.log(`  ⚠️  No content_id assigned`)
      }
    }
  }

  // Check for posts that should have posted but didn't
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const { data: missedPosts, error: missedError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning')
    .eq('status', 'pending')
    .lt('scheduled_post_time', oneHourAgo.toISOString())
    .order('scheduled_post_time', { ascending: false })
    .limit(10)

  if (missedError) {
    console.error('\n❌ Error fetching missed posts:', missedError)
    return
  }

  console.log(`\n\n🚨 Missed Posts (should have posted > 1hr ago):`)
  console.log(`Found ${missedPosts?.length || 0} missed posts\n`)

  if (missedPosts && missedPosts.length > 0) {
    for (const post of missedPosts) {
      const scheduledTime = new Date(post.scheduled_post_time)
      const hoursLate = Math.floor((now.getTime() - scheduledTime.getTime()) / (60 * 60 * 1000))

      console.log(`\n⏰ Post ${post.id} is ${hoursLate}h late:`)
      console.log(`  Platform: ${post.platform}`)
      console.log(`  Scheduled: ${post.scheduled_post_time}`)
      console.log(`  Content ID: ${post.content_id}`)
      console.log(`  Status: ${post.status}`)
    }
  }

  // Check recent posted_content entries
  const { data: recentPosts, error: recentError } = await supabase
    .from('posted_content')
    .select('id, content_queue_id, scheduled_post_id, platform, posted_at')
    .order('posted_at', { ascending: false })
    .limit(5)

  if (!recentError && recentPosts) {
    console.log(`\n\n✅ Recent successful posts (last 5):`)
    for (const post of recentPosts) {
      console.log(`  - ${post.platform} at ${post.posted_at} (content: ${post.content_queue_id})`)
    }
  }
}

checkFailedPosts().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
