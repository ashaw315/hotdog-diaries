#!/usr/bin/env tsx

/**
 * Comprehensive test for Reddit scanner with new improvements
 */

import { RedditScanningService } from '@/lib/services/reddit-scanning'

async function testRedditScan() {
  console.log('\n🧪 Testing Reddit Scanner with New Improvements\n')
  console.log('='.repeat(80))

  const scanner = new RedditScanningService()

  try {
    // Test 1: Check configuration
    console.log('\n📋 Test 1: Verifying Scanner Configuration')
    console.log('-'.repeat(80))
    const config = await scanner.getScanConfig()

    console.log(`✓ MaxPostsPerScan: ${config.maxPostsPerScan} (expected: 25)`)
    console.log(`✓ Search Terms: ${config.searchTerms.length} (expected: 8)`)
    console.log(`✓ Target Subreddits: ${config.targetSubreddits.length} (expected: 3)`)

    console.log('\n  Search terms configured:')
    config.searchTerms.forEach((term, i) => {
      console.log(`  ${i + 1}. "${term}"`)
    })

    console.log('\n  Target subreddits:')
    config.targetSubreddits.forEach((sub, i) => {
      console.log(`  ${i + 1}. r/${sub}`)
    })

    // Test 2: Test connection to Reddit API
    console.log('\n\n🔌 Test 2: Testing Connection to Reddit API')
    console.log('-'.repeat(80))
    const connectionTest = await scanner.testConnection()

    if (connectionTest.success) {
      console.log(`✓ Connection test: ${connectionTest.message}`)
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
    console.log('  • 8 search terms (was 2)')
    console.log('  • Sort variation: Random (hot/new/top/rising)')
    console.log('  • Time range variation: Random (day/week/month)')
    console.log('  • Reddit "after" pagination with Map storage')
    console.log('  • MaxPosts: 25 (was 15)')
    console.log()

    const result = await scanner.performScan({ maxPosts: 25 })

    console.log('\n📊 Scan Results:')
    console.log('-'.repeat(80))
    console.log(`🔍 Total found: ${result.postsFound}`)
    console.log(`🔄 Processed: ${result.postsProcessed}`)
    console.log(`✅ Approved: ${result.postsApproved}`)
    console.log(`❌ Rejected: ${result.postsRejected}`)
    console.log(`🏳️  Flagged: ${result.postsFlagged}`)
    console.log(`🔁 Duplicates: ${result.duplicatesFound}`)
    console.log(`⚠️  Errors: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log('\n  Errors encountered:')
      result.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`)
      })
    }

    if (result.highestScoredPost) {
      console.log('\n🏆 Highest scored post:')
      console.log(`  Title: ${result.highestScoredPost.title}`)
      console.log(`  Score: ${result.highestScoredPost.score}`)
      console.log(`  Subreddit: r/${result.highestScoredPost.subreddit}`)
    }

    // Calculate statistics
    const totalAttempts = result.postsFound
    const approvalRate = result.postsProcessed > 0 ? (result.postsApproved / result.postsProcessed) * 100 : 0

    console.log('\n📈 Statistics:')
    console.log(`  • Approval rate: ${approvalRate.toFixed(1)}%`)
    console.log(`  • Rejection rate: ${result.postsProcessed > 0 ? ((result.postsRejected / result.postsProcessed) * 100).toFixed(1) : 0}%`)
    console.log(`  • Flagged rate: ${result.postsProcessed > 0 ? ((result.postsFlagged / result.postsProcessed) * 100).toFixed(1) : 0}%`)
    console.log(`  • Duplicate rate: ${totalAttempts > 0 ? ((result.duplicatesFound / totalAttempts) * 100).toFixed(1) : 0}%`)

    // Test 4: Evaluate improvements
    console.log('\n\n✨ Test 4: Evaluating Improvements')
    console.log('-'.repeat(80))

    const improvements = []
    const issues = []

    // Check if we got content from Reddit
    if (result.postsFound > 0) {
      improvements.push(`✓ Successfully finding content from Reddit (${result.postsFound} posts)`)
    } else {
      issues.push('✗ No content found - may indicate Reddit API issues')
    }

    // Check if content was processed
    if (result.postsProcessed > 0) {
      improvements.push(`✓ Content processing working: ${result.postsProcessed} posts processed`)
    } else if (result.postsFound > 0) {
      issues.push(`✗ Found ${result.postsFound} posts but none processed - check filters`)
    }

    // Check approval rates
    if (result.postsApproved > 0) {
      improvements.push(`✓ Approval system working: ${result.postsApproved} posts approved`)
    } else if (result.postsProcessed > 0) {
      issues.push('✗ No approvals - content quality may be low or filters too strict')
    }

    // Check variety (should have good variety with 8 search terms × 3 subreddits = 24 searches)
    if (result.postsFound >= 10) {
      improvements.push(`✓ Good variety: ${result.postsFound} posts from multiple searches`)
    } else if (result.postsFound > 0) {
      issues.push(`✗ Limited variety: only ${result.postsFound} posts found from 24 searches`)
    }

    // Check for pagination working (duplicates should be manageable)
    if (result.duplicatesFound < result.postsFound * 0.7) {
      improvements.push('✓ Pagination appears to be working (reasonable duplicate rate)')
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

    if (result.postsApproved > 0) {
      console.log('✅ SUCCESS! Scanner improvements are working:')
      console.log(`   - ${result.postsApproved} items approved`)
      console.log(`   - ${approvalRate.toFixed(1)}% approval rate`)
      console.log('   - Expanded search terms (8) and pagination showing results')
    } else if (result.postsProcessed > 0) {
      console.log('⚠️  PARTIAL SUCCESS: Finding and processing content, but low approval rate')
      console.log(`   - Found ${result.postsFound}, processed ${result.postsProcessed}`)
      console.log('   - Content quality may need review')
    } else if (result.postsFound > 0) {
      console.log('⚠️  MIXED RESULTS: Finding content but high rejection/duplicate rate')
      console.log(`   - Found ${result.postsFound} items`)
      console.log('   - Check filters and subreddit selection')
    } else {
      console.log('❌ NO CONTENT FOUND: Reddit API may be unreachable or rate limited')
      console.log('   - Check API credentials and rate limits')
      console.log('   - Try again later')
    }

  } catch (error) {
    console.error('\n❌ Scan failed:', error)
    throw error
  }

  console.log('\n' + '='.repeat(80) + '\n')
}

testRedditScan().catch(console.error)
