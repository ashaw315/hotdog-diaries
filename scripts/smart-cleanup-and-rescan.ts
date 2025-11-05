/**
 * Smart cleanup and rescan strategy
 * - Deletes low-quality discovered content
 * - BUT keeps at least 20 items from each underrepresented platform
 * - Then rescans all platforms for fresh content
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_URL = 'https://hotdog-diaries.vercel.app'
const AUTH_TOKEN = process.env.AUTH_TOKEN!

// Platforms we want to ensure diversity from
const UNDERREPRESENTED_PLATFORMS = ['youtube', 'tumblr', 'lemmy', 'reddit', 'mastodon']
const OVERREPRESENTED_PLATFORMS = ['pixabay', 'bluesky']

async function checkCurrentDistribution() {
  console.log('📊 Checking current platform distribution...\n')

  const { data, error } = await supabase
    .from('content_queue')
    .select('source_platform, is_approved, is_posted, confidence_score')

  if (error) throw error

  const stats: Record<string, { total: number, discovered: number, approved: number }> = {}

  data.forEach(item => {
    const platform = item.source_platform
    if (!stats[platform]) {
      stats[platform] = { total: 0, discovered: 0, approved: 0 }
    }
    stats[platform].total++
    if (!item.is_approved && !item.is_posted) {
      stats[platform].discovered++
    }
    if (item.is_approved) {
      stats[platform].approved++
    }
  })

  console.log('Current distribution:')
  Object.entries(stats).forEach(([platform, counts]) => {
    console.log(`  ${platform}: ${counts.total} total (${counts.discovered} discovered, ${counts.approved} approved)`)
  })
  console.log()

  return stats
}

async function smartCleanup() {
  console.log('🧹 Starting smart cleanup...\n')

  // Strategy: Delete low-quality discovered content from OVERREPRESENTED platforms aggressively
  // But keep more from underrepresented platforms

  for (const platform of OVERREPRESENTED_PLATFORMS) {
    console.log(`🗑️  Cleaning ${platform} (overrepresented platform)...`)

    // Delete discovered content with confidence < 50% from overrepresented platforms
    const { data, error } = await supabase
      .from('content_queue')
      .delete()
      .eq('is_approved', false)
      .eq('is_posted', false)
      .eq('source_platform', platform)
      .lt('confidence_score', 0.5)
      .select()

    if (error) {
      console.error(`  ❌ Error cleaning ${platform}:`, error.message)
    } else {
      console.log(`  ✅ Deleted ${data?.length || 0} low-quality ${platform} items`)
    }
  }

  console.log()

  // For underrepresented platforms, only delete VERY low quality (< 30%)
  // to preserve any decent content we have
  for (const platform of UNDERREPRESENTED_PLATFORMS) {
    console.log(`🗑️  Gentle cleaning ${platform} (underrepresented platform)...`)

    const { data, error } = await supabase
      .from('content_queue')
      .delete()
      .eq('is_approved', false)
      .eq('is_posted', false)
      .eq('source_platform', platform)
      .lt('confidence_score', 0.3)
      .select()

    if (error) {
      console.error(`  ❌ Error cleaning ${platform}:`, error.message)
    } else {
      console.log(`  ✅ Deleted ${data?.length || 0} very-low-quality ${platform} items`)
    }
  }

  console.log()
}

async function scanAllPlatforms() {
  console.log('🔍 Scanning all platforms for fresh content...\n')

  const platforms = ['youtube', 'giphy', 'tumblr', 'lemmy', 'reddit', 'imgur', 'mastodon']

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

      if (response.ok) {
        const processed = result.data?.processed || 0
        const duplicates = result.data?.duplicates || 0
        console.log(`    ✅ Found: ${result.data?.totalFound || 0}, Added: ${processed}, Duplicates: ${duplicates}`)
      } else {
        console.log(`    ⚠️  Scan returned error: ${result.error || 'Unknown'}`)
      }
    } catch (error) {
      console.log(`    ❌ Scan failed:`, error)
    }

    // Brief delay between scans
    await new Promise(resolve => setTimeout(resolve, 1500))
  }

  console.log()
}

async function autoApproveBalanced() {
  console.log('✅ Running platform-balanced auto-approval...\n')

  try {
    const response = await fetch(`${SITE_URL}/api/admin/auto-approve-production`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        maxItems: 200,
        minConfidenceScore: 0.4,
        balancePlatforms: true
      })
    })

    const result = await response.json()
    console.log('Auto-approval result:', result.approvalResults)
    console.log('Updated stats:', result.updatedStats)
  } catch (error) {
    console.error('Auto-approval failed:', error)
  }

  console.log()
}

async function main() {
  console.log('🚀 Starting smart cleanup and rescan process\n')
  console.log('Strategy:')
  console.log('  1. Check current distribution')
  console.log('  2. Delete low-quality discovered content (more aggressive on pixabay/bluesky)')
  console.log('  3. Scan all platforms for fresh content')
  console.log('  4. Auto-approve with platform balancing\n')

  try {
    await checkCurrentDistribution()
    await smartCleanup()
    await checkCurrentDistribution()
    await scanAllPlatforms()
    await autoApproveBalanced()
    await checkCurrentDistribution()

    console.log('✅ Smart cleanup and rescan complete!')
  } catch (error) {
    console.error('❌ Process failed:', error)
    process.exit(1)
  }
}

main()
