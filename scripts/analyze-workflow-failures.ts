/**
 * Analyze recent workflow failures
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function analyzeFailures() {
  console.log('🔍 Analyzing workflow failures from past 24 hours...\n')

  // Get list of failed runs
  const { stdout: failuresJson } = await execAsync(
    `gh run list --status failure --limit 50 --json name,conclusion,createdAt,displayTitle,workflowName,databaseId,event | jq -r '.[] | select(.createdAt > (now - 86400 | todate)) | "\\(.databaseId)|\\(.workflowName)"'`
  )

  const failures = failuresJson
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [id, name] = line.split('|')
      return { id, name }
    })

  console.log(`📊 Found ${failures.length} failures in past 24 hours\n`)

  // Group by workflow name
  const byWorkflow = failures.reduce((acc: Record<string, string[]>, { id, name }) => {
    if (!acc[name]) acc[name] = []
    acc[name].push(id)
    return acc
  }, {})

  // Analyze each workflow type
  for (const [workflowName, runIds] of Object.entries(byWorkflow).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`📋 ${workflowName}`)
    console.log(`   Failures: ${runIds.length}`)
    console.log(`='.repeat(80)}`)

    // Get detailed info from most recent failure
    const mostRecentRun = runIds[0]
    try {
      const { stdout: runInfo } = await execAsync(`gh run view ${mostRecentRun}`)
      console.log('\nMost recent failure:')
      console.log(runInfo.split('\n').slice(0, 15).join('\n'))
    } catch (error) {
      console.log('   Could not fetch run details')
    }
  }
}

analyzeFailures().catch(console.error)
