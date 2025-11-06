/**
 * Check for the specific imgur post at 15:00
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSpecificPost() {
  console.log('🔍 Looking for 15:00 imgur post...\n')

  const today = new Date().toISOString().split('T')[0]

  // Find posts scheduled for 15:00 (19:00 UTC) today
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, platform, scheduled_post_time, status, reasoning, updated_at')
    .eq('platform', 'imgur')
    .gte('scheduled_post_time', `${today}T18:00:00`)
    .lte('scheduled_post_time', `${today}T20:00:00`)
    .order('scheduled_post_time', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${posts?.length || 0} imgur posts scheduled around 15:00 ET:\n`)

  if (posts && posts.length > 0) {
    for (const post of posts) {
      console.log(`\n📋 Post ${post.id}:`)
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
          console.log(`  Content ID: ${content.id}`)
          console.log(`  Title: "${content.content_text}"`)
          console.log(`  Author: ${content.original_author}`)
          console.log(`  Source: ${content.source_platform}`)
          console.log(`  Image: ${content.content_image_url || 'None'}`)
          console.log(`  Video: ${content.content_video_url || 'None'}`)
        }
      }
    }
  } else {
    console.log('No posts found - checking content_queue for LordoftheHildago...')

    const { data: content } = await supabase
      .from('content_queue')
      .select('*')
      .ilike('original_author', '%LordoftheHildago%')
      .limit(5)

    if (content && content.length > 0) {
      console.log(`\nFound ${content.length} items by LordoftheHildago:`)
      for (const item of content) {
        console.log(`\n  ID: ${item.id}`)
        console.log(`  Platform: ${item.source_platform}`)
        console.log(`  Text: "${item.content_text}"`)
        console.log(`  Approved: ${item.is_approved}`)
        console.log(`  Posted: ${item.is_posted}`)
      }
    }
  }
}

checkSpecificPost().catch(console.error)
