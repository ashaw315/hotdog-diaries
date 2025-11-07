/**
 * Check today's scheduled posts to verify they'll post correctly
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkTodaysPosts() {
  console.log('🔍 Checking today\'s scheduled posts (Nov 7)...\n')

  const today = '2025-11-07'

  // Get all scheduled posts for today
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning, created_at, updated_at')
    .gte('scheduled_post_time', `${today}T00:00:00`)
    .lt('scheduled_post_time', `${today}T23:59:59`)
    .order('scheduled_post_time', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${posts?.length || 0} scheduled posts for today:\n`)

  let readyToPost = 0
  let alreadyPosted = 0
  let willFail = 0

  if (posts && posts.length > 0) {
    for (const post of posts) {
      const time = new Date(post.scheduled_post_time).toISOString().split('T')[1].substring(0, 5)
      const timeET = `${(parseInt(time.split(':')[0]) - 4 + 24) % 24}:${time.split(':')[1]}`

      console.log(`\n⏰ ${timeET} ET (${time} UTC) - ${post.platform}`)
      console.log(`   Status: ${post.status}`)
      console.log(`   Post ID: ${post.id}`)

      if (post.content_id) {
        const { data: content } = await supabase
          .from('content_queue')
          .select('id, is_posted, is_approved, content_text')
          .eq('id', post.content_id)
          .single()

        if (content) {
          console.log(`   Content ID: ${content.id}`)
          console.log(`   Text: "${content.content_text?.substring(0, 60)}..."`)
          console.log(`   Is Approved: ${content.is_approved}`)
          console.log(`   Is Posted: ${content.is_posted}`)

          // Check if this will work
          if (post.status === 'pending' && content.is_approved && !content.is_posted) {
            console.log(`   ✅ READY TO POST`)
            readyToPost++
          } else if (post.status === 'posted' || content.is_posted) {
            console.log(`   ℹ️ Already posted`)
            alreadyPosted++
          } else if (post.status === 'failed') {
            console.log(`   ⚠️ Marked as failed: ${post.reasoning?.substring(0, 80)}`)
            willFail++
          } else if (!content.is_approved) {
            console.log(`   ❌ Content not approved - will not post`)
            willFail++
          } else {
            console.log(`   ⚠️ Unexpected state`)
            willFail++
          }
        } else {
          console.log(`   ❌ Content ${post.content_id} not found!`)
          willFail++
        }
      } else {
        console.log(`   ❌ No content_id assigned!`)
        willFail++
      }
    }

    console.log('\n\n📊 Today\'s Forecast:')
    console.log(`   ✅ Ready to post: ${readyToPost}`)
    console.log(`   ℹ️ Already posted: ${alreadyPosted}`)
    console.log(`   ⚠️ Will fail/skip: ${willFail}`)
    console.log(`\n${readyToPost > 0 ? '✅' : '⚠️'} Expected to post ${readyToPost} items today`)
  } else {
    console.log('⚠️ No posts scheduled for today!')
  }
}

checkTodaysPosts().catch(console.error)
