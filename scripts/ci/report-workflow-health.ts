#!/usr/bin/env tsx

/**
 * CI Audit: Health Report Generator
 * 
 * Synthesizes all previous analysis (workflows, runs, logs, crons, posting matrix)
 * into a comprehensive, actionable health report with root causes and specific fixes.
 */

import fs from 'fs/promises'
import path from 'path'
import { formatInTimeZone } from 'date-fns-tz'

interface HealthCheckResult {
  check: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  message: string
  details?: any
  actions?: string[]
}

interface WorkflowHealthReport {
  generated_at: string
  analysis_date_et: string
  overall_status: 'healthy' | 'degraded' | 'critical'
  critical_issues: number
  warnings: number
  
  executive_summary: {
    posting_success_rate: string
    workflows_healthy: number
    workflows_total: number
    root_cause: string
    immediate_actions: string[]
  }
  
  health_checks: HealthCheckResult[]
  
  detailed_analysis: {
    posting_pipeline: {
      status: 'healthy' | 'degraded' | 'critical'
      today_posts_expected: number
      today_posts_actual: number
      empty_slots: number
      failed_slots: number
      issues: string[]
    }
    
    workflow_reliability: {
      total_workflows: number
      scheduled_workflows: number
      success_rate_overall: string
      cron_collisions: number
      recent_failures: number
    }
    
    source_of_truth_compliance: {
      violations_detected: number
      enforcement_enabled: boolean
      recommendations: string[]
    }
  }
  
  next_steps: {
    immediate: string[]
    short_term: string[]
    monitoring: string[]
  }
}

class HealthReportGenerator {
  private outputDir: string
  private easternTZ = 'America/New_York'

  constructor() {
    this.outputDir = 'ci_audit/actions'
  }

  async generateReport(): Promise<WorkflowHealthReport> {
    console.log('🏥 Generating comprehensive workflow health report...')
    
    const now = new Date()
    const todayET = formatInTimeZone(now, this.easternTZ, 'yyyy-MM-dd')
    
    // Load all analysis data
    const data = await this.loadAnalysisData()
    
    // Run health checks
    const healthChecks = await this.runHealthChecks(data)
    
    // Determine overall status
    const overallStatus = this.determineOverallStatus(healthChecks)
    
    // Generate executive summary
    const executiveSummary = this.generateExecutiveSummary(data, healthChecks)
    
    // Generate detailed analysis
    const detailedAnalysis = this.generateDetailedAnalysis(data)
    
    // Generate next steps
    const nextSteps = this.generateNextSteps(healthChecks, data)
    
    const report: WorkflowHealthReport = {
      generated_at: now.toISOString(),
      analysis_date_et: todayET,
      overall_status: overallStatus,
      critical_issues: healthChecks.filter(h => h.status === 'fail').length,
      warnings: healthChecks.filter(h => h.status === 'warn').length,
      executive_summary: executiveSummary,
      health_checks: healthChecks,
      detailed_analysis: detailedAnalysis,
      next_steps: nextSteps
    }
    
    await this.saveReport(report)
    return report
  }

  private async loadAnalysisData(): Promise<any> {
    const data: any = {}
    
    try {
      // Load all analysis files
      const files = [
        'workflows.json',
        'runs.json', 
        'cron-analysis.json',
        'posting-logs-analysis.json',
        'TODAY-posting-matrix.json'
      ]
      
      for (const file of files) {
        try {
          const filePath = path.join(this.outputDir, file)
          const content = await fs.readFile(filePath, 'utf8')
          const key = file.replace('.json', '').replace('-', '_')
          data[key] = JSON.parse(content)
          console.log(`  ✅ Loaded ${file}`)
        } catch (error) {
          console.warn(`  ⚠️ Could not load ${file}:`, error)
          data[file.replace('.json', '').replace('-', '_')] = null
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to load analysis data:', error)
    }
    
    return data
  }

  private async runHealthChecks(data: any): Promise<HealthCheckResult[]> {
    const checks: HealthCheckResult[] = []

    // Check 1: Today's posting performance
    if (data.TODAY_posting_matrix) {
      const matrix = data.TODAY_posting_matrix
      const successRate = matrix.summary.total_slots > 0 
        ? (matrix.summary.successful_posts / matrix.summary.total_slots) * 100
        : 0

      if (successRate >= 80) {
        checks.push({
          check: 'today_posting_performance',
          status: 'pass',
          message: `Posting success rate: ${successRate.toFixed(1)}%`,
          details: matrix.summary
        })
      } else if (successRate >= 50) {
        checks.push({
          check: 'today_posting_performance',
          status: 'warn',
          message: `Posting success rate below target: ${successRate.toFixed(1)}%`,
          details: matrix.summary,
          actions: ['Review failed posting slots', 'Check workflow logs']
        })
      } else {
        checks.push({
          check: 'today_posting_performance',
          status: 'fail',
          message: `Critical posting failure: ${successRate.toFixed(1)}% success rate`,
          details: matrix.summary,
          actions: ['Immediate investigation required', 'Check all posting workflows', 'Verify cron schedules']
        })
      }
    } else {
      checks.push({
        check: 'today_posting_performance',
        status: 'fail',
        message: 'No posting matrix data available',
        actions: ['Run today-posting-matrix.ts to analyze posting status']
      })
    }

    // Check 2: Workflow run reliability
    if (data.runs) {
      const totalRuns = data.runs.reduce((sum: number, s: any) => sum + s.summary.total, 0)
      const totalSuccess = data.runs.reduce((sum: number, s: any) => sum + s.summary.success, 0)
      const successRate = totalRuns > 0 ? (totalSuccess / totalRuns) * 100 : 0

      if (successRate >= 90) {
        checks.push({
          check: 'workflow_reliability',
          status: 'pass',
          message: `Workflow success rate: ${successRate.toFixed(1)}%`,
          details: { totalRuns, totalSuccess }
        })
      } else if (successRate >= 70) {
        checks.push({
          check: 'workflow_reliability', 
          status: 'warn',
          message: `Workflow success rate needs attention: ${successRate.toFixed(1)}%`,
          details: { totalRuns, totalSuccess },
          actions: ['Review recent failures', 'Check for pattern in failing workflows']
        })
      } else {
        checks.push({
          check: 'workflow_reliability',
          status: 'fail',
          message: `Poor workflow reliability: ${successRate.toFixed(1)}%`,
          details: { totalRuns, totalSuccess },
          actions: ['Critical: investigate widespread failures', 'Check GitHub Actions status', 'Review recent changes']
        })
      }
    }

    // Check 3: Cron schedule health
    if (data.cron_analysis) {
      const analysis = data.cron_analysis
      
      if (analysis.analysis.thundering_herd_risk) {
        checks.push({
          check: 'cron_schedule_health',
          status: 'warn',
          message: 'Thundering herd risk detected in cron schedules',
          details: analysis.collisions,
          actions: ['Stagger conflicting workflows by 1-2 minutes', 'Review high-collision time slots']
        })
      } else {
        checks.push({
          check: 'cron_schedule_health',
          status: 'pass',
          message: 'Cron schedules appear well-distributed',
          details: { collisions: analysis.collisions.length }
        })
      }
    }

    // Check 4: Posting logs and markers
    if (data.posting_logs_analysis) {
      const logs = data.posting_logs_analysis
      
      if (logs.source_of_truth_violations > 0) {
        checks.push({
          check: 'source_of_truth_compliance',
          status: 'fail',
          message: `Source of truth violations detected: ${logs.source_of_truth_violations}`,
          details: logs,
          actions: ['Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true in all posting workflows', 'Review posting logic']
        })
      } else {
        checks.push({
          check: 'source_of_truth_compliance',
          status: 'pass',
          message: 'No source of truth violations detected',
          details: { violations: 0 }
        })
      }

      if (logs.posting_attempts === 0) {
        checks.push({
          check: 'posting_activity',
          status: 'fail',
          message: 'No posting attempts detected in recent workflow runs',
          actions: ['Check if posting workflows are executing', 'Verify content is scheduled', 'Review workflow triggers']
        })
      } else {
        const postingSuccessRate = (logs.successful_posts / logs.posting_attempts) * 100
        if (postingSuccessRate >= 80) {
          checks.push({
            check: 'posting_activity',
            status: 'pass',
            message: `Posting activity healthy: ${postingSuccessRate.toFixed(1)}% success rate`,
            details: logs
          })
        } else {
          checks.push({
            check: 'posting_activity',
            status: 'warn',
            message: `Posting success rate concerning: ${postingSuccessRate.toFixed(1)}%`,
            details: logs,
            actions: ['Review posting workflow logs', 'Check for API failures', 'Verify content availability']
          })
        }
      }
    }

    // Check 5: Empty slots analysis
    if (data.TODAY_posting_matrix) {
      const emptySlots = data.TODAY_posting_matrix.summary.empty_slots
      const totalSlots = data.TODAY_posting_matrix.summary.total_slots

      if (emptySlots >= totalSlots * 0.5) {
        checks.push({
          check: 'content_availability',
          status: 'fail',
          message: `Too many empty slots: ${emptySlots}/${totalSlots}`,
          actions: ['Run content scanning workflows', 'Check content approval process', 'Verify scheduling system']
        })
      } else if (emptySlots > 0) {
        checks.push({
          check: 'content_availability',
          status: 'warn',
          message: `Some empty slots detected: ${emptySlots}/${totalSlots}`,
          actions: ['Monitor content pipeline', 'Consider increasing scan frequency']
        })
      } else {
        checks.push({
          check: 'content_availability',
          status: 'pass',
          message: 'All posting slots have content scheduled'
        })
      }
    }

    return checks
  }

  private determineOverallStatus(healthChecks: HealthCheckResult[]): WorkflowHealthReport['overall_status'] {
    const criticalIssues = healthChecks.filter(h => h.status === 'fail').length
    const warnings = healthChecks.filter(h => h.status === 'warn').length

    if (criticalIssues > 0) return 'critical'
    if (warnings >= 3) return 'degraded'
    return 'healthy'
  }

  private generateExecutiveSummary(data: any, healthChecks: HealthCheckResult[]): WorkflowHealthReport['executive_summary'] {
    const postingCheck = healthChecks.find(h => h.check === 'today_posting_performance')
    const workflowCheck = healthChecks.find(h => h.check === 'workflow_reliability')
    
    const postingSuccessRate = postingCheck?.details ? 
      `${((postingCheck.details.successful_posts / postingCheck.details.total_slots) * 100).toFixed(1)}%` : 'Unknown'
    
    const workflowsHealthy = data.runs ? 
      data.runs.filter((w: any) => w.summary.success === w.summary.total && w.summary.total > 0).length : 0
    const workflowsTotal = data.runs ? data.runs.length : 0

    // Determine root cause
    let rootCause = 'System operating normally'
    const criticalChecks = healthChecks.filter(h => h.status === 'fail')
    
    if (criticalChecks.length > 0) {
      const criticalMessages = criticalChecks.map(c => c.message)
      if (criticalMessages.some(m => m.includes('posting'))) {
        rootCause = 'Posting pipeline failures detected'
      } else if (criticalMessages.some(m => m.includes('workflow'))) {
        rootCause = 'Widespread workflow reliability issues'
      } else if (criticalMessages.some(m => m.includes('source of truth'))) {
        rootCause = 'Source of truth enforcement not properly configured'
      } else {
        rootCause = 'Multiple system components failing'
      }
    }

    // Generate immediate actions
    const immediateActions: string[] = []
    criticalChecks.forEach(check => {
      if (check.actions) {
        immediateActions.push(...check.actions.slice(0, 2)) // Top 2 actions per critical issue
      }
    })

    return {
      posting_success_rate: postingSuccessRate,
      workflows_healthy: workflowsHealthy,
      workflows_total: workflowsTotal,
      root_cause: rootCause,
      immediate_actions: immediateActions.slice(0, 5) // Top 5 immediate actions
    }
  }

  private generateDetailedAnalysis(data: any): WorkflowHealthReport['detailed_analysis'] {
    const postingPipeline = this.analyzePostingPipeline(data)
    const workflowReliability = this.analyzeWorkflowReliability(data)
    const sourceOfTruthCompliance = this.analyzeSourceOfTruthCompliance(data)

    return {
      posting_pipeline: postingPipeline,
      workflow_reliability: workflowReliability,
      source_of_truth_compliance: sourceOfTruthCompliance
    }
  }

  private analyzePostingPipeline(data: any): WorkflowHealthReport['detailed_analysis']['posting_pipeline'] {
    const matrix = data.TODAY_posting_matrix
    if (!matrix) {
      return {
        status: 'critical',
        today_posts_expected: 0,
        today_posts_actual: 0,
        empty_slots: 0,
        failed_slots: 0,
        issues: ['No posting matrix data available']
      }
    }

    const summary = matrix.summary
    const successRate = summary.total_slots > 0 ? 
      (summary.successful_posts / summary.total_slots) * 100 : 0

    let status: 'healthy' | 'degraded' | 'critical'
    if (successRate >= 80) status = 'healthy'
    else if (successRate >= 50) status = 'degraded'
    else status = 'critical'

    const issues: string[] = []
    if (summary.workflow_failures > 0) {
      issues.push(`${summary.workflow_failures} workflow execution failures`)
    }
    if (summary.empty_slots > 0) {
      issues.push(`${summary.empty_slots} slots with no scheduled content`)
    }
    if (summary.failed_posts > 0) {
      issues.push(`${summary.failed_posts} posting attempts failed`)
    }

    return {
      status,
      today_posts_expected: summary.total_slots,
      today_posts_actual: summary.successful_posts,
      empty_slots: summary.empty_slots,
      failed_slots: summary.failed_posts,
      issues
    }
  }

  private analyzeWorkflowReliability(data: any): WorkflowHealthReport['detailed_analysis']['workflow_reliability'] {
    if (!data.runs || !data.cron_analysis) {
      return {
        total_workflows: 0,
        scheduled_workflows: 0,
        success_rate_overall: '0%',
        cron_collisions: 0,
        recent_failures: 0
      }
    }

    const totalRuns = data.runs.reduce((sum: number, s: any) => sum + s.summary.total, 0)
    const totalSuccess = data.runs.reduce((sum: number, s: any) => sum + s.summary.success, 0)
    const successRate = totalRuns > 0 ? ((totalSuccess / totalRuns) * 100).toFixed(1) + '%' : '0%'

    const recentFailures = data.runs.reduce((sum: number, w: any) => {
      return sum + w.runs.filter((r: any) => r.conclusion === 'failure').length
    }, 0)

    return {
      total_workflows: data.runs.length,
      scheduled_workflows: data.cron_analysis.total_scheduled_workflows,
      success_rate_overall: successRate,
      cron_collisions: data.cron_analysis.collisions.length,
      recent_failures: recentFailures
    }
  }

  private analyzeSourceOfTruthCompliance(data: any): WorkflowHealthReport['detailed_analysis']['source_of_truth_compliance'] {
    const logs = data.posting_logs_analysis
    if (!logs) {
      return {
        violations_detected: 0,
        enforcement_enabled: false,
        recommendations: ['Run posting logs analysis to check compliance']
      }
    }

    const recommendations: string[] = []
    if (logs.source_of_truth_violations > 0) {
      recommendations.push('Enable ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true in all posting workflows')
      recommendations.push('Review posting logic to ensure it respects scheduled_posts table')
    }
    if (logs.posting_attempts === 0) {
      recommendations.push('Verify posting workflows are executing and generating log markers')
    }

    return {
      violations_detected: logs.source_of_truth_violations || 0,
      enforcement_enabled: logs.source_of_truth_violations === 0,
      recommendations
    }
  }

  private generateNextSteps(healthChecks: HealthCheckResult[], data: any): WorkflowHealthReport['next_steps'] {
    const immediate: string[] = []
    const shortTerm: string[] = []
    const monitoring: string[] = []

    // Collect all actions from health checks
    healthChecks.forEach(check => {
      if (check.status === 'fail' && check.actions) {
        immediate.push(...check.actions)
      } else if (check.status === 'warn' && check.actions) {
        shortTerm.push(...check.actions)
      }
    })

    // Add standard monitoring recommendations
    monitoring.push('Monitor posting success rate daily')
    monitoring.push('Review workflow failure alerts')
    monitoring.push('Check cron schedule performance weekly')
    monitoring.push('Validate source of truth compliance')

    // Add specific monitoring based on detected issues
    if (data.cron_analysis?.collisions?.length > 0) {
      monitoring.push('Monitor for cron collision impacts during peak hours')
    }
    if (data.TODAY_posting_matrix?.summary?.empty_slots > 0) {
      monitoring.push('Monitor content pipeline to prevent empty slots')
    }

    return {
      immediate: Array.from(new Set(immediate)).slice(0, 8), // Dedupe and limit
      short_term: Array.from(new Set(shortTerm)).slice(0, 6),
      monitoring: Array.from(new Set(monitoring)).slice(0, 8)
    }
  }

  private async saveReport(report: WorkflowHealthReport): Promise<void> {
    // Save JSON report
    const jsonPath = path.join(this.outputDir, 'WORKFLOW_HEALTH_REPORT.json')
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2))
    console.log(`💾 Saved health report to ${jsonPath}`)

    // Generate markdown report
    await this.generateMarkdownReport(report)
  }

  private async generateMarkdownReport(report: WorkflowHealthReport): Promise<void> {
    const markdownPath = path.join(this.outputDir, 'WORKFLOW_HEALTH_REPORT.md')
    
    let content = `# GitHub Actions Workflow Health Report

**Generated**: ${report.generated_at}  
**Analysis Date**: ${report.analysis_date_et} (Eastern Time)  
**Overall Status**: ${this.getStatusIcon(report.overall_status)} **${report.overall_status.toUpperCase()}**

---

## 🎯 Executive Summary

`

    const summary = report.executive_summary
    const statusColor = report.overall_status === 'healthy' ? '✅' : 
                       report.overall_status === 'degraded' ? '⚠️' : '❌'
    
    content += `${statusColor} **Root Cause**: ${summary.root_cause}\n\n`
    content += `**Key Metrics**:\n`
    content += `- **Posting Success Rate**: ${summary.posting_success_rate}\n`
    content += `- **Healthy Workflows**: ${summary.workflows_healthy}/${summary.workflows_total}\n`
    content += `- **Critical Issues**: ${report.critical_issues}\n`
    content += `- **Warnings**: ${report.warnings}\n\n`

    if (summary.immediate_actions.length > 0) {
      content += `**🚨 Immediate Actions Required**:\n`
      summary.immediate_actions.forEach(action => {
        content += `1. ${action}\n`
      })
      content += `\n`
    }

    // Health Checks
    content += `## 🔍 Health Checks\n\n`
    content += `| Check | Status | Message | Actions |\n`
    content += `|-------|--------|---------|----------|\n`
    
    report.health_checks.forEach(check => {
      const statusIcon = this.getStatusIcon(check.status)
      const actions = check.actions ? check.actions.join('<br>') : 'None'
      content += `| ${check.check.replace(/_/g, ' ')} | ${statusIcon} ${check.status} | ${check.message} | ${actions} |\n`
    })

    // Detailed Analysis
    content += `\n## 📊 Detailed Analysis\n\n`
    
    content += `### Posting Pipeline\n`
    const posting = report.detailed_analysis.posting_pipeline
    content += `- **Status**: ${this.getStatusIcon(posting.status)} ${posting.status}\n`
    content += `- **Today's Posts**: ${posting.today_posts_actual}/${posting.today_posts_expected} expected\n`
    content += `- **Empty Slots**: ${posting.empty_slots}\n`
    content += `- **Failed Slots**: ${posting.failed_slots}\n`
    if (posting.issues.length > 0) {
      content += `- **Issues**: ${posting.issues.join(', ')}\n`
    }
    content += `\n`

    content += `### Workflow Reliability\n`
    const workflow = report.detailed_analysis.workflow_reliability
    content += `- **Total Workflows**: ${workflow.total_workflows}\n`
    content += `- **Scheduled Workflows**: ${workflow.scheduled_workflows}\n`
    content += `- **Overall Success Rate**: ${workflow.success_rate_overall}\n`
    content += `- **Cron Collisions**: ${workflow.cron_collisions}\n`
    content += `- **Recent Failures**: ${workflow.recent_failures}\n\n`

    content += `### Source of Truth Compliance\n`
    const sot = report.detailed_analysis.source_of_truth_compliance
    content += `- **Violations Detected**: ${sot.violations_detected}\n`
    content += `- **Enforcement Enabled**: ${sot.enforcement_enabled ? '✅ Yes' : '❌ No'}\n`
    if (sot.recommendations.length > 0) {
      content += `- **Recommendations**: ${sot.recommendations.join(', ')}\n`
    }

    // Next Steps
    content += `\n## 🎯 Next Steps\n\n`
    
    if (report.next_steps.immediate.length > 0) {
      content += `### 🚨 Immediate (Next 1-2 hours)\n`
      report.next_steps.immediate.forEach((step, i) => {
        content += `${i + 1}. ${step}\n`
      })
      content += `\n`
    }

    if (report.next_steps.short_term.length > 0) {
      content += `### ⏰ Short Term (Next 1-2 days)\n`
      report.next_steps.short_term.forEach((step, i) => {
        content += `${i + 1}. ${step}\n`
      })
      content += `\n`
    }

    if (report.next_steps.monitoring.length > 0) {
      content += `### 📈 Ongoing Monitoring\n`
      report.next_steps.monitoring.forEach((step, i) => {
        content += `${i + 1}. ${step}\n`
      })
      content += `\n`
    }

    // Footer
    content += `---\n\n`
    content += `**Report generated by CI Audit System**  \n`
    content += `For detailed logs and analysis, see other files in \`ci_audit/actions/\`\n`

    await fs.writeFile(markdownPath, content)
    console.log(`📄 Generated markdown report at ${markdownPath}`)
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pass':
      case 'healthy': return '✅'
      case 'warn':
      case 'degraded': return '⚠️'
      case 'fail':
      case 'critical': return '❌'
      case 'info': return 'ℹ️'
      default: return '⚪'
    }
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('report-workflow-health')
if (isMainModule) {
  const generator = new HealthReportGenerator()
  generator.generateReport().catch(console.error)
}

export { HealthReportGenerator }