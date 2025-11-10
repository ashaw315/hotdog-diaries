#!/usr/bin/env tsx

/**
 * Check GitHub Actions posting workflow runs for today
 */

import { parseArgs } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { getTodayET, getTimeSlots, formatET } from './lib/time'

interface Args {
  date?: string
}

interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  created_at: string
  html_url: string
}

interface SlotStatus {
  slot: string
  timeET: string
  status: 'EXECUTED_SUCCESS' | 'EXECUTED_SKIPPED_BY_GUARD' | 'NOT_EXECUTED_YET' | 'MISSING_EXECUTION' | 'FAILED'
  lastRun?: WorkflowRun
  message: string
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: 'string' }
    }
  })

  const args: Args = {
    date: values.date || getTodayET()
  }

  console.log(`🔍 Checking GitHub Actions for ${args.date}`)
  console.log(`ℹ️  Note: Using auto-post-scheduled.yml (runs every 15min) instead of legacy slot workflows`)

  const slots = getTimeSlots(args.date!)
  const results: SlotStatus[] = []

  // Check auto-post-scheduled workflow runs instead of individual slot workflows
  const workflowFile = 'auto-post-scheduled.yml'

  for (const slot of slots) {
    console.log(`  Checking ${slot.slot} (${slot.timeET} ET)...`)

    const status = await checkSlotWithAutoScheduler(workflowFile, slot)
    results.push(status)

    console.log(`    → ${status.status}`)
  }

  // Save results
  await mkdir('ci_audit/watchdog', { recursive: true })
  await writeFile(
    'ci_audit/watchdog/actions-today.json',
    JSON.stringify({
      date: args.date,
      checkedAt: new Date().toISOString(),
      slots: results
    }, null, 2)
  )

  // Determine overall health
  const failures = results.filter(r => 
    r.status === 'MISSING_EXECUTION' || r.status === 'FAILED'
  )

  if (failures.length > 0) {
    console.error(`❌ ${failures.length} slots have issues`)
    process.exit(1)
  } else {
    console.log('✅ All executed slots healthy')
  }
}

async function checkSlotWithAutoScheduler(workflowFile: string, slot: any): Promise<SlotStatus> {
  try {
    // For auto-post-scheduled.yml, we check if there was a successful run
    // within a reasonable window around the slot time (±30 min)
    const runsJson = execSync(
      `gh api /repos/$GITHUB_REPOSITORY/actions/workflows/${workflowFile}/runs --jq '.workflow_runs[:20]' 2>/dev/null || echo '[]'`,
      { encoding: 'utf-8', env: { ...process.env, GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || 'ashaw315/hotdog-diaries' } }
    )

    const runs: WorkflowRun[] = JSON.parse(runsJson)

    // If slot is in the future, it's expected not to have run yet
    if (!slot.isPast) {
      return {
        slot: slot.slot,
        timeET: slot.timeET,
        status: 'NOT_EXECUTED_YET',
        message: 'Scheduled for future'
      }
    }

    // Find runs around the slot time (slot time ± 60 minutes)
    const slotTime = slot.timeUTC.getTime()
    const windowStart = slotTime - (60 * 60 * 1000) // 1 hour before
    const windowEnd = slotTime + (60 * 60 * 1000)   // 1 hour after

    const runsNearSlot = runs.filter(run => {
      const runTime = new Date(run.created_at).getTime()
      return runTime >= windowStart && runTime <= windowEnd
    })

    if (runsNearSlot.length === 0) {
      return {
        slot: slot.slot,
        timeET: slot.timeET,
        status: 'MISSING_EXECUTION',
        message: `No auto-post-scheduled run found within ±1h of ${slot.timeET}`
      }
    }

    // Check if any run was successful
    const successfulRun = runsNearSlot.find(run => run.conclusion === 'success')

    if (successfulRun) {
      return {
        slot: slot.slot,
        timeET: slot.timeET,
        status: 'EXECUTED_SUCCESS',
        lastRun: successfulRun,
        message: 'Auto-scheduler ran successfully near slot time'
      }
    }

    // If no successful run, report the most recent attempt
    const lastRun = runsNearSlot[0]
    return {
      slot: slot.slot,
      timeET: slot.timeET,
      status: 'FAILED',
      lastRun,
      message: `Auto-scheduler run failed: ${lastRun.conclusion}`
    }

  } catch (error) {
    return {
      slot: slot.slot,
      timeET: slot.timeET,
      status: 'FAILED',
      message: `Error checking workflow: ${error}`
    }
  }
}

async function checkSlot(workflowFile: string, slot: any): Promise<SlotStatus> {
  try {
    // Get recent runs for this workflow
    const runsJson = execSync(
      `gh api /repos/$GITHUB_REPOSITORY/actions/workflows/${workflowFile}/runs --jq '.workflow_runs[:5]' 2>/dev/null || echo '[]'`,
      { encoding: 'utf-8', env: { ...process.env, GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || 'ashaw315/hotdog-diaries' } }
    )
    
    const runs: WorkflowRun[] = JSON.parse(runsJson)
    
    // Find runs from today
    const todayRuns = runs.filter(run => {
      const runDate = new Date(run.created_at)
      const runDateET = formatET(runDate).split(' ')[0]
      return runDateET === slot.slot.split('T')[0]
    })

    // Determine status
    if (!slot.isPast) {
      return {
        slot: slot.slot,
        timeET: slot.timeET,
        status: 'NOT_EXECUTED_YET',
        message: 'Scheduled for future'
      }
    }

    if (todayRuns.length === 0) {
      return {
        slot: slot.slot,
        timeET: slot.timeET,
        status: 'MISSING_EXECUTION',
        message: 'No run found for past slot'
      }
    }

    const lastRun = todayRuns[0]

    // Check if guard blocked it (expected when schedule empty)
    if (lastRun.conclusion === 'skipped' || lastRun.conclusion === 'cancelled') {
      return {
        slot: slot.slot,
        timeET: slot.timeET,
        status: 'EXECUTED_SKIPPED_BY_GUARD',
        lastRun,
        message: 'Guard prevented posting (likely no content)'
      }
    }

    if (lastRun.conclusion === 'success') {
      return {
        slot: slot.slot,
        timeET: slot.timeET,
        status: 'EXECUTED_SUCCESS',
        lastRun,
        message: 'Posted successfully'
      }
    }

    return {
      slot: slot.slot,
      timeET: slot.timeET,
      status: 'FAILED',
      lastRun,
      message: `Run failed: ${lastRun.conclusion}`
    }

  } catch (error) {
    return {
      slot: slot.slot,
      timeET: slot.timeET,
      status: 'FAILED',
      message: `Error checking workflow: ${error}`
    }
  }
}

// ES module check for direct execution
if (process.argv[1] && process.argv[1].includes('check-actions-today')) {
  main().catch(console.error)
}

export { main as checkActionsToday }