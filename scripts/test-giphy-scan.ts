#!/usr/bin/env tsx

/**
 * Test Giphy scanner with new random offset and multi-endpoint strategy
 */

import { GiphyScanningService } from '@/lib/services/giphy-scanning'

async function testGiphyScan() {
  console.log('\n🧪 Testing Giphy Scanner with New Strategy\n')
  console.log('='  .repeat(80))

  const scanner = new GiphyScanningService()

  try {
    console.log('\n🔄 Running scan...\n')
    const result = await scanner.performScan({ maxPosts: 25 })

    console.log('\n📊 Scan Results:')
    console.log('-'.repeat(80))
    console.log(`🔍 Total found: ${result.totalFound}`)
    console.log(`🔄 Processed: ${result.processed}`)
    console.log(`✅ Approved: ${result.approved}`)
    console.log(`❌ Rejected: ${result.rejected}`)
    console.log(`🔁 Duplicates: ${result.duplicates}`)
    console.log(`⚠️ Errors: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:')
      result.errors.forEach(err => console.log(`  • ${err}`))
    }

    console.log('\n✨ Key improvements tested:')
    console.log('  • Random offset pagination (0-500 results)')
    console.log('  • Multiple endpoints (search/trending/random)')
    console.log('  • Expanded search terms (10 total)')
    console.log('  • Quality threshold (0.5)')
    console.log('  • Removed auto-approval bypass')

    if (result.approved > 0) {
      console.log('\n🎉 SUCCESS! Scanner found and approved fresh content!')
    } else if (result.duplicates > 0) {
      console.log('\n⚠️ No new content found (all duplicates). May need more scans with different random offsets.')
    } else if (result.rejected > 0) {
      console.log('\n⚠️ Content found but all rejected. Quality threshold may be working correctly.')
    } else {
      console.log('\n❌ No content found at all. Check API key and search terms.')
    }

  } catch (error) {
    console.error('\n❌ Scan failed:', error)
    throw error
  }

  console.log('\n' + '='  .repeat(80) + '\n')
}

testGiphyScan().catch(console.error)
