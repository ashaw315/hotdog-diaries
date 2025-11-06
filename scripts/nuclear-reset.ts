/**
 * NUCLEAR RESET: Delete all discovered content and start fresh
 * This is SAFE - it only deletes unapproved content, keeps approved/posted items
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_URL = 'https://hotdog-diaries.vercel.app'
const AUTH_TOKEN = process.env.AUTH_TOKEN!

async function nuclearReset() {
  console.log('💣 NUCLEAR RESET v3: Starting clean slate process\n')
  console.log('⚠️  This will DELETE all discovered (unapproved) content')
  console.log('⚠️  This will DELETE all low-quality approved content (< 50% confidence)')
  console.log('✅ This will KEEP posted content and high-quality approved content')
  console.log()

  // Step 1: Check what we have
  console.log('📊 Step 1: Checking current state...')
  const { data: before, error: beforeError } = await supabase
    .from('content_queue')
    .select('id, is_approved, is_posted')

  if (beforeError) throw beforeError

  const stats = {
    total: before.length,
    discovered: before.filter(c => !c.is_approved && !c.is_posted).length,
    approved: before.filter(c => c.is_approved && !c.is_posted).length,
    posted: before.filter(c => c.is_posted).length
  }

  console.log(`  Total items: ${stats.total}`)
  console.log(`  Discovered (will be deleted): ${stats.discovered}`)
  console.log(`  Approved (will be kept): ${stats.approved}`)
  console.log(`  Posted (will be kept): ${stats.posted}`)
  console.log()

  // Step 2: DELETE all discovered content
  console.log('🗑️  Step 2: Deleting all discovered content...')
  const { data: deleted, error: deleteError } = await supabase
    .from('content_queue')
    .delete()
    .eq('is_approved', false)
    .eq('is_posted', false)
    .select()

  if (deleteError) {
    console.error('❌ Error deleting:', deleteError)
    throw deleteError
  }

  console.log(`  ✅ Deleted ${deleted?.length || 0} discovered items`)
  console.log()

  // Step 2b: DELETE low-quality approved content
  console.log('🗑️  Step 2b: Deleting low-quality approved content...')
  const { data: deletedApproved, error: deleteApprovedError } = await supabase
    .from('content_queue')
    .delete()
    .eq('is_approved', true)
    .eq('is_posted', false)
    .lt('confidence_score', 0.5)
    .select()

  if (deleteApprovedError) {
    console.error('❌ Error deleting low-quality approved:', deleteApprovedError)
    throw deleteApprovedError
  }

  console.log(`  ✅ Deleted ${deletedApproved?.length || 0} low-quality approved items`)
  console.log()

  // Step 3: Scan all platforms fresh
  console.log('🔍 Step 3: Scanning all platforms for fresh content...')
  const platforms = ['youtube', 'giphy', 'tumblr', 'lemmy', 'reddit', 'imgur', 'pixabay', 'bluesky']
  const scanResults: Record<string, any> = {}

  for (const platform of platforms) {
    console.log(`  Scanning ${platform}...`)

    try {
      const response = await fetch(`${SITE_URL}/api/admin/${platform}/scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ maxPosts: 30 })
      })

      const result = await response.json()
      scanResults[platform] = result

      if (response.ok) {
        const added = result.data?.processed || 0
        console.log(`    ✅ Added ${added} new items`)
      } else {
        console.log(`    ⚠️  ${result.error || 'Scan failed'}`)
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error}`)
    }

    // Brief delay between scans
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  console.log()

  // Step 4: Auto-approve high-quality content
  console.log('✅ Step 4: Auto-approving high-quality content...')

  // First, approve anything with confidence >= 0.6 from underrepresented platforms
  const underrepresented = ['youtube', 'tumblr', 'lemmy', 'reddit', 'mastodon', 'giphy', 'imgur']

  for (const platform of underrepresented) {
    const { data: approved, error: approveError } = await supabase
      .from('content_queue')
      .update({ is_approved: true })
      .eq('is_approved', false)
      .eq('is_posted', false)
      .eq('source_platform', platform)
      .gte('confidence_score', 0.6)
      .select()

    if (!approveError && approved) {
      console.log(`  ✅ ${platform}: approved ${approved.length} items`)
    }
  }

  // Then approve high-quality content from all platforms
  const { data: highQuality, error: hqError } = await supabase
    .from('content_queue')
    .update({ is_approved: true })
    .eq('is_approved', false)
    .eq('is_posted', false)
    .gte('confidence_score', 0.7)
    .select()

  if (!hqError && highQuality) {
    console.log(`  ✅ Approved ${highQuality.length} additional high-quality items`)
  }
  console.log()

  // Step 5: Show final state
  console.log('📊 Step 5: Final state...')
  const { data: after } = await supabase
    .from('content_queue')
    .select('id, source_platform, is_approved, is_posted')

  const finalStats = {
    total: after?.length || 0,
    discovered: after?.filter(c => !c.is_approved && !c.is_posted).length || 0,
    approved: after?.filter(c => c.is_approved && !c.is_posted).length || 0,
    posted: after?.filter(c => c.is_posted).length || 0
  }

  const platformBreakdown: Record<string, number> = {}
  after?.filter(c => c.is_approved && !c.is_posted).forEach(item => {
    platformBreakdown[item.source_platform] = (platformBreakdown[item.source_platform] || 0) + 1
  })

  console.log(`  Total items: ${finalStats.total}`)
  console.log(`  Discovered (pending): ${finalStats.discovered}`)
  console.log(`  Approved (ready): ${finalStats.approved}`)
  console.log(`  Posted: ${finalStats.posted}`)
  console.log()
  console.log('  Approved content by platform:')
  Object.entries(platformBreakdown)
    .sort(([, a], [, b]) => b - a)
    .forEach(([platform, count]) => {
      console.log(`    ${platform}: ${count}`)
    })
  console.log()

  console.log('🎉 NUCLEAR RESET COMPLETE!')
  console.log('Your queue now has fresh, high-quality, diverse content.')
}

nuclearReset().catch(error => {
  console.error('❌ Nuclear reset failed:', error)
  process.exit(1)
})
