#!/usr/bin/env tsx

/**
 * Test Count Query with Filters
 *
 * This script tests if the count query works correctly with platform filters
 */

import { sql } from '@vercel/postgres'

async function testCountQuery() {
  console.log('🧪 Testing Count Query with Platform Filter')
  console.log('==============================================\n')

  const platform = 'reddit'

  // Test 1: Unfiltered count
  console.log('Test 1: Unfiltered count')
  const unfilteredQuery = `SELECT COUNT(*) as total FROM content_queue`
  const unfilteredResult = await sql.query(unfilteredQuery)
  console.log('Query:', unfilteredQuery)
  console.log('Result:', unfilteredResult.rows[0])
  console.log('')

  // Test 2: Filtered count with parameter
  console.log('Test 2: Filtered count with parameter')
  const filteredQuery = `
    SELECT COUNT(*) as total
    FROM content_queue cq
    WHERE 1=1 AND cq.source_platform = $1
  `
  const filteredResult = await sql.query(filteredQuery, [platform])
  console.log('Query:', filteredQuery)
  console.log('Params:', [platform])
  console.log('Result:', filteredResult.rows[0])
  console.log('')

  // Test 3: Check actual reddit count
  console.log('Test 3: Actual reddit content count')
  const redditQuery = `
    SELECT COUNT(*) as total
    FROM content_queue
    WHERE source_platform = 'reddit'
  `
  const redditResult = await sql.query(redditQuery)
  console.log('Query:', redditQuery)
  console.log('Result:', redditResult.rows[0])
  console.log('')

  // Test 4: List platform counts
  console.log('Test 4: Platform distribution')
  const platformQuery = `
    SELECT source_platform, COUNT(*) as count
    FROM content_queue
    GROUP BY source_platform
    ORDER BY count DESC
  `
  const platformResult = await sql.query(platformQuery)
  console.log('Query:', platformQuery)
  console.log('Results:')
  platformResult.rows.forEach((row: any) => {
    console.log(`  ${row.source_platform}: ${row.count}`)
  })
}

testCountQuery()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
