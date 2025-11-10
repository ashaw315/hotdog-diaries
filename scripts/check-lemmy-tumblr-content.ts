/**
 * Check if Lemmy and Tumblr content exists in database
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkContent() {
  console.log('🔍 Checking for Lemmy and Tumblr content in database...\n')

  const { data, error } = await supabase
    .from('content_queue')
    .select('id, source_platform, content_text, created_at')
    .in('source_platform', ['lemmy', 'tumblr'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Found ${data?.length || 0} Lemmy/Tumblr items (last 20)\n`)

  if (data && data.length > 0) {
    console.log('Recent content:')
    console.log('='.repeat(80))
    data.forEach(item => {
      const text = item.content_text?.substring(0, 60) || 'N/A'
      const created = new Date(item.created_at).toISOString()
      console.log(`\n${item.source_platform.toUpperCase()} (ID ${item.id})`)
      console.log(`  Created: ${created}`)
      console.log(`  Text: "${text}..."`)
    })

    // Group by platform
    const byPlatform = data.reduce((acc: Record<string, number>, item) => {
      acc[item.source_platform] = (acc[item.source_platform] || 0) + 1
      return acc
    }, {})

    console.log('\n' + '='.repeat(80))
    console.log('\n📈 Breakdown:')
    Object.entries(byPlatform).forEach(([platform, count]) => {
      console.log(`  ${platform}: ${count} items`)
    })

    // Check items created in last hour (after migration)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const recentItems = data.filter(item => item.created_at >= oneHourAgo)

    console.log(`\n✅ Items created in last hour: ${recentItems.length}`)
    if (recentItems.length > 0) {
      console.log('   Migration successful! Scanners are now saving content.')
    }
  } else {
    console.log('❌ No Lemmy or Tumblr content found in database')
    console.log('   The scanners may not have run yet, or found no matching content.')
  }
}

checkContent().catch(console.error)
