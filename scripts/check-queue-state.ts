/**
 * Check queue state after nuclear reset
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkQueueState() {
  console.log('📊 Checking queue state after nuclear reset...\n')

  // Get all content
  const { data: allContent } = await supabase
    .from('content_queue')
    .select('id, source_platform, is_approved, is_posted, confidence_score')

  if (!allContent) {
    console.log('❌ Failed to fetch content')
    return
  }

  const stats = {
    total: allContent.length,
    discovered: allContent.filter(c => !c.is_approved && !c.is_posted).length,
    approved: allContent.filter(c => c.is_approved && !c.is_posted).length,
    posted: allContent.filter(c => c.is_posted).length
  }

  console.log('Overall Stats:')
  console.log(`  Total items: ${stats.total}`)
  console.log(`  Discovered (pending): ${stats.discovered}`)
  console.log(`  Approved (ready): ${stats.approved}`)
  console.log(`  Posted: ${stats.posted}`)
  console.log()

  // Platform breakdown for approved content
  const approvedByPlatform: Record<string, number> = {}
  allContent
    .filter(c => c.is_approved && !c.is_posted)
    .forEach(item => {
      approvedByPlatform[item.source_platform] = (approvedByPlatform[item.source_platform] || 0) + 1
    })

  console.log('Approved Content by Platform:')
  Object.entries(approvedByPlatform)
    .sort(([, a], [, b]) => b - a)
    .forEach(([platform, count]) => {
      const percentage = ((count / stats.approved) * 100).toFixed(1)
      console.log(`  ${platform}: ${count} (${percentage}%)`)
    })
  console.log()

  // Platform breakdown for discovered content
  const discoveredByPlatform: Record<string, number> = {}
  allContent
    .filter(c => !c.is_approved && !c.is_posted)
    .forEach(item => {
      discoveredByPlatform[item.source_platform] = (discoveredByPlatform[item.source_platform] || 0) + 1
    })

  console.log('Discovered Content by Platform:')
  Object.entries(discoveredByPlatform)
    .sort(([, a], [, b]) => b - a)
    .forEach(([platform, count]) => {
      const percentage = ((count / stats.discovered) * 100).toFixed(1)
      console.log(`  ${platform}: ${count} (${percentage}%)`)
    })
  console.log()

  // Confidence score analysis for approved
  const approvedConfidenceScores = allContent
    .filter(c => c.is_approved && !c.is_posted)
    .map(c => c.confidence_score || 0)

  if (approvedConfidenceScores.length > 0) {
    const avgConfidence = approvedConfidenceScores.reduce((a, b) => a + b, 0) / approvedConfidenceScores.length
    const minConfidence = Math.min(...approvedConfidenceScores)
    const maxConfidence = Math.max(...approvedConfidenceScores)

    console.log('Approved Content Quality:')
    console.log(`  Average confidence: ${(avgConfidence * 100).toFixed(1)}%`)
    console.log(`  Min confidence: ${(minConfidence * 100).toFixed(1)}%`)
    console.log(`  Max confidence: ${(maxConfidence * 100).toFixed(1)}%`)
    console.log()
  }

  // Check for platform diversity
  const platformCount = Object.keys(approvedByPlatform).length
  console.log(`Platform Diversity: ${platformCount} platforms represented in approved content`)

  if (platformCount >= 6) {
    console.log('✅ Good platform diversity!')
  } else if (platformCount >= 4) {
    console.log('⚠️  Moderate platform diversity')
  } else {
    console.log('❌ Low platform diversity')
  }
}

checkQueueState().catch(console.error)
