#!/usr/bin/env tsx

/**
 * Test Status Filters
 *
 * Check what content exists for each status
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testStatusFilters() {
  console.log('🧪 Testing Status Filters')
  console.log('==============================================\n')

  // Test 1: Count by content_status
  console.log('Test 1: Count by content_status field')
  const { data: allData, error: allError } = await supabase
    .from('content_queue')
    .select('content_status')

  if (allError) throw allError

  const statusCounts: Record<string, number> = {}
  allData?.forEach((row: any) => {
    const status = row.content_status || '(null)'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  console.log('Content by status:')
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`)
    })
  console.log('')

  // Test 2: Check approved content
  console.log('Test 2: Approved content (content_status = approved)')
  const { count: approvedCount, error: approvedError } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .eq('content_status', 'approved')

  if (approvedError) throw approvedError
  console.log(`Total approved: ${approvedCount}`)

  // Show sample
  const { data: approvedSample, error: approvedSampleError } = await supabase
    .from('content_queue')
    .select('id, content_text, source_platform, content_status, is_approved, is_posted')
    .eq('content_status', 'approved')
    .limit(5)

  if (approvedSampleError) throw approvedSampleError
  console.log('Sample approved items:')
  approvedSample?.forEach((row: any) => {
    console.log(`  ID ${row.id}: ${row.content_text?.substring(0, 50)}... [status=${row.content_status}, is_approved=${row.is_approved}, is_posted=${row.is_posted}]`)
  })
  console.log('')

  // Test 3: Check scheduled content
  console.log('Test 3: Scheduled content (content_status = scheduled)')
  const { count: scheduledCount, error: scheduledError } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .eq('content_status', 'scheduled')

  if (scheduledError) throw scheduledError
  console.log(`Total scheduled: ${scheduledCount}`)

  // Show sample
  const { data: scheduledSample, error: scheduledSampleError } = await supabase
    .from('content_queue')
    .select('id, content_text, source_platform, content_status, is_approved, is_posted')
    .eq('content_status', 'scheduled')
    .limit(5)

  if (scheduledSampleError) throw scheduledSampleError
  console.log('Sample scheduled items:')
  scheduledSample?.forEach((row: any) => {
    console.log(`  ID ${row.id}: ${row.content_text?.substring(0, 50)}... [status=${row.content_status}, is_approved=${row.is_approved}, is_posted=${row.is_posted}]`)
  })
  console.log('')

  // Test 4: Check what the API query would return for approved
  console.log('Test 4: What API returns for approved (with is_posted check)')
  const { count: apiApprovedCount, error: apiApprovedError } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .eq('content_status', 'approved')
    .eq('is_posted', false)

  if (apiApprovedError) throw apiApprovedError
  console.log(`Total approved (not posted): ${apiApprovedCount}`)
  console.log('')

  // Test 5: Check discovered/pending
  console.log('Test 5: Discovered/Pending content')
  const { count: pendingCount, error: pendingError } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .in('content_status', ['discovered', 'pending_review'])
    .eq('is_posted', false)

  if (pendingError) throw pendingError
  console.log(`Total discovered/pending: ${pendingCount}`)
  console.log('')

  // Test 6: Check rejected
  console.log('Test 6: Rejected content')
  const { count: rejectedCount, error: rejectedError } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .eq('content_status', 'rejected')

  if (rejectedError) throw rejectedError
  console.log(`Total rejected: ${rejectedCount}`)
}

testStatusFilters()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
