/**
 * Check the most recent posting failure
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkPostingError() {
  console.log('🔍 Checking recent posting failures...\n')

  // Get recent failed posts
  const { data: failedPosts, error } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning, updated_at')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${failedPosts?.length || 0} recent failed posts:\n`)

  if (failedPosts && failedPosts.length > 0) {
    for (const post of failedPosts) {
      console.log(`\n📋 Post ${post.id}:`)
      console.log(`  Platform: ${post.platform}`)
      console.log(`  Content ID: ${post.content_id}`)
      console.log(`  Scheduled: ${post.scheduled_post_time}`)
      console.log(`  Status: ${post.status}`)
      console.log(`  Error: ${post.reasoning || 'None'}`)
      console.log(`  Updated: ${post.updated_at}`)

      // Check if content exists
      if (post.content_id) {
        const { data: content } = await supabase
          .from('content_queue')
          .select('id, content_text, source_platform, content_image_url, content_video_url')
          .eq('id', post.content_id)
          .single()

        if (content) {
          console.log(`  Content: "${content.content_text?.substring(0, 50)}..."`)
          console.log(`  Has image: ${!!content.content_image_url}`)
          console.log(`  Has video: ${!!content.content_video_url}`)
        }
      }
    }
  }

  // Also check for posts in "posting" status (stuck)
  const { data: stuckPosts } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, updated_at')
    .eq('status', 'posting')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (stuckPosts && stuckPosts.length > 0) {
    console.log(`\n\n⚠️ Found ${stuckPosts.length} posts stuck in 'posting' status:`)
    for (const post of stuckPosts) {
      console.log(`  - Post ${post.id} (${post.platform}) at ${post.scheduled_post_time}`)
    }
  }
}

checkPostingError().catch(console.error)
