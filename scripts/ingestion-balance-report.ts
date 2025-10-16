#!/usr/bin/env npx tsx

/**
 * STEP 9: Ingestion Balance Monitoring Script
 * 
 * Generates daily reports on platform distribution and quota health.
 * Can be run manually or via GitHub Actions cron.
 * 
 * Usage:
 *   npx tsx scripts/ingestion-balance-report.ts
 *   npx tsx scripts/ingestion-balance-report.ts --format=json
 *   npx tsx scripts/ingestion-balance-report.ts --alert-thresholds
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PlatformMetrics {
  platform: string
  totalItems: number
  approvedItems: number
  unpostedItems: number
  activeItems: number
  deprioritizedItems: number
  approvalRate: number
  activePercentage: number
  insertedToday: number
  status: 'healthy' | 'low' | 'critical' | 'overflow'
  recommendation: string
}

interface BalanceReport {
  timestamp: string
  summary: {
    totalPlatforms: number
    totalActiveItems: number
    diversityScore: number
    healthyPlatforms: number
    criticalPlatforms: number
    overflowPlatforms: number
  }
  platforms: PlatformMetrics[]
  alerts: string[]
  recommendations: string[]
}

async function getPoolDistribution(): Promise<Record<string, any>> {
  // Get all content with relevant fields
  let allData: any[] = []
  let from = 0
  const batchSize = 1000

  while (true) {
    const { data: batch } = await supabase
      .from('content_queue')
      .select('source_platform, is_approved, is_posted, ingest_priority, created_at')
      .range(from, from + batchSize - 1)

    if (!batch || batch.length === 0) break
    allData.push(...batch)
    from += batchSize
    if (batch.length < batchSize) break
  }

  return allData.reduce((acc, item) => {
    const platform = item.source_platform.toLowerCase()
    if (!acc[platform]) {
      acc[platform] = {
        total: 0,
        approved: 0,
        unposted: 0,
        active: 0,
        deprioritized: 0,
        insertedToday: 0
      }
    }

    acc[platform].total++
    
    if (item.is_approved) {
      acc[platform].approved++
      
      if (!item.is_posted) {
        acc[platform].unposted++
        
        const priority = item.ingest_priority || 0
        if (priority >= 0) {
          acc[platform].active++
        } else {
          acc[platform].deprioritized++
        }
      }
    }

    // Count today's insertions
    const today = new Date().toISOString().split('T')[0]
    const itemDate = item.created_at.split('T')[0]
    if (itemDate === today) {
      acc[platform].insertedToday++
    }

    return acc
  }, {} as Record<string, any>)
}

function calculatePlatformMetrics(platform: string, data: any): PlatformMetrics {
  const approvalRate = data.total > 0 ? (data.approved / data.total) * 100 : 0
  const totalActive = Object.values(data).reduce((sum: number, platformData: any) => sum + platformData.active, 0)
  const activePercentage = totalActive > 0 ? (data.active / totalActive) * 100 : 0

  // Determine status based on active items
  let status: 'healthy' | 'low' | 'critical' | 'overflow' = 'healthy'
  let recommendation = 'Continue normal operation'

  if (data.active === 0) {
    status = 'critical'
    recommendation = 'URGENT: Run collector to add content'
  } else if (data.active < 50) {
    status = 'low'
    recommendation = 'Boost ingestion - buffer low'
  } else if (data.active > 400) {
    status = 'overflow'
    recommendation = 'Throttle ingestion - excess content'
  } else if (activePercentage > 40) {
    status = 'overflow'
    recommendation = 'Consider deprioritizing excess content'
  }

  return {
    platform,
    totalItems: data.total,
    approvedItems: data.approved,
    unpostedItems: data.unposted,
    activeItems: data.active,
    deprioritizedItems: data.deprioritized,
    approvalRate: Math.round(approvalRate),
    activePercentage: Math.round(activePercentage * 10) / 10,
    insertedToday: data.insertedToday,
    status,
    recommendation
  }
}

function calculateDiversityScore(platforms: PlatformMetrics[]): number {
  const activePlatforms = platforms.filter(p => p.activeItems > 0).length
  const totalActive = platforms.reduce((sum, p) => sum + p.activeItems, 0)
  
  if (totalActive === 0) return 0
  
  // Calculate Herfindahl-Hirschman Index (inverted for diversity)
  const hhi = platforms.reduce((sum, p) => {
    const share = p.activeItems / totalActive
    return sum + (share * share)
  }, 0)
  
  // Convert to 0-100 scale (higher = more diverse)
  const diversityScore = (1 - hhi) * 100
  
  // Bonus points for having more active platforms
  const platformBonus = Math.min(activePlatforms * 5, 25)
  
  return Math.round(diversityScore + platformBonus)
}

async function generateBalanceReport(): Promise<BalanceReport> {
  console.log('📊 Generating ingestion balance report...')
  
  const distributionData = await getPoolDistribution()
  const platforms = Object.entries(distributionData)
    .map(([platform, data]) => calculatePlatformMetrics(platform, data))
    .sort((a, b) => b.activeItems - a.activeItems)

  const totalActiveItems = platforms.reduce((sum, p) => sum + p.activeItems, 0)
  const diversityScore = calculateDiversityScore(platforms)
  
  const healthyPlatforms = platforms.filter(p => p.status === 'healthy').length
  const criticalPlatforms = platforms.filter(p => p.status === 'critical').length
  const overflowPlatforms = platforms.filter(p => p.status === 'overflow').length

  // Generate alerts
  const alerts: string[] = []
  const recommendations: string[] = []

  if (diversityScore < 50) {
    alerts.push(`Low diversity score: ${diversityScore}/100`)
    recommendations.push('Rebalance content or boost underrepresented platforms')
  }

  if (criticalPlatforms > 0) {
    alerts.push(`${criticalPlatforms} platforms have empty pools`)
    recommendations.push('Run collectors for empty platforms immediately')
  }

  if (totalActiveItems < 500) {
    alerts.push(`Low total active items: ${totalActiveItems}`)
    recommendations.push('Increase overall ingestion rates')
  }

  platforms.forEach(p => {
    if (p.status === 'critical') {
      alerts.push(`${p.platform}: No active content available`)
    } else if (p.status === 'overflow' && p.activePercentage > 50) {
      alerts.push(`${p.platform}: Excessive dominance (${p.activePercentage}%)`)
    }
  })

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalPlatforms: platforms.length,
      totalActiveItems,
      diversityScore,
      healthyPlatforms,
      criticalPlatforms,
      overflowPlatforms
    },
    platforms,
    alerts,
    recommendations
  }
}

function printReport(report: BalanceReport, format: 'table' | 'json' = 'table') {
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log('\n📊 INGESTION BALANCE REPORT')
  console.log('============================')
  console.log(`🕐 Generated: ${new Date(report.timestamp).toLocaleString()}`)
  console.log(`🎯 Diversity Score: ${report.summary.diversityScore}/100`)
  console.log(`📦 Total Active Items: ${report.summary.totalActiveItems}`)
  console.log(`✅ Healthy Platforms: ${report.summary.healthyPlatforms}`)
  console.log(`⚠️  Critical Platforms: ${report.summary.criticalPlatforms}`)
  console.log(`🔄 Overflow Platforms: ${report.summary.overflowPlatforms}`)

  console.log('\n📋 PLATFORM BREAKDOWN:')
  console.log('Platform'.padEnd(12) + 'Active'.padEnd(8) + 'Share%'.padEnd(8) + 'Status'.padEnd(12) + 'Today'.padEnd(8) + 'Recommendation')
  console.log('='.repeat(80))

  report.platforms.forEach(p => {
    const statusIcon = {
      healthy: '✅',
      low: '⚠️ ',
      critical: '❌',
      overflow: '🔄'
    }[p.status]

    console.log(
      p.platform.padEnd(12) +
      p.activeItems.toString().padEnd(8) +
      `${p.activePercentage}%`.padEnd(8) +
      `${statusIcon} ${p.status}`.padEnd(12) +
      p.insertedToday.toString().padEnd(8) +
      p.recommendation
    )
  })

  if (report.alerts.length > 0) {
    console.log('\n🚨 ALERTS:')
    report.alerts.forEach(alert => console.log(`  • ${alert}`))
  }

  if (report.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:')
    report.recommendations.forEach(rec => console.log(`  • ${rec}`))
  }

  // Summary line for GitHub Actions
  console.log(`\n📊 Summary: ${report.summary.diversityScore}/100 diversity, ${report.summary.totalActiveItems} active items, ${report.alerts.length} alerts`)
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const format = args.includes('--format=json') ? 'json' : 'table'
  const alertOnly = args.includes('--alert-thresholds')

  try {
    const report = await generateBalanceReport()

    if (alertOnly) {
      // Exit with non-zero code if there are alerts
      if (report.alerts.length > 0) {
        console.log(`❌ ${report.alerts.length} alerts found`)
        report.alerts.forEach(alert => console.log(`  • ${alert}`))
        process.exit(1)
      } else {
        console.log('✅ No alerts - system healthy')
        process.exit(0)
      }
    }

    printReport(report, format)

  } catch (error) {
    console.error('❌ Report generation failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { generateBalanceReport, printReport }
