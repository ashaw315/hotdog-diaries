#!/usr/bin/env tsx

/**
 * CI Audit: Orchestrator
 * 
 * Runs all CI audit components in sequence and generates a comprehensive
 * GitHub Actions health report. This is the main entry point for the audit system.
 */

import fs from 'fs/promises'
import path from 'path'
import { WorkflowScanner } from './scan-workflows'
import { RunsFetcher } from './fetch-runs'
import { PostingLogsExtractor } from './fetch-posting-logs'
import { CronAnalyzer } from './analyze-crons'
import { TodayPostingMatrixGenerator } from './today-posting-matrix'
import { HealthReportGenerator } from './report-workflow-health'

interface AuditResult {
  success: boolean
  execution_time_ms: number
  components_completed: string[]
  components_failed: string[]
  output_files: string[]
  summary: {
    workflows_found: number
    runs_analyzed: number
    posting_attempts: number
    posting_success_rate: string
    overall_health: 'healthy' | 'degraded' | 'critical'
    critical_issues: number
  }
}

class ActionsAuditor {
  private outputDir: string
  private startTime: number

  constructor() {
    this.outputDir = 'ci_audit/actions'
    this.startTime = Date.now()
  }

  async runFullAudit(): Promise<AuditResult> {
    console.log('🚀 Starting comprehensive GitHub Actions audit...')
    console.log(`📅 Timestamp: ${new Date().toISOString()}`)
    console.log('=' * 60)
    
    const result: AuditResult = {
      success: false,
      execution_time_ms: 0,
      components_completed: [],
      components_failed: [],
      output_files: [],
      summary: {
        workflows_found: 0,
        runs_analyzed: 0,
        posting_attempts: 0,
        posting_success_rate: '0%',
        overall_health: 'critical',
        critical_issues: 0
      }
    }

    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true })
      console.log(`📁 Output directory: ${this.outputDir}`)

      // Component 1: Scan workflows
      await this.runComponent('Workflow Scanner', async () => {
        const scanner = new WorkflowScanner()
        const workflows = await scanner.scan()
        result.summary.workflows_found = workflows.length
        result.components_completed.push('scan-workflows')
        return workflows
      })

      // Component 2: Fetch workflow runs
      await this.runComponent('Runs Fetcher', async () => {
        const fetcher = new RunsFetcher()
        const runs = await fetcher.fetchAllRuns()
        result.summary.runs_analyzed = runs.reduce((sum, r) => sum + r.summary.total, 0)
        result.components_completed.push('fetch-runs')
        return runs
      })

      // Component 3: Analyze cron schedules (independent of runs)
      await this.runComponent('Cron Analyzer', async () => {
        const analyzer = new CronAnalyzer()
        const analysis = await analyzer.analyzeCrons()
        result.components_completed.push('analyze-crons')
        return analysis
      })

      // Component 4: Extract posting logs (depends on runs)
      await this.runComponent('Posting Logs Extractor', async () => {
        const extractor = new PostingLogsExtractor()
        const logs = await extractor.extractLogs()
        result.summary.posting_attempts = logs.posting_attempts
        result.summary.posting_success_rate = logs.posting_attempts > 0 
          ? `${((logs.successful_posts / logs.posting_attempts) * 100).toFixed(1)}%`
          : '0%'
        result.components_completed.push('fetch-posting-logs')
        return logs
      })

      // Component 5: Generate today's posting matrix (depends on runs)
      await this.runComponent('Today Posting Matrix Generator', async () => {
        const generator = new TodayPostingMatrixGenerator()
        const matrix = await generator.generateMatrix()
        result.components_completed.push('today-posting-matrix')
        return matrix
      })

      // Component 6: Generate health report (depends on all previous)
      const healthReport = await this.runComponent('Health Report Generator', async () => {
        const generator = new HealthReportGenerator()
        const report = await generator.generateReport()
        result.summary.overall_health = report.overall_status
        result.summary.critical_issues = report.critical_issues
        result.components_completed.push('report-workflow-health')
        return report
      })

      // Collect output files
      result.output_files = await this.collectOutputFiles()

      result.success = true
      console.log('\n' + '=' * 60)
      console.log('✅ CI Audit completed successfully!')
      
    } catch (error) {
      console.error('\n' + '=' * 60)
      console.error('❌ CI Audit failed:', error)
      result.success = false
    } finally {
      result.execution_time_ms = Date.now() - this.startTime
      await this.generateExecutionSummary(result)
    }

    return result
  }

  private async runComponent<T>(name: string, fn: () => Promise<T>): Promise<T> {
    console.log(`\n🔄 Running: ${name}`)
    console.log('-' * 40)
    
    const componentStart = Date.now()
    
    try {
      const result = await fn()
      const duration = Date.now() - componentStart
      console.log(`✅ ${name} completed in ${duration}ms`)
      return result
    } catch (error) {
      const duration = Date.now() - componentStart
      console.error(`❌ ${name} failed after ${duration}ms:`, error)
      throw error
    }
  }

  private async collectOutputFiles(): Promise<string[]> {
    const files: string[] = []
    
    try {
      const dirContents = await fs.readdir(this.outputDir)
      
      for (const file of dirContents) {
        const filePath = path.join(this.outputDir, file)
        const stat = await fs.stat(filePath)
        
        if (stat.isFile()) {
          files.push(file)
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Could not collect output files:', error)
    }
    
    return files.sort()
  }

  private async generateExecutionSummary(result: AuditResult): Promise<void> {
    const summaryPath = path.join(this.outputDir, 'audit-execution-summary.json')
    
    const summary = {
      ...result,
      execution_timestamp: new Date().toISOString(),
      execution_duration_human: this.formatDuration(result.execution_time_ms),
      component_status: {
        completed: result.components_completed.length,
        failed: result.components_failed.length,
        total: result.components_completed.length + result.components_failed.length
      }
    }
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2))
    console.log(`\n📊 Execution summary saved to: ${summaryPath}`)
    
    // Display final summary
    this.displayFinalSummary(result)
  }

  private displayFinalSummary(result: AuditResult): void {
    console.log('\n📋 AUDIT SUMMARY')
    console.log('=' * 60)
    console.log(`✅ Success: ${result.success ? 'YES' : 'NO'}`)
    console.log(`⏱️  Duration: ${this.formatDuration(result.execution_time_ms)}`)
    console.log(`🔧 Components: ${result.components_completed.length} completed, ${result.components_failed.length} failed`)
    console.log(`📁 Output files: ${result.output_files.length}`)
    console.log('')
    
    console.log('🎯 KEY FINDINGS:')
    console.log(`   Workflows found: ${result.summary.workflows_found}`)
    console.log(`   Runs analyzed: ${result.summary.runs_analyzed}`)
    console.log(`   Posting success rate: ${result.summary.posting_success_rate}`)
    console.log(`   Overall health: ${this.getHealthIcon(result.summary.overall_health)} ${result.summary.overall_health.toUpperCase()}`)
    console.log(`   Critical issues: ${result.summary.critical_issues}`)
    console.log('')
    
    if (result.output_files.length > 0) {
      console.log('📄 GENERATED REPORTS:')
      const importantFiles = [
        'WORKFLOW_HEALTH_REPORT.md',
        'TODAY-posting-matrix.md', 
        'runs-summary.md',
        'cron-collisions.md',
        'posting-logs-report.md'
      ]
      
      importantFiles.forEach(file => {
        if (result.output_files.includes(file)) {
          console.log(`   ✅ ${file}`)
        }
      })
      
      const otherFiles = result.output_files.filter(f => !importantFiles.includes(f))
      if (otherFiles.length > 0) {
        console.log(`   📎 +${otherFiles.length} additional data files`)
      }
    }
    
    console.log('')
    console.log('🔍 MAIN REPORT:')
    console.log(`   📋 ci_audit/actions/WORKFLOW_HEALTH_REPORT.md`)
    console.log('')
    
    if (result.summary.critical_issues > 0) {
      console.log('🚨 CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED')
      console.log('   Review WORKFLOW_HEALTH_REPORT.md for specific fixes')
    } else if (result.summary.overall_health === 'degraded') {
      console.log('⚠️  SYSTEM DEGRADED - ATTENTION NEEDED')
      console.log('   Review WORKFLOW_HEALTH_REPORT.md for recommendations')
    } else {
      console.log('✅ SYSTEM HEALTHY - NO IMMEDIATE ACTION REQUIRED')
    }
    
    console.log('=' * 60)
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  private getHealthIcon(health: string): string {
    switch (health) {
      case 'healthy': return '✅'
      case 'degraded': return '⚠️'
      case 'critical': return '❌'
      default: return '⚪'
    }
  }

  // Helper method for manual component testing
  async runSingleComponent(componentName: string): Promise<void> {
    console.log(`🧪 Running single component: ${componentName}`)
    
    await fs.mkdir(this.outputDir, { recursive: true })
    
    switch (componentName) {
      case 'scan-workflows':
        await this.runComponent('Workflow Scanner', async () => {
          const scanner = new WorkflowScanner()
          return await scanner.scan()
        })
        break
        
      case 'fetch-runs':
        await this.runComponent('Runs Fetcher', async () => {
          const fetcher = new RunsFetcher()
          return await fetcher.fetchAllRuns()
        })
        break
        
      case 'analyze-crons':
        await this.runComponent('Cron Analyzer', async () => {
          const analyzer = new CronAnalyzer()
          return await analyzer.analyzeCrons()
        })
        break
        
      case 'fetch-posting-logs':
        await this.runComponent('Posting Logs Extractor', async () => {
          const extractor = new PostingLogsExtractor()
          return await extractor.extractLogs()
        })
        break
        
      case 'today-posting-matrix':
        await this.runComponent('Today Posting Matrix Generator', async () => {
          const generator = new TodayPostingMatrixGenerator()
          return await generator.generateMatrix()
        })
        break
        
      case 'report-workflow-health':
        await this.runComponent('Health Report Generator', async () => {
          const generator = new HealthReportGenerator()
          return await generator.generateReport()
        })
        break
        
      default:
        throw new Error(`Unknown component: ${componentName}`)
    }
    
    console.log(`✅ Component ${componentName} completed`)
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('run-actions-audit')
if (isMainModule) {
  const auditor = new ActionsAuditor()
  
  // Check for component-specific execution
  const componentArg = process.argv.find(arg => arg.startsWith('--component='))
  
  if (componentArg) {
    const componentName = componentArg.split('=')[1]
    auditor.runSingleComponent(componentName).catch(console.error)
  } else {
    auditor.runFullAudit()
      .then(result => {
        console.log('\n🎉 Actions audit complete; see ci_audit/actions/WORKFLOW_HEALTH_REPORT.md')
        process.exit(result.success ? 0 : 1)
      })
      .catch(error => {
        console.error('💥 Audit orchestrator failed:', error)
        process.exit(1)
      })
  }
}

export { ActionsAuditor }