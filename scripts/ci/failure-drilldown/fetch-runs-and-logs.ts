#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

interface WorkflowRun {
  workflowName: string
  workflowId: number
  runId: number
  htmlUrl: string
  status: string
  conclusion: string | null
  event: string
  started: string
  updated: string
  jobs: JobInfo[]
}

interface JobInfo {
  name: string
  status: string
  conclusion: string | null
  steps: Array<{
    name: string
    number: number
    started_at: string | null
    completed_at: string | null
  }>
}

const TARGET_WORKFLOWS = [
  "Auto PR CI Shepherd",
  "Deploy Gate", 
  "Post-Deploy Check",
  "Secret Validation",
  "🚪 Deployment Gate"
]

const TARGET_JOBS = {
  "Auto PR CI Shepherd": ["shepherd"],
  "Deploy Gate": ["Validate AUTH_TOKEN Deploy Gate", "Deployment Gate Result", "Comprehensive Health Validation"],
  "Post-Deploy Check": ["guard", "Health & Metrics Validation", "Two-Day Refill Validation"],
  "Secret Validation": ["Validate Secret Strength & Environment Variables", "Environment Variable Completeness Check", "Token Strength Verification"],
  "🚪 Deployment Gate": ["🔐 Security & Health Gate"]
}

async function main() {
  console.log('🔍 Starting CI Failure Drilldown...')
  
  // Parse arguments
  const args = process.argv.slice(2)
  const lookbackIdx = args.indexOf('--lookback')
  const onlyFailedIdx = args.indexOf('--onlyFailed')
  
  const lookback = lookbackIdx !== -1 ? Math.min(10, parseInt(args[lookbackIdx + 1]) || 10) : 10
  const onlyFailed = onlyFailedIdx !== -1 ? args[onlyFailedIdx + 1] === 'true' : true
  
  console.log(`📊 Config: lookback=${lookback}, onlyFailed=${onlyFailed}`)
  
  // Get repo info from environment
  const repoEnv = process.env.GITHUB_REPOSITORY
  if (!repoEnv) {
    console.error('❌ GITHUB_REPOSITORY not set. Run from GitHub Actions.')
    process.exit(1)
  }
  
  const [owner, repo] = repoEnv.split('/')
  console.log(`📦 Repository: ${owner}/${repo}`)
  
  // Create output directory
  const outputDir = 'ci_audit/failure_drilldown'
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(join(outputDir, 'logs'), { recursive: true })
  
  const allRuns: WorkflowRun[] = []
  
  // Fetch workflows
  console.log('📥 Fetching workflows...')
  const workflowsJson = execSync(
    `gh api repos/${owner}/${repo}/actions/workflows --paginate`,
    { encoding: 'utf8', env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN } }
  )
  
  const workflowsData = JSON.parse(workflowsJson)
  const workflows = workflowsData.workflows || []
  
  for (const targetName of TARGET_WORKFLOWS) {
    console.log(`\n🔍 Processing: ${targetName}`)
    
    // Find matching workflows by name
    const matchingWorkflows = workflows.filter((w: any) => w.name === targetName)
    
    if (matchingWorkflows.length === 0) {
      console.warn(`⚠️ No workflow found with name: ${targetName}`)
      continue
    }
    
    for (const workflow of matchingWorkflows) {
      console.log(`  📋 Found workflow ID: ${workflow.id}`)
      
      // Fetch recent runs
      try {
        const runsJson = execSync(
          `gh api repos/${owner}/${repo}/actions/workflows/${workflow.id}/runs --per-page ${lookback}`,
          { encoding: 'utf8', env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN } }
        )
        
        const runsData = JSON.parse(runsJson)
        const runs = runsData.workflow_runs || []
        
        console.log(`  📊 Found ${runs.length} recent runs`)
        
        for (const run of runs) {
          // Check if we should process this run
          const shouldProcess = !onlyFailed || 
            run.conclusion === 'failure' || 
            run.conclusion === 'neutral' || 
            run.conclusion === 'skipped' ||
            run.status !== 'completed'
          
          if (!shouldProcess) {
            console.log(`  ⏩ Skipping successful run ${run.id}`)
            continue
          }
          
          console.log(`  🔍 Processing run ${run.id} (${run.conclusion || run.status})`)
          
          // Fetch jobs for this run
          const jobsJson = execSync(
            `gh api repos/${owner}/${repo}/actions/runs/${run.id}/jobs --paginate`,
            { encoding: 'utf8', env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN } }
          )
          
          const jobsData = JSON.parse(jobsJson)
          const jobs = jobsData.jobs || []
          
          // Filter to target jobs or all failed jobs
          const targetJobNames = TARGET_JOBS[targetName] || []
          const relevantJobs = jobs.filter((job: any) => {
            if (targetJobNames.length > 0 && targetJobNames.includes(job.name)) {
              return true
            }
            // If no specific target jobs, keep all failed ones
            return job.conclusion === 'failure' || job.conclusion === 'skipped' || job.conclusion === 'neutral'
          })
          
          // Download logs if we have relevant jobs
          if (relevantJobs.length > 0) {
            const logDir = join(outputDir, 'logs', targetName.replace(/[^a-zA-Z0-9]/g, '_'), String(run.id))
            mkdirSync(logDir, { recursive: true })
            
            try {
              console.log(`  📥 Downloading logs for run ${run.id}...`)
              const logsZipPath = `/tmp/run_${run.id}.zip`
              
              // Download logs archive
              execSync(
                `gh api repos/${owner}/${repo}/actions/runs/${run.id}/logs > ${logsZipPath}`,
                { env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN } }
              )
              
              // Extract logs
              const extractDir = `/tmp/run_${run.id}_extracted`
              mkdirSync(extractDir, { recursive: true })
              execSync(`unzip -q ${logsZipPath} -d ${extractDir}`)
              
              // Copy relevant job logs
              for (const job of relevantJobs) {
                const jobDir = join(logDir, job.name.replace(/[^a-zA-Z0-9]/g, '_'))
                mkdirSync(jobDir, { recursive: true })
                
                // Find job log files in extracted directory
                const jobLogPattern = job.name.replace(/[^a-zA-Z0-9]/g, '*')
                try {
                  // Copy all log files for this job
                  const files = readdirSync(extractDir)
                  for (const file of files) {
                    if (file.includes(job.name.substring(0, 20))) {
                      const srcPath = join(extractDir, file)
                      const destPath = join(jobDir, file)
                      const content = readFileSync(srcPath, 'utf8')
                      writeFileSync(destPath, content)
                    }
                  }
                } catch (err) {
                  console.warn(`  ⚠️ Could not copy logs for job ${job.name}`)
                }
              }
              
              // Cleanup temp files
              execSync(`rm -rf ${logsZipPath} ${extractDir}`)
              
            } catch (err) {
              console.error(`  ❌ Failed to download/extract logs: ${err}`)
            }
          }
          
          // Create run record
          const runRecord: WorkflowRun = {
            workflowName: targetName,
            workflowId: workflow.id,
            runId: run.id,
            htmlUrl: run.html_url,
            status: run.status,
            conclusion: run.conclusion,
            event: run.event,
            started: run.run_started_at,
            updated: run.updated_at,
            jobs: relevantJobs.map((job: any) => ({
              name: job.name,
              status: job.status,
              conclusion: job.conclusion,
              steps: (job.steps || []).map((step: any) => ({
                name: step.name,
                number: step.number,
                started_at: step.started_at,
                completed_at: step.completed_at
              }))
            }))
          }
          
          allRuns.push(runRecord)
        }
      } catch (err) {
        console.error(`  ❌ Failed to fetch runs for workflow ${workflow.id}: ${err}`)
      }
    }
  }
  
  // Save runs data
  writeFileSync(
    join(outputDir, 'runs.json'),
    JSON.stringify(allRuns, null, 2)
  )
  
  console.log('\n✅ Fetch complete!')
  console.log(`📊 Analyzed ${allRuns.length} runs across ${TARGET_WORKFLOWS.length} workflows`)
  console.log(`📁 Output: ${outputDir}/`)
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as fetchRunsAndLogs }