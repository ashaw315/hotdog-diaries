#!/usr/bin/env tsx

/**
 * CI Audit: Workflow Scanner
 * 
 * Discovers all GitHub Actions workflows, parses YAML, and extracts metadata
 * including triggers, timeouts, concurrency, and permissions.
 */

import fs from 'fs/promises'
import path from 'path'
import yaml from 'yaml'

interface WorkflowTrigger {
  schedule?: { cron: string }[]
  workflow_dispatch?: any
  push?: { branches?: string[] }
  workflow_call?: any
  workflow_run?: { workflows: string[], types?: string[] }
  deployment_status?: any
}

interface WorkflowJob {
  name?: string
  'runs-on': string
  'timeout-minutes'?: number
  if?: string
  needs?: string | string[]
  steps: Array<{
    name?: string
    uses?: string
    run?: string
    if?: string
  }>
}

interface WorkflowMetadata {
  filename: string
  name: string
  on: WorkflowTrigger
  concurrency?: {
    group: string
    'cancel-in-progress'?: boolean
  }
  permissions?: Record<string, string>
  env?: Record<string, string>
  jobs: Record<string, WorkflowJob>
  intent: string // Human-readable purpose
  category: 'posting' | 'scanning' | 'deploy' | 'maintenance' | 'test' | 'monitor'
}

class WorkflowScanner {
  private workflowsDir: string
  private outputDir: string

  constructor() {
    this.workflowsDir = '.github/workflows'
    this.outputDir = 'ci_audit/actions'
  }

  async scan(): Promise<WorkflowMetadata[]> {
    console.log('🔍 Scanning GitHub Actions workflows...')
    
    const workflows: WorkflowMetadata[] = []
    
    try {
      const files = await fs.readdir(this.workflowsDir)
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      
      console.log(`📂 Found ${yamlFiles.length} workflow files`)
      
      for (const file of yamlFiles) {
        try {
          const workflow = await this.parseWorkflow(file)
          workflows.push(workflow)
          console.log(`  ✅ Parsed: ${workflow.name} (${workflow.category})`)
        } catch (error) {
          console.error(`  ❌ Failed to parse ${file}:`, error.message)
          // Skip failed files but continue processing others
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to read workflows directory:`, error)
    }
    
    await this.saveResults(workflows)
    await this.generateOverview(workflows)
    
    return workflows
  }

  private async parseWorkflow(filename: string): Promise<WorkflowMetadata> {
    const filePath = path.join(this.workflowsDir, filename)
    const content = await fs.readFile(filePath, 'utf8')
    const parsed = yaml.parse(content)
    
    return {
      filename,
      name: parsed.name || filename.replace(/\.(yml|yaml)$/, ''),
      on: parsed.on || {},
      concurrency: parsed.concurrency,
      permissions: parsed.permissions,
      env: parsed.env,
      jobs: parsed.jobs || {},
      intent: this.inferIntent(parsed, filename),
      category: this.categorizeWorkflow(parsed, filename)
    }
  }

  private inferIntent(workflow: any, filename: string): string {
    const name = (workflow.name || '').toLowerCase()
    const file = filename.toLowerCase()
    
    // Posting workflows
    if (name.includes('post-') || file.includes('post-')) {
      if (name.includes('breakfast')) return 'Posts scheduled content at 08:00 ET (breakfast slot)'
      if (name.includes('lunch')) return 'Posts scheduled content at 12:00 ET (lunch slot)'
      if (name.includes('snack')) return 'Posts scheduled content at 15:00 ET (snack slot)'
      if (name.includes('dinner')) return 'Posts scheduled content at 18:00 ET (dinner slot)'
      if (name.includes('evening')) return 'Posts scheduled content at 21:00 ET (evening slot)'
      if (name.includes('late')) return 'Posts scheduled content at 23:30 ET (late night slot)'
      return 'Posts scheduled content at configured time'
    }
    
    // Scheduling workflows
    if (name.includes('schedule') || name.includes('materializer')) {
      return 'Creates scheduled_posts rows for upcoming posting slots'
    }
    
    // Scanning workflows
    if (name.includes('scan') || name.includes('content')) {
      if (name.includes('reddit')) return 'Scans Reddit for hotdog content'
      if (name.includes('youtube')) return 'Scans YouTube for hotdog content'
      if (name.includes('giphy')) return 'Scans Giphy for hotdog GIFs'
      if (name.includes('imgur')) return 'Scans Imgur for hotdog images'
      if (name.includes('bluesky')) return 'Scans Bluesky for hotdog content'
      return 'Scans social media platforms for hotdog-related content'
    }
    
    // Deployment
    if (name.includes('deploy') || name.includes('gate')) {
      return 'Validates deployment health and security gates'
    }
    
    // Testing
    if (name.includes('test') || name.includes('ci')) {
      return 'Runs automated tests and builds'
    }
    
    // Monitoring
    if (name.includes('health') || name.includes('monitor')) {
      return 'Monitors system health and performance'
    }
    
    // Maintenance
    if (name.includes('cleanup') || name.includes('backup')) {
      return 'Performs maintenance and cleanup tasks'
    }
    
    return 'General workflow (purpose unclear from name)'
  }

  private categorizeWorkflow(workflow: any, filename: string): WorkflowMetadata['category'] {
    const name = (workflow.name || '').toLowerCase()
    const file = filename.toLowerCase()
    
    if (name.includes('post-') || file.includes('post-')) return 'posting'
    if (name.includes('scan') || name.includes('content')) return 'scanning'
    if (name.includes('deploy') || name.includes('gate')) return 'deploy'
    if (name.includes('test') || name.includes('ci')) return 'test'
    if (name.includes('health') || name.includes('monitor')) return 'monitor'
    
    return 'maintenance'
  }

  private async saveResults(workflows: WorkflowMetadata[]): Promise<void> {
    const outputPath = path.join(this.outputDir, 'workflows.json')
    await fs.writeFile(outputPath, JSON.stringify(workflows, null, 2))
    console.log(`💾 Saved workflow metadata to ${outputPath}`)
  }

  private async generateOverview(workflows: WorkflowMetadata[]): Promise<void> {
    const overviewPath = path.join(this.outputDir, 'overview.md')
    
    let content = `# GitHub Actions Workflows Overview

Generated: ${new Date().toISOString()}
Total workflows: ${workflows.length}

## By Category

`

    // Group by category
    const byCategory = workflows.reduce((acc, w) => {
      if (!acc[w.category]) acc[w.category] = []
      acc[w.category].push(w)
      return acc
    }, {} as Record<string, WorkflowMetadata[]>)

    for (const [category, categoryWorkflows] of Object.entries(byCategory)) {
      content += `### ${category.charAt(0).toUpperCase() + category.slice(1)} (${categoryWorkflows.length})\n\n`
      content += `| Workflow | Triggers | Intent |\n`
      content += `|----------|----------|--------|\n`
      
      for (const workflow of categoryWorkflows) {
        const triggers = this.summarizeTriggers(workflow.on)
        const workflowLink = `[${workflow.name}](https://github.com/ashaw315/hotdog-diaries/actions/workflows/${workflow.filename})`
        content += `| ${workflowLink} | ${triggers} | ${workflow.intent} |\n`
      }
      content += '\n'
    }

    // Scheduling analysis
    const scheduledWorkflows = workflows.filter(w => w.on.schedule)
    if (scheduledWorkflows.length > 0) {
      content += `## Scheduled Workflows\n\n`
      content += `| Workflow | Cron | Next Run (approx) |\n`
      content += `|----------|------|------------------|\n`
      
      for (const workflow of scheduledWorkflows) {
        if (workflow.on.schedule) {
          for (const schedule of workflow.on.schedule) {
            const nextRun = this.estimateNextRun(schedule.cron)
            content += `| ${workflow.name} | \`${schedule.cron}\` | ${nextRun} |\n`
          }
        }
      }
      content += '\n'
    }

    // Configuration concerns
    content += `## Configuration Analysis\n\n`
    
    const concerns: string[] = []
    
    workflows.forEach(w => {
      // Check for missing timeouts
      const jobsWithoutTimeout = Object.entries(w.jobs).filter(([_, job]) => !job['timeout-minutes'])
      if (jobsWithoutTimeout.length > 0) {
        concerns.push(`⚠️ **${w.name}**: ${jobsWithoutTimeout.length} jobs without timeout-minutes`)
      }
      
      // Check for overly broad permissions
      if (w.permissions && Object.values(w.permissions).includes('write')) {
        concerns.push(`🔒 **${w.name}**: Has write permissions - review necessity`)
      }
      
      // Check for potential cron collisions
      if (w.on.schedule) {
        w.on.schedule.forEach(s => {
          const [minute] = s.cron.split(' ')
          if (minute === '*') {
            concerns.push(`⏰ **${w.name}**: Runs every minute - potential resource waste`)
          }
        })
      }
    })

    if (concerns.length > 0) {
      content += concerns.join('\n') + '\n\n'
    } else {
      content += `✅ No configuration concerns detected\n\n`
    }

    await fs.writeFile(overviewPath, content)
    console.log(`📄 Generated overview at ${overviewPath}`)
  }

  private summarizeTriggers(triggers: WorkflowTrigger): string {
    const parts: string[] = []
    
    if (triggers.schedule) {
      parts.push(`cron (${triggers.schedule.length})`)
    }
    if (triggers.workflow_dispatch) {
      parts.push('manual')
    }
    if (triggers.push) {
      parts.push('push')
    }
    if (triggers.workflow_call) {
      parts.push('reusable')
    }
    if (triggers.workflow_run) {
      parts.push('workflow_run')
    }
    if (triggers.deployment_status) {
      parts.push('deployment')
    }
    
    return parts.join(', ') || 'none'
  }

  private estimateNextRun(cron: string): string {
    // Simple cron parsing for common patterns
    const parts = cron.split(' ')
    if (parts.length >= 2) {
      const [minute, hour] = parts
      if (minute !== '*' && hour !== '*') {
        return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`
      }
      if (minute !== '*' && hour === '*') {
        return `Every hour at :${minute.padStart(2, '0')}`
      }
    }
    return 'Complex schedule'
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('scan-workflows')
if (isMainModule) {
  const scanner = new WorkflowScanner()
  scanner.scan().catch(console.error)
}

export { WorkflowScanner }