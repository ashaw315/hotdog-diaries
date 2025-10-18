#!/usr/bin/env tsx

/**
 * CI Audit: Posting Logs Extractor
 * 
 * Fetches and analyzes logs from posting-related workflow runs,
 * extracting structured markers and failure details.
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { pipeline } from 'stream/promises'
import { createWriteStream, createReadStream } from 'fs'
import zlib from 'zlib'

interface PostingLogEntry {
  workflow_name: string
  run_id: number
  run_number: number
  run_url: string
  job_name: string
  step_name: string
  timestamp?: string
  log_content: string
  markers: {
    enforce_schedule_source_of_truth?: boolean
    no_scheduled_content?: boolean
    empty_schedule_slot?: boolean
    post_ok?: boolean
    post_fail?: boolean
    error_details?: string[]
  }
}

interface PostingLogsAnalysis {
  runs_analyzed: number
  logs_extracted: number
  posting_attempts: number
  successful_posts: number
  failed_posts: number
  empty_slots: number
  source_of_truth_violations: number
  summary_by_workflow: Record<string, {
    runs: number
    attempts: number
    successes: number
    failures: number
    last_run: string
  }>
  detailed_logs: PostingLogEntry[]
}

class PostingLogsExtractor {
  private outputDir: string
  private logsDir: string
  private rateLimitDelay: number = 200 // ms between API calls

  constructor() {
    this.outputDir = 'ci_audit/actions'
    this.logsDir = path.join(this.outputDir, 'posting-logs')
  }

  async extractLogs(): Promise<PostingLogsAnalysis> {
    console.log('📜 Extracting posting workflow logs...')
    
    // Load runs data
    const runsPath = path.join(this.outputDir, 'runs.json')
    const runsData = JSON.parse(await fs.readFile(runsPath, 'utf8'))
    
    // Filter to posting-related workflows
    const postingWorkflows = runsData.filter((summary: any) => 
      this.isPostingWorkflow(summary.workflow_name)
    )
    
    console.log(`🎯 Found ${postingWorkflows.length} posting workflows`)
    
    const analysis: PostingLogsAnalysis = {
      runs_analyzed: 0,
      logs_extracted: 0,
      posting_attempts: 0,
      successful_posts: 0,
      failed_posts: 0,
      empty_slots: 0,
      source_of_truth_violations: 0,
      summary_by_workflow: {},
      detailed_logs: []
    }
    
    for (const workflowSummary of postingWorkflows) {
      console.log(`  📋 Processing: ${workflowSummary.workflow_name}`)
      
      const workflowAnalysis = {
        runs: 0,
        attempts: 0,
        successes: 0,
        failures: 0,
        last_run: ''
      }
      
      for (const run of workflowSummary.runs) {
        try {
          console.log(`    🔍 Run #${run.run_number} (${run.conclusion})`)
          
          const logs = await this.fetchRunLogs(run, workflowSummary.workflow_name)
          analysis.detailed_logs.push(...logs)
          analysis.runs_analyzed++
          analysis.logs_extracted += logs.length
          
          workflowAnalysis.runs++
          if (run.created_at > workflowAnalysis.last_run) {
            workflowAnalysis.last_run = run.created_at
          }
          
          // Analyze markers
          for (const log of logs) {
            if (log.markers.post_ok) {
              analysis.successful_posts++
              workflowAnalysis.successes++
            }
            if (log.markers.post_fail) {
              analysis.failed_posts++
              workflowAnalysis.failures++
            }
            if (log.markers.empty_schedule_slot) {
              analysis.empty_slots++
            }
            if (log.markers.no_scheduled_content) {
              analysis.empty_slots++
            }
            if (log.markers.enforce_schedule_source_of_truth === false) {
              analysis.source_of_truth_violations++
            }
            if (log.markers.post_ok || log.markers.post_fail) {
              analysis.posting_attempts++
              workflowAnalysis.attempts++
            }
          }
          
          // Rate limiting
          await this.sleep(this.rateLimitDelay)
        } catch (error) {
          console.error(`    ❌ Failed to process run ${run.id}:`, error)
        }
      }
      
      analysis.summary_by_workflow[workflowSummary.workflow_name] = workflowAnalysis
    }
    
    await this.saveAnalysis(analysis)
    return analysis
  }

  private isPostingWorkflow(name: string): boolean {
    const postingKeywords = ['post-', 'posting', 'post_', 'breakfast', 'lunch', 'snack', 'dinner', 'evening', 'late']
    return postingKeywords.some(keyword => name.toLowerCase().includes(keyword))
  }

  private async fetchRunLogs(run: any, workflowName: string): Promise<PostingLogEntry[]> {
    const logs: PostingLogEntry[] = []
    
    try {
      // Get jobs for this run
      const jobsJson = execSync(
        `gh api "${run.jobs_url}" --jq '.jobs[]'`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
      
      const jobs = jobsJson.trim().split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
      
      for (const job of jobs) {
        // Only process jobs that might have posting steps
        if (this.isPostingJob(job.name)) {
          const jobLogs = await this.fetchJobLogs(run, job, workflowName)
          logs.push(...jobLogs)
        }
      }
      
    } catch (error) {
      console.warn(`    ⚠️ Could not fetch jobs for run ${run.id}:`, error)
    }
    
    return logs
  }

  private isPostingJob(jobName: string): boolean {
    const postingKeywords = ['post', 'schedule', 'content', 'trigger', 'slot']
    return postingKeywords.some(keyword => jobName.toLowerCase().includes(keyword))
  }

  private async fetchJobLogs(run: any, job: any, workflowName: string): Promise<PostingLogEntry[]> {
    const logs: PostingLogEntry[] = []
    
    try {
      // Create directory for this run's logs
      const runLogsDir = path.join(this.logsDir, workflowName, run.id.toString())
      await fs.mkdir(runLogsDir, { recursive: true })
      
      // Fetch raw logs
      const logContent = execSync(
        `gh api repos/:owner/:repo/actions/jobs/${job.id}/logs`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
      
      // Save raw logs
      const logFile = path.join(runLogsDir, `${job.name.replace(/[^a-zA-Z0-9-]/g, '-')}.log`)
      await fs.writeFile(logFile, logContent)
      
      // Parse logs for posting-related steps
      const steps = this.parseLogsIntoSteps(logContent)
      
      for (const step of steps) {
        if (this.isPostingStep(step.name, step.content)) {
          const markers = this.extractMarkers(step.content)
          
          logs.push({
            workflow_name: workflowName,
            run_id: run.id,
            run_number: run.run_number,
            run_url: run.html_url,
            job_name: job.name,
            step_name: step.name,
            timestamp: step.timestamp,
            log_content: step.content,
            markers
          })
        }
      }
      
    } catch (error) {
      console.warn(`    ⚠️ Could not fetch logs for job ${job.id}:`, error)
    }
    
    return logs
  }

  private parseLogsIntoSteps(logContent: string): Array<{name: string, content: string, timestamp?: string}> {
    const steps: Array<{name: string, content: string, timestamp?: string}> = []
    const lines = logContent.split('\n')
    
    let currentStep: {name: string, content: string, timestamp?: string} | null = null
    
    for (const line of lines) {
      // GitHub Actions log format: timestamp [group]step name
      const stepMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+##\[group\](.+)/)
      if (stepMatch) {
        // Save previous step
        if (currentStep) {
          steps.push(currentStep)
        }
        
        // Start new step
        currentStep = {
          name: stepMatch[2],
          content: '',
          timestamp: stepMatch[1]
        }
      } else if (currentStep) {
        currentStep.content += line + '\n'
      }
    }
    
    // Save last step
    if (currentStep) {
      steps.push(currentStep)
    }
    
    return steps
  }

  private isPostingStep(stepName: string, content: string): boolean {
    const stepKeywords = ['post', 'trigger', 'schedule', 'content', 'slot']
    const contentKeywords = ['POST_OK', 'POST_FAIL', 'ENFORCE_SCHEDULE_SOURCE_OF_TRUTH', 'NO_SCHEDULED_CONTENT', 'EMPTY_SCHEDULE_SLOT']
    
    return stepKeywords.some(keyword => stepName.toLowerCase().includes(keyword)) ||
           contentKeywords.some(keyword => content.includes(keyword))
  }

  private extractMarkers(content: string): PostingLogEntry['markers'] {
    const markers: PostingLogEntry['markers'] = {}
    
    // Look for our structured markers
    if (content.includes('ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true')) {
      markers.enforce_schedule_source_of_truth = true
    } else if (content.includes('ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=false')) {
      markers.enforce_schedule_source_of_truth = false
    }
    
    if (content.includes('NO_SCHEDULED_CONTENT')) {
      markers.no_scheduled_content = true
    }
    
    if (content.includes('EMPTY_SCHEDULE_SLOT')) {
      markers.empty_schedule_slot = true
    }
    
    if (content.includes('POST_OK')) {
      markers.post_ok = true
    }
    
    if (content.includes('POST_FAIL')) {
      markers.post_fail = true
    }
    
    // Extract error details
    const errorLines = content.split('\n').filter(line => 
      line.includes('ERROR') || 
      line.includes('Failed') ||
      line.includes('Error:') ||
      line.includes('❌')
    )
    
    if (errorLines.length > 0) {
      markers.error_details = errorLines.slice(0, 5) // Limit to 5 error lines
    }
    
    return markers
  }

  private async saveAnalysis(analysis: PostingLogsAnalysis): Promise<void> {
    const outputPath = path.join(this.outputDir, 'posting-logs-analysis.json')
    await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2))
    console.log(`💾 Saved posting logs analysis to ${outputPath}`)
    
    // Generate summary report
    await this.generateLogsReport(analysis)
  }

  private async generateLogsReport(analysis: PostingLogsAnalysis): Promise<void> {
    const reportPath = path.join(this.outputDir, 'posting-logs-report.md')
    
    let content = `# Posting Logs Analysis

Generated: ${new Date().toISOString()}

## Summary

- **Runs analyzed**: ${analysis.runs_analyzed}
- **Log entries extracted**: ${analysis.logs_extracted}
- **Posting attempts**: ${analysis.posting_attempts}
- **Successful posts**: ${analysis.successful_posts}
- **Failed posts**: ${analysis.failed_posts}
- **Empty slots encountered**: ${analysis.empty_slots}
- **Source of truth violations**: ${analysis.source_of_truth_violations}

## Success Rate

`

    const successRate = analysis.posting_attempts > 0 
      ? ((analysis.successful_posts / analysis.posting_attempts) * 100).toFixed(1)
      : '0'
    
    if (parseFloat(successRate) >= 90) {
      content += `✅ **${successRate}%** - Excellent\n\n`
    } else if (parseFloat(successRate) >= 70) {
      content += `⚠️ **${successRate}%** - Needs attention\n\n`
    } else {
      content += `❌ **${successRate}%** - Critical issues\n\n`
    }

    // Per-workflow breakdown
    content += `## Per-Workflow Analysis\n\n`
    content += `| Workflow | Runs | Attempts | Success Rate | Last Run |\n`
    content += `|----------|------|----------|--------------|----------|\n`
    
    for (const [name, stats] of Object.entries(analysis.summary_by_workflow)) {
      const workflowSuccessRate = stats.attempts > 0 
        ? ((stats.successes / stats.attempts) * 100).toFixed(0) + '%'
        : 'N/A'
      
      const lastRun = stats.last_run 
        ? new Date(stats.last_run).toLocaleDateString()
        : 'Never'
      
      const statusIcon = stats.successes === stats.attempts && stats.attempts > 0 ? '✅' :
                        stats.failures > 0 ? '❌' : '⚠️'
      
      content += `| ${statusIcon} ${name} | ${stats.runs} | ${stats.attempts} | ${workflowSuccessRate} | ${lastRun} |\n`
    }

    // Issues found
    content += `\n## Issues Detected\n\n`
    
    if (analysis.source_of_truth_violations > 0) {
      content += `❌ **Source of Truth Violations**: ${analysis.source_of_truth_violations} instances where ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=false\n`
    }
    
    if (analysis.empty_slots > 0) {
      content += `⚠️ **Empty Schedule Slots**: ${analysis.empty_slots} instances of NO_SCHEDULED_CONTENT or EMPTY_SCHEDULE_SLOT\n`
    }
    
    if (analysis.failed_posts > 0) {
      content += `❌ **Failed Posts**: ${analysis.failed_posts} posting failures detected\n`
    }
    
    if (analysis.posting_attempts === 0) {
      content += `🚨 **No Posting Attempts**: No POST_OK or POST_FAIL markers found in recent runs\n`
    }

    // Recent errors
    const recentErrors = analysis.detailed_logs
      .filter(log => log.markers.error_details && log.markers.error_details.length > 0)
      .slice(0, 5)
    
    if (recentErrors.length > 0) {
      content += `\n## Recent Errors\n\n`
      
      for (const error of recentErrors) {
        content += `### ${error.workflow_name} - Run #${error.run_number}\n`
        content += `**Step**: ${error.step_name}\n`
        content += `**Run**: [View](${error.run_url})\n`
        content += `**Errors**:\n`
        error.markers.error_details?.forEach(err => {
          content += `- \`${err.trim()}\`\n`
        })
        content += `\n`
      }
    }

    await fs.writeFile(reportPath, content)
    console.log(`📄 Generated posting logs report at ${reportPath}`)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('fetch-posting-logs')
if (isMainModule) {
  const extractor = new PostingLogsExtractor()
  extractor.extractLogs().catch(console.error)
}

export { PostingLogsExtractor }