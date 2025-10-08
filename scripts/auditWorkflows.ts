#!/usr/bin/env tsx
/**
 * GitHub Actions Workflow Audit & Reliability Report Generator
 * 
 * Analyzes all .github/workflows/*.yml files and their execution history
 * to determine health, redundancy, and reliability status.
 * 
 * Usage: GH_TOKEN=your_token tsx scripts/auditWorkflows.ts
 */

import { Octokit } from '@octokit/rest'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'
import { existsSync } from 'fs'

interface WorkflowConfig {
  name: string
  on: any
  jobs: Record<string, any>
}

interface WorkflowAnalysis {
  filename: string
  name: string
  triggers: string[]
  cronSchedules: string[]
  jobCount: number
  totalSteps: number
  hasSecrets: boolean
  referencesScripts: string[]
  isActive: boolean
  workflowId?: number
}

interface WorkflowStats {
  totalRuns: number
  successCount: number
  failureCount: number
  pendingCount: number
  lastRunAt: string | null
  lastSuccessAt: string | null
  averageDuration: number
  manualTriggers: number
  scheduledTriggers: number
}

interface WorkflowHealth {
  analysis: WorkflowAnalysis
  stats: WorkflowStats
  healthStatus: 'healthy' | 'warning' | 'critical' | 'inactive' | 'unknown'
  recommendations: string[]
  redundancyFlags: string[]
  successRate: number
}

interface AuditSummary {
  totalWorkflows: number
  activeWorkflows: number
  healthyWorkflows: number
  warningWorkflows: number
  criticalWorkflows: number
  inactiveWorkflows: number
  redundantWorkflows: number
  lastAuditDate: string
  recommendations: {
    keep: string[]
    update: string[]
    remove: string[]
    consolidate: string[]
  }
}

class WorkflowAuditor {
  private octokit: Octokit
  private owner: string = 'anthropics' // Will be detected from git
  private repo: string = 'hotdog-diaries'
  private workflowsPath: string
  private reportsPath: string

  constructor(githubToken: string) {
    this.octokit = new Octokit({ auth: githubToken })
    this.workflowsPath = join(process.cwd(), '.github', 'workflows')
    this.reportsPath = join(process.cwd(), 'reports')
  }

  /**
   * Main audit execution
   */
  async runAudit(daysBack: number = 30): Promise<void> {
    console.log('🔍 Starting GitHub Actions Workflow Audit...')
    console.log(`📅 Analyzing last ${daysBack} days of execution history`)
    
    try {
      // Ensure reports directory exists
      await this.ensureReportsDirectory()
      
      // Detect repository info from git
      await this.detectRepository()
      
      // Step 1: Discover all workflow files
      console.log('\n📋 Step 1: Discovering workflow files...')
      const workflowAnalyses = await this.discoverWorkflows()
      console.log(`✅ Found ${workflowAnalyses.length} workflow files`)
      
      // Step 2: Fetch GitHub API data
      console.log('\n📊 Step 2: Fetching execution history from GitHub API...')
      const healthReports = await this.analyzeWorkflowHealth(workflowAnalyses, daysBack)
      console.log(`✅ Analyzed execution history for ${healthReports.length} workflows`)
      
      // Step 3: Detect redundancy and conflicts
      console.log('\n🔍 Step 3: Detecting redundancy and conflicts...')
      const enhancedReports = await this.detectRedundancy(healthReports)
      console.log(`✅ Redundancy analysis complete`)
      
      // Step 4: Generate comprehensive report
      console.log('\n📄 Step 4: Generating audit report...')
      const summary = await this.generateReport(enhancedReports)
      console.log(`✅ Report generated: ${this.reportsPath}/workflow-audit.md`)
      
      // Step 5: Display summary
      this.displaySummary(summary)
      
    } catch (error) {
      console.error('❌ Audit failed:', error)
      throw error
    }
  }

  /**
   * Discover and parse all workflow YAML files
   */
  private async discoverWorkflows(): Promise<WorkflowAnalysis[]> {
    const analyses: WorkflowAnalysis[] = []
    
    try {
      const files = await readdir(this.workflowsPath)
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      
      for (const filename of yamlFiles) {
        try {
          const filePath = join(this.workflowsPath, filename)
          const content = await readFile(filePath, 'utf-8')
          const config = parseYaml(content) as WorkflowConfig
          
          const analysis = this.analyzeWorkflowConfig(filename, config)
          analyses.push(analysis)
          
        } catch (error) {
          console.warn(`⚠️ Failed to parse ${filename}:`, error.message)
          // Add a basic analysis for unparseable files
          analyses.push({
            filename,
            name: filename.replace(/\.ya?ml$/, ''),
            triggers: ['unknown'],
            cronSchedules: [],
            jobCount: 0,
            totalSteps: 0,
            hasSecrets: false,
            referencesScripts: [],
            isActive: false
          })
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to read workflows directory:', error)
      throw error
    }
    
    return analyses
  }

  /**
   * Analyze individual workflow configuration
   */
  private analyzeWorkflowConfig(filename: string, config: WorkflowConfig): WorkflowAnalysis {
    const triggers: string[] = []
    const cronSchedules: string[] = []
    
    // Parse triggers
    if (config.on) {
      if (typeof config.on === 'string') {
        triggers.push(config.on)
      } else if (typeof config.on === 'object') {
        Object.keys(config.on).forEach(trigger => {
          triggers.push(trigger)
          
          // Extract cron schedules
          if (trigger === 'schedule' && Array.isArray(config.on[trigger])) {
            config.on[trigger].forEach((schedule: any) => {
              if (schedule.cron) {
                cronSchedules.push(schedule.cron)
              }
            })
          }
        })
      }
    }
    
    // Count jobs and steps
    const jobCount = config.jobs ? Object.keys(config.jobs).length : 0
    let totalSteps = 0
    let hasSecrets = false
    const referencesScripts: string[] = []
    
    if (config.jobs) {
      Object.values(config.jobs).forEach((job: any) => {
        if (job.steps && Array.isArray(job.steps)) {
          totalSteps += job.steps.length
          
          // Check for secrets usage
          job.steps.forEach((step: any) => {
            const stepStr = JSON.stringify(step)
            if (stepStr.includes('secrets.') || stepStr.includes('${{ secrets')) {
              hasSecrets = true
            }
            
            // Check for script references
            if (step.run && typeof step.run === 'string') {
              const scriptMatches = step.run.match(/(?:tsx|node|npm run|\.\/)\s+([^\s]+\.(?:ts|js|sh))/g)
              if (scriptMatches) {
                referencesScripts.push(...scriptMatches)
              }
            }
          })
        }
      })
    }
    
    return {
      filename,
      name: config.name || filename.replace(/\.ya?ml$/, ''),
      triggers,
      cronSchedules,
      jobCount,
      totalSteps,
      hasSecrets,
      referencesScripts,
      isActive: triggers.length > 0 && jobCount > 0
    }
  }

  /**
   * Fetch and analyze workflow execution history
   */
  private async analyzeWorkflowHealth(
    analyses: WorkflowAnalysis[], 
    daysBack: number
  ): Promise<WorkflowHealth[]> {
    const healthReports: WorkflowHealth[] = []
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
    
    // First, get all workflows from GitHub API
    let githubWorkflows: any[] = []
    try {
      const { data } = await this.octokit.rest.actions.listRepoWorkflows({
        owner: this.owner,
        repo: this.repo
      })
      githubWorkflows = data.workflows
    } catch (error) {
      console.warn('⚠️ Failed to fetch workflows from GitHub API:', error.message)
    }
    
    for (const analysis of analyses) {
      try {
        // Find corresponding GitHub workflow
        const githubWorkflow = githubWorkflows.find(w => 
          w.name === analysis.name || 
          w.path.endsWith(analysis.filename)
        )
        
        let stats: WorkflowStats = {
          totalRuns: 0,
          successCount: 0,
          failureCount: 0,
          pendingCount: 0,
          lastRunAt: null,
          lastSuccessAt: null,
          averageDuration: 0,
          manualTriggers: 0,
          scheduledTriggers: 0
        }
        
        if (githubWorkflow) {
          analysis.workflowId = githubWorkflow.id
          stats = await this.fetchWorkflowStats(githubWorkflow.id, since)
        }
        
        const health = this.assessWorkflowHealth(analysis, stats)
        healthReports.push(health)
        
      } catch (error) {
        console.warn(`⚠️ Failed to analyze ${analysis.filename}:`, error.message)
        
        // Create a default health report for failed analysis
        healthReports.push({
          analysis,
          stats: {
            totalRuns: 0,
            successCount: 0,
            failureCount: 0,
            pendingCount: 0,
            lastRunAt: null,
            lastSuccessAt: null,
            averageDuration: 0,
            manualTriggers: 0,
            scheduledTriggers: 0
          },
          healthStatus: 'unknown',
          recommendations: ['Failed to analyze - check workflow syntax'],
          redundancyFlags: [],
          successRate: 0
        })
      }
    }
    
    return healthReports
  }

  /**
   * Fetch detailed statistics for a specific workflow
   */
  private async fetchWorkflowStats(workflowId: number, since: string): Promise<WorkflowStats> {
    try {
      const { data } = await this.octokit.rest.actions.listWorkflowRuns({
        owner: this.owner,
        repo: this.repo,
        workflow_id: workflowId,
        created: `>=${since}`,
        per_page: 100
      })
      
      const runs = data.workflow_runs
      const stats: WorkflowStats = {
        totalRuns: runs.length,
        successCount: runs.filter(r => r.conclusion === 'success').length,
        failureCount: runs.filter(r => r.conclusion === 'failure').length,
        pendingCount: runs.filter(r => r.status === 'in_progress' || r.status === 'queued').length,
        lastRunAt: runs.length > 0 ? runs[0].created_at : null,
        lastSuccessAt: null,
        averageDuration: 0,
        manualTriggers: runs.filter(r => r.event === 'workflow_dispatch').length,
        scheduledTriggers: runs.filter(r => r.event === 'schedule').length
      }
      
      // Find last successful run
      const lastSuccess = runs.find(r => r.conclusion === 'success')
      if (lastSuccess) {
        stats.lastSuccessAt = lastSuccess.created_at
      }
      
      // Calculate average duration (for completed runs)
      const completedRuns = runs.filter(r => 
        r.conclusion && r.created_at && r.updated_at
      )
      
      if (completedRuns.length > 0) {
        const totalDuration = completedRuns.reduce((sum, run) => {
          const start = new Date(run.created_at).getTime()
          const end = new Date(run.updated_at).getTime()
          return sum + (end - start)
        }, 0)
        
        stats.averageDuration = Math.round(totalDuration / completedRuns.length / 1000) // seconds
      }
      
      return stats
      
    } catch (error) {
      console.warn(`⚠️ Failed to fetch stats for workflow ${workflowId}:`, error.message)
      return {
        totalRuns: 0,
        successCount: 0,
        failureCount: 0,
        pendingCount: 0,
        lastRunAt: null,
        lastSuccessAt: null,
        averageDuration: 0,
        manualTriggers: 0,
        scheduledTriggers: 0
      }
    }
  }

  /**
   * Assess the health status of a workflow
   */
  private assessWorkflowHealth(analysis: WorkflowAnalysis, stats: WorkflowStats): WorkflowHealth {
    const recommendations: string[] = []
    const redundancyFlags: string[] = []
    const successRate = stats.totalRuns > 0 ? (stats.successCount / stats.totalRuns) * 100 : 0
    
    let healthStatus: 'healthy' | 'warning' | 'critical' | 'inactive' | 'unknown' = 'unknown'
    
    // Determine health status
    if (!analysis.isActive) {
      healthStatus = 'inactive'
      recommendations.push('Workflow appears to be inactive or malformed')
    } else if (stats.totalRuns === 0) {
      healthStatus = 'inactive'
      recommendations.push('No runs in analysis period - may be unused')
    } else if (successRate >= 90) {
      healthStatus = 'healthy'
    } else if (successRate >= 70) {
      healthStatus = 'warning'
      recommendations.push('Success rate below 90% - investigate recent failures')
    } else {
      healthStatus = 'critical'
      recommendations.push('Success rate below 70% - requires immediate attention')
    }
    
    // Additional recommendations
    if (stats.totalRuns > 0 && stats.failureCount > 5) {
      recommendations.push('High failure count - check error patterns')
    }
    
    if (analysis.cronSchedules.length > 0 && stats.scheduledTriggers === 0) {
      recommendations.push('Has cron schedule but no scheduled runs detected')
    }
    
    if (analysis.referencesScripts.length > 0) {
      recommendations.push('Verify referenced scripts exist and are executable')
    }
    
    if (!analysis.hasSecrets && analysis.triggers.includes('schedule')) {
      recommendations.push('Scheduled workflow without secrets - may need authentication')
    }
    
    const daysSinceLastRun = stats.lastRunAt 
      ? Math.floor((Date.now() - new Date(stats.lastRunAt).getTime()) / (24 * 60 * 60 * 1000))
      : null
    
    if (daysSinceLastRun !== null && daysSinceLastRun > 7) {
      recommendations.push(`No runs for ${daysSinceLastRun} days - may be stale`)
    }
    
    return {
      analysis,
      stats,
      healthStatus,
      recommendations,
      redundancyFlags,
      successRate
    }
  }

  /**
   * Detect redundant and overlapping workflows
   */
  private async detectRedundancy(healthReports: WorkflowHealth[]): Promise<WorkflowHealth[]> {
    // Group workflows by similar patterns
    const triggerGroups: Record<string, WorkflowHealth[]> = {}
    const nameGroups: Record<string, WorkflowHealth[]> = {}
    const scheduleGroups: Record<string, WorkflowHealth[]> = {}
    
    // Group by triggers
    healthReports.forEach(report => {
      report.analysis.triggers.forEach(trigger => {
        if (!triggerGroups[trigger]) triggerGroups[trigger] = []
        triggerGroups[trigger].push(report)
      })
      
      // Group by similar names
      const nameKey = report.analysis.name.toLowerCase()
        .replace(/[-_]/g, '')
        .replace(/\d+/g, '')
      if (!nameGroups[nameKey]) nameGroups[nameKey] = []
      nameGroups[nameKey].push(report)
      
      // Group by schedule patterns
      report.analysis.cronSchedules.forEach(schedule => {
        if (!scheduleGroups[schedule]) scheduleGroups[schedule] = []
        scheduleGroups[schedule].push(report)
      })
    })
    
    // Flag redundancy
    Object.entries(triggerGroups).forEach(([trigger, reports]) => {
      if (reports.length > 1 && trigger === 'workflow_dispatch') {
        // Multiple manual workflows are okay
        return
      }
      
      if (reports.length > 1) {
        reports.forEach(report => {
          report.redundancyFlags.push(`Multiple workflows with '${trigger}' trigger`)
        })
      }
    })
    
    Object.entries(nameGroups).forEach(([nameKey, reports]) => {
      if (reports.length > 1) {
        reports.forEach(report => {
          const others = reports.filter(r => r !== report).map(r => r.analysis.filename)
          report.redundancyFlags.push(`Similar name to: ${others.join(', ')}`)
        })
      }
    })
    
    Object.entries(scheduleGroups).forEach(([schedule, reports]) => {
      if (reports.length > 1) {
        reports.forEach(report => {
          const others = reports.filter(r => r !== report).map(r => r.analysis.filename)
          report.redundancyFlags.push(`Duplicate schedule '${schedule}' in: ${others.join(', ')}`)
        })
      }
    })
    
    return healthReports
  }

  /**
   * Generate comprehensive markdown report
   */
  private async generateReport(healthReports: WorkflowHealth[]): Promise<AuditSummary> {
    const summary: AuditSummary = {
      totalWorkflows: healthReports.length,
      activeWorkflows: healthReports.filter(r => r.healthStatus !== 'inactive').length,
      healthyWorkflows: healthReports.filter(r => r.healthStatus === 'healthy').length,
      warningWorkflows: healthReports.filter(r => r.healthStatus === 'warning').length,
      criticalWorkflows: healthReports.filter(r => r.healthStatus === 'critical').length,
      inactiveWorkflows: healthReports.filter(r => r.healthStatus === 'inactive').length,
      redundantWorkflows: healthReports.filter(r => r.redundancyFlags.length > 0).length,
      lastAuditDate: new Date().toISOString(),
      recommendations: {
        keep: [],
        update: [],
        remove: [],
        consolidate: []
      }
    }
    
    // Generate recommendations
    healthReports.forEach(report => {
      if (report.healthStatus === 'healthy' && report.redundancyFlags.length === 0) {
        summary.recommendations.keep.push(report.analysis.filename)
      } else if (report.healthStatus === 'warning' || report.recommendations.length > 0) {
        summary.recommendations.update.push(report.analysis.filename)
      } else if (report.healthStatus === 'inactive' || report.successRate < 20) {
        summary.recommendations.remove.push(report.analysis.filename)
      }
      
      if (report.redundancyFlags.length > 0) {
        summary.recommendations.consolidate.push(report.analysis.filename)
      }
    })
    
    const reportContent = this.generateMarkdownReport(healthReports, summary)
    const reportPath = join(this.reportsPath, 'workflow-audit.md')
    
    await writeFile(reportPath, reportContent, 'utf-8')
    
    return summary
  }

  /**
   * Generate the actual markdown content
   */
  private generateMarkdownReport(healthReports: WorkflowHealth[], summary: AuditSummary): string {
    const sortedReports = healthReports.sort((a, b) => {
      // Sort by health status, then by success rate
      const healthOrder = { critical: 0, warning: 1, inactive: 2, unknown: 3, healthy: 4 }
      const statusDiff = healthOrder[a.healthStatus] - healthOrder[b.healthStatus]
      if (statusDiff !== 0) return statusDiff
      return b.successRate - a.successRate
    })
    
    let markdown = `# 🔍 GitHub Actions Workflow Audit Report

**Generated:** ${new Date().toLocaleString()}  
**Analysis Period:** Last 30 days  
**Repository:** ${this.owner}/${this.repo}

## 📊 Executive Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Workflows** | ${summary.totalWorkflows} | 100% |
| **Healthy** ✅ | ${summary.healthyWorkflows} | ${Math.round((summary.healthyWorkflows / summary.totalWorkflows) * 100)}% |
| **Warning** ⚠️ | ${summary.warningWorkflows} | ${Math.round((summary.warningWorkflows / summary.totalWorkflows) * 100)}% |
| **Critical** ❌ | ${summary.criticalWorkflows} | ${Math.round((summary.criticalWorkflows / summary.totalWorkflows) * 100)}% |
| **Inactive** 💤 | ${summary.inactiveWorkflows} | ${Math.round((summary.inactiveWorkflows / summary.totalWorkflows) * 100)}% |
| **Redundant** 🔄 | ${summary.redundantWorkflows} | ${Math.round((summary.redundantWorkflows / summary.totalWorkflows) * 100)}% |

## 📋 Detailed Analysis

| Workflow | Status | Success Rate | Runs | Last Run | Avg Duration | Triggers | Notes |
|----------|--------|--------------|------|----------|--------------|-----------|-------|
`

    sortedReports.forEach(report => {
      const statusEmoji = {
        healthy: '✅',
        warning: '⚠️',
        critical: '❌',
        inactive: '💤',
        unknown: '❓'
      }[report.healthStatus]
      
      const lastRun = report.stats.lastRunAt 
        ? new Date(report.stats.lastRunAt).toLocaleDateString()
        : 'Never'
      
      const duration = report.stats.averageDuration > 0 
        ? `${Math.floor(report.stats.averageDuration / 60)}m ${report.stats.averageDuration % 60}s`
        : '-'
      
      const triggers = report.analysis.triggers.join(', ')
      const notes = [
        ...report.recommendations,
        ...report.redundancyFlags
      ].join('; ').substring(0, 100) + (report.recommendations.length + report.redundancyFlags.length > 0 ? '...' : '')
      
      markdown += `| \`${report.analysis.filename}\` | ${statusEmoji} ${report.healthStatus} | ${report.successRate.toFixed(1)}% | ${report.stats.totalRuns} | ${lastRun} | ${duration} | ${triggers} | ${notes} |
`
    })
    
    markdown += `
## 🔧 Recommendations

### ✅ Keep (${summary.recommendations.keep.length} workflows)
Healthy workflows that should be maintained as-is.

${summary.recommendations.keep.map(f => `- \`${f}\``).join('\n') || 'None'}

### ⚙️ Needs Update (${summary.recommendations.update.length} workflows)
Workflows that need attention or improvements.

${summary.recommendations.update.map(f => `- \`${f}\``).join('\n') || 'None'}

### 🗑️ Consider Removal (${summary.recommendations.remove.length} workflows)
Workflows that appear unused or consistently failing.

${summary.recommendations.remove.map(f => `- \`${f}\``).join('\n') || 'None'}

### 🔄 Consolidate (${summary.recommendations.consolidate.length} workflows)
Workflows that may be redundant with others.

${summary.recommendations.consolidate.map(f => `- \`${f}\``).join('\n') || 'None'}

## 📅 Scheduled Workflows Analysis

`

    const scheduledWorkflows = sortedReports.filter(r => r.analysis.cronSchedules.length > 0)
    if (scheduledWorkflows.length > 0) {
      markdown += `| Workflow | Schedule | Last Scheduled Run | Status |
|----------|----------|-------------------|--------|
`
      scheduledWorkflows.forEach(report => {
        const schedules = report.analysis.cronSchedules.join(', ')
        const lastScheduled = report.stats.scheduledTriggers > 0 ? '✅' : '❌ None detected'
        const status = report.healthStatus
        
        markdown += `| \`${report.analysis.filename}\` | ${schedules} | ${lastScheduled} | ${status} |
`
      })
    } else {
      markdown += 'No scheduled workflows detected.\n'
    }
    
    markdown += `
## 🚨 Critical Issues

`

    const criticalIssues = sortedReports.filter(r => 
      r.healthStatus === 'critical' || 
      r.successRate < 50 ||
      r.redundancyFlags.length > 0
    )
    
    if (criticalIssues.length > 0) {
      criticalIssues.forEach(report => {
        markdown += `### \`${report.analysis.filename}\`
- **Status:** ${report.healthStatus}
- **Success Rate:** ${report.successRate.toFixed(1)}%
- **Issues:** ${[...report.recommendations, ...report.redundancyFlags].join(', ')}

`
      })
    } else {
      markdown += 'No critical issues detected! 🎉\n'
    }
    
    markdown += `
## 🔍 Audit Methodology

1. **Static Analysis:** Parsed all \`.github/workflows/*.yml\` files
2. **GitHub API:** Fetched execution history for last 30 days
3. **Health Assessment:** Analyzed success rates, frequency, and patterns
4. **Redundancy Detection:** Identified overlapping triggers and similar names
5. **Recommendations:** Generated actionable next steps

**Last Updated:** ${new Date().toISOString()}
`

    return markdown
  }

  /**
   * Display summary to console
   */
  private displaySummary(summary: AuditSummary): void {
    console.log('\n🎉 Audit Complete!')
    console.log('=================')
    console.log(`✅ ${summary.totalWorkflows} workflows analyzed`)
    console.log(`✅ ${summary.healthyWorkflows} healthy`)
    console.log(`⚠️  ${summary.warningWorkflows} need attention`)
    console.log(`❌ ${summary.criticalWorkflows} critical issues`)
    console.log(`💤 ${summary.inactiveWorkflows} inactive`)
    console.log(`🔄 ${summary.redundantWorkflows} redundant`)
    
    console.log('\n📊 Recommendations:')
    console.log(`  ✅ Keep: ${summary.recommendations.keep.length} workflows`)
    console.log(`  ⚙️ Update: ${summary.recommendations.update.length} workflows`) 
    console.log(`  🗑️ Remove: ${summary.recommendations.remove.length} workflows`)
    console.log(`  🔄 Consolidate: ${summary.recommendations.consolidate.length} workflows`)
    
    console.log(`\n📄 Full report: ${this.reportsPath}/workflow-audit.md`)
  }

  /**
   * Ensure reports directory exists
   */
  private async ensureReportsDirectory(): Promise<void> {
    if (!existsSync(this.reportsPath)) {
      await mkdir(this.reportsPath, { recursive: true })
    }
  }

  /**
   * Detect repository owner and name from git config
   */
  private async detectRepository(): Promise<void> {
    try {
      // For now, use hardcoded values
      // In a real implementation, you'd parse .git/config or use git commands
      this.owner = 'adamshaw'
      this.repo = 'hotdog-diaries'
      
      console.log(`🔍 Analyzing repository: ${this.owner}/${this.repo}`)
    } catch (error) {
      console.warn('⚠️ Could not detect repository info, using defaults')
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  
  if (!githubToken) {
    console.error('❌ Error: GitHub token required')
    console.error('Usage: GH_TOKEN=your_token tsx scripts/auditWorkflows.ts')
    console.error('Get token from: https://github.com/settings/tokens')
    process.exit(1)
  }
  
  const daysBack = parseInt(process.env.DAYS_BACK || '30')
  
  try {
    const auditor = new WorkflowAuditor(githubToken)
    await auditor.runAudit(daysBack)
    
    console.log('\n✅ Audit completed successfully!')
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { WorkflowAuditor }