/**
 * Simple script to approve quality content from all platforms
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function approveContent() {
  console.log('✅ Starting simple approval process...\n')

  // Approve content with confidence >= 0.5 from underrepresented platforms first
  const underrepresented = ['youtube', 'tumblr', 'lemmy', 'reddit', 'mastodon', 'giphy']

  for (const platform of underrepresented) {
    console.log(`Approving ${platform} content...`)

    const { data, error } = await supabase
      .from('content_queue')
      .update({ is_approved: true })
      .eq('is_approved', false)
      .eq('is_posted', false)
      .eq('source_platform', platform)
      .gte('confidence_score', 0.5)
      .select()

    if (error) {
      console.log(`  ❌ Error: ${error.message}`)
    } else {
      console.log(`  ✅ Approved ${data?.length || 0} items`)
    }
  }

  // Also approve some high-quality content from other platforms
  console.log('\nApproving high-quality content from other platforms...')
  const { data: highQuality, error: hqError } = await supabase
    .from('content_queue')
    .update({ is_approved: true })
    .eq('is_approved', false)
    .eq('is_posted', false)
    .gte('confidence_score', 0.7)
    .limit(100)
    .select()

  if (hqError) {
    console.log(`  ❌ Error: ${hqError.message}`)
  } else {
    console.log(`  ✅ Approved ${highQuality?.length || 0} high-quality items`)
  }

  console.log('\n✅ Approval process complete!')
}

approveContent()
