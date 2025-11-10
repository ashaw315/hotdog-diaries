import { createSimpleClient } from '../utils/supabase/server'

async function checkPlatformContent() {
  try {
    const supabase = createSimpleClient()

    console.log('\n📊 PLATFORM CONTENT ANALYSIS\n')

    const platforms = ['pixabay', 'bluesky', 'imgur', 'reddit', 'youtube', 'giphy', 'tumblr', 'lemmy']

    for (const platform of platforms) {
      console.log(`\n=== ${platform.toUpperCase()} ===`)

      // Get total content for this platform
      const { count: totalCount, error: countError } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('source_platform', platform)

      if (countError) {
        console.error(`Error counting ${platform}:`, countError)
        continue
      }

      // Get approved content
      const { count: approvedCount, error: approvedError } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('source_platform', platform)
        .eq('approval_status', 'approved')

      // Get awaiting approval
      const { count: awaitingCount, error: awaitingError } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('source_platform', platform)
        .eq('approval_status', 'awaiting_approval')

      // Get rejected
      const { count: rejectedCount, error: rejectedError } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('source_platform', platform)
        .eq('approval_status', 'rejected')

      console.log(`Total: ${totalCount || 0}`)
      console.log(`Approved: ${approvedCount || 0}`)
      console.log(`Awaiting Approval: ${awaitingCount || 0}`)
      console.log(`Rejected: ${rejectedCount || 0}`)

      // Get a sample of recent content
      if (totalCount && totalCount > 0) {
        const { data: samples, error: sampleError } = await supabase
          .from('content_queue')
          .select('id, content_text, content_type, approval_status, confidence_score, created_at')
          .eq('source_platform', platform)
          .order('created_at', { ascending: false })
          .limit(3)

        if (samples && samples.length > 0) {
          console.log('\nRecent samples:')
          samples.forEach(sample => {
            console.log(`  - ID ${sample.id}: ${sample.approval_status} (${sample.content_type}, confidence: ${sample.confidence_score})`)
            console.log(`    "${sample.content_text?.substring(0, 60)}..."`)
            console.log(`    Added: ${sample.created_at}`)
          })
        }
      }
    }

    console.log('\n\n📈 SUMMARY')
    console.log('='.repeat(50))

    const { data: summary, error: summaryError } = await supabase
      .from('content_queue')
      .select('source_platform, approval_status')

    if (summaryError) {
      console.error('Error fetching summary:', summaryError)
    } else {
      const platformCounts: Record<string, { total: number, approved: number, awaiting: number, rejected: number }> = {}

      summary?.forEach(item => {
        if (!platformCounts[item.source_platform]) {
          platformCounts[item.source_platform] = { total: 0, approved: 0, awaiting: 0, rejected: 0 }
        }
        platformCounts[item.source_platform].total++
        if (item.approval_status === 'approved') platformCounts[item.source_platform].approved++
        if (item.approval_status === 'awaiting_approval') platformCounts[item.source_platform].awaiting++
        if (item.approval_status === 'rejected') platformCounts[item.source_platform].rejected++
      })

      console.log('\nPlatform | Total | Approved | Awaiting | Rejected')
      console.log('-'.repeat(60))
      Object.entries(platformCounts).sort((a, b) => b[1].total - a[1].total).forEach(([platform, counts]) => {
        console.log(`${platform.padEnd(10)} | ${counts.total.toString().padStart(5)} | ${counts.approved.toString().padStart(8)} | ${counts.awaiting.toString().padStart(8)} | ${counts.rejected.toString().padStart(8)}`)
      })
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error)
  }
}

checkPlatformContent()
