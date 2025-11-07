/**
 * Check the state of approved content in content_queue
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkApprovedContent() {
  console.log('🔍 Checking approved content state...\n')

  // Get total counts
  const { data: allContent, error: allError } = await supabase
    .from('content_queue')
    .select('id, is_approved, is_posted, source_platform, content_text')
    .order('created_at', { ascending: false })

  if (allError) {
    console.error('❌ Error:', allError)
    return
  }

  const total = allContent?.length || 0
  const approved = allContent?.filter(c => c.is_approved).length || 0
  const pending = allContent?.filter(c => !c.is_approved).length || 0
  const posted = allContent?.filter(c => c.is_posted).length || 0
  const approvedNotPosted = allContent?.filter(c => c.is_approved && !c.is_posted).length || 0

  console.log('📊 Overall Stats:')
  console.log(`   Total content: ${total}`)
  console.log(`   Approved: ${approved}`)
  console.log(`   Pending review: ${pending}`)
  console.log(`   Posted: ${posted}`)
  console.log(`   ✅ Approved & not posted (available to schedule): ${approvedNotPosted}`)
  console.log('')

  // Break down by platform
  console.log('📊 Approved & Not Posted by Platform:')
  const availableByPlatform: Record<string, number> = {}
  allContent
    ?.filter(c => c.is_approved && !c.is_posted)
    .forEach(c => {
      const platform = c.source_platform || 'unknown'
      availableByPlatform[platform] = (availableByPlatform[platform] || 0) + 1
    })

  Object.entries(availableByPlatform)
    .sort((a, b) => b[1] - a[1])
    .forEach(([platform, count]) => {
      console.log(`   ${platform}: ${count}`)
    })
  console.log('')

  // Check recent approved items
  console.log('📋 Recent Approved Content (not posted):')
  const recentApproved = allContent
    ?.filter(c => c.is_approved && !c.is_posted)
    .slice(0, 10)

  if (recentApproved && recentApproved.length > 0) {
    for (const item of recentApproved) {
      console.log(`   ID ${item.id}: ${item.source_platform || 'no platform'} - "${item.content_text?.substring(0, 60)}..."`)
    }
  } else {
    console.log('   ⚠️ No approved content available!')
  }
  console.log('')

  // Check for content that might have been incorrectly marked as posted
  console.log('🔍 Checking for incorrectly marked content...')

  // Get content marked as posted
  const { data: markedPosted } = await supabase
    .from('content_queue')
    .select('id, source_platform, content_text, is_posted')
    .eq('is_posted', true)
    .order('id', { ascending: false })
    .limit(20)

  if (markedPosted && markedPosted.length > 0) {
    console.log(`   Found ${markedPosted.length} recent items marked as posted`)

    // Check if they actually have posted_content records
    for (const item of markedPosted) {
      const { data: postedRecords, error: postedError } = await supabase
        .from('posted_content')
        .select('id, posted_at')
        .eq('content_queue_id', item.id)

      if (postedError) {
        console.error(`   ❌ Error checking posted_content for ${item.id}:`, postedError)
      } else if (!postedRecords || postedRecords.length === 0) {
        console.log(`   ⚠️ Content ${item.id} marked as posted but NO posted_content record!`)
        console.log(`      Platform: ${item.source_platform}`)
        console.log(`      Text: "${item.content_text?.substring(0, 50)}..."`)
      }
    }
  }

  console.log('\n✅ Diagnosis complete')
}

checkApprovedContent().catch(console.error)
