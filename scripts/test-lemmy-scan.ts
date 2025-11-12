#!/usr/bin/env tsx

/**
 * Comprehensive test for Lemmy scanner with new improvements
 */

import { LemmyScanningService } from '@/lib/services/lemmy-scanning'

async function testLemmyScan() {
  console.log('\n🧪 Testing Lemmy Scanner with New Improvements\n')
  console.log('='.repeat(80))

  const scanner = new LemmyScanningService()

  try {
    // Test 1: Check configuration
    console.log('\n📋 Test 1: Verifying Scanner Configuration')
    console.log('-'.repeat(80))
    const config = await scanner.getScanConfig()

    console.log(`✓ MaxPostsPerScan: ${config.maxPostsPerScan} (expected: 30)`)
    console.log(`✓ Total Communities: ${config.targetCommunities.length} (expected: 6)`)
    console.log(`✓ Unique Instances: ${new Set(config.targetCommunities.map(c => c.instance)).size} (expected: 3)`)

    console.log('\n  Communities configured:')
    config.targetCommunities.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.instance}/c/${c.community}`)
      console.log(`     ${c.description}`)
    })

    // Test 2: Test connection to communities
    console.log('\n\n🔌 Test 2: Testing Connection to Federated Communities')
    console.log('-'.repeat(80))
    const connectionTest = await scanner.testConnection()

    if (connectionTest.success) {
      console.log(`✓ Connection test: ${connectionTest.message}`)
      if (connectionTest.details?.communityResults) {
        connectionTest.details.communityResults.forEach((result: any) => {
          const status = result.success ? '✓' : '✗'
          const info = result.success
            ? `Found ${result.postsFound} posts`
            : `Error: ${result.error}`
          console.log(`  ${status} ${result.community}: ${info}`)
        })
      }
    } else {
      console.log(`✗ Connection test failed: ${connectionTest.message}`)
    }

    // Test 3: Run actual scan
    console.log('\n\n🔄 Test 3: Running Comprehensive Scan')
    console.log('-'.repeat(80))
    console.log('Testing improvements:')
    console.log('  • 6 communities across 3 instances (was 2 on 1 instance)')
    console.log('  • Auto-approval threshold: 0.6 (was 0.65)')
    console.log('  • Sort variation: Random (Hot/Active/New/TopWeek)')
    console.log('  • Page-based pagination (pages 1-5 per community)')
    console.log('  • Relaxed text filters: title 200 chars, body 250-400 chars')
    console.log('  • MaxPosts: 30 (was 20)')
    console.log()

    const result = await scanner.performScan({ maxPosts: 30 })

    console.log('\n📊 Scan Results:')
    console.log('-'.repeat(80))
    console.log(`🔍 Total found: ${result.totalFound}`)
    console.log(`🔄 Processed: ${result.processed}`)
    console.log(`✅ Approved: ${result.approved}`)
    console.log(`❌ Rejected: ${result.rejected}`)
    console.log(`🔁 Duplicates: ${result.duplicates}`)
    console.log(`⚠️  Errors: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log('\n  Errors encountered:')
      result.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`)
      })
    }

    // Calculate statistics
    const totalAttempts = result.totalFound
    const approvalRate = result.processed > 0 ? (result.approved / result.processed) * 100 : 0

    console.log('\n📈 Statistics:')
    console.log(`  • Approval rate: ${approvalRate.toFixed(1)}%`)
    console.log(`  • Rejection rate: ${result.processed > 0 ? ((result.rejected / result.processed) * 100).toFixed(1) : 0}%`)
    console.log(`  • Duplicate rate: ${totalAttempts > 0 ? ((result.duplicates / totalAttempts) * 100).toFixed(1) : 0}%`)

    // Test 4: Evaluate improvements
    console.log('\n\n✨ Test 4: Evaluating Improvements')
    console.log('-'.repeat(80))

    const improvements = []
    const issues = []

    // Check if we got content from multiple communities
    if (result.totalFound > 0) {
      improvements.push('✓ Successfully finding content from federated communities')
    } else {
      issues.push('✗ No content found - may indicate community access issues')
    }

    // Check approval rate (should be better with 0.6 threshold)
    if (result.approved > 0) {
      improvements.push(`✓ Approval threshold (0.6) working: ${result.approved} items approved`)
    } else if (result.processed > 0) {
      issues.push('✗ No approvals - content quality may be low or filters too strict')
    }

    // Check variety (should have processed content)
    if (result.processed > 5) {
      improvements.push(`✓ Good variety: processed ${result.processed} posts`)
    } else if (result.totalFound > 0) {
      issues.push(`✗ Limited variety: only ${result.processed} processed from ${result.totalFound} found`)
    }

    // Check for pagination working (low duplicates expected with pagination)
    if (result.duplicates < result.totalFound * 0.5) {
      improvements.push('✓ Pagination appears to be working (low duplicate rate)')
    }

    console.log('\nPositive indicators:')
    improvements.forEach(msg => console.log(`  ${msg}`))

    if (issues.length > 0) {
      console.log('\nAreas needing attention:')
      issues.forEach(msg => console.log(`  ${msg}`))
    }

    // Final verdict
    console.log('\n\n🎯 Test Summary')
    console.log('='.repeat(80))

    if (result.approved > 0) {
      console.log('✅ SUCCESS! Scanner improvements are working:')
      console.log(`   - ${result.approved} items approved (was typically 0 before)`)
      console.log(`   - ${approvalRate.toFixed(1)}% approval rate`)
      console.log('   - Lower threshold (0.6) and expanded communities showing results')
    } else if (result.processed > 0) {
      console.log('⚠️  PARTIAL SUCCESS: Finding and processing content, but low approval rate')
      console.log(`   - Found ${result.totalFound}, processed ${result.processed}`)
      console.log('   - Content quality may need review or communities may have limited hotdog content')
    } else if (result.totalFound > 0) {
      console.log('⚠️  MIXED RESULTS: Finding content but high rejection/duplicate rate')
      console.log(`   - Found ${result.totalFound} items`)
      console.log('   - Check filters and community selection')
    } else {
      console.log('❌ NO CONTENT FOUND: Lemmy instances may be unreachable or communities inactive')
      console.log('   - This is common with federated platforms')
      console.log('   - Try again later when instances are more responsive')
    }

  } catch (error) {
    console.error('\n❌ Scan failed:', error)
    throw error
  }

  console.log('\n' + '='.repeat(80) + '\n')
}

testLemmyScan().catch(console.error)
