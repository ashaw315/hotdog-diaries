#!/usr/bin/env tsx

/**
 * Check Tumblr scanner status and content
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ulaadphxfsrihoubjdrb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkTumblrStatus() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n🔍 Checking Tumblr Status\n')

  // Check all Tumblr content (approved + pending)
  const { data: allTumblr, error: allError } = await supabase
    .from('content_queue')
    .select('id, is_approved, is_posted, scraped_at, confidence_score, content_text')
    .eq('source_platform', 'tumblr')
    .order('scraped_at', { ascending: false })
    .limit(20)

  if (allError) {
    console.error('Error fetching Tumblr content:', allError)
    return
  }

  console.log(`Total Tumblr items in database: ${allTumblr?.length || 0}`)

  const approved = allTumblr?.filter(t => t.is_approved && !t.is_posted).length || 0
  const pending = allTumblr?.filter(t => !t.is_approved && !t.is_posted).length || 0
  const posted = allTumblr?.filter(t => t.is_posted).length || 0

  console.log(`  - Approved (not posted): ${approved}`)
  console.log(`  - Pending review: ${pending}`)
  console.log(`  - Already posted: ${posted}`)
  console.log('')

  if (allTumblr && allTumblr.length > 0) {
    const lastScan = allTumblr[0].scraped_at
    console.log(`Last scan: ${lastScan}`)
    console.log('')

    console.log('Recent Tumblr content (last 10):')
    allTumblr.slice(0, 10).forEach(item => {
      const status = item.is_posted ? 'POSTED' : item.is_approved ? 'APPROVED' : 'PENDING'
      console.log(`  [${status}] Score: ${item.confidence_score?.toFixed(2) || 'N/A'} | ${item.content_text?.substring(0, 60)}... | Scanned: ${item.scraped_at}`)
    })
  } else {
    console.log('⚠️ No Tumblr content found in database at all')
  }

  // Check GitHub Actions workflow status
  console.log('\n📊 Checking Tumblr scanner workflow status...\n')
}

checkTumblrStatus().catch(console.error)
