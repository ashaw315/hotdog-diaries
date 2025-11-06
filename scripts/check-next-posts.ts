/**
 * Check what posts are scheduled for today
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkNextPosts() {
  console.log('📅 Checking upcoming scheduled posts...\n')

  const now = new Date()
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  // Get posts scheduled for rest of today
  const { data: todayPosts, error: todayError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status')
    .eq('status', 'pending')
    .gte('scheduled_post_time', now.toISOString())
    .lte('scheduled_post_time', todayEnd.toISOString())
    .order('scheduled_post_time', { ascending: true })

  if (todayError) {
    console.error('❌ Error fetching today\'s posts:', todayError)
    return
  }

  console.log(`📋 Found ${todayPosts?.length || 0} posts scheduled for today:\n`)

  if (todayPosts && todayPosts.length > 0) {
    for (const post of todayPosts) {
      const scheduledTime = new Date(post.scheduled_post_time)
      const localTime = scheduledTime.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })

      console.log(`  ${localTime} ET - ${post.platform} (slot ${post.id}, content ${post.content_id})`)
    }
  } else {
    console.log('  No posts scheduled for today')
  }

  // Get next few posts
  console.log('\n\n📋 Next 5 pending posts:\n')

  const { data: nextPosts, error: nextError } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status')
    .eq('status', 'pending')
    .gte('scheduled_post_time', now.toISOString())
    .order('scheduled_post_time', { ascending: true })
    .limit(5)

  if (nextError) {
    console.error('❌ Error fetching next posts:', nextError)
    return
  }

  if (nextPosts && nextPosts.length > 0) {
    for (const post of nextPosts) {
      const scheduledTime = new Date(post.scheduled_post_time)
      const localTime = scheduledTime.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })

      console.log(`  ${localTime} ET - ${post.platform} (slot ${post.id})`)
    }
  } else {
    console.log('  No pending posts found')
  }
}

checkNextPosts().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
