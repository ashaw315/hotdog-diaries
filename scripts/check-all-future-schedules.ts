/**
 * Check all future scheduled posts to see what the scheduler created
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAllFutureSchedules() {
  console.log('🔍 Checking all future scheduled posts...\n')

  const now = new Date()

  const { data: scheduled, error } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning, created_at')
    .gte('scheduled_post_time', now.toISOString())
    .order('scheduled_post_time', { ascending: true })
    .limit(50)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${scheduled?.length || 0} future scheduled posts\n`)

  // Group by date
  const byDate: Record<string, typeof scheduled> = {}
  for (const post of scheduled || []) {
    const date = post.scheduled_post_time.split('T')[0]
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(post)
  }

  for (const [date, posts] of Object.entries(byDate).sort()) {
    console.log(`\n📅 ${date} (${posts.length} posts)`)
    for (const post of posts) {
      const time = new Date(post.scheduled_post_time).toISOString().split('T')[1].substring(0, 5)
      const statusEmoji = post.status === 'pending' ? '🕒' : post.status === 'posted' ? '✅' : '❌'
      const createdDate = post.created_at ? new Date(post.created_at).toISOString().split('T')[0] : 'unknown'

      console.log(`   ${statusEmoji} ${time} ${post.platform.padEnd(10)} (Post ${post.id}, created ${createdDate})`)

      if (post.content_id) {
        const { data: content } = await supabase
          .from('content_queue')
          .select('is_posted')
          .eq('id', post.content_id)
          .single()

        if (content?.is_posted) {
          console.log(`      ⚠️ Content ${post.content_id} already posted!`)
        }
      }
    }
  }

  console.log('\n\n📊 Summary:')
  const pending = scheduled?.filter(s => s.status === 'pending' && !s.reasoning?.includes('already been posted')).length || 0
  const failed = scheduled?.filter(s => s.status === 'failed').length || 0

  console.log(`   🕒 Pending (ready to post): ${pending}`)
  console.log(`   ❌ Failed/duplicates: ${failed}`)
  console.log(`   📅 Total future posts: ${scheduled?.length || 0}`)
}

checkAllFutureSchedules().catch(console.error)
