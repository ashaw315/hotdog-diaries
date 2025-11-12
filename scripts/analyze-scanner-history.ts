#!/usr/bin/env tsx

/**
 * Analyze historical scanner performance
 * Shows average content found per platform over last N runs
 */

import { execSync } from 'child_process'

const platforms = ['lemmy', 'tumblr', 'bluesky', 'imgur', 'pixabay', 'giphy']
const RUNS_TO_ANALYZE = 10

interface ScanMetrics {
  platform: string
  totalRuns: number
  successfulRuns: number
  totalFound: number
  totalProcessed: number
  averageFound: number
  averageProcessed: number
  lastRun: string
}

async function analyzeHistory() {
  console.log(`\n📊 Scanner Performance Analysis (Last ${RUNS_TO_ANALYZE} runs)\n`)
  console.log('Platform   | Success Rate | Avg Found | Avg Processed | Last Run')
  console.log('-----------|--------------|-----------|---------------|-------------------------')

  const metrics: ScanMetrics[] = []

  for (const platform of platforms) {
    try {
      // Get last N runs
      const runsJson = execSync(
        `gh run list --workflow=scan-${platform}.yml --limit ${RUNS_TO_ANALYZE} --json databaseId,conclusion,createdAt`,
        { encoding: 'utf-8' }
      )

      const runs = JSON.parse(runsJson)
      if (!runs || runs.length === 0) {
        console.log(`${platform.padEnd(10)} | NO RUNS      | -         | -             | -`)
        continue
      }

      let totalFound = 0
      let totalProcessed = 0
      let successfulRuns = 0

      // Analyze each run
      for (const run of runs) {
        if (run.conclusion !== 'success') continue

        try {
          const logs = execSync(
            `gh run view ${run.databaseId} --log 2>&1`,
            { encoding: 'utf-8' }
          )

          // Parse metrics from logs
          const foundMatch = logs.match(/Found (\d+)/)
          const processedMatch = logs.match(/processed (\d+) new/)

          if (foundMatch) {
            totalFound += parseInt(foundMatch[1])
            successfulRuns++
          }
          if (processedMatch) {
            totalProcessed += parseInt(processedMatch[1])
          }
        } catch (logError) {
          // Skip if we can't get logs
          continue
        }
      }

      const avgFound = successfulRuns > 0 ? totalFound / successfulRuns : 0
      const avgProcessed = successfulRuns > 0 ? totalProcessed / successfulRuns : 0
      const successRate = `${successfulRuns}/${runs.length}`

      const lastRunDate = new Date(runs[0].createdAt).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      metrics.push({
        platform,
        totalRuns: runs.length,
        successfulRuns,
        totalFound,
        totalProcessed,
        averageFound: avgFound,
        averageProcessed: avgProcessed,
        lastRun: lastRunDate
      })

      console.log(
        `${platform.padEnd(10)} | ${successRate.padEnd(12)} | ${avgFound.toFixed(1).padStart(9)} | ${avgProcessed.toFixed(1).padStart(13)} | ${lastRunDate}`
      )

    } catch (error) {
      console.log(`${platform.padEnd(10)} | ERROR        | -         | -             | -`)
    }
  }

  // Summary statistics
  console.log('\n📈 Summary Statistics\n')

  const totalAvgFound = metrics.reduce((sum, m) => sum + m.averageFound, 0)
  const totalAvgProcessed = metrics.reduce((sum, m) => sum + m.averageProcessed, 0)

  console.log(`Total average found per cycle: ${totalAvgFound.toFixed(1)} items`)
  console.log(`Total average processed per cycle: ${totalAvgProcessed.toFixed(1)} items`)
  console.log(`\nWith 3 posts/day = 21 posts/week, we need ${(21 / totalAvgProcessed).toFixed(1)} scan cycles per week`)
  console.log(`Current scanning: Every 6 hours = ~28 cycles/week`)

  if (totalAvgProcessed > 0) {
    const weeklySustainability = (28 * totalAvgProcessed) / 21
    if (weeklySustainability >= 1.5) {
      console.log(`\n✅ Content flow is SUSTAINABLE (${weeklySustainability.toFixed(1)}x weekly needs)`)
    } else if (weeklySustainability >= 1.0) {
      console.log(`\n⚠️  Content flow is MARGINAL (${weeklySustainability.toFixed(1)}x weekly needs)`)
    } else {
      console.log(`\n❌ Content flow is INSUFFICIENT (${weeklySustainability.toFixed(1)}x weekly needs)`)
    }
  }

  console.log('\n')
}

analyzeHistory().catch(console.error)
