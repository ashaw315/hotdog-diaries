/**
 * Find content that has been posted but still has is_posted = FALSE
 * This causes the scheduler to keep selecting already-posted content
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function findPostedContentWithWrongFlag() {
  console.log('🔍 Finding content that has been posted but still has is_posted = FALSE\n')

  // Get all content that has been posted (from posted_content table)
  const { data: postedContent, error: postedError } = await supabase
    .from('posted_content')
    .select('content_queue_id, created_at')
    .order('created_at', { ascending: false })

  if (postedError) {
    console.error('❌ Error fetching posted content:', postedError)
    return
  }

  console.log(`📊 Total posted content records: ${postedContent?.length || 0}`)

  // Get the content_queue records for these IDs
  const contentIds = postedContent?.map(pc => pc.content_queue_id) || []

  if (contentIds.length === 0) {
    console.log('No posted content found')
    return
  }

  const { data: queueItems, error: queueError } = await supabase
    .from('content_queue')
    .select('id, content_text, source_platform, is_posted, is_approved, created_at')
    .in('id', contentIds)

  if (queueError) {
    console.error('❌ Error fetching queue items:', queueError)
    return
  }

  console.log(`📊 Checked ${queueItems?.length || 0} content_queue records\n`)

  // Find items where is_posted = FALSE but they're in posted_content
  const wrongFlag = queueItems?.filter(item => !item.is_posted) || []

  console.log(`🚨 Found ${wrongFlag.length} items with WRONG is_posted flag:\n`)

  if (wrongFlag.length > 0) {
    console.log('Items that are posted but still have is_posted = FALSE:')
    console.log('=' .repeat(80))

    for (const item of wrongFlag.slice(0, 20)) {
      // Find when it was posted
      const posted = postedContent?.find(pc => pc.content_queue_id === item.id)
      const postedDate = posted ? new Date(posted.created_at).toISOString().split('T')[0] : 'unknown'

      console.log(`\nID: ${item.id}`)
      console.log(`  Platform: ${item.source_platform}`)
      console.log(`  Content: "${item.content_text?.substring(0, 60)}..."`)
      console.log(`  Posted on: ${postedDate}`)
      console.log(`  is_posted flag: ${item.is_posted} ❌ (should be TRUE)`)
      console.log(`  is_approved: ${item.is_approved}`)
    }

    if (wrongFlag.length > 20) {
      console.log(`\n... and ${wrongFlag.length - 20} more`)
    }

    console.log('\n' + '='.repeat(80))
    console.log(`\n💡 SOLUTION: Update these ${wrongFlag.length} records to set is_posted = TRUE`)
    console.log(`   This will prevent the scheduler from selecting them again.\n`)

    // Show breakdown by platform
    const byPlatform = wrongFlag.reduce((acc, item) => {
      acc[item.source_platform] = (acc[item.source_platform] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('📊 Breakdown by platform:')
    Object.entries(byPlatform).forEach(([platform, count]) => {
      console.log(`   ${platform}: ${count} items`)
    })

    // Find the specific imgur post mentioned by user
    const imgurDracula = wrongFlag.find(item =>
      item.content_text?.includes('My Dad is Dracula') ||
      item.content_text?.includes('Carnival food')
    )

    if (imgurDracula) {
      console.log(`\n\n🎯 FOUND THE SPECIFIC POST THE USER MENTIONED:`)
      console.log(`   ID: ${imgurDracula.id}`)
      console.log(`   Content: "${imgurDracula.content_text?.substring(0, 100)}..."`)
      console.log(`   This content was posted but is_posted flag was never set!`)
    }

  } else {
    console.log('✅ All posted content has correct is_posted = TRUE flag')
  }
}

findPostedContentWithWrongFlag().catch(console.error)
