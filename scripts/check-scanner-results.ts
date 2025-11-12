/**
 * Check recent scanner results from GitHub Actions
 */

import { execSync } from 'child_process'

const platforms = ['lemmy', 'tumblr', 'bluesky', 'imgur', 'pixabay', 'giphy']

interface ScanResult {
  platform: string
  found: number
  processed: number
  status: 'success' | 'skipped' | 'failed'
  timestamp: string
}

async function checkScannerResults() {
  console.log('\n📊 Scanner Results Summary\n')
  console.log('Platform   | Status    | Found | Processed | Last Run')
  console.log('-----------|-----------|-------|-----------|-------------------------')

  for (const platform of platforms) {
    try {
      // Get latest run
      const runJson = execSync(
        `gh run list --workflow=scan-${platform}.yml --limit 1 --json databaseId,conclusion,createdAt`,
        { encoding: 'utf-8' }
      )

      const runs = JSON.parse(runJson)
      if (!runs || runs.length === 0) {
        console.log(`${platform.padEnd(10)} | NO RUNS   | -     | -         | -`)
        continue
      }

      const run = runs[0]

      // Get logs
      const logs = execSync(
        `gh run view ${run.databaseId} --log 2>&1`,
        { encoding: 'utf-8' }
      )

      // Parse results from logs
      let found = 0
      let processed = 0
      let status: 'success' | 'skipped' | 'failed' = 'failed'

      // Look for result lines
      const foundMatch = logs.match(/Found (\d+)/)
      const processedMatch = logs.match(/processed (\d+) new/)

      if (foundMatch) found = parseInt(foundMatch[1])
      if (processedMatch) processed = parseInt(processedMatch[1])

      if (logs.includes('COMPLETED')) {
        status = 'success'
      } else if (logs.includes('SKIPPED')) {
        status = 'skipped'
      }

      const timestamp = new Date(run.createdAt).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      const statusIcon = status === 'success' ? '✅' : status === 'skipped' ? '⏭️' : '❌'

      console.log(
        `${platform.padEnd(10)} | ${statusIcon} ${status.padEnd(6)} | ${String(found).padStart(5)} | ${String(processed).padStart(9)} | ${timestamp}`
      )

    } catch (error) {
      console.log(`${platform.padEnd(10)} | ERROR     | -     | -         | -`)
    }
  }

  console.log('\n')
}

checkScannerResults().catch(console.error)
