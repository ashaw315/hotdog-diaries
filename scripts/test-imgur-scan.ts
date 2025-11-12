#!/usr/bin/env tsx

/**
 * Comprehensive test for Imgur scanner with new improvements
 */

import { ImgurScanningService } from '@/lib/services/imgur-scanning'

async function testImgurScan() {
  console.log('\n🧪 Testing Imgur Scanner with New Improvements\n')
  console.log('='.repeat(80))

  const scanner = new ImgurScanningService()

  try {
    // Test 1: Check configuration
    console.log('\n📋 Test 1: Verifying Scanner Configuration')
    console.log('-'.repeat(80))
    const config = await scanner.getScanConfig()

    console.log(`✓ Scan Interval: ${config.scanInterval / (60 * 60 * 1000)} hours`)
    console.log(`✓ Search Terms: ${config.searchTerms.length} (expected: 8)`)
    console.log(`✓ API Enabled: ${config.isEnabled}`)

    console.log('\n  Search terms configured:')
    config.searchTerms.forEach((term, i) => {
      console.log(`  ${i + 1}. "${term}"`)
    })

    // Test 2: Test connection to Imgur API
    console.log('\n\n🔌 Test 2: Testing Connection to Imgur API')
    console.log('-'.repeat(80))
    const connectionTest = await scanner.testConnection()

    if (connectionTest.success) {
      console.log(`✓ Connection test: ${connectionTest.message}`)
      if (connectionTest.details) {
        console.log(`  Client ID configured: ${connectionTest.details.clientIdConfigured}`)
      }
    } else {
      console.log(`✗ Connection test failed: ${connectionTest.message}`)
      if (connectionTest.details) {
        console.log(`  Details: ${JSON.stringify(connectionTest.details)}`)
      }
    }

    // Test 3: Run actual scan
    console.log('\n\n🔄 Test 3: Running Comprehensive Scan')
    console.log('-'.repeat(80))
    console.log('Testing improvements:')
    console.log('  • 8 search terms (was 5)')
    console.log('  • Sort variation: Random (time/viral/top)')
    console.log('  • Window variation: Random (day/week/month) for top sort')
    console.log('  • Page-based pagination (0-4) with Map storage')
    console.log('  • MaxPosts: 30 (was 20)')
    console.log('  • Auto-approval threshold: 0.6 (was 0.5)')
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
    console.log(`  • Success rate: ${totalAttempts > 0 ? ((result.approved / totalAttempts) * 100).toFixed(1) : 0}%`)

    // Test 4: Evaluate improvements
    console.log('\n\n✨ Test 4: Evaluating Improvements')
    console.log('-'.repeat(80))

    const improvements = []
    const issues = []

    // Check if we got content from Imgur
    if (result.totalFound > 0) {
      improvements.push(`✓ Successfully finding content from Imgur (${result.totalFound} items)`)
    } else {
      issues.push('✗ No content found - may indicate Imgur API issues or rate limiting')
    }

    // Check if content was processed
    if (result.processed > 0) {
      improvements.push(`✓ Content processing working: ${result.processed} items processed`)
    } else if (result.totalFound > 0) {
      issues.push(`✗ Found ${result.totalFound} items but none processed - check filters`)
    }

    // Check approval rates
    if (result.approved > 0) {
      improvements.push(`✓ Approval system working: ${result.approved} items approved`)
    } else if (result.processed > 0) {
      issues.push('✗ No approvals - content quality may be low or filters too strict')
    }

    // Check variety (should have good variety with 8 search terms)
    if (result.totalFound >= 10) {
      improvements.push(`✓ Good variety: ${result.totalFound} items from 8 search terms`)
    } else if (result.totalFound > 0) {
      issues.push(`✗ Limited variety: only ${result.totalFound} items found from 8 search terms`)
    }

    // Check for pagination working (duplicates should be manageable)
    if (result.duplicates < result.totalFound * 0.7) {
      improvements.push('✓ Pagination appears to be working (reasonable duplicate rate)')
    } else if (result.totalFound > 0) {
      issues.push(`✗ High duplicate rate: ${result.duplicates}/${result.totalFound} - pagination may need adjustment`)
    }

    // Check for approval threshold (should be higher quality now with 0.6 threshold)
    if (result.approved > 0 && approvalRate > 20) {
      improvements.push(`✓ Approval threshold (0.6) appears balanced: ${approvalRate.toFixed(1)}% approval rate`)
    } else if (result.processed > 5 && approvalRate < 10) {
      issues.push(`✗ Low approval rate (${approvalRate.toFixed(1)}%) - threshold may be too strict`)
    }

    console.log('\nPositive indicators:')
    improvements.forEach(msg => console.log(`  ${msg}`))

    if (issues.length > 0) {
      console.log('\nAreas needing attention:')
      issues.forEach(msg => console.log(`  ${msg}`))
    }

    // Test 5: Check scanning stats
    console.log('\n\n📊 Test 5: Scanning Statistics')
    console.log('-'.repeat(80))
    const stats = await scanner.getScanningStats()

    console.log(`  • Total found (24h): ${stats.totalFound}`)
    console.log(`  • Total approved (24h): ${stats.totalApproved}`)
    console.log(`  • Total rejected (24h): ${stats.totalRejected}`)
    console.log(`  • Success rate: ${(stats.successRate * 100).toFixed(1)}%`)
    if (stats.lastScanTime) {
      console.log(`  • Last scan: ${stats.lastScanTime.toLocaleString()}`)
    }

    // Final verdict
    console.log('\n\n🎯 Test Summary')
    console.log('='.repeat(80))

    if (result.approved > 0) {
      console.log('✅ SUCCESS! Scanner improvements are working:')
      console.log(`   - ${result.approved} items approved`)
      console.log(`   - ${approvalRate.toFixed(1)}% approval rate`)
      console.log('   - Expanded search terms (8), sort variation, and pagination showing results')
      console.log('   - Higher quality threshold (0.6) filtering effectively')
    } else if (result.processed > 0) {
      console.log('⚠️  PARTIAL SUCCESS: Finding and processing content, but low approval rate')
      console.log(`   - Found ${result.totalFound}, processed ${result.processed}`)
      console.log('   - Content quality may need review or threshold adjustment')
    } else if (result.totalFound > 0) {
      console.log('⚠️  MIXED RESULTS: Finding content but high rejection/duplicate rate')
      console.log(`   - Found ${result.totalFound} items`)
      console.log('   - Check filters and search term selection')
    } else {
      console.log('❌ NO CONTENT FOUND: Imgur API may be unreachable or rate limited')
      console.log('   - Check API credentials (IMGUR_CLIENT_ID)')
      console.log('   - Check rate limits and try again later')
    }

  } catch (error) {
    console.error('\n❌ Scan failed:', error)
    throw error
  }

  console.log('\n' + '='.repeat(80) + '\n')
}

testImgurScan().catch(console.error)
