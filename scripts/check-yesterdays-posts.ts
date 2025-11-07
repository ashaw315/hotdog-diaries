/**
 * Check what happened with yesterday's failed posts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkYesterdaysPosts() {
  console.log('🔍 Checking yesterday\'s posts (Nov 6)...\n')

  const yesterday = '2025-11-06'

  // Get all scheduled posts for yesterday
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning, updated_at')
    .gte('scheduled_post_time', `${yesterday}T00:00:00`)
    .lt('scheduled_post_time', `${yesterday}T23:59:59`)
    .order('scheduled_post_time', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${posts?.length || 0} scheduled posts for yesterday:\n`)

  const byStatus = {
    posted: 0,
    failed: 0,
    pending: 0,
    posting: 0
  }

  if (posts && posts.length > 0) {
    for (const post of posts) {
      byStatus[post.status as keyof typeof byStatus]++

      const time = new Date(post.scheduled_post_time).toISOString().split('T')[1].substring(0, 5)
      const statusEmoji = post.status === 'posted' ? '✅' : post.status === 'failed' ? '❌' : '⏳'

      console.log(`${statusEmoji} ${time} ${post.platform.padEnd(10)} ${post.status.padEnd(10)} (Post ${post.id})`)
      if (post.reasoning && post.status !== 'posted') {
        console.log(`   Reason: ${post.reasoning.substring(0, 100)}${post.reasoning.length > 100 ? '...' : ''}`)
      }

      // Check if content exists and is_posted flag
      if (post.content_id) {
        const { data: content } = await supabase
          .from('content_queue')
          .select('id, is_posted, content_text')
          .eq('id', post.content_id)
          .single()

        if (content) {
          if (post.status === 'pending' && content.is_posted) {
            console.log(`   ⚠️ Content ${content.id} is marked as posted but schedule is still pending!`)
          } else if (post.status === 'posted' && !content.is_posted) {
            console.log(`   ⚠️ Schedule is posted but content is_posted flag is FALSE!`)
          }
        }
      }
      console.log('')
    }

    console.log('\n📊 Summary:')
    console.log(`   ✅ Posted: ${byStatus.posted}`)
    console.log(`   ❌ Failed: ${byStatus.failed}`)
    console.log(`   ⏳ Pending: ${byStatus.pending}`)
    console.log(`   🔄 Posting: ${byStatus.posting}`)
  }
}

checkYesterdaysPosts().catch(console.error)
