#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ulaadphxfsrihoubjdrb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkBlueskyStatus() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n🔍 Checking Bluesky Status\n')

  const { data, error } = await supabase
    .from('content_queue')
    .select('id, is_approved, is_posted, scraped_at, confidence_score')
    .eq('source_platform', 'bluesky')
    .order('scraped_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Total Bluesky items (last 20): ${data?.length || 0}`)

  if (data && data.length > 0) {
    const approved = data.filter(d => d.is_approved && !d.is_posted).length
    const pending = data.filter(d => !d.is_approved && !d.is_posted).length
    const posted = data.filter(d => d.is_posted).length

    console.log(`  - Approved (not posted): ${approved}`)
    console.log(`  - Pending: ${pending}`)
    console.log(`  - Posted: ${posted}`)
    console.log(`\nLast scan: ${data[0].scraped_at}`)
    console.log('\nRecent items:')

    data.slice(0, 10).forEach((item) => {
      const status = item.is_posted ? 'POSTED' : item.is_approved ? 'APPROVED' : 'PENDING'
      console.log(`  [${status}] Score: ${item.confidence_score?.toFixed(2) || 'N/A'} | ${item.scraped_at}`)
    })
  } else {
    console.log('⚠️ No Bluesky content found')
  }
}

checkBlueskyStatus().catch(console.error)
