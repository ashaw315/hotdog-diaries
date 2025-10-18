#!/usr/bin/env tsx
/**
 * Workflow Refactor Plan Validation Script
 * 
 * Validates that the refactor plan has been correctly implemented:
 * - Verifies all 28 workflows are accounted for
 * - Checks that duplicate schedules have been resolved
 * - Validates that recommended reliability improvements are in place
 * - Ensures workflow files pass GitHub Actions validation
 * 
 * Usage: tsx scripts/validateRefactorPlan.ts
 */

import { readdir, readFile } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'
import chalk from 'chalk'

interface ValidationResult {
  workflow: string
  status: 'pass' | 'fail' | 'warning'
  issues: string[]
  suggestions: string[]
}

interface ValidationSummary {
  totalWorkflows: number
  passCount: number
  failCount: number
  warningCount: number
  duplicateSchedules: string[]
  missingTimeouts: string[]
  missingNotifications: string[]
  overallScore: number
}

class RefactorPlanValidator {
  private workflowsPath: string
  private expectedWorkflows = 28
  private results: ValidationResult[] = []

  constructor() {
    this.workflowsPath = join(process.cwd(), '.github', 'workflows')
  }

  async validate(): Promise<ValidationSummary> {
    console.log(chalk.blue('🔍 Validating Workflow Refactor Plan Implementation'))
    console.log(chalk.blue('=' .repeat(50)))

    // Step 1: Check workflow count and existence
    const workflows = await this.loadWorkflows()
    
    // Step 2: Validate each workflow
    await this.validateWorkflows(workflows)
    
    // Step 3: Check for duplicate schedules
    const duplicateSchedules = this.checkDuplicateSchedules(workflows)
    
    // Step 4: Check reliability improvements
    const reliabilityCheck = this.checkReliabilityImprovements(workflows)
    
    // Step 5: Generate summary
    const summary = this.generateSummary(duplicateSchedules, reliabilityCheck)
    
    // Step 6: Display results
    this.displayResults(summary)
    
    return summary
  }

  private async loadWorkflows(): Promise<any[]> {
    console.log(chalk.cyan('\\n📋 Step 1: Loading and parsing workflows...'))
    
    const workflows: any[] = []
    
    try {
      const files = await readdir(this.workflowsPath)
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      
      console.log(chalk.white(`Found ${yamlFiles.length} workflow files (expected: ${this.expectedWorkflows})`))
      
      for (const filename of yamlFiles) {
        const result: ValidationResult = {
          workflow: filename,
          status: 'pass',
          issues: [],
          suggestions: []
        }
        
        try {
          const content = await readFile(join(this.workflowsPath, filename), 'utf-8')
          const config = parseYaml(content)
          
          workflows.push({ filename, config })
          
          // Basic YAML validation
          if (!config.name) {
            result.issues.push('Missing workflow name')
            result.status = 'warning'
          }
          
          if (!config.on) {
            result.issues.push('Missing trigger configuration')
            result.status = 'fail'
          }
          
          if (!config.jobs || Object.keys(config.jobs).length === 0) {
            result.issues.push('No jobs defined')
            result.status = 'fail'
          }
          
          console.log(chalk.green(`  ✅ ${filename}`))
          
        } catch (error) {
          result.status = 'fail'
          result.issues.push(`Parse error: ${error.message}`)
          console.log(chalk.red(`  ❌ ${filename}: ${error.message}`))
        }
        
        this.results.push(result)
      }
      
      // Check workflow count
      if (yamlFiles.length !== this.expectedWorkflows) {
        console.log(chalk.yellow(`⚠️  Workflow count mismatch: found ${yamlFiles.length}, expected ${this.expectedWorkflows}`))
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to load workflows:'), error)
      throw error
    }
    
    return workflows
  }

  private async validateWorkflows(workflows: any[]): Promise<void> {
    console.log(chalk.cyan('\\n🔍 Step 2: Validating workflow configurations...'))
    
    for (const { filename, config } of workflows) {
      const result = this.results.find(r => r.workflow === filename)!
      
      // Check for recommended naming conventions
      if (filename.includes('scan-') && !filename.startsWith('content-scan-') && !filename.startsWith('scan-')) {
        result.suggestions.push('Consider renaming to follow content-scan-{platform}.yml convention')
      }
      
      if (filename.includes('post-') && !filename.startsWith('content-post-')) {
        result.suggestions.push('Consider renaming to follow content-post-{time}.yml convention')
      }
      
      if (filename.includes('ci-') && filename !== 'ci.yml') {
        result.suggestions.push('Consider clarifying CI purpose (e.g., ci-production.yml)')
      }
      
      // Check job-level validations
      if (config.jobs) {
        Object.entries(config.jobs).forEach(([jobName, job]: [string, any]) => {
          // Check for timeout-minutes
          if (!job['timeout-minutes']) {
            result.issues.push(`Job '${jobName}' missing timeout-minutes`)
            if (result.status === 'pass') result.status = 'warning'
          }
          
          // Check for appropriate timeouts (should be 10-30 minutes)
          if (job['timeout-minutes']) {
            const timeout = job['timeout-minutes']
            if (timeout < 5 || timeout > 60) {
              result.suggestions.push(`Job '${jobName}' timeout (${timeout}min) outside recommended range (5-60min)`)
            }
          }
          
          // Check for continue-on-error where appropriate
          if (job.steps && Array.isArray(job.steps)) {
            job.steps.forEach((step: any, index: number) => {
              if (step.name && step.name.toLowerCase().includes('lint') && !step['continue-on-error']) {
                result.suggestions.push(`Consider adding continue-on-error to lint step in job '${jobName}'`)
              }
            })
          }
        })
      }
      
      console.log(chalk.white(`  Validated ${filename}: ${result.status}`))
    }
  }

  private checkDuplicateSchedules(workflows: any[]): string[] {
    console.log(chalk.cyan('\\n⏰ Step 3: Checking for duplicate schedules...'))
    
    const cronGroups: Record<string, string[]> = {}
    const duplicates: string[] = []
    
    workflows.forEach(({ filename, config }) => {
      if (config.on?.schedule && Array.isArray(config.on.schedule)) {
        config.on.schedule.forEach((schedule: any) => {
          if (schedule.cron) {
            if (!cronGroups[schedule.cron]) cronGroups[schedule.cron] = []
            cronGroups[schedule.cron].push(filename)
          }
        })
      }
    })
    
    Object.entries(cronGroups).forEach(([cron, workflowList]) => {
      if (workflowList.length > 1) {
        duplicates.push(`${cron}: ${workflowList.join(', ')}`)
        console.log(chalk.red(`  ❌ Duplicate schedule: ${cron} used by ${workflowList.join(', ')}`))
      }
    })
    
    if (duplicates.length === 0) {
      console.log(chalk.green('  ✅ No duplicate schedules found'))
    } else {
      console.log(chalk.red(`  ❌ Found ${duplicates.length} duplicate schedules`))
    }
    
    return duplicates
  }

  private checkReliabilityImprovements(workflows: any[]): { missingTimeouts: string[], missingNotifications: string[] } {
    console.log(chalk.cyan('\\n🛡️  Step 4: Checking reliability improvements...'))
    
    const missingTimeouts: string[] = []
    const missingNotifications: string[] = []
    
    workflows.forEach(({ filename, config }) => {
      let hasAnyTimeout = false
      let hasNotifications = false
      
      if (config.jobs) {
        Object.values(config.jobs).forEach((job: any) => {
          if (job['timeout-minutes']) {
            hasAnyTimeout = true
          }
          
          // Check for notification mechanisms
          if (job.steps && Array.isArray(job.steps)) {
            job.steps.forEach((step: any) => {
              const stepStr = JSON.stringify(step).toLowerCase()
              if (stepStr.includes('slack') || stepStr.includes('discord') || stepStr.includes('email')) {
                hasNotifications = true
              }
            })
          }
        })
      }
      
      if (!hasAnyTimeout) {
        missingTimeouts.push(filename)
      }
      
      if (!hasNotifications) {
        missingNotifications.push(filename)
      }
    })
    
    console.log(chalk.white(`  Timeouts: ${workflows.length - missingTimeouts.length}/${workflows.length} workflows have timeout-minutes`))
    console.log(chalk.white(`  Notifications: ${workflows.length - missingNotifications.length}/${workflows.length} workflows have failure notifications`))
    
    return { missingTimeouts, missingNotifications }
  }

  private generateSummary(
    duplicateSchedules: string[], 
    reliabilityCheck: { missingTimeouts: string[], missingNotifications: string[] }
  ): ValidationSummary {
    const passCount = this.results.filter(r => r.status === 'pass').length
    const failCount = this.results.filter(r => r.status === 'fail').length
    const warningCount = this.results.filter(r => r.status === 'warning').length
    
    // Calculate overall score (0-100)
    let score = 100
    score -= (failCount / this.results.length) * 30  // Failed workflows
    score -= (warningCount / this.results.length) * 15  // Warning workflows
    score -= (duplicateSchedules.length / 10) * 20  // Duplicate schedules
    score -= (reliabilityCheck.missingTimeouts.length / this.results.length) * 20  // Missing timeouts
    score -= (reliabilityCheck.missingNotifications.length / this.results.length) * 10  // Missing notifications
    
    return {
      totalWorkflows: this.results.length,
      passCount,
      failCount,
      warningCount,
      duplicateSchedules,
      missingTimeouts: reliabilityCheck.missingTimeouts,
      missingNotifications: reliabilityCheck.missingNotifications,
      overallScore: Math.max(0, Math.round(score))
    }
  }

  private displayResults(summary: ValidationSummary): void {
    console.log(chalk.blue('\\n📊 Validation Results Summary'))
    console.log(chalk.blue('=' .repeat(30)))
    
    console.log(chalk.white(`Total Workflows: ${summary.totalWorkflows} (expected: ${this.expectedWorkflows})`))
    console.log(chalk.green(`✅ Passed: ${summary.passCount}`))
    console.log(chalk.yellow(`⚠️  Warnings: ${summary.warningCount}`))
    console.log(chalk.red(`❌ Failed: ${summary.failCount}`))
    
    console.log(chalk.blue('\\n🔧 Refactor Plan Implementation:'))
    console.log(chalk.white(`Duplicate Schedules: ${summary.duplicateSchedules.length} remaining`))
    console.log(chalk.white(`Missing Timeouts: ${summary.missingTimeouts.length} workflows`))
    console.log(chalk.white(`Missing Notifications: ${summary.missingNotifications.length} workflows`))
    
    console.log(chalk.blue(`\\n🏥 Overall Health Score: ${summary.overallScore}/100`))
    
    if (summary.overallScore >= 90) {
      console.log(chalk.green('🎉 Excellent! Refactor plan is well implemented'))
    } else if (summary.overallScore >= 75) {
      console.log(chalk.yellow('👍 Good progress, minor issues to address'))
    } else if (summary.overallScore >= 60) {
      console.log(chalk.yellow('⚠️  Needs attention, several issues remain'))
    } else {
      console.log(chalk.red('❌ Poor implementation, major issues need fixing'))
    }
    
    // Show detailed issues
    const failedWorkflows = this.results.filter(r => r.status === 'fail')
    const warningWorkflows = this.results.filter(r => r.status === 'warning')
    
    if (failedWorkflows.length > 0) {
      console.log(chalk.red('\\n❌ Failed Workflows:'))
      failedWorkflows.forEach(result => {
        console.log(chalk.red(`  ${result.workflow}:`))
        result.issues.forEach(issue => console.log(chalk.red(`    - ${issue}`)))
      })
    }
    
    if (warningWorkflows.length > 0) {
      console.log(chalk.yellow('\\n⚠️  Workflows with Warnings:'))
      warningWorkflows.forEach(result => {
        console.log(chalk.yellow(`  ${result.workflow}:`))
        result.issues.forEach(issue => console.log(chalk.yellow(`    - ${issue}`)))
      })
    }
    
    // Show next steps
    console.log(chalk.blue('\\n📋 Next Steps:'))
    if (summary.duplicateSchedules.length > 0) {
      console.log(chalk.white('  1. Resolve duplicate schedules using stagger recommendations'))
    }
    if (summary.missingTimeouts.length > 0) {
      console.log(chalk.white('  2. Add timeout-minutes to all workflow jobs'))
    }
    if (summary.missingNotifications.length > 0) {
      console.log(chalk.white('  3. Implement failure notification system'))
    }
    if (summary.failCount > 0) {
      console.log(chalk.white('  4. Fix workflow parsing and configuration errors'))
    }
    
    console.log(chalk.blue('\\n💡 Run this validator again after implementing fixes'))
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const validator = new RefactorPlanValidator()
    const summary = await validator.validate()
    
    // Exit with appropriate code
    if (summary.failCount > 0 || summary.overallScore < 75) {
      console.log(chalk.red('\\n❌ Validation failed - issues need to be addressed'))
      process.exit(1)
    } else {
      console.log(chalk.green('\\n✅ Validation passed - refactor plan is well implemented'))
      process.exit(0)
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Validation failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { RefactorPlanValidator }