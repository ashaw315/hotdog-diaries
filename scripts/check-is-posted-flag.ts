/**
 * Check is_posted flag consistency
 * Verify content_queue.is_posted matches posted_content records
 */

import { createSimpleClient } from '@/utils/supabase/server'

async function checkIsPostedFlag() {
  const supabase = createSimpleClient()

  console.log('\n🔍 Checking is_posted flag consistency\n')

  // 1. Get the problematic content IDs from diagnosis
  const problemContentIds = [93, 7796, 8174]

  for (const contentId of problemContentIds) {
    // Check content_queue
    const { data: queueData, error: queueError } = await supabase
      .from('content_queue')
      .select('id, is_posted, is_approved, source_platform, content_text')
      .eq('id', contentId)
      .single()

    if (queueError) {
      console.error(`❌ Error fetching content_queue for ID ${contentId}:`, queueError)
      continue
    }

    // Check posted_content
    const { data: postedData, error: postedError } = await supabase
      .from('posted_content')
      .select('id, posted_at, platform')
      .eq('content_queue_id', contentId)

    if (postedError) {
      console.error(`❌ Error fetching posted_content for ID ${contentId}:`, postedError)
      continue
    }

    console.log(`\nContent ID ${contentId} (${queueData.source_platform}):`)
    console.log(`  content_queue.is_posted: ${queueData.is_posted}`)
    console.log(`  content_queue.is_approved: ${queueData.is_approved}`)
    console.log(`  content_text: ${queueData.content_text?.substring(0, 50)}...`)

    if (postedData && postedData.length > 0) {
      console.log(`  ✅ Found in posted_content:`)
      for (const posted of postedData) {
        console.log(`    - Posted on ${posted.posted_at} to ${posted.platform} (id: ${posted.id})`)
      }

      if (!queueData.is_posted) {
        console.log(`  ❌ INCONSISTENCY: is_posted=FALSE but content is in posted_content!`)
      }
    } else {
      console.log(`  ⚠️ NOT found in posted_content`)
      if (queueData.is_posted) {
        console.log(`  ❌ INCONSISTENCY: is_posted=TRUE but content not in posted_content!`)
      }
    }
  }

  console.log('\n\n📊 Finding all inconsistencies in database...\n')

  // Find all content where is_posted flag doesn't match posted_content
  const { data: allQueue, error: allQueueError } = await supabase
    .from('content_queue')
    .select('id, is_posted, source_platform')
    .eq('is_approved', true)

  if (allQueueError) {
    console.error('❌ Error fetching all content_queue:', allQueueError)
    return
  }

  let falsePositives = 0
  let falseNegatives = 0

  for (const item of allQueue || []) {
    const { data: posted } = await supabase
      .from('posted_content')
      .select('id')
      .eq('content_queue_id', item.id)
      .limit(1)

    const isInPostedContent = (posted && posted.length > 0)

    if (item.is_posted && !isInPostedContent) {
      console.log(`❌ False positive: Content ${item.id} (${item.source_platform}) has is_posted=TRUE but not in posted_content`)
      falsePositives++
    } else if (!item.is_posted && isInPostedContent) {
      console.log(`❌ False negative: Content ${item.id} (${item.source_platform}) has is_posted=FALSE but IS in posted_content`)
      falseNegatives++
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`  False positives (is_posted=TRUE but not posted): ${falsePositives}`)
  console.log(`  False negatives (is_posted=FALSE but posted): ${falseNegatives}`)
  console.log(`  Total approved content checked: ${allQueue?.length || 0}`)
}

checkIsPostedFlag().catch(console.error)
