#!/usr/bin/env tsx

/**
 * CI Audit: Runs Fetcher
 * 
 * Fetches last 10 runs for each workflow via GitHub API and extracts
 * key metadata including status, duration, and failure messages.
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

interface WorkflowRun {
  id: number
  name: string
  run_number: number
  event: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null
  workflow_id: number
  head_branch: string
  head_sha: string
  created_at: string
  updated_at: string
  run_started_at: string
  html_url: string
  duration_seconds?: number
  failure_reason?: string
  jobs_url: string
}

interface WorkflowRunSummary {
  workflow_name: string
  workflow_filename: string
  runs: WorkflowRun[]
  summary: {
    total: number
    success: number
    failure: number
    cancelled: number
    in_progress: number
    last_success?: string
    last_failure?: string
    avg_duration_seconds?: number
  }
}

class RunsFetcher {
  private outputDir: string
  private rateLimitDelay: number = 100 // ms between API calls

  constructor() {
    this.outputDir = 'ci_audit/actions'
  }

  async fetchAllRuns(): Promise<WorkflowRunSummary[]> {
    console.log('📡 Fetching workflow runs...')
    
    // First, get list of workflows
    const workflows = await this.getWorkflows()
    console.log(`📋 Found ${workflows.length} workflows`)
    
    const summaries: WorkflowRunSummary[] = []
    
    for (const workflow of workflows) {
      try {
        console.log(`  🔍 Fetching runs for: ${workflow.name}`)
        const runs = await this.fetchWorkflowRuns(workflow.id, workflow.name)
        const summary = this.buildSummary(workflow.name, workflow.path, runs)
        summaries.push(summary)
        
        // Rate limiting
        await this.sleep(this.rateLimitDelay)
      } catch (error) {
        console.error(`  ❌ Failed to fetch runs for ${workflow.name}:`, error)
      }
    }
    
    await this.saveResults(summaries)
    return summaries
  }

  private async getWorkflows(): Promise<Array<{id: number, name: string, path: string}>> {
    try {
      const result = execSync('gh api repos/:owner/:repo/actions/workflows --jq \'.workflows[] | {id, name, path}\'', 
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
      
      return result.trim().split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
    } catch (error) {
      console.error('❌ Failed to fetch workflows via gh CLI, trying direct API...')
      
      // Fallback: read workflow files and guess IDs
      const workflowsPath = path.join(this.outputDir, 'workflows.json')
      try {
        const content = await fs.readFile(workflowsPath, 'utf8')
        const workflows = JSON.parse(content)
        
        // For fallback, we'll use filename as a placeholder ID
        return workflows.map((w: any, idx: number) => ({
          id: idx + 1000, // Temporary ID
          name: w.name,
          path: w.filename
        }))
      } catch {
        throw new Error('Cannot read workflows. Run scan-workflows.ts first.')
      }
    }
  }

  private async fetchWorkflowRuns(workflowId: number, workflowName: string): Promise<WorkflowRun[]> {
    try {
      // Try to get runs by workflow ID first
      let result: string
      try {
        result = execSync(
          `gh api "repos/:owner/:repo/actions/workflows/${workflowId}/runs?per_page=10" --jq '.workflow_runs[]'`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        )
      } catch {
        // Fallback: get all runs and filter by name
        result = execSync(
          `gh api "repos/:owner/:repo/actions/runs?per_page=50" --jq '.workflow_runs[] | select(.name == "${workflowName}")'`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        )
      }
      
      const runs = result.trim().split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .slice(0, 10) // Limit to 10 most recent
      
      // Enhance with duration and failure analysis
      return runs.map(run => this.enhanceRun(run))
    } catch (error) {
      console.warn(`⚠️ Could not fetch runs for workflow ${workflowName}:`, error)
      return []
    }
  }

  private enhanceRun(run: any): WorkflowRun {
    // Calculate duration
    let duration_seconds: number | undefined
    if (run.run_started_at && run.updated_at) {
      const start = new Date(run.run_started_at)
      const end = new Date(run.updated_at)
      duration_seconds = Math.floor((end.getTime() - start.getTime()) / 1000)
    }
    
    // Analyze failure reason
    let failure_reason: string | undefined
    if (run.conclusion === 'failure') {
      failure_reason = this.inferFailureReason(run)
    }
    
    return {
      id: run.id,
      name: run.name,
      run_number: run.run_number,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      workflow_id: run.workflow_id,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      created_at: run.created_at,
      updated_at: run.updated_at,
      run_started_at: run.run_started_at,
      html_url: run.html_url,
      duration_seconds,
      failure_reason,
      jobs_url: run.jobs_url
    }
  }

  private inferFailureReason(run: any): string {
    // This is a basic inference - we'll get detailed logs in fetch-posting-logs.ts
    if (run.conclusion === 'cancelled') return 'Cancelled'
    if (run.conclusion === 'timed_out') return 'Timeout'
    if (run.conclusion === 'failure') {
      // Try to get more specific info from the run
      if (run.event === 'schedule' && run.status === 'completed') {
        return 'Scheduled run failed'
      }
      return 'Job failure (see logs)'
    }
    return 'Unknown'
  }

  private buildSummary(workflowName: string, filename: string, runs: WorkflowRun[]): WorkflowRunSummary {
    const summary = {
      total: runs.length,
      success: runs.filter(r => r.conclusion === 'success').length,
      failure: runs.filter(r => r.conclusion === 'failure').length,
      cancelled: runs.filter(r => r.conclusion === 'cancelled').length,
      in_progress: runs.filter(r => r.status === 'in_progress').length,
      last_success: runs.find(r => r.conclusion === 'success')?.created_at,
      last_failure: runs.find(r => r.conclusion === 'failure')?.created_at,
      avg_duration_seconds: undefined as number | undefined
    }
    
    // Calculate average duration for completed runs
    const completedRuns = runs.filter(r => r.duration_seconds !== undefined)
    if (completedRuns.length > 0) {
      const totalDuration = completedRuns.reduce((sum, r) => sum + (r.duration_seconds || 0), 0)
      summary.avg_duration_seconds = Math.floor(totalDuration / completedRuns.length)
    }
    
    return {
      workflow_name: workflowName,
      workflow_filename: filename,
      runs,
      summary
    }
  }

  private async saveResults(summaries: WorkflowRunSummary[]): Promise<void> {
    const outputPath = path.join(this.outputDir, 'runs.json')
    await fs.writeFile(outputPath, JSON.stringify(summaries, null, 2))
    console.log(`💾 Saved runs data to ${outputPath}`)
    
    // Also create a quick summary
    await this.generateRunsSummary(summaries)
  }

  private async generateRunsSummary(summaries: WorkflowRunSummary[]): Promise<void> {
    const summaryPath = path.join(this.outputDir, 'runs-summary.md')
    
    let content = `# Workflow Runs Summary

Generated: ${new Date().toISOString()}
Total workflows analyzed: ${summaries.length}

## Overall Health

`

    const totalRuns = summaries.reduce((sum, s) => sum + s.summary.total, 0)
    const totalSuccess = summaries.reduce((sum, s) => sum + s.summary.success, 0)
    const totalFailure = summaries.reduce((sum, s) => sum + s.summary.failure, 0)
    const successRate = totalRuns > 0 ? ((totalSuccess / totalRuns) * 100).toFixed(1) : '0'
    
    content += `- **Total runs (last 10 per workflow)**: ${totalRuns}\n`
    content += `- **Success rate**: ${successRate}% (${totalSuccess}/${totalRuns})\n`
    content += `- **Failures**: ${totalFailure}\n`
    content += `- **Active workflows**: ${summaries.filter(s => s.summary.total > 0).length}\n\n`

    // Health by workflow
    content += `## Per-Workflow Health\n\n`
    content += `| Workflow | Runs | Success Rate | Last Success | Last Failure | Avg Duration |\n`
    content += `|----------|------|--------------|--------------|-------------- |-------------|\n`
    
    for (const summary of summaries) {
      const successRate = summary.summary.total > 0 
        ? ((summary.summary.success / summary.summary.total) * 100).toFixed(0) + '%'
        : 'N/A'
      
      const lastSuccess = summary.summary.last_success 
        ? new Date(summary.summary.last_success).toLocaleString()
        : 'Never'
      
      const lastFailure = summary.summary.last_failure 
        ? new Date(summary.summary.last_failure).toLocaleString()
        : 'Never'
      
      const avgDuration = summary.summary.avg_duration_seconds 
        ? `${Math.floor(summary.summary.avg_duration_seconds / 60)}m ${summary.summary.avg_duration_seconds % 60}s`
        : 'N/A'
      
      const healthIcon = summary.summary.success === summary.summary.total && summary.summary.total > 0 ? '✅' :
                        summary.summary.failure > 0 ? '❌' : '⚠️'
      
      content += `| ${healthIcon} ${summary.workflow_name} | ${summary.summary.total} | ${successRate} | ${lastSuccess} | ${lastFailure} | ${avgDuration} |\n`
    }

    content += `\n## Recent Failures\n\n`
    
    const recentFailures = summaries
      .flatMap(s => s.runs.filter(r => r.conclusion === 'failure'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
    
    if (recentFailures.length > 0) {
      content += `| Workflow | Run | Failure Reason | When | Link |\n`
      content += `|----------|-----|----------------|------|------|\n`
      
      for (const failure of recentFailures) {
        const when = new Date(failure.created_at).toLocaleString()
        content += `| ${failure.name} | #${failure.run_number} | ${failure.failure_reason || 'Unknown'} | ${when} | [View](${failure.html_url}) |\n`
      }
    } else {
      content += `✅ No recent failures detected\n`
    }

    await fs.writeFile(summaryPath, content)
    console.log(`📄 Generated runs summary at ${summaryPath}`)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('fetch-runs')
if (isMainModule) {
  const fetcher = new RunsFetcher()
  fetcher.fetchAllRuns().catch(console.error)
}

export { RunsFetcher }