#!/usr/bin/env tsx

/**
 * Dispatch a workflow and wait for completion
 */

import { parseArgs } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

interface Args {
  workflow: string
  inputs?: string
  timeoutSec: number
}

interface WorkflowRun {
  databaseId: number
  headSha: string
  status: string
  conclusion: string | null
  htmlUrl: string
}

async function main() {
  const { values } = parseArgs({
    options: {
      workflow: { type: 'string' },
      inputs: { type: 'string' },
      timeoutSec: { type: 'string', default: '900' }
    }
  })

  const args: Args = {
    workflow: values.workflow!,
    inputs: values.inputs,
    timeoutSec: parseInt(values.timeoutSec!)
  }

  if (!args.workflow) {
    console.error('❌ --workflow required')
    process.exit(1)
  }

  console.log(`🚀 Dispatching workflow: ${args.workflow}`)
  
  // For PRs, use HEAD ref instead of merge commit SHA to avoid "No ref found" errors
  let ref: string
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    // Use the actual HEAD branch for PR dispatch
    ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF || 'main'
    console.log(`  PR context: using HEAD ref ${ref}`)
  } else {
    // For push events, use SHA or ref normally
    ref = process.env.GITHUB_SHA || process.env.GITHUB_REF || 'main'
  }
  console.log(`  Branch/SHA: ${ref}`)
  
  // Step 1: Dispatch workflow
  try {
    let dispatchCmd = `gh workflow run ${args.workflow} --ref ${ref}`
    
    // Parse inputs if provided
    if (args.inputs) {
      const inputPairs = args.inputs.split('&')
      for (const pair of inputPairs) {
        const [key, value] = pair.split('=')
        if (key && value !== undefined) {
          dispatchCmd += ` -f ${key}="${value}"`
        }
      }
    }
    
    console.log(`  Command: ${dispatchCmd}`)
    execSync(dispatchCmd, { encoding: 'utf-8' })
    console.log('  ✅ Workflow dispatched')
  } catch (error: any) {
    console.error(`❌ Failed to dispatch workflow: ${error.message}`)
    process.exit(1)
  }

  // Wait a moment for workflow to register
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Step 2: Poll for completion
  const workflowName = args.workflow.split('/').pop()!.replace('.yml', '')
  const startTime = Date.now()
  const timeoutMs = args.timeoutSec * 1000
  
  console.log(`  Waiting for completion (timeout: ${args.timeoutSec}s)...`)
  
  let run: WorkflowRun | undefined
  let lastStatus = ''
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const listCmd = `gh run list --workflow ${args.workflow} --json databaseId,headSha,status,conclusion,htmlUrl --limit 20`
      const runsJson = execSync(listCmd, { encoding: 'utf-8' })
      const runs: WorkflowRun[] = JSON.parse(runsJson)
      
      // Find our run (most recent with matching ref)
      run = runs.find(r => r.headSha === ref || r.headSha.startsWith(ref.substring(0, 7)))
      if (!run && runs.length > 0) {
        // If exact match not found, use most recent
        run = runs[0]
      }
      
      if (run) {
        if (run.status !== lastStatus) {
          console.log(`  Status: ${run.status}`)
          lastStatus = run.status
        }
        
        if (run.status === 'completed') {
          break
        }
      }
    } catch (error) {
      // Ignore polling errors
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, 10000))
  }

  // Step 3: Determine outcome
  let exitCode = 1
  let outcome = 'UNKNOWN'
  let message = 'Workflow status unknown'
  
  if (!run) {
    outcome = 'NOT_FOUND'
    message = 'Could not find workflow run'
    exitCode = 1
  } else if (run.status !== 'completed') {
    outcome = 'TIMEOUT'
    message = `Workflow timed out after ${args.timeoutSec}s`
    exitCode = 1
  } else {
    outcome = run.conclusion!.toUpperCase()
    message = `Workflow completed: ${run.conclusion}`
    
    if (run.conclusion === 'success') {
      exitCode = 0
    } else if (run.conclusion === 'neutral') {
      exitCode = 2
    } else {
      exitCode = 1
    }
  }

  // Step 4: Write report
  const report = `# Workflow Invocation Report

**Workflow:** ${args.workflow}
**Ref:** ${ref}
**Outcome:** ${outcome}
**Message:** ${message}
${run ? `**Run URL:** ${run.htmlUrl}` : ''}

## Timing
- Started: ${new Date(startTime).toISOString()}
- Duration: ${Math.round((Date.now() - startTime) / 1000)}s

## Inputs
${args.inputs || 'None'}
`

  await mkdir('ci_audit/shepherd', { recursive: true })
  await writeFile('ci_audit/shepherd/WATCHDOG_INVOKE.md', report)
  
  console.log(`  Outcome: ${outcome}`)
  if (run) {
    console.log(`  Run URL: ${run.htmlUrl}`)
  }
  
  process.exit(exitCode)
}

// ES module check for direct execution
if (process.argv[1] && process.argv[1].includes('run-and-wait-workflow')) {
  main().catch(console.error)
}

export { main as runAndWaitWorkflow }