#!/usr/bin/env tsx

/**
 * Analyze content distribution by platform in the database
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function analyzePlatformDistribution() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n📊 Database Content Distribution by Platform\n')

  // Get all content from content_queue
  const { data: allContent, error } = await supabase
    .from('content_queue')
    .select('source_platform, is_approved, is_posted, confidence_score, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching content:', error.message)
    return
  }

  // Group by platform
  const platforms = ['lemmy', 'tumblr', 'bluesky', 'imgur', 'pixabay', 'giphy', 'reddit', 'youtube']

  console.log('Platform   | Total | Approved | Posted | Available | Avg Confidence | Last Added')
  console.log('-----------|-------|----------|--------|-----------|----------------|-------------------------')

  for (const platform of platforms) {
    const platformContent = allContent?.filter(c => c.source_platform === platform) || []

    if (platformContent.length === 0) {
      console.log(`${platform.padEnd(10)} |     0 |        0 |      0 |         0 |              - | Never`)
      continue
    }

    const total = platformContent.length
    const approved = platformContent.filter(c => c.is_approved).length
    const posted = platformContent.filter(c => c.is_posted).length
    const available = platformContent.filter(c => c.is_approved && !c.is_posted).length

    const avgConfidence = platformContent.reduce((sum, c) => sum + (c.confidence_score || 0), 0) / total

    const lastAdded = new Date(platformContent[0].created_at).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    console.log(
      `${platform.padEnd(10)} | ${String(total).padStart(5)} | ${String(approved).padStart(8)} | ${String(posted).padStart(6)} | ${String(available).padStart(9)} | ${avgConfidence.toFixed(2).padStart(14)} | ${lastAdded}`
    )
  }

  // Summary
  const total = allContent?.length || 0
  const approved = allContent?.filter(c => c.is_approved).length || 0
  const posted = allContent?.filter(c => c.is_posted).length || 0
  const available = allContent?.filter(c => c.is_approved && !c.is_posted).length || 0

  console.log('-----------|-------|----------|--------|-----------|----------------|')
  console.log(`${'TOTAL'.padEnd(10)} | ${String(total).padStart(5)} | ${String(approved).padStart(8)} | ${String(posted).padStart(6)} | ${String(available).padStart(9)} |                |`)

  // Analyze recent additions
  console.log('\n📅 Recent Content Additions (Last 7 Days)\n')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentContent = allContent?.filter(c => new Date(c.created_at) > sevenDaysAgo) || []

  console.log('Platform   | Added Last 7 Days | Approved | Approval Rate')
  console.log('-----------|-------------------|----------|---------------')

  for (const platform of platforms) {
    const recentPlatform = recentContent.filter(c => c.source_platform === platform)

    if (recentPlatform.length === 0) continue

    const recentApproved = recentPlatform.filter(c => c.is_approved).length
    const approvalRate = recentPlatform.length > 0 ? (recentApproved / recentPlatform.length * 100).toFixed(1) : '0.0'

    console.log(
      `${platform.padEnd(10)} | ${String(recentPlatform.length).padStart(17)} | ${String(recentApproved).padStart(8)} | ${approvalRate.padStart(12)}%`
    )
  }

  // Analyze confidence score distribution for Pixabay
  console.log('\n🔍 Pixabay Detailed Analysis\n')

  const pixabayContent = allContent?.filter(c => c.source_platform === 'pixabay') || []

  if (pixabayContent.length > 0) {
    const recentPixabay = pixabayContent.filter(c => new Date(c.created_at) > sevenDaysAgo)

    console.log(`Total Pixabay content: ${pixabayContent.length}`)
    console.log(`Approved: ${pixabayContent.filter(c => c.is_approved).length}`)
    console.log(`Posted: ${pixabayContent.filter(c => c.is_posted).length}`)
    console.log(`Available: ${pixabayContent.filter(c => c.is_approved && !c.is_posted).length}`)
    console.log(`\nAdded in last 7 days: ${recentPixabay.length}`)

    if (recentPixabay.length > 0) {
      const scores = recentPixabay.map(c => c.confidence_score || 0).sort((a, b) => b - a)
      console.log(`\nRecent confidence scores:`)
      console.log(`  Highest: ${scores[0].toFixed(2)}`)
      console.log(`  Lowest: ${scores[scores.length - 1].toFixed(2)}`)
      console.log(`  Average: ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)}`)
      console.log(`  Median: ${scores[Math.floor(scores.length / 2)].toFixed(2)}`)

      // Show distribution
      const approved = recentPixabay.filter(c => c.is_approved).length
      const aboveThreshold = recentPixabay.filter(c => (c.confidence_score || 0) >= 0.7).length

      console.log(`\nApproval threshold analysis:`)
      console.log(`  Items with score >= 0.7: ${aboveThreshold}`)
      console.log(`  Items actually approved: ${approved}`)
    }
  } else {
    console.log('No Pixabay content in database')
  }

  console.log('\n')
}

analyzePlatformDistribution().catch(console.error)
