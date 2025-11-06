/**
 * Cleanup script to mark old stuck posts as failed
 * This handles posts that are way past their grace window
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanupStuckPosts() {
  console.log('🧹 Cleaning up stuck scheduled posts...\n')

  const now = new Date()
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

  // Find posts that should have posted more than 2 hours ago and are still pending
  const { data: stuckPosts, error: findError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status')
    .eq('status', 'pending')
    .lt('scheduled_post_time', twoHoursAgo.toISOString())

  if (findError) {
    console.error('❌ Error finding stuck posts:', findError)
    return
  }

  console.log(`Found ${stuckPosts?.length || 0} stuck posts (more than 2 hours late)\n`)

  if (!stuckPosts || stuckPosts.length === 0) {
    console.log('✅ No stuck posts to clean up!')
    return
  }

  // Mark each as failed
  for (const post of stuckPosts) {
    const hoursLate = Math.floor((now.getTime() - new Date(post.scheduled_post_time).getTime()) / (60 * 60 * 1000))

    console.log(`Marking post ${post.id} as failed (${hoursLate}h late, ${post.platform})...`)

    const { error: updateError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'failed',
        reasoning: `Missed posting window by ${hoursLate} hours - too late to post`,
        updated_at: now.toISOString()
      })
      .eq('id', post.id)

    if (updateError) {
      console.error(`  ❌ Error updating post ${post.id}:`, updateError)
    } else {
      console.log(`  ✅ Marked as failed`)
    }
  }

  console.log(`\n✅ Cleanup complete: ${stuckPosts.length} posts marked as failed`)
}

cleanupStuckPosts().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
