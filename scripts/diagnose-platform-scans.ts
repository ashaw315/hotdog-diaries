import { db } from '../lib/db'

async function diagnosePlatformScans() {
  try {
    await db.connect()

    console.log('=== PLATFORM SCAN DIAGNOSTICS ===\n')

    // 1. Check content by platform and status
    const platformStats = await db.query(`
      SELECT
        source_platform as platform,
        COUNT(*) as total_items,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_count,
        AVG(CASE WHEN confidence_score IS NOT NULL THEN confidence_score ELSE 0 END) as avg_confidence,
        MIN(created_at) as first_scan,
        MAX(created_at) as last_scan
      FROM content_queue
      GROUP BY source_platform
      ORDER BY total_items DESC
    `)

    console.log('📊 CONTENT BY PLATFORM:\n')
    for (const row of platformStats.rows) {
      const daysSinceFirst = row.first_scan ? Math.floor((Date.now() - new Date(row.first_scan).getTime()) / (1000 * 60 * 60 * 24)) : 0
      const daysSinceLast = row.last_scan ? Math.floor((Date.now() - new Date(row.last_scan).getTime()) / (1000 * 60 * 60 * 24)) : 0

      console.log(`${row.platform}:`)
      console.log(`  Total: ${row.total_items} items`)
      console.log(`  Approved: ${row.approved_count} (${((row.approved_count / row.total_items) * 100).toFixed(1)}%)`)
      console.log(`  Avg Confidence: ${(row.avg_confidence * 100).toFixed(1)}%`)
      console.log(`  First scan: ${daysSinceFirst} days ago`)
      console.log(`  Last scan: ${daysSinceLast} days ago`)
      console.log('')
    }

    // 2. Check recent scan activity (last 24 hours)
    const recentScans = await db.query(`
      SELECT
        source_platform as platform,
        COUNT(*) as items_today,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_today
      FROM content_queue
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY source_platform
      ORDER BY items_today DESC
    `)

    console.log('\n📅 RECENT SCAN ACTIVITY (Last 24 hours):\n')
    if (recentScans.rows.length === 0) {
      console.log('❌ NO SCANS in the last 24 hours!\n')
    } else {
      for (const row of recentScans.rows) {
        console.log(`${row.platform}: ${row.items_today} items (${row.approved_today} approved)`)
      }
      console.log('')
    }

    // 3. Check for platforms with zero content
    const allPlatforms = ['youtube', 'reddit', 'pixabay', 'bluesky', 'giphy', 'imgur', 'lemmy', 'tumblr']
    const foundPlatforms = new Set(platformStats.rows.map(r => r.platform))
    const missingPlatforms = allPlatforms.filter(p => !foundPlatforms.has(p))

    if (missingPlatforms.length > 0) {
      console.log('🚨 PLATFORMS WITH ZERO CONTENT:\n')
      missingPlatforms.forEach(p => console.log(`  - ${p}`))
      console.log('')
    }

    // 4. Check confidence score distribution
    const confidenceDistribution = await db.query(`
      SELECT
        source_platform as platform,
        COUNT(CASE WHEN confidence_score < 0.3 THEN 1 END) as low,
        COUNT(CASE WHEN confidence_score >= 0.3 AND confidence_score < 0.6 THEN 1 END) as medium,
        COUNT(CASE WHEN confidence_score >= 0.6 THEN 1 END) as high,
        COUNT(CASE WHEN confidence_score IS NULL THEN 1 END) as null_scores
      FROM content_queue
      GROUP BY source_platform
      ORDER BY platform
    `)

    console.log('\n🎯 CONFIDENCE SCORE DISTRIBUTION:\n')
    for (const row of confidenceDistribution.rows) {
      console.log(`${row.platform}:`)
      console.log(`  Low (<30%): ${row.low}`)
      console.log(`  Medium (30-60%): ${row.medium}`)
      console.log(`  High (>60%): ${row.high}`)
      console.log(`  No score: ${row.null_scores}`)
      console.log('')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await db.disconnect()
  }
}

diagnosePlatformScans()
