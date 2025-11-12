#!/usr/bin/env tsx

/**
 * Check for content items with missing original_url
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMissingUrls() {
  console.log('🔍 Checking for content items with missing original_url\n')

  // Get count of items with NULL original_url
  const { count: nullCount, error: nullError } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .is('original_url', null)

  if (nullError) {
    console.error('Error checking NULL URLs:', nullError)
    return
  }

  console.log(`Items with NULL original_url: ${nullCount}`)

  // Get count of items with empty string original_url
  const { count: emptyCount, error: emptyError } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .eq('original_url', '')

  if (emptyError) {
    console.error('Error checking empty URLs:', emptyError)
    return
  }

  console.log(`Items with empty string original_url: ${emptyCount}`)

  // Get some sample items with missing URLs to analyze
  const { data: samples, error: samplesError } = await supabase
    .from('content_queue')
    .select('id, source_platform, content_text, created_at, original_url')
    .or('original_url.is.null,original_url.eq.')
    .limit(10)

  if (samplesError) {
    console.error('Error fetching samples:', samplesError)
    return
  }

  console.log('\nSample items with missing URLs:')
  console.log('================================')
  samples?.forEach(item => {
    console.log(`\nID: ${item.id}`)
    console.log(`Platform: ${item.source_platform}`)
    console.log(`Created: ${item.created_at}`)
    console.log(`URL: ${item.original_url || '(missing)'}`)
    console.log(`Text: ${item.content_text?.substring(0, 100) || '(no text)'}...`)
  })

  // Get distribution by platform
  const { data: allMissing, error: allError } = await supabase
    .from('content_queue')
    .select('source_platform')
    .or('original_url.is.null,original_url.eq.')

  if (allError) {
    console.error('Error fetching all missing:', allError)
    return
  }

  const platformCounts: Record<string, number> = {}
  allMissing?.forEach(item => {
    platformCounts[item.source_platform] = (platformCounts[item.source_platform] || 0) + 1
  })

  console.log('\nMissing URLs by platform:')
  console.log('=========================')
  Object.entries(platformCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([platform, count]) => {
      console.log(`${platform}: ${count}`)
    })
}

checkMissingUrls()
  .then(() => {
    console.log('\n✅ Check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error)
    process.exit(1)
  })
