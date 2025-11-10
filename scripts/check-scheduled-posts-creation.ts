/**
 * Check when scheduled_posts entries were created
 */

import { createSimpleClient } from '@/utils/supabase/server'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

async function checkScheduledPostsCreation() {
  const supabase = createSimpleClient()

  const now = new Date()
  const etDate = toZonedTime(now, 'America/New_York')
  const todayET = format(etDate, 'yyyy-MM-dd')

  console.log(`\n📅 Checking scheduled_posts creation for ${todayET} (ET)\n`)

  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('id, content_id, scheduled_post_time, status, created_at, reasoning')
    .gte('scheduled_post_time', `${todayET}T00:00:00`)
    .lt('scheduled_post_time', `${todayET}T23:59:59`)
    .order('scheduled_post_time')

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${data?.length || 0} scheduled_posts entries:\n`)

  for (const post of data || []) {
    console.log(`Slot ID ${post.id}:`)
    console.log(`  Content ID: ${post.content_id}`)
    console.log(`  Scheduled for: ${post.scheduled_post_time}`)
    console.log(`  Status: ${post.status}`)
    console.log(`  Created at: ${post.created_at}`)
    if (post.reasoning) {
      console.log(`  Reasoning: ${post.reasoning.substring(0, 100)}...`)
    }
    console.log()
  }
}

checkScheduledPostsCreation().catch(console.error)
