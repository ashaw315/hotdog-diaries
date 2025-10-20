#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

interface WorkflowRun {
  id: number
  html_url: string
  event: string
  run_number: number
  status: string
  conclusion: string | null
  head_sha: string
  head_branch: string
  created_at: string
  updated_at: string
  jobs: JobSummary[]
}

interface JobSummary {
  id: number
  name: string
  status: string
  conclusion: string | null
  started_at: string | null
  completed_at: string | null
}

interface SnapshotData {
  workflowPath: string
  workflowId: number
  runs: WorkflowRun[]
  summary: {
    success: number
    neutral: number
    failure: number
    skipped: number
    cancelled: number
    total: number
  }
}

function parseArgs(): { paths: string[], windowHours: number, limitPerWorkflow: number } {
  const args = process.argv.slice(2)
  
  const pathsIdx = args.indexOf('--paths')
  const windowIdx = args.indexOf('--windowHours')
  const limitIdx = args.indexOf('--limitPerWorkflow')
  
  const paths = pathsIdx !== -1 ? args[pathsIdx + 1].split(',').map(p => p.trim()) : [
    '.github/workflows/auto-pr-ci-shepherd.yml',
    '.github/workflows/deploy-gate.yml',
    '.github/workflows/post-deploy-check.yml',
    '.github/workflows/secret-validation.yml',
    '.github/workflows/deployment-gate.yml'
  ]
  
  const windowHours = windowIdx !== -1 ? parseInt(args[windowIdx + 1]) || 24 : 24
  const limitPerWorkflow = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) || 20 : 20
  
  return { paths, windowHours, limitPerWorkflow }
}

async function execWithRetry(command: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      return execSync(command, { 
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN }
      })
    } catch (error) {
      if (i === retries - 1) throw error
      console.log(`  ⚠️ Retry ${i + 1}/${retries} for command: ${command.substring(0, 50)}...`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  return ''
}

async function resolveWorkflowId(workflowPath: string): Promise<number | null> {
  try {
    const repo = process.env.GITHUB_REPOSITORY || execSync('gh repo view --json nameWithOwner -q .nameWithOwner', { encoding: 'utf8' }).trim()
    
    const workflowsJson = await execWithRetry(`gh api repos/${repo}/actions/workflows --paginate`)
    const workflowsData = JSON.parse(workflowsJson)
    
    const workflow = workflowsData.workflows?.find((w: any) => w.path === workflowPath)
    return workflow?.id || null
  } catch (error) {
    console.error(`❌ Failed to resolve workflow ID for ${workflowPath}:`, error)
    return null
  }
}

async function fetchWorkflowRuns(workflowId: number, limitPerWorkflow: number, windowHours: number): Promise<WorkflowRun[]> {
  try {
    const repo = process.env.GITHUB_REPOSITORY || execSync('gh repo view --json nameWithOwner -q .nameWithOwner', { encoding: 'utf8' }).trim()
    
    // Fetch runs with pagination
    const runsJson = await execWithRetry(`gh api repos/${repo}/actions/workflows/${workflowId}/runs --per-page ${Math.min(limitPerWorkflow, 100)}`)
    const runsData = JSON.parse(runsJson)
    const runs = runsData.workflow_runs || []
    
    // Filter by time window
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000)
    const recentRuns = runs.filter((run: any) => new Date(run.created_at) > cutoffTime)
    
    console.log(`  📊 Found ${recentRuns.length} runs in last ${windowHours}h (${runs.length} total)`)
    
    // Fetch jobs for each run
    const runsWithJobs: WorkflowRun[] = []
    
    for (const run of recentRuns.slice(0, limitPerWorkflow)) {
      try {
        const jobsJson = await execWithRetry(`gh api repos/${repo}/actions/runs/${run.id}/jobs`)
        const jobsData = JSON.parse(jobsJson)
        const jobs = jobsData.jobs || []
        
        const jobSummaries: JobSummary[] = jobs.map((job: any) => ({
          id: job.id,
          name: job.name,
          status: job.status,
          conclusion: job.conclusion,
          started_at: job.started_at,
          completed_at: job.completed_at
        }))
        
        runsWithJobs.push({
          id: run.id,
          html_url: run.html_url,
          event: run.event,
          run_number: run.run_number,
          status: run.status,
          conclusion: run.conclusion,
          head_sha: run.head_sha,
          head_branch: run.head_branch,
          created_at: run.created_at,
          updated_at: run.updated_at,
          jobs: jobSummaries
        })
        
      } catch (error) {
        console.warn(`  ⚠️ Could not fetch jobs for run ${run.id}`)
        // Still include the run without job details
        runsWithJobs.push({
          id: run.id,
          html_url: run.html_url,
          event: run.event,
          run_number: run.run_number,
          status: run.status,
          conclusion: run.conclusion,
          head_sha: run.head_sha,
          head_branch: run.head_branch,
          created_at: run.created_at,
          updated_at: run.updated_at,
          jobs: []
        })
      }
    }
    
    return runsWithJobs
  } catch (error) {
    console.error(`❌ Failed to fetch runs for workflow ${workflowId}:`, error)
    return []
  }
}

function generateSnapshotMatrix(snapshots: SnapshotData[]): string {
  const totalSummary = {
    success: 0,
    neutral: 0,
    failure: 0,
    skipped: 0,
    cancelled: 0,
    total: 0
  }
  
  // Calculate totals
  for (const snapshot of snapshots) {
    totalSummary.success += snapshot.summary.success
    totalSummary.neutral += snapshot.summary.neutral
    totalSummary.failure += snapshot.summary.failure
    totalSummary.skipped += snapshot.summary.skipped
    totalSummary.cancelled += snapshot.summary.cancelled
    totalSummary.total += snapshot.summary.total
  }
  
  let report = `# Live Workflow Snapshot (Last 24h)

*Generated: ${new Date().toISOString()}*

## 📊 Overall Summary

| Conclusion | Count | Percentage |
|------------|-------|------------|
| ✅ Success | ${totalSummary.success} | ${totalSummary.total > 0 ? ((totalSummary.success / totalSummary.total) * 100).toFixed(1) : '0.0'}% |
| ⚠️ Neutral | ${totalSummary.neutral} | ${totalSummary.total > 0 ? ((totalSummary.neutral / totalSummary.total) * 100).toFixed(1) : '0.0'}% |
| ❌ Failure | ${totalSummary.failure} | ${totalSummary.total > 0 ? ((totalSummary.failure / totalSummary.total) * 100).toFixed(1) : '0.0'}% |
| ⏩ Skipped | ${totalSummary.skipped} | ${totalSummary.total > 0 ? ((totalSummary.skipped / totalSummary.total) * 100).toFixed(1) : '0.0'}% |
| 🚫 Cancelled | ${totalSummary.cancelled} | ${totalSummary.total > 0 ? ((totalSummary.cancelled / totalSummary.total) * 100).toFixed(1) : '0.0'}% |
| **Total** | **${totalSummary.total}** | **100.0%** |

## 📋 Workflow Details

`
  
  // Generate tables for each workflow
  for (const snapshot of snapshots) {
    const workflowName = snapshot.workflowPath.split('/').pop()?.replace('.yml', '') || 'Unknown'
    
    report += `### ${workflowName}

**Path**: \`${snapshot.workflowPath}\`  
**Workflow ID**: ${snapshot.workflowId}  
**Recent Runs**: ${snapshot.runs.length}

| Run # | Event | When | Conclusion | First Non-Success Job | URL |
|-------|-------|------|------------|----------------------|-----|
`
    
    if (snapshot.runs.length === 0) {
      report += '| *No runs in window* | - | - | - | - | - |\n'
    } else {
      for (const run of snapshot.runs) {
        const conclusion = run.conclusion || run.status
        const conclusionIcon = {
          success: '✅',
          neutral: '⚠️',
          failure: '❌',
          skipped: '⏩',
          cancelled: '🚫'
        }[conclusion] || '❓'
        
        // Find first non-success job
        const nonSuccessJob = run.jobs.find(job => 
          job.conclusion !== 'success' && job.conclusion !== null
        )
        const jobName = nonSuccessJob ? nonSuccessJob.name : (conclusion === 'success' ? '-' : 'N/A')
        
        const when = new Date(run.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        
        report += `| ${run.run_number} | ${run.event} | ${when} | ${conclusionIcon} ${conclusion} | ${jobName} | [View](${run.html_url}) |\n`
      }
    }
    
    report += '\n'
  }
  
  return report
}

async function main() {
  console.log('📸 Starting Live Workflow Snapshot...')
  
  const { paths, windowHours, limitPerWorkflow } = parseArgs()
  
  console.log(`📊 Config:`)
  console.log(`  - Workflow paths: ${paths.length}`)
  console.log(`  - Time window: ${windowHours} hours`)
  console.log(`  - Limit per workflow: ${limitPerWorkflow}`)
  
  // Create output directory
  const outputDir = 'ci_audit/failure_drilldown'
  mkdirSync(outputDir, { recursive: true })
  
  const snapshots: SnapshotData[] = []
  
  for (const workflowPath of paths) {
    console.log(`\n🔍 Processing: ${workflowPath}`)
    
    // Resolve workflow ID
    const workflowId = await resolveWorkflowId(workflowPath)
    if (!workflowId) {
      console.warn(`  ⚠️ Could not resolve workflow ID for ${workflowPath}`)
      continue
    }
    
    console.log(`  📋 Workflow ID: ${workflowId}`)
    
    // Fetch runs
    const runs = await fetchWorkflowRuns(workflowId, limitPerWorkflow, windowHours)
    
    // Calculate summary
    const summary = {
      success: runs.filter(r => r.conclusion === 'success').length,
      neutral: runs.filter(r => r.conclusion === 'neutral').length,
      failure: runs.filter(r => r.conclusion === 'failure').length,
      skipped: runs.filter(r => r.conclusion === 'skipped').length,
      cancelled: runs.filter(r => r.conclusion === 'cancelled').length,
      total: runs.length
    }
    
    console.log(`  📊 Summary: ${summary.success}✅ ${summary.neutral}⚠️ ${summary.failure}❌ ${summary.skipped}⏩ ${summary.cancelled}🚫`)
    
    snapshots.push({
      workflowPath,
      workflowId,
      runs,
      summary
    })
  }
  
  // Save snapshot data
  writeFileSync(
    join(outputDir, 'snapshot.json'),
    JSON.stringify(snapshots, null, 2)
  )
  
  // Generate matrix report
  const matrixReport = generateSnapshotMatrix(snapshots)
  writeFileSync(
    join(outputDir, 'SNAPSHOT_MATRIX.md'),
    matrixReport
  )
  
  console.log('\n✅ Live snapshot complete!')
  console.log(`📁 Output: ${outputDir}/snapshot.json`)
  console.log(`📋 Matrix: ${outputDir}/SNAPSHOT_MATRIX.md`)
  
  // Print summary
  const totalRuns = snapshots.reduce((sum, s) => sum + s.summary.total, 0)
  const nonSuccessRuns = snapshots.reduce((sum, s) => 
    sum + s.summary.neutral + s.summary.failure + s.summary.skipped + s.summary.cancelled, 0)
  
  console.log(`\n📊 Final Summary: ${totalRuns} total runs, ${nonSuccessRuns} non-success`)
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as liveSnapshot }