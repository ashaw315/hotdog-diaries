#!/usr/bin/env tsx

/**
 * Debug script to check platform distribution in database
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function debugPlatformStats() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n🔍 Debugging Platform Statistics\n')

  // Query 1: Total approved & pending
  const { data: totals, error: totalsError } = await supabase
    .from('content_queue')
    .select('is_approved, is_posted')
    .eq('is_posted', false)

  if (totalsError) {
    console.error('Error fetching totals:', totalsError)
    return
  }

  const approved = totals?.filter(c => c.is_approved).length || 0
  const pending = totals?.filter(c => !c.is_approved).length || 0

  console.log(`Total approved (not posted): ${approved}`)
  console.log(`Total pending (not posted): ${pending}`)
  console.log('')

  // Query 2: Platform distribution (approved only)
  const { data: platforms, error: platformsError } = await supabase
    .from('content_queue')
    .select('source_platform')
    .eq('is_approved', true)
    .eq('is_posted', false)
    .not('source_platform', 'is', null)

  if (platformsError) {
    console.error('Error fetching platforms:', platformsError)
    return
  }

  const platformCounts: Record<string, number> = {}
  platforms?.forEach(p => {
    if (p.source_platform) {
      platformCounts[p.source_platform] = (platformCounts[p.source_platform] || 0) + 1
    }
  })

  console.log('Platform Distribution (approved, not posted):')
  Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([platform, count]) => {
      console.log(`  ${platform}: ${count}`)
    })
  console.log('')

  // Query 3: Check for NULL source_platforms
  const { count: nullCount } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .eq('is_approved', true)
    .eq('is_posted', false)
    .is('source_platform', null)

  console.log(`Items with NULL source_platform: ${nullCount || 0}`)
  console.log('')

  // Query 4: Sample of content to inspect
  const { data: sample } = await supabase
    .from('content_queue')
    .select('id, source_platform, content_type, content_text, is_approved, is_posted')
    .eq('is_approved', true)
    .eq('is_posted', false)
    .limit(10)

  console.log('Sample of approved content:')
  sample?.forEach(item => {
    console.log(`  ID ${item.id}: ${item.source_platform || 'NULL'} | ${item.content_type || 'NULL'} | ${item.content_text?.substring(0, 50)}...`)
  })
}

debugPlatformStats().catch(console.error)
