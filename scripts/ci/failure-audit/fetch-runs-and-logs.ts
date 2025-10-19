#!/usr/bin/env tsx

import { Octokit } from '@octokit/rest'
import { writeFileSync, existsSync, readFileSync } from 'fs'

interface WorkflowRun {
  id: number
  name: string
  head_branch: string
  head_sha: string
  status: string
  conclusion: string | null
  workflow_id: number
  check_suite_id: number
  check_suite_node_id: string
  url: string
  html_url: string
  created_at: string
  updated_at: string
  actor: {
    login: string
    id: number
  }
  triggering_actor: {
    login: string
    id: number
  }
  run_number: number
  event: string
  display_title: string
  path: string
}

interface JobStep {
  name: string
  status: string
  conclusion: string | null
  number: number
  started_at: string | null
  completed_at: string | null
}

interface WorkflowJob {
  id: number
  run_id: number
  run_url: string
  node_id: string
  head_sha: string
  url: string
  html_url: string
  status: string
  conclusion: string | null
  started_at: string
  completed_at: string | null
  name: string
  steps: JobStep[]
  check_run_url: string
  labels: string[]
  runner_id: number | null
  runner_name: string | null
  runner_group_id: number | null
  runner_group_name: string | null
}

interface FetchedData {
  workflow_filename: string
  workflow_name: string
  runs: WorkflowRun[]
  jobs: Record<number, WorkflowJob[]>
  logs: Record<number, Record<number, string>>
  fetch_timestamp: string
  fetch_summary: {
    runs_fetched: number
    jobs_fetched: number
    logs_fetched: number
    failed_runs: number
    recent_failure_rate: number
  }
}

async function fetchRunsAndLogs(): Promise<void> {
  console.log('🔍 Fetching GitHub Actions runs and logs...')
  
  // Parse command line arguments
  const args = process.argv.slice(2)
  const workflowsArg = args.find(arg => arg.startsWith('--workflows'))
  
  if (!workflowsArg) {
    console.error('❌ Usage: pnpm tsx fetch-runs-and-logs.ts --workflows "Deploy Gate,Post-Deploy Check,Secret Validation,Auto-PR CI Shepherd,Deployment Gate"')
    process.exit(1)
  }
  
  const targetWorkflows = workflowsArg
    .split('=')[1]
    .replace(/^["']|["']$/g, '') // Remove quotes
    .split(',')
    .map(w => w.trim())
  
  console.log('📋 Target workflows:', targetWorkflows)
  
  // Initialize GitHub client
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable required')
    process.exit(1)
  }
  
  const octokit = new Octokit({ auth: token })
  const [owner, repo] = getRepoInfo()
  
  console.log(`🏢 Repository: ${owner}/${repo}`)
  
  // Load workflow data from previous scan
  const workflowsPath = 'ci_audit/failure_forensics/workflows.json'
  if (!existsSync(workflowsPath)) {
    console.error('❌ workflows.json not found. Run scan-workflows.ts first.')
    process.exit(1)
  }
  
  const workflowsData = JSON.parse(readFileSync(workflowsPath, 'utf8'))
  const targetWorkflowData = workflowsData.filter((w: any) => 
    targetWorkflows.some(target => 
      w.name.includes(target) || w.filename.includes(target.toLowerCase().replace(/\s+/g, '-'))
    )
  )
  
  console.log(`🎯 Found ${targetWorkflowData.length} matching workflows`)
  
  const fetchedData: Record<string, FetchedData> = {}
  
  // Fetch data for each target workflow
  for (const workflow of targetWorkflowData) {
    console.log(`\n📥 Fetching data for: ${workflow.name}`)
    
    try {
      const data = await fetchWorkflowData(octokit, owner, repo, workflow)
      fetchedData[workflow.filename] = data
      
      console.log(`✅ ${workflow.name}: ${data.fetch_summary.runs_fetched} runs, ${data.fetch_summary.jobs_fetched} jobs, ${data.fetch_summary.logs_fetched} logs`)
      
      // Brief rate limiting pause
      await new Promise(resolve => setTimeout(resolve, 500))
      
    } catch (error) {
      console.error(`❌ Failed to fetch ${workflow.name}:`, error)
      
      // Create error placeholder
      fetchedData[workflow.filename] = {
        workflow_filename: workflow.filename,
        workflow_name: workflow.name,
        runs: [],
        jobs: {},
        logs: {},
        fetch_timestamp: new Date().toISOString(),
        fetch_summary: {
          runs_fetched: 0,
          jobs_fetched: 0,
          logs_fetched: 0,
          failed_runs: 0,
          recent_failure_rate: 0
        }
      }
    }
  }
  
  // Save results
  writeFileSync(
    'ci_audit/failure_forensics/runs_and_logs.json',
    JSON.stringify(fetchedData, null, 2)
  )
  
  // Generate summary
  const summary = generateSummary(fetchedData)
  writeFileSync(
    'ci_audit/failure_forensics/fetch_summary.md',
    summary
  )
  
  console.log('\n✅ Fetch completed')
  console.log('📄 Output: ci_audit/failure_forensics/runs_and_logs.json')
  console.log('📄 Summary: ci_audit/failure_forensics/fetch_summary.md')
}

async function fetchWorkflowData(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflow: any
): Promise<FetchedData> {
  
  // Fetch recent workflow runs (last 50)
  const runsResponse = await octokit.rest.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: workflow.filename,
    per_page: 50,
    page: 1
  })
  
  const runs = runsResponse.data.workflow_runs as WorkflowRun[]
  const jobs: Record<number, WorkflowJob[]> = {}
  const logs: Record<number, Record<number, string>> = {}
  
  let jobsFetched = 0
  let logsFetched = 0
  
  // Fetch jobs and logs for failed runs (up to 10 most recent failures)
  const failedRuns = runs
    .filter(run => run.conclusion === 'failure')
    .slice(0, 10)
  
  for (const run of failedRuns) {
    try {
      // Fetch jobs for this run
      const jobsResponse = await octokit.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: run.id
      })
      
      jobs[run.id] = jobsResponse.data.jobs as WorkflowJob[]
      jobsFetched += jobsResponse.data.jobs.length
      
      // Fetch logs for failed jobs
      logs[run.id] = {}
      
      for (const job of jobsResponse.data.jobs) {
        if (job.conclusion === 'failure') {
          try {
            const logsResponse = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
              owner,
              repo,
              job_id: job.id
            })
            
            // Convert response to text (it comes as a redirect URL)
            if (typeof logsResponse.data === 'string') {
              logs[run.id][job.id] = logsResponse.data
            } else {
              logs[run.id][job.id] = 'Log data unavailable (binary or redirect)'
            }
            
            logsFetched++
            
          } catch (logError) {
            console.warn(`⚠️ Could not fetch logs for job ${job.id}:`, (logError as Error).message)
            logs[run.id][job.id] = `Log fetch failed: ${(logError as Error).message}`
          }
        }
      }
      
      // Brief pause between runs
      await new Promise(resolve => setTimeout(resolve, 200))
      
    } catch (jobError) {
      console.warn(`⚠️ Could not fetch jobs for run ${run.id}:`, (jobError as Error).message)
    }
  }
  
  // Calculate failure rate for recent runs (last 20)
  const recentRuns = runs.slice(0, 20)
  const recentFailures = recentRuns.filter(run => run.conclusion === 'failure').length
  const recentFailureRate = recentRuns.length > 0 ? recentFailures / recentRuns.length : 0
  
  return {
    workflow_filename: workflow.filename,
    workflow_name: workflow.name,
    runs,
    jobs,
    logs,
    fetch_timestamp: new Date().toISOString(),
    fetch_summary: {
      runs_fetched: runs.length,
      jobs_fetched: jobsFetched,
      logs_fetched: logsFetched,
      failed_runs: runs.filter(run => run.conclusion === 'failure').length,
      recent_failure_rate: Math.round(recentFailureRate * 100) / 100
    }
  }
}

function getRepoInfo(): [string, string] {
  // Try to get from environment first
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
    return [owner, repo]
  }
  
  // Fallback to parsing git remote (for local development)
  try {
    const { execSync } = await import('child_process')
    const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
    
    // Parse GitHub URL formats
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
    if (match) {
      return [match[1], match[2]]
    }
  } catch (error) {
    // Ignore git errors
  }
  
  // Default fallback - you may want to customize this
  console.warn('⚠️ Could not determine repository info, using default')
  return ['adamshaw', 'hotdog-diaries']
}

function generateSummary(fetchedData: Record<string, FetchedData>): string {
  const sections = [
    '# GitHub Actions Fetch Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Workflows analyzed: ${Object.keys(fetchedData).length}`,
    '',
    '## Fetch Results',
    ''
  ]
  
  // Overall statistics
  let totalRuns = 0
  let totalJobs = 0
  let totalLogs = 0
  let totalFailures = 0
  
  Object.values(fetchedData).forEach(data => {
    totalRuns += data.fetch_summary.runs_fetched
    totalJobs += data.fetch_summary.jobs_fetched
    totalLogs += data.fetch_summary.logs_fetched
    totalFailures += data.fetch_summary.failed_runs
  })
  
  sections.push('| Metric | Count |')
  sections.push('|--------|-------|')
  sections.push(`| Total Runs Fetched | ${totalRuns} |`)
  sections.push(`| Total Jobs Fetched | ${totalJobs} |`)
  sections.push(`| Total Logs Fetched | ${totalLogs} |`)
  sections.push(`| Total Failed Runs | ${totalFailures} |`)
  
  sections.push('')
  sections.push('## Per-Workflow Summary')
  sections.push('')
  
  sections.push('| Workflow | Runs | Jobs | Logs | Failed | Failure Rate |')
  sections.push('|----------|------|------|------|--------|--------------|')
  
  Object.values(fetchedData)
    .sort((a, b) => b.fetch_summary.recent_failure_rate - a.fetch_summary.recent_failure_rate)
    .forEach(data => {
      const rate = (data.fetch_summary.recent_failure_rate * 100).toFixed(0)
      sections.push(`| ${data.workflow_name} | ${data.fetch_summary.runs_fetched} | ${data.fetch_summary.jobs_fetched} | ${data.fetch_summary.logs_fetched} | ${data.fetch_summary.failed_runs} | ${rate}% |`)
    })
  
  sections.push('')
  sections.push('## Failure Analysis')
  sections.push('')
  
  const highFailureWorkflows = Object.values(fetchedData)
    .filter(data => data.fetch_summary.recent_failure_rate > 0.3)
  
  if (highFailureWorkflows.length > 0) {
    sections.push('### High-Failure Workflows (>30%)')
    sections.push('')
    
    highFailureWorkflows.forEach(data => {
      const rate = (data.fetch_summary.recent_failure_rate * 100).toFixed(0)
      sections.push(`- **${data.workflow_name}**: ${rate}% failure rate (${data.fetch_summary.failed_runs} failed out of ${data.fetch_summary.runs_fetched} total)`)
    })
  } else {
    sections.push('✅ No workflows have high failure rates (>30%)')
  }
  
  sections.push('')
  sections.push('## Data Quality')
  sections.push('')
  
  const workflowsWithLogs = Object.values(fetchedData)
    .filter(data => data.fetch_summary.logs_fetched > 0).length
  
  const workflowsWithoutData = Object.values(fetchedData)
    .filter(data => data.fetch_summary.runs_fetched === 0).length
  
  sections.push(`- Workflows with log data: ${workflowsWithLogs}/${Object.keys(fetchedData).length}`)
  sections.push(`- Workflows without data: ${workflowsWithoutData}/${Object.keys(fetchedData).length}`)
  
  if (workflowsWithoutData > 0) {
    sections.push('')
    sections.push('⚠️ Some workflows have no run data. This could indicate:')
    sections.push('- Workflow file names not matching GitHub workflow names')
    sections.push('- Workflows that have never been executed')
    sections.push('- GitHub API rate limiting or permissions issues')
  }
  
  return sections.join('\n')
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  fetchRunsAndLogs().catch(error => {
    console.error('❌ Fetch failed:', error)
    process.exit(1)
  })
}

export { fetchRunsAndLogs, FetchedData, WorkflowRun, WorkflowJob }