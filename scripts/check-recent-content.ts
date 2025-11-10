import { createSimpleClient } from '../utils/supabase/server'

async function checkRecentContent() {
  try {
    const supabase = createSimpleClient()

    console.log('\n🔍 CHECKING RECENT CONTENT BY PLATFORM\n')

    const platforms = ['youtube', 'giphy', 'tumblr', 'lemmy', 'pixabay', 'bluesky', 'imgur', 'reddit']

    // Check content added in the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    for (const platform of platforms) {
      // Count recent content
      const { count: recentCount, error: recentError } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('source_platform', platform)
        .gte('created_at', twoHoursAgo)

      // Count total for platform
      const { count: totalCount, error: totalError } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('source_platform', platform)

      // Get approval stats
      const { count: approvedCount, error: approvedError } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('source_platform', platform)
        .eq('is_approved', true)

      if (recentError || totalError || approvedError) {
        console.error(`Error checking ${platform}:`, recentError || totalError || approvedError)
        continue
      }

      console.log(`${platform.toUpperCase().padEnd(10)} | Recent: ${(recentCount || 0).toString().padStart(3)} | Total: ${(totalCount || 0).toString().padStart(4)} | Approved: ${(approvedCount || 0).toString().padStart(4)}`)

      // If we found recent content, show samples
      if (recentCount && recentCount > 0) {
        const { data: samples } = await supabase
          .from('content_queue')
          .select('id, content_text, content_type, is_approved, confidence_score, created_at')
          .eq('source_platform', platform)
          .gte('created_at', twoHoursAgo)
          .order('created_at', { ascending: false })
          .limit(3)

        if (samples && samples.length > 0) {
          console.log(`  Recent ${platform} content:`)
          samples.forEach(s => {
            const status = s.is_approved ? 'approved' : 'pending'
            console.log(`    - ID ${s.id}: ${status} (confidence: ${s.confidence_score})`)
            console.log(`      "${s.content_text?.substring(0, 60)}..."`)
          })
        }
        console.log('')
      }
    }

    console.log('\n📊 SUMMARY\n')
    console.log(`Checked content created since: ${new Date(twoHoursAgo).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`)

  } catch (error) {
    console.error('❌ Check failed:', error)
  }
}

checkRecentContent()
