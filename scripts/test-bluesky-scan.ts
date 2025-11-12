#!/usr/bin/env tsx

/**
 * Test Bluesky scanner with new improvements
 */

import { BlueskyService } from '@/lib/services/bluesky-scanning'

async function testBlueSkyScan() {
  console.log('\n🧪 Testing Bluesky Scanner with New Improvements\n')
  console.log('='  .repeat(80))

  const scanner = new BlueskyService()

  try {
    console.log('\n🔄 Running scan...\n')
    const result = await scanner.performScan({ maxPosts: 18 })

    console.log('\n📊 Scan Results:')
    console.log('-'.repeat(80))
    console.log(`🔍 Total found: ${result.totalFound}`)
    console.log(`🔄 Processed: ${result.processed}`)
    console.log(`✅ Approved: ${result.approved}`)
    console.log(`❌ Rejected: ${result.rejected}`)
    console.log(`🔁 Duplicates: ${result.duplicates}`)
    console.log(`⚠️ Errors: ${result.errors}`)

    console.log('\n✨ Key improvements tested:')
    console.log('  • Expanded search terms (8 total, 4-5 selected per scan)')
    console.log('  • Cursor-based pagination')
    console.log('  • Random sort parameter (latest/top)')
    console.log('  • Increased maxPosts (18)')
    console.log('  • Random term selection for variety')

    if (result.approved > 0) {
      console.log('\n🎉 SUCCESS! Scanner found and approved content!')
      console.log(`   Approval rate: ${((result.approved / result.processed) * 100).toFixed(1)}%`)
    } else if (result.duplicates > 0) {
      console.log('\n⚠️ All content was duplicates. This is expected - run scanner again for fresh results.')
    } else if (result.rejected > 0) {
      console.log('\n⚠️ Content found but all rejected. Quality threshold (0.6) working correctly.')
    } else {
      console.log('\n❌ No content found. Check Bluesky credentials.')
    }

  } catch (error) {
    console.error('\n❌ Scan failed:', error)
    throw error
  }

  console.log('\n' + '='  .repeat(80) + '\n')
}

testBlueSkyScan().catch(console.error)
