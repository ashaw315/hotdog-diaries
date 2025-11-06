/**
 * Diagnose the actual state of the queue
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function diagnose() {
  console.log('🔍 Diagnosing queue state...\n')

  // Get all content with status breakdown
  const { data: allContent, error } = await supabase
    .from('content_queue')
    .select('id, source_platform, is_approved, is_posted, confidence_score, content_status, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return
  }

  // Analyze by status
  const discovered = allContent.filter(c => !c.is_approved && !c.is_posted)
  const approved = allContent.filter(c => c.is_approved && !c.is_posted)
  const posted = allContent.filter(c => c.is_posted)

  console.log('📊 Overall Stats:')
  console.log(`  Total items: ${allContent.length}`)
  console.log(`  Discovered (not approved): ${discovered.length}`)
  console.log(`  Approved (ready to post): ${approved.length}`)
  console.log(`  Posted: ${posted.length}`)
  console.log()

  // Platform breakdown for discovered
  const discoveredByPlatform: Record<string, { count: number, avgConfidence: number }> = {}
  discovered.forEach(item => {
    if (!discoveredByPlatform[item.source_platform]) {
      discoveredByPlatform[item.source_platform] = { count: 0, avgConfidence: 0 }
    }
    discoveredByPlatform[item.source_platform].count++
    discoveredByPlatform[item.source_platform].avgConfidence += item.confidence_score || 0
  })

  console.log('🔍 Discovered Content by Platform:')
  Object.entries(discoveredByPlatform)
    .sort(([, a], [, b]) => b.count - a.count)
    .forEach(([platform, stats]) => {
      const avgConf = (stats.avgConfidence / stats.count * 100).toFixed(1)
      console.log(`  ${platform}: ${stats.count} items (avg confidence: ${avgConf}%)`)
    })
  console.log()

  // Platform breakdown for approved
  const approvedByPlatform: Record<string, number> = {}
  approved.forEach(item => {
    approvedByPlatform[item.source_platform] = (approvedByPlatform[item.source_platform] || 0) + 1
  })

  console.log('✅ Approved Content by Platform:')
  if (Object.keys(approvedByPlatform).length === 0) {
    console.log('  ❌ NO APPROVED CONTENT!')
  } else {
    Object.entries(approvedByPlatform)
      .sort(([, a], [, b]) => b - a)
      .forEach(([platform, count]) => {
        console.log(`  ${platform}: ${count} items`)
      })
  }
  console.log()

  // Confidence score distribution for discovered
  const confidenceBuckets = {
    veryLow: discovered.filter(c => (c.confidence_score || 0) < 0.3).length,
    low: discovered.filter(c => (c.confidence_score || 0) >= 0.3 && (c.confidence_score || 0) < 0.5).length,
    medium: discovered.filter(c => (c.confidence_score || 0) >= 0.5 && (c.confidence_score || 0) < 0.7).length,
    high: discovered.filter(c => (c.confidence_score || 0) >= 0.7).length,
  }

  console.log('📈 Discovered Content Quality:')
  console.log(`  Very Low (<30%): ${confidenceBuckets.veryLow}`)
  console.log(`  Low (30-50%): ${confidenceBuckets.low}`)
  console.log(`  Medium (50-70%): ${confidenceBuckets.medium}`)
  console.log(`  High (>70%): ${confidenceBuckets.high}`)
  console.log()

  // Check recent additions
  const recentItems = allContent.slice(0, 10)
  console.log('🆕 10 Most Recent Items:')
  recentItems.forEach(item => {
    const conf = ((item.confidence_score || 0) * 100).toFixed(0)
    const status = item.is_posted ? 'posted' : item.is_approved ? 'approved' : 'discovered'
    console.log(`  ${item.source_platform} - ${status} (${conf}% confidence) - ${item.created_at}`)
  })
}

diagnose().catch(console.error)
