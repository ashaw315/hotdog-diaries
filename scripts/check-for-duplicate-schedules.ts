/**
 * Check for content scheduled multiple times with status 'pending'
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkForDuplicateSchedules() {
  console.log('🔍 Checking for duplicate scheduled content (status=pending)\\n')

  // Get all pending scheduled posts
  const { data: scheduled, error } = await supabase
    .from('scheduled_posts')
    .select('content_id, scheduled_post_time, status, created_at')
    .eq('status', 'pending')
    .order('content_id', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Total pending scheduled posts: ${scheduled?.length || 0}`)

  // Group by content_id to find duplicates
  const contentScheduleCounts = new Map<number, any[]>()

  scheduled?.forEach(item => {
    if (!contentScheduleCounts.has(item.content_id)) {
      contentScheduleCounts.set(item.content_id, [])
    }
    contentScheduleCounts.get(item.content_id)!.push(item)
  })

  // Find content_ids scheduled more than once
  const duplicates = Array.from(contentScheduleCounts.entries())
    .filter(([_, schedules]) => schedules.length > 1)

  if (duplicates.length === 0) {
    console.log('\\n✅ No duplicate schedules found! All content is scheduled only once.')
    console.log('   The race condition fix is working correctly.')
  } else {
    console.log(`\\n🚨 Found ${duplicates.length} content items scheduled multiple times:\\n`)

    for (const [contentId, schedules] of duplicates) {
      console.log(`Content ID ${contentId} - scheduled ${schedules.length} times:`)
      schedules.forEach((s, idx) => {
        console.log(`   ${idx + 1}. ${s.scheduled_post_time} (created: ${s.created_at})`)
      })
      console.log()
    }
  }

  console.log(`\\n📊 Summary:`)
  console.log(`   Total pending posts: ${scheduled?.length}`)
  console.log(`   Unique content items: ${contentScheduleCounts.size}`)
  console.log(`   Duplicate content items: ${duplicates.length}`)
}

checkForDuplicateSchedules().catch(console.error)
