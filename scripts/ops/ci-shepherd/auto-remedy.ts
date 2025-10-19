#!/usr/bin/env tsx

/**
 * Auto-Remedy for Production Watchdog failures
 * Attempts targeted, safe remediations before allowing revert
 */

import { parseArgs } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

interface Args {
  skipWatchdog?: boolean
}

interface WatchdogData {
  actions?: any
  db?: any
  ui?: any
}

interface RemediationPlan {
  causes: string[]
  actions: RemediationAction[]
}

interface RemediationAction {
  type: 'SCHEDULE' | 'QUEUE_REFILL' | 'MISSED_POSTING' | 'UI_ISSUE'
  description: string
  commands: string[]
  issueNeeded?: boolean
}

async function main() {
  const { values } = parseArgs({
    options: {
      skipWatchdog: { type: 'boolean', default: false }
    }
  })

  const args: Args = {
    skipWatchdog: values.skipWatchdog
  }

  console.log('🔧 Auto-Remedy: Analyzing Watchdog failures...')

  // Load watchdog data
  const data = await loadWatchdogData()
  
  // Analyze failure causes
  const plan = analyzeFailures(data)
  
  if (plan.causes.length === 0) {
    console.log('  ✅ No remediable failures detected')
    await writeReport(plan, [], 'NO_FAILURES_DETECTED')
    process.exit(0)
  }

  console.log(`  🎯 Detected ${plan.causes.length} remediable cause(s):`)
  for (const cause of plan.causes) {
    console.log(`    - ${cause}`)
  }

  // Execute remediations
  const results: string[] = []
  
  for (const action of plan.actions) {
    console.log(`\n🔨 Executing: ${action.description}`)
    
    try {
      for (const command of action.commands) {
        console.log(`  Command: ${command}`)
        const result = execSync(command, { 
          encoding: 'utf-8',
          timeout: 120000, // 2 minute timeout
          stdio: 'pipe'
        })
        results.push(`✅ ${command}: ${result.trim() || 'Success'}`)
      }
      
      if (action.issueNeeded) {
        await createDiagnosticIssue(action, data)
        results.push(`✅ ${action.description}: Diagnostic issue created`)
      }
      
    } catch (error: any) {
      const errorMsg = `❌ ${action.description}: ${error.message}`
      console.warn(`  ${errorMsg}`)
      results.push(errorMsg)
    }
  }

  // Wait a moment for systems to settle
  console.log('\n⏳ Waiting 30s for systems to settle...')
  await new Promise(resolve => setTimeout(resolve, 30000))

  let finalResult = 'UNKNOWN'
  
  if (!args.skipWatchdog) {
    // Re-run watchdog to verify fixes
    console.log('\n🔍 Re-running Production Watchdog to verify remediations...')
    
    try {
      const watchdogCmd = 'pnpm tsx scripts/ops/ci-shepherd/run-and-wait-workflow.ts --workflow .github/workflows/prod-watchdog.yml --timeoutSec 900'
      execSync(watchdogCmd, { 
        encoding: 'utf-8',
        stdio: 'inherit'
      })
      finalResult = 'GREEN_OR_YELLOW'
      console.log('✅ Post-remediation Watchdog succeeded')
    } catch (error: any) {
      finalResult = 'STILL_RED'
      console.error('❌ Post-remediation Watchdog still failing')
      results.push(`❌ Post-remediation Watchdog: ${error.message}`)
    }
  } else {
    finalResult = 'WATCHDOG_SKIPPED'
  }

  // Write report
  await writeReport(plan, results, finalResult)

  // Exit with appropriate code
  if (finalResult === 'GREEN_OR_YELLOW') {
    console.log('🎉 Auto-remedy successful - systems restored')
    process.exit(0)
  } else if (finalResult === 'WATCHDOG_SKIPPED') {
    console.log('⚠️ Auto-remedy completed (watchdog skipped)')
    process.exit(2)
  } else {
    console.error('💥 Auto-remedy failed - system still unhealthy')
    process.exit(1)
  }
}

async function loadWatchdogData(): Promise<WatchdogData> {
  const data: WatchdogData = {}
  
  const files = [
    { key: 'actions', path: 'ci_audit/watchdog/actions-today.json' },
    { key: 'db', path: 'ci_audit/watchdog/db-today.json' },
    { key: 'ui', path: 'ci_audit/watchdog/ui-today.json' }
  ]

  for (const file of files) {
    if (existsSync(file.path)) {
      try {
        const content = await readFile(file.path, 'utf-8')
        data[file.key as keyof WatchdogData] = JSON.parse(content)
      } catch (error) {
        console.warn(`  ⚠️ Failed to load ${file.path}: ${error}`)
      }
    }
  }

  return data
}

function analyzeFailures(data: WatchdogData): RemediationPlan {
  const causes: string[] = []
  const actions: RemediationAction[] = []

  // Check schedule issues
  if (data.db) {
    const todayCount = data.db.scheduleTodayCount || 0
    const tomorrowCount = data.db.scheduleTomorrowCount || 0
    
    if (todayCount < 6 || tomorrowCount < 6) {
      causes.push(`NO_SCHEDULE: Today=${todayCount}/6, Tomorrow=${tomorrowCount}/6`)
      actions.push({
        type: 'SCHEDULE',
        description: 'Fix schedule materialization',
        commands: [
          'gh workflow run content-scheduler.yml --ref main || true',
          `pnpm tsx scripts/ops/materialize-schedule.ts --dates "$(date -u +%Y-%m-%d),$(date -u -d '+1 day' +%Y-%m-%d 2>/dev/null || gdate -d '+1 day' +%Y-%m-%d)" --force || true`
        ]
      })
    }
  }

  // Check queue levels
  if (data.db) {
    const approvedCount = data.db.approvedCount || 0
    
    if (approvedCount < 12) {
      causes.push(`QUEUE_LOW: Only ${approvedCount} approved items available`)
      actions.push({
        type: 'QUEUE_REFILL',
        description: 'Trigger content scanning for queue refill',
        commands: [
          'gh workflow run scan-reddit.yml --ref main || true',
          'gh workflow run scan-youtube.yml --ref main || true', 
          'gh workflow run scan-giphy.yml --ref main || true'
        ]
      })
    }
  }

  // Check missed posting executions
  if (data.actions?.slots) {
    const missedSlots = data.actions.slots.filter((s: any) => 
      s.status === 'MISSING_EXECUTION' && s.isPast
    )
    
    if (missedSlots.length > 0) {
      const slotWorkflows = {
        '0': 'post-breakfast.yml',   // 08:00 ET
        '1': 'post-lunch.yml',      // 12:00 ET  
        '2': 'post-snack.yml',      // 15:00 ET
        '3': 'post-dinner.yml',     // 18:00 ET
        '4': 'post-evening.yml',    // 21:00 ET
        '5': 'post-late-night.yml'  // 23:30 ET
      }
      
      const commands = missedSlots
        .map((slot: any) => slotWorkflows[slot.slot as keyof typeof slotWorkflows])
        .filter(Boolean)
        .map((workflow: string) => `gh workflow run ${workflow} --ref main || true`)

      causes.push(`MISSED_EXECUTIONS: ${missedSlots.length} slots (${missedSlots.map((s: any) => s.slot).join(', ')})`)
      actions.push({
        type: 'MISSED_POSTING',
        description: 'Re-dispatch missed posting workflows',
        commands
      })
    }
  }

  // Check UI health
  if (data.ui?.probes) {
    const failedProbes = data.ui.probes.filter((p: any) => !p.ok)
    
    if (failedProbes.length > 0) {
      causes.push(`UI_HEALTH_FAIL: ${failedProbes.length} endpoints failing`)
      actions.push({
        type: 'UI_ISSUE',
        description: 'Create diagnostic issue for UI health failures',
        commands: [], // No direct commands, will create issue
        issueNeeded: true
      })
    }
  }

  return { causes, actions }
}

async function createDiagnosticIssue(action: RemediationAction, data: WatchdogData) {
  if (!data.ui?.probes) return

  const failedProbes = data.ui.probes.filter((p: any) => !p.ok)
  const timestamp = new Date().toISOString()
  
  const title = `🚨 UI Health Diagnostic - ${timestamp.split('T')[0]}`
  
  const body = `# UI Health Diagnostic Report

**Generated:** ${timestamp}
**Failed Endpoints:** ${failedProbes.length}

## Failed Probes

| Endpoint | Status | Response Time | Error |
|----------|--------|---------------|-------|
${failedProbes.map((p: any) => 
  `| ${p.endpoint} | ${p.status} | ${p.responseTime}ms | ${p.error || 'N/A'} |`
).join('\n')}

## Raw Data

\`\`\`json
${JSON.stringify(data.ui, null, 2)}
\`\`\`

## Next Steps

1. Check Vercel deployment status
2. Review application logs
3. Test endpoints manually
4. Consider rolling back if widespread failures

---
*Auto-generated by ci-shepherd auto-remedy*
`

  try {
    // Check for existing open issue
    const listCmd = 'gh issue list --search "UI Health Diagnostic" --state open --limit 1 --json number'
    const existingIssues = JSON.parse(execSync(listCmd, { encoding: 'utf-8' }))
    
    if (existingIssues.length > 0) {
      // Update existing issue
      const issueNumber = existingIssues[0].number
      execSync(`gh issue comment ${issueNumber} --body "${body.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' })
      console.log(`  Updated existing issue #${issueNumber}`)
    } else {
      // Create new issue
      const createCmd = `gh issue create --title "${title}" --body "${body.replace(/"/g, '\\"')}" --label "ui-health,auto-remedy"`
      execSync(createCmd, { encoding: 'utf-8' })
      console.log('  Created new diagnostic issue')
    }
  } catch (error) {
    console.warn(`  ⚠️ Failed to create/update issue: ${error}`)
  }
}

async function writeReport(plan: RemediationPlan, results: string[], finalResult: string) {
  const timestamp = new Date().toISOString()
  
  const report = `# Auto-Remedy Report

**Generated:** ${timestamp}
**Final Result:** ${finalResult}

## Detected Causes

${plan.causes.length > 0 ? plan.causes.map(c => `- ${c}`).join('\n') : '*No remediable failures detected*'}

## Actions Taken

${plan.actions.length > 0 ? plan.actions.map(a => `### ${a.description}\n${a.commands.map(c => `- \`${c}\``).join('\n')}`).join('\n\n') : '*No actions required*'}

## Execution Results

${results.length > 0 ? results.map(r => `- ${r}`).join('\n') : '*No results recorded*'}

## Next Steps

${finalResult === 'GREEN_OR_YELLOW' ? '✅ Systems restored - no further action needed' :
  finalResult === 'STILL_RED' ? '❌ Manual intervention required - check logs and consider emergency procedures' :
  finalResult === 'WATCHDOG_SKIPPED' ? '⚠️ Remediation completed but watchdog verification skipped' :
  '❓ Unknown result - manual verification recommended'}

---
*Generated by auto-remedy.ts*
`

  await mkdir('ci_audit/shepherd', { recursive: true })
  await writeFile('ci_audit/shepherd/AUTOREMEDY_REPORT.md', report)
}

// ES module check for direct execution
if (process.argv[1] && process.argv[1].includes('auto-remedy')) {
  main().catch(console.error)
}

export { main as autoRemedy }