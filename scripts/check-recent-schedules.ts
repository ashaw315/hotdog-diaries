/**
 * Check schedules created after our fix was deployed
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkRecentSchedules() {
  // Our fix was deployed at 2025-11-08 17:56 UTC
  const fixDeployTime = '2025-11-08T17:56:00+00:00'

  console.log(`🔍 Checking schedules created after fix deployment (${fixDeployTime})\\n`)

  // Get all scheduled posts created after the fix
  const { data: scheduled, error } = await supabase
    .from('scheduled_posts')
    .select('content_id, scheduled_post_time, status, created_at')
    .gte('created_at', fixDeployTime)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Total schedules created after fix: ${scheduled?.length || 0}\\n`)

  if (scheduled && scheduled.length > 0) {
    console.log('Schedules created after fix:')
    scheduled.forEach(s => {
      console.log(`  Content ${s.content_id}: ${s.scheduled_post_time} (status: ${s.status}, created: ${s.created_at})`)
    })

    // Check for duplicates among these new schedules
    const contentScheduleCounts = new Map<number, any[]>()
    scheduled.forEach(item => {
      if (!contentScheduleCounts.has(item.content_id)) {
        contentScheduleCounts.set(item.content_id, [])
      }
      contentScheduleCounts.get(item.content_id)!.push(item)
    })

    const duplicates = Array.from(contentScheduleCounts.entries())
      .filter(([_, schedules]) => schedules.length > 1)

    if (duplicates.length === 0) {
      console.log('\\n✅ No duplicates among newly created schedules!')
      console.log('   The race condition fix is working correctly.')
    } else {
      console.log(`\\n🚨 Found ${duplicates.length} duplicates among newly created schedules:`)
      for (const [contentId, schedules] of duplicates) {
        console.log(`  Content ID ${contentId} - scheduled ${schedules.length} times`)
      }
    }
  } else {
    console.log('ℹ️  No schedules were created after the fix deployment.')
    console.log('   This is expected if all slots were already filled.')
  }
}

checkRecentSchedules().catch(console.error)
