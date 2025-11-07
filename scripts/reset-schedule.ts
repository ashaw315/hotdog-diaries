/**
 * Reset the scheduling system by cleaning up old schedules
 * and rebuilding with fresh approved content
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function resetSchedule() {
  console.log('🔄 Resetting schedule...\n')

  // Step 1: Get counts before reset
  const { data: beforeScheduled } = await supabase
    .from('scheduled_posts')
    .select('id, status')
    .gte('scheduled_post_time', new Date().toISOString())

  const { data: beforePosted } = await supabase
    .from('posted_content')
    .select('id')

  const { data: beforeApproved } = await supabase
    .from('content_queue')
    .select('id')
    .eq('is_approved', true)
    .eq('is_posted', false)

  console.log('📊 Before Reset:')
  console.log(`   Future scheduled_posts: ${beforeScheduled?.length || 0}`)
  console.log(`   Posted content records: ${beforePosted?.length || 0}`)
  console.log(`   Available approved content: ${beforeApproved?.length || 0}`)
  console.log('')

  // Step 2: Delete ALL future scheduled_posts
  console.log('🗑️ Deleting all future scheduled_posts...')
  const { data: deleted, error: deleteError } = await supabase
    .from('scheduled_posts')
    .delete()
    .gte('scheduled_post_time', new Date().toISOString())
    .select('id')

  if (deleteError) {
    console.error('❌ Error deleting scheduled_posts:', deleteError)
    return
  }

  console.log(`✅ Deleted ${deleted?.length || 0} scheduled_posts`)
  console.log('')

  // Step 3: Verify cleanup
  const { data: afterScheduled } = await supabase
    .from('scheduled_posts')
    .select('id')
    .gte('scheduled_post_time', new Date().toISOString())

  console.log('📊 After Reset:')
  console.log(`   Future scheduled_posts: ${afterScheduled?.length || 0}`)
  console.log(`   Available for scheduling: ${beforeApproved?.length || 0}`)
  console.log('')

  console.log('✅ Schedule reset complete!')
  console.log('')
  console.log('🔄 Next Steps:')
  console.log('   1. Run the schedule refill workflow to create new schedules')
  console.log('   2. The scheduler will use the 22 available approved items')
  console.log('   3. Posts should be distributed across the next few days')
}

resetSchedule().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
