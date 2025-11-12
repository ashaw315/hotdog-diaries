#!/usr/bin/env tsx

/**
 * Check actual original_url values for specific platforms
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPlatformUrls() {
  const platforms = ['imgur']

  for (const platform of platforms) {
    console.log(`\n=== ${platform.toUpperCase()} ===`)

    const { data, error } = await supabase
      .from('content_queue')
      .select('id, content_text, original_url, source_platform, content_status')
      .eq('source_platform', platform)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error:', error)
      continue
    }

    console.log(`Total items fetched: ${data?.length || 0}`)

    data?.forEach(item => {
      console.log(`\nID: ${item.id}`)
      console.log(`Status: ${item.content_status}`)
      console.log(`URL: '${item.original_url}'`)
      console.log(`URL is null: ${item.original_url === null}`)
      console.log(`URL is empty: ${item.original_url === ''}`)
      console.log(`URL type: ${typeof item.original_url}`)
      console.log(`Text: ${item.content_text?.substring(0, 60)}...`)
    })
  }
}

checkPlatformUrls()
  .then(() => {
    console.log('\n✅ Check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error)
    process.exit(1)
  })
