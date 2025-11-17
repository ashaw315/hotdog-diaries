#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function checkPostedStatus() {
  console.log('🔍 Checking if "Boiled hot dogs beat grilled" has been posted...\n')

  // Check if content_queue ID 8792 has been posted
  const { data, error } = await supabase
    .from('posted_content')
    .select('id, posted_at, scheduled_time, content_queue_id')
    .eq('content_queue_id', 8792)

  if (error && error.code !== 'PGRST116') {
    console.log('❌ Error:', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('✅ Post HAS been posted to the feed!')
    console.log('  Posted at:', data[0].posted_at)
    console.log('  Scheduled time:', data[0].scheduled_time)
    console.log('  Posted content ID:', data[0].id)
    console.log('')
    console.log('🎠 The carousel should be visible on the production feed now!')
    console.log('   Visit: https://hotdog-diaries.vercel.app')
  } else {
    console.log('⏳ Post has NOT been posted to feed yet')
    console.log('   It will show as a carousel when it gets posted')
  }
}

checkPostedStatus()
