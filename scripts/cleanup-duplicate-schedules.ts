/**
 * Cleanup duplicate scheduled_posts that try to post already-posted content
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanupDuplicateSchedules() {
  console.log('🧹 Cleaning up duplicate scheduled_posts...\n')

  // Find all content_ids that have been successfully posted
  const { data: postedContent, error: postedError } = await supabase
    .from('posted_content')
    .select('content_queue_id')
    .order('content_queue_id', { ascending: true })

  if (postedError) {
    console.error('❌ Error fetching posted content:', postedError)
    return
  }

  const postedContentIds = [...new Set(postedContent?.map(p => p.content_queue_id) || [])]
  console.log(`Found ${postedContentIds.length} unique content items that have been posted\n`)

  let totalUpdated = 0
  let totalFixed = 0

  // For each posted content, find duplicate scheduled_posts that are still pending
  for (const contentId of postedContentIds) {
    const { data: duplicates, error: dupError } = await supabase
      .from('scheduled_posts')
      .select('id, scheduled_post_time, status, reasoning')
      .eq('content_id', contentId)
      .in('status', ['pending', 'posting'])
      .order('scheduled_post_time', { ascending: true })

    if (dupError) {
      console.error(`❌ Error fetching duplicates for content ${contentId}:`, dupError)
      continue
    }

    if (duplicates && duplicates.length > 0) {
      console.log(`⚠️ Content ${contentId} has ${duplicates.length} duplicate pending schedule(s)`)

      for (const duplicate of duplicates) {
        console.log(`  - Marking scheduled_post ${duplicate.id} as failed (${duplicate.scheduled_post_time})`)

        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            reasoning: 'Content has already been posted - preventing duplicate posting',
            updated_at: new Date().toISOString()
          })
          .eq('id', duplicate.id)

        if (updateError) {
          console.error(`    ❌ Error updating scheduled_post ${duplicate.id}:`, updateError)
        } else {
          console.log(`    ✅ Marked as failed`)
          totalUpdated++
        }
      }

      // Also update content_queue to ensure is_posted flag is set
      const { data: content, error: contentError } = await supabase
        .from('content_queue')
        .select('id, is_posted, posted_at')
        .eq('id', contentId)
        .single()

      if (contentError) {
        console.error(`  ❌ Error fetching content ${contentId}:`, contentError)
      } else if (content && !content.is_posted) {
        console.log(`  ⚠️ Content ${contentId} is_posted flag is false, fixing...`)

        // Get the posted_at time from posted_content
        const { data: posted, error: postedAtError } = await supabase
          .from('posted_content')
          .select('posted_at')
          .eq('content_queue_id', contentId)
          .order('posted_at', { ascending: true })
          .limit(1)
          .single()

        if (postedAtError) {
          console.error(`    ❌ Error fetching posted_at:`, postedAtError)
        } else if (posted) {
          const { error: fixError } = await supabase
            .from('content_queue')
            .update({
              is_posted: true,
              posted_at: posted.posted_at
            })
            .eq('id', contentId)

          if (fixError) {
            console.error(`    ❌ Error fixing content_queue:`, fixError)
          } else {
            console.log(`    ✅ Fixed is_posted flag and posted_at timestamp`)
            totalFixed++
          }
        }
      }

      console.log('')
    }
  }

  console.log(`\n✅ Cleanup complete:`)
  console.log(`   - ${totalUpdated} duplicate scheduled_posts marked as failed`)
  console.log(`   - ${totalFixed} content_queue rows fixed`)
}

cleanupDuplicateSchedules().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
