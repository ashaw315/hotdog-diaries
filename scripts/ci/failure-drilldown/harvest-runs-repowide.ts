#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

interface Workflow {
  id: number
  name: string
  path: string
  state: string
  created_at: string
  updated_at: string
}

interface WorkflowRun {
  id: number
  workflow_id: number
  workflow_name: string
  workflow_path?: string
  name: string
  event: string
  status: string
  conclusion: string | null
  head_branch: string | null
  head_sha: string
  html_url: string
  run_number: number
  created_at: string
  updated_at: string
  jobs: JobInfo[]
  primaryNonSuccessJob: string | null
  logsAvailable: boolean
}

interface JobInfo {
  id: number
  name: string
  status: string
  conclusion: string | null
  started_at: string | null
  completed_at: string | null
}

function parseArgs() {
  const args = process.argv.slice(2)
  
  const sinceHoursIdx = args.indexOf('--sinceHours')
  const limitIdx = args.indexOf('--limit')
  const includeLogsIdx = args.indexOf('--includeLogs')
  const includeSuccessIdx = args.indexOf('--includeSuccess')
  const runIdsIdx = args.indexOf('--runIds')
  
  return {
    sinceHours: sinceHoursIdx !== -1 ? parseInt(args[sinceHoursIdx + 1]) || 168 : 168, // 7 days default
    limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1]) || 500 : 500,
    includeLogs: includeLogsIdx !== -1 ? args[includeLogsIdx + 1] === 'true' : true,
    includeSuccess: includeSuccessIdx !== -1 ? args[includeSuccessIdx + 1] === 'true' : true,
    runIds: runIdsIdx !== -1 ? args[runIdsIdx + 1].split(',').map(id => parseInt(id.trim())) : []
  }
}

function execGH(command: string): string {
  try {
    return execSync(command, {
      encoding: 'utf8',
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN }
    })
  } catch (error: any) {
    console.error(`❌ GitHub CLI command failed: ${command}`)
    console.error(`Error: ${error.message}`)
    throw error
  }
}

async function fetchAllWorkflows(repo: string): Promise<Workflow[]> {
  console.log('📋 Fetching all workflows...')
  
  const workflowsJson = execGH(`gh api repos/${repo}/actions/workflows --paginate`)
  const workflowsData = JSON.parse(workflowsJson)
  const workflows = workflowsData.workflows || []
  
  console.log(`✅ Found ${workflows.length} workflows`)
  
  return workflows.map((w: any) => ({
    id: w.id,
    name: w.name,
    path: w.path,
    state: w.state,
    created_at: w.created_at,
    updated_at: w.updated_at
  }))
}

async function fetchAllRecentRuns(repo: string, sinceHours: number, limit: number, explicitRunIds: number[]): Promise<any[]> {
  console.log(`📥 Fetching all runs from last ${sinceHours} hours (limit: ${limit})...`)
  
  const cutoffTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()
  console.log(`📅 Cutoff time: ${cutoffTime}`)
  
  // Fetch all runs with pagination
  let allRuns: any[] = []
  let page = 1
  const perPage = 100
  
  while (allRuns.length < limit) {
    const runsJson = execGH(`gh api repos/${repo}/actions/runs -F per_page=${perPage} -F page=${page}`)
    const runsData = JSON.parse(runsJson)
    const runs = runsData.workflow_runs || []
    
    if (runs.length === 0) break
    
    // Filter by time window
    const recentRuns = runs.filter((run: any) => {
      const runTime = new Date(run.created_at)
      const cutoff = new Date(cutoffTime)
      return runTime >= cutoff
    })
    
    allRuns.push(...recentRuns)
    console.log(`  📊 Page ${page}: ${runs.length} runs, ${recentRuns.length} in window (total: ${allRuns.length})`)
    
    // If we didn't get any runs in the time window from this page, we can stop
    if (recentRuns.length === 0) break
    
    page++
    if (allRuns.length >= limit) break
  }
  
  // Add explicit run IDs if provided
  if (explicitRunIds.length > 0) {
    console.log(`🎯 Adding ${explicitRunIds.length} explicit run IDs...`)
    
    for (const runId of explicitRunIds) {
      try {
        const runJson = execGH(`gh api repos/${repo}/actions/runs/${runId}`)
        const run = JSON.parse(runJson)
        
        // Check if we already have this run
        if (!allRuns.some(r => r.id === run.id)) {
          allRuns.push(run)
          console.log(`  ✅ Added explicit run ${runId} (${run.conclusion || run.status})`)
        }
      } catch (error) {
        console.warn(`  ⚠️ Could not fetch explicit run ${runId}`)
      }
    }
  }
  
  // Sort by creation time (newest first) and limit
  allRuns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  allRuns = allRuns.slice(0, limit)
  
  console.log(`✅ Collected ${allRuns.length} total runs`)
  return allRuns
}

async function enrichRunsWithWorkflowData(runs: any[], workflows: Workflow[]): Promise<WorkflowRun[]> {
  console.log('🔗 Enriching runs with workflow data...')
  
  const workflowMap = new Map<number, Workflow>()
  workflows.forEach(w => workflowMap.set(w.id, w))
  
  const enrichedRuns: WorkflowRun[] = []
  
  for (const run of runs) {
    const workflow = workflowMap.get(run.workflow_id)
    
    enrichedRuns.push({
      id: run.id,
      workflow_id: run.workflow_id,
      workflow_name: run.name || workflow?.name || 'Unknown',
      workflow_path: workflow?.path,
      name: run.name,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      html_url: run.html_url,
      run_number: run.run_number,
      created_at: run.created_at,
      updated_at: run.updated_at,
      jobs: [], // Will be filled later
      primaryNonSuccessJob: null, // Will be filled later
      logsAvailable: false // Will be filled later
    })
  }
  
  console.log(`✅ Enriched ${enrichedRuns.length} runs with workflow metadata`)
  return enrichedRuns
}

async function fetchJobsAndLogs(repo: string, runs: WorkflowRun[], includeLogs: boolean, includeSuccess: boolean, outputDir: string): Promise<void> {
  console.log('🔧 Fetching jobs and logs...')
  
  const logsDir = join(outputDir, 'logs')
  mkdirSync(logsDir, { recursive: true })
  
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]
    console.log(`  📊 Processing run ${run.id} (${i + 1}/${runs.length}) - ${run.conclusion || run.status}`)
    
    try {
      // Fetch jobs
      const jobsJson = execGH(`gh api repos/${repo}/actions/runs/${run.id}/jobs --paginate`)
      const jobsData = JSON.parse(jobsJson)
      const jobs = jobsData.jobs || []
      
      run.jobs = jobs.map((job: any) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        started_at: job.started_at,
        completed_at: job.completed_at
      }))
      
      // Find primary non-success job
      const nonSuccessJob = jobs.find((job: any) => 
        job.conclusion !== 'success' && job.conclusion !== null
      )
      run.primaryNonSuccessJob = nonSuccessJob?.name || (jobs.length > 0 ? jobs[0].name : null)
      
      // Determine if we should download logs
      const isNonSuccess = run.conclusion !== 'success'
      const shouldDownloadLogs = includeLogs && (isNonSuccess || includeSuccess)
      
      if (shouldDownloadLogs) {
        try {
          console.log(`    📥 Downloading logs for run ${run.id}...`)
          
          const runLogsDir = join(logsDir, String(run.workflow_id), String(run.id))
          mkdirSync(runLogsDir, { recursive: true })
          
          const logsZipPath = `/tmp/run_${run.id}.zip`
          
          // Download logs archive
          execGH(`gh api repos/${repo}/actions/runs/${run.id}/logs > ${logsZipPath}`)
          
          // Extract logs
          const extractDir = `/tmp/run_${run.id}_extracted`
          mkdirSync(extractDir, { recursive: true })
          execSync(`unzip -q ${logsZipPath} -d ${extractDir}`)
          
          // Copy all log files
          const files = readdirSync(extractDir)
          for (const file of files) {
            const srcPath = join(extractDir, file)
            const destPath = join(runLogsDir, file)
            const content = readFileSync(srcPath, 'utf8')
            writeFileSync(destPath, content)
          }
          
          // Cleanup temp files
          execSync(`rm -rf ${logsZipPath} ${extractDir}`)
          
          run.logsAvailable = true
          console.log(`    ✅ Logs saved for run ${run.id}`)
          
        } catch (logError) {
          console.warn(`    ⚠️ Could not download logs for run ${run.id}: logs may not be available`)
          run.logsAvailable = false
        }
      }
      
    } catch (error) {
      console.error(`    ❌ Failed to process run ${run.id}: ${error}`)
      run.jobs = []
      run.primaryNonSuccessJob = null
      run.logsAvailable = false
    }
  }
  
  const logsDownloaded = runs.filter(r => r.logsAvailable).length
  console.log(`✅ Processed ${runs.length} runs, downloaded logs for ${logsDownloaded}`)
}

async function main() {
  console.log('🚀 Starting Repo-wide CI Runs Harvest')
  console.log('===================================')
  
  const config = parseArgs()
  console.log(`📊 Configuration:`)
  console.log(`  - Time window: ${config.sinceHours} hours`)
  console.log(`  - Run limit: ${config.limit}`)
  console.log(`  - Include logs: ${config.includeLogs}`)
  console.log(`  - Include success logs: ${config.includeSuccess}`)
  console.log(`  - Explicit run IDs: ${config.runIds.length > 0 ? config.runIds.join(', ') : 'None'}`)
  
  // Get repository info
  const repoEnv = process.env.GITHUB_REPOSITORY
  if (!repoEnv) {
    console.error('❌ GITHUB_REPOSITORY not set. Please set it manually.')
    process.exit(1)
  }
  
  const repo = repoEnv
  console.log(`📦 Repository: ${repo}`)
  
  // Create output directory
  const outputDir = 'ci_audit/failure_drilldown/repowide'
  mkdirSync(outputDir, { recursive: true })
  
  try {
    // Step 1: Fetch all workflows
    const workflows = await fetchAllWorkflows(repo)
    
    // Step 2: Fetch all recent runs
    const rawRuns = await fetchAllRecentRuns(repo, config.sinceHours, config.limit, config.runIds)
    
    // Step 3: Enrich runs with workflow data
    const enrichedRuns = await enrichRunsWithWorkflowData(rawRuns, workflows)
    
    // Step 4: Fetch jobs and logs
    await fetchJobsAndLogs(repo, enrichedRuns, config.includeLogs, config.includeSuccess, outputDir)
    
    // Step 5: Save data
    console.log('💾 Saving harvest data...')
    
    // Save structured JSON
    writeFileSync(
      join(outputDir, 'runs.json'),
      JSON.stringify(enrichedRuns, null, 2)
    )
    
    // Save JSONL format (one JSON object per line)
    const jsonlContent = enrichedRuns.map(run => JSON.stringify(run)).join('\n')
    writeFileSync(
      join(outputDir, 'runs.jsonl'),
      jsonlContent
    )
    
    // Save workflows metadata
    writeFileSync(
      join(outputDir, 'workflows.json'),
      JSON.stringify(workflows, null, 2)
    )
    
    // Generate summary
    const summary = {
      generated: new Date().toISOString(),
      timeWindow: {
        sinceHours: config.sinceHours,
        cutoffTime: new Date(Date.now() - config.sinceHours * 60 * 60 * 1000).toISOString()
      },
      totals: {
        workflows: workflows.length,
        runs: enrichedRuns.length,
        explicitRuns: config.runIds.length,
        logsDownloaded: enrichedRuns.filter(r => r.logsAvailable).length
      },
      conclusions: {
        success: enrichedRuns.filter(r => r.conclusion === 'success').length,
        failure: enrichedRuns.filter(r => r.conclusion === 'failure').length,
        neutral: enrichedRuns.filter(r => r.conclusion === 'neutral').length,
        skipped: enrichedRuns.filter(r => r.conclusion === 'skipped').length,
        cancelled: enrichedRuns.filter(r => r.conclusion === 'cancelled').length,
        other: enrichedRuns.filter(r => !['success', 'failure', 'neutral', 'skipped', 'cancelled'].includes(r.conclusion || '')).length
      },
      events: Object.entries(
        enrichedRuns.reduce((acc: Record<string, number>, run) => {
          acc[run.event] = (acc[run.event] || 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])
    }
    
    writeFileSync(
      join(outputDir, 'harvest_summary.json'),
      JSON.stringify(summary, null, 2)
    )
    
    console.log('\n✅ Repo-wide harvest complete!')
    console.log(`📁 Output directory: ${outputDir}/`)
    console.log(`📊 Summary:`)
    console.log(`  - ${summary.totals.workflows} workflows`)
    console.log(`  - ${summary.totals.runs} runs (${summary.totals.explicitRuns} explicit)`)
    console.log(`  - ${summary.totals.logsDownloaded} logs downloaded`)
    console.log(`  - Conclusions: ${summary.conclusions.success}✅ ${summary.conclusions.failure}❌ ${summary.conclusions.neutral}⚠️ ${summary.conclusions.skipped}⏩ ${summary.conclusions.cancelled}🚫`)
    console.log(`  - Top events: ${summary.events.slice(0, 3).map(([event, count]) => `${event}(${count})`).join(', ')}`)
    
  } catch (error) {
    console.error('❌ Harvest failed:', error)
    process.exit(1)
  }
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as harvestRunsRepowide }