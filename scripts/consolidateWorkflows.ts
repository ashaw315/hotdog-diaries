#!/usr/bin/env tsx
/**
 * CI Workflow Consolidation & Reliability Refactor Script
 * 
 * Analyzes all .github/workflows/*.yml files to identify:
 * - Duplicate schedules and overlapping functionality
 * - Naming inconsistencies and consolidation opportunities
 * - Reliability improvements and optimization recommendations
 * 
 * Usage: tsx scripts/consolidateWorkflows.ts [--dry-run]
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'
import { existsSync } from 'fs'
import chalk from 'chalk'
// Note: string-similarity is deprecated, using simple similarity function
// import stringSimilarity from 'string-similarity'

interface WorkflowMetadata {
  filename: string
  name: string
  triggers: string[]
  cronSchedules: string[]
  jobs: Record<string, any>
  jobNames: string[]
  scripts: string[]
  hasSecrets: boolean
  hasContinueOnError: boolean
  hasTimeout: boolean
  hasNotifications: boolean
  category: 'content-scan' | 'content-post' | 'infrastructure' | 'ci-cd' | 'operations' | 'unknown'
}

interface ConsolidationAction {
  workflow: string
  action: 'keep' | 'merge' | 'remove' | 'rename'
  reason: string
  target?: string
  newCron?: string
  priority: 'high' | 'medium' | 'low'
}

interface ScheduleConflict {
  cron: string
  workflows: string[]
  suggestedStagger: Record<string, string>
}

class WorkflowConsolidator {
  private workflowsPath: string
  private reportsPath: string
  private workflows: WorkflowMetadata[] = []
  private dryRun: boolean

  constructor(dryRun: boolean = false) {
    this.workflowsPath = join(process.cwd(), '.github', 'workflows')
    this.reportsPath = join(process.cwd(), 'reports')
    this.dryRun = dryRun
  }

  async analyze(): Promise<void> {
    console.log(chalk.blue('🔍 CI Workflow Consolidation & Reliability Analysis'))
    console.log(chalk.blue('=' .repeat(55)))
    
    if (this.dryRun) {
      console.log(chalk.yellow('🧪 DRY RUN MODE - No files will be modified'))
    }

    // Step 1: Load and parse all workflows
    await this.loadWorkflows()
    
    // Step 2: Categorize workflows
    this.categorizeWorkflows()
    
    // Step 3: Detect duplicates and overlaps
    const duplicates = this.detectDuplicates()
    
    // Step 4: Analyze schedule conflicts
    const scheduleConflicts = this.analyzeScheduleConflicts()
    
    // Step 5: Generate consolidation plan
    const consolidationPlan = this.generateConsolidationPlan(duplicates, scheduleConflicts)
    
    // Step 6: Assess reliability improvements
    const reliabilityImprovements = this.assessReliabilityImprovements()
    
    // Step 7: Generate reports
    await this.generateRefactorPlan({
      duplicates,
      scheduleConflicts,
      consolidationPlan,
      reliabilityImprovements
    })
    
    // Step 8: Display summary
    this.displaySummary(consolidationPlan)
  }

  private async loadWorkflows(): Promise<void> {
    console.log(chalk.cyan('\\n📋 Step 1: Loading workflow files...'))
    
    try {
      const files = await readdir(this.workflowsPath)
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      
      for (const filename of yamlFiles) {
        try {
          const content = await readFile(join(this.workflowsPath, filename), 'utf-8')
          const config = parseYaml(content)
          
          const metadata: WorkflowMetadata = {
            filename,
            name: config.name || filename.replace(/\\.ya?ml$/, ''),
            triggers: this.extractTriggers(config),
            cronSchedules: this.extractCronSchedules(config),
            jobs: config.jobs || {},
            jobNames: Object.keys(config.jobs || {}),
            scripts: this.extractScripts(config),
            hasSecrets: this.hasSecrets(config),
            hasContinueOnError: this.hasContinueOnError(config),
            hasTimeout: this.hasTimeout(config),
            hasNotifications: this.hasNotifications(config),
            category: 'unknown'
          }
          
          this.workflows.push(metadata)
          console.log(chalk.green(`  ✅ ${filename}`))
          
        } catch (error) {
          console.log(chalk.red(`  ❌ ${filename}: ${error.message}`))
        }
      }
      
      console.log(chalk.cyan(`✅ Loaded ${this.workflows.length} workflows`))
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to load workflows:'), error)
      throw error
    }
  }

  private extractTriggers(config: any): string[] {
    const triggers: string[] = []
    
    if (config.on) {
      if (typeof config.on === 'string') {
        triggers.push(config.on)
      } else if (typeof config.on === 'object') {
        triggers.push(...Object.keys(config.on))
      }
    }
    
    return triggers
  }

  private extractCronSchedules(config: any): string[] {
    const schedules: string[] = []
    
    if (config.on?.schedule && Array.isArray(config.on.schedule)) {
      config.on.schedule.forEach((schedule: any) => {
        if (schedule.cron) {
          schedules.push(schedule.cron)
        }
      })
    }
    
    return schedules
  }

  private extractScripts(config: any): string[] {
    const scripts: string[] = []
    const configStr = JSON.stringify(config)
    
    // Find script references in run commands
    const scriptMatches = configStr.match(/(tsx|node|npm run|\.\/)\s+([^\s]+\.(ts|js|sh))/g)
    if (scriptMatches) {
      scripts.push(...scriptMatches)
    }
    
    return scripts
  }

  private hasSecrets(config: any): boolean {
    const configStr = JSON.stringify(config)
    return configStr.includes('secrets.') || configStr.includes('${{ secrets')
  }

  private hasContinueOnError(config: any): boolean {
    const configStr = JSON.stringify(config)
    return configStr.includes('continue-on-error')
  }

  private hasTimeout(config: any): boolean {
    const configStr = JSON.stringify(config)
    return configStr.includes('timeout-minutes')
  }

  private hasNotifications(config: any): boolean {
    const configStr = JSON.stringify(config)
    return configStr.includes('slack') || configStr.includes('discord') || configStr.includes('email')
  }

  private categorizeWorkflows(): void {
    console.log(chalk.cyan('\\n🏷️ Step 2: Categorizing workflows...'))
    
    for (const workflow of this.workflows) {
      const filename = workflow.filename.toLowerCase()
      const name = workflow.name.toLowerCase()
      
      if (filename.includes('scan-') || name.includes('scan')) {
        workflow.category = 'content-scan'
      } else if (filename.includes('post-') || name.includes('post')) {
        workflow.category = 'content-post'
      } else if (filename.includes('ci') || filename.includes('e2e') || name.includes('test')) {
        workflow.category = 'ci-cd'
      } else if (filename.includes('queue') || filename.includes('monitor') || filename.includes('cleanup')) {
        workflow.category = 'infrastructure'
      } else if (filename.includes('manual') || filename.includes('token') || filename.includes('report')) {
        workflow.category = 'operations'
      }
    }
    
    const categories = this.workflows.reduce((acc, w) => {
      acc[w.category] = (acc[w.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(chalk.cyan('📊 Workflow Categories:'))
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(chalk.white(`  ${cat}: ${count} workflows`))
    })
  }

  private detectDuplicates(): Record<string, string[]> {
    console.log(chalk.cyan('\\n🔍 Step 3: Detecting duplicates and overlaps...'))
    
    const duplicates: Record<string, string[]> = {
      sameCron: [],
      similarNames: [],
      sameScripts: [],
      sameJobs: []
    }
    
    // Group by cron schedules
    const cronGroups: Record<string, string[]> = {}
    this.workflows.forEach(w => {
      w.cronSchedules.forEach(cron => {
        if (!cronGroups[cron]) cronGroups[cron] = []
        cronGroups[cron].push(w.filename)
      })
    })
    
    Object.entries(cronGroups).forEach(([cron, workflows]) => {
      if (workflows.length > 1) {
        duplicates.sameCron.push(`${cron}: ${workflows.join(', ')}`)
      }
    })
    
    // Find similar names using simple similarity
    for (let i = 0; i < this.workflows.length; i++) {
      for (let j = i + 1; j < this.workflows.length; j++) {
        const w1 = this.workflows[i]
        const w2 = this.workflows[j]
        
        if (this.calculateSimilarity(w1.name, w2.name) > 0.7) {
          duplicates.similarNames.push(`${w1.filename} ↔ ${w2.filename}`)
        }
      }
    }
    
    // Find workflows with same scripts
    const scriptGroups: Record<string, string[]> = {}
    this.workflows.forEach(w => {
      w.scripts.forEach(script => {
        if (!scriptGroups[script]) scriptGroups[script] = []
        scriptGroups[script].push(w.filename)
      })
    })
    
    Object.entries(scriptGroups).forEach(([script, workflows]) => {
      if (workflows.length > 1) {
        duplicates.sameScripts.push(`${script}: ${workflows.join(', ')}`)
      }
    })
    
    console.log(chalk.yellow(`⚠️  Found ${duplicates.sameCron.length} cron duplicates`))
    console.log(chalk.yellow(`⚠️  Found ${duplicates.similarNames.length} name similarities`))
    console.log(chalk.yellow(`⚠️  Found ${duplicates.sameScripts.length} script overlaps`))
    
    return duplicates
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity for workflow names
    const normalize = (str: string) => str.toLowerCase()
      .replace(/[-_]/g, '')
      .replace(/\\.(yml|yaml)$/, '')
    
    const s1 = normalize(str1)
    const s2 = normalize(str2)
    
    if (s1 === s2) return 1.0
    
    const set1 = new Set(s1.split(''))
    const set2 = new Set(s2.split(''))
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    return intersection.size / union.size
  }

  private analyzeScheduleConflicts(): ScheduleConflict[] {
    console.log(chalk.cyan('\\n⏰ Step 4: Analyzing schedule conflicts...'))
    
    const conflicts: ScheduleConflict[] = []
    const cronGroups: Record<string, string[]> = {}
    
    this.workflows.forEach(w => {
      w.cronSchedules.forEach(cron => {
        if (!cronGroups[cron]) cronGroups[cron] = []
        cronGroups[cron].push(w.filename)
      })
    })
    
    Object.entries(cronGroups).forEach(([cron, workflows]) => {
      if (workflows.length > 1) {
        const suggestedStagger: Record<string, string> = {}
        
        workflows.forEach((workflow, index) => {
          if (index === 0) {
            suggestedStagger[workflow] = cron // Keep first one unchanged
          } else {
            // Stagger by 5-10 minutes
            suggestedStagger[workflow] = this.staggerCron(cron, index * 5)
          }
        })
        
        conflicts.push({
          cron,
          workflows,
          suggestedStagger
        })
      }
    })
    
    console.log(chalk.yellow(`⚠️  Found ${conflicts.length} schedule conflicts`))
    
    return conflicts
  }

  private staggerCron(originalCron: string, minuteOffset: number): string {
    // Parse and modify cron expression to add minute offset
    const parts = originalCron.split(' ')
    if (parts.length >= 2) {
      let minute = parseInt(parts[1]) || 0
      minute = (minute + minuteOffset) % 60
      parts[1] = minute.toString()
      return parts.join(' ')
    }
    return originalCron
  }

  private generateConsolidationPlan(
    duplicates: Record<string, string[]>, 
    scheduleConflicts: ScheduleConflict[]
  ): ConsolidationAction[] {
    console.log(chalk.cyan('\\n🧩 Step 5: Generating consolidation plan...'))
    
    const actions: ConsolidationAction[] = []
    
    // Analyze each workflow for consolidation opportunities
    this.workflows.forEach(workflow => {
      const action: ConsolidationAction = {
        workflow: workflow.filename,
        action: 'keep',
        reason: 'No issues detected',
        priority: 'low'
      }
      
      // Check for CI workflow consolidation
      if (workflow.category === 'ci-cd') {
        if (workflow.filename === 'ci-test.yml') {
          action.action = 'remove'
          action.reason = 'Superseded by ci-new.yml with better configuration'
          action.priority = 'medium'
        } else if (workflow.filename === 'ci-new.yml') {
          action.action = 'rename'
          action.target = 'ci-production.yml'
          action.reason = 'Clarify this is the production CI configuration'
          action.priority = 'low'
        }
      }
      
      // Check for scanning workflow consolidation
      if (workflow.category === 'content-scan') {
        const similarScanners = this.workflows.filter(w => 
          w.category === 'content-scan' && 
          w.filename !== workflow.filename &&
          w.cronSchedules.some(cron => workflow.cronSchedules.includes(cron))
        )
        
        if (similarScanners.length > 0) {
          // Suggest merging similar scanning workflows
          if (workflow.filename === 'scan-social-platforms.yml') {
            action.action = 'merge'
            action.target = 'content-scan-unified.yml'
            action.reason = 'Consolidate with scan-bluesky.yml (same schedule)'
            action.priority = 'medium'
          }
        }
      }
      
      // Check for schedule conflicts
      const hasScheduleConflict = scheduleConflicts.some(conflict => 
        conflict.workflows.includes(workflow.filename)
      )
      
      if (hasScheduleConflict && action.action === 'keep') {
        const conflict = scheduleConflicts.find(c => c.workflows.includes(workflow.filename))!
        action.newCron = conflict.suggestedStagger[workflow.filename]
        action.reason = 'Stagger schedule to avoid conflicts'
        action.priority = 'high'
      }
      
      // Check for reliability improvements needed
      if (!workflow.hasTimeout) {
        if (action.reason === 'No issues detected') {
          action.reason = 'Add timeout-minutes for reliability'
        } else {
          action.reason += '; Add timeout-minutes'
        }
        action.priority = action.priority === 'low' ? 'medium' : action.priority
      }
      
      actions.push(action)
    })
    
    const actionCounts = actions.reduce((acc, a) => {
      acc[a.action] = (acc[a.action] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(chalk.cyan('📊 Consolidation Actions:'))
    Object.entries(actionCounts).forEach(([action, count]) => {
      console.log(chalk.white(`  ${action}: ${count} workflows`))
    })
    
    return actions
  }

  private assessReliabilityImprovements(): Record<string, any> {
    console.log(chalk.cyan('\\n🛡️  Step 6: Assessing reliability improvements...'))
    
    const improvements = {
      missingTimeouts: this.workflows.filter(w => !w.hasTimeout).length,
      missingContinueOnError: this.workflows.filter(w => !w.hasContinueOnError).length,
      missingNotifications: this.workflows.filter(w => !w.hasNotifications).length,
      suggestions: [
        'Add timeout-minutes to all jobs (recommended: 10-30 minutes)',
        'Implement failure notifications for critical workflows',
        'Add continue-on-error for non-blocking steps',
        'Create weekly meta-audit workflow to run auditWorkflows.ts',
        'Add retry mechanisms for flaky network operations'
      ]
    }
    
    console.log(chalk.yellow(`⚠️  ${improvements.missingTimeouts} workflows need timeouts`))
    console.log(chalk.yellow(`⚠️  ${improvements.missingNotifications} workflows need notifications`))
    
    return improvements
  }

  private async generateRefactorPlan(analysis: any): Promise<void> {
    console.log(chalk.cyan('\\n📄 Step 7: Generating refactor plan report...'))
    
    if (!existsSync(this.reportsPath)) {
      await mkdir(this.reportsPath, { recursive: true })
    }
    
    const reportContent = this.generateMarkdownReport(analysis)
    const reportPath = join(this.reportsPath, 'workflow-refactor-plan.md')
    
    if (!this.dryRun) {
      await writeFile(reportPath, reportContent, 'utf-8')
      console.log(chalk.green(`✅ Report generated: ${reportPath}`))
    } else {
      console.log(chalk.yellow(`🧪 Would generate: ${reportPath}`))
    }
  }

  private generateMarkdownReport(analysis: any): string {
    const { duplicates, scheduleConflicts, consolidationPlan, reliabilityImprovements } = analysis
    
    let markdown = `# 🔧 CI Workflow Consolidation & Reliability Refactor Plan

**Generated:** ${new Date().toLocaleString()}  
**Total Workflows:** ${this.workflows.length}  
**Analysis Scope:** Complete .github/workflows/ directory

## 📊 Executive Summary

### Current State
- **Total Workflows:** ${this.workflows.length}
- **Schedule Conflicts:** ${scheduleConflicts.length} 
- **Consolidation Opportunities:** ${consolidationPlan.filter(a => a.action === 'merge').length}
- **Reliability Gaps:** ${reliabilityImprovements.missingTimeouts} missing timeouts

### Target State  
- **Reduced Conflicts:** 0 duplicate schedules
- **Clearer Organization:** Consistent naming and categorization
- **Enhanced Reliability:** 100% timeout coverage and failure notifications

## 📋 Detailed Consolidation Plan

| Workflow | Action | Priority | Reason | Target/New Schedule |
|----------|--------|----------|--------|--------------------|
`

    consolidationPlan.forEach((action: ConsolidationAction) => {
      const emoji = {
        keep: '✅',
        merge: '⚙️',
        remove: '🗑️',
        rename: '📝'
      }[action.action]
      
      const target = action.target || action.newCron || 'N/A'
      
      markdown += `| \`${action.workflow}\` | ${emoji} ${action.action} | ${action.priority} | ${action.reason} | ${target} |\\n`
    })

    markdown += `

## ⏰ Schedule Optimization

### Current Conflicts
`

    scheduleConflicts.forEach(conflict => {
      markdown += `
**\`${conflict.cron}\`** - ${conflict.workflows.length} workflows:
- ${conflict.workflows.map(w => `\`${w}\``).join(', ')}

**Proposed Staggering:**
${Object.entries(conflict.suggestedStagger).map(([workflow, newCron]) => 
  `- \`${workflow}\` → \`${newCron}\``
).join('\\n')}
`
    })

    markdown += `

## 🏷️ Naming Normalization

### Current Categories
`

    const categories = this.workflows.reduce((acc, w) => {
      acc[w.category] = (acc[w.category] || []).concat(w.filename)
      return acc
    }, {} as Record<string, string[]>)

    Object.entries(categories).forEach(([category, workflows]) => {
      markdown += `
**${category}** (${workflows.length} workflows):
${workflows.map(w => `- \`${w}\``).join('\\n')}
`
    })

    markdown += `

### Suggested Naming Convention
- **Content Scanning:** \`content-scan-{platform}.yml\`
- **Content Posting:** \`content-post-{time}.yml\`  
- **Infrastructure:** \`infra-{function}.yml\`
- **CI/CD:** \`ci-{environment}.yml\`
- **Operations:** \`ops-{function}.yml\`

## 🛡️ Reliability Enhancements

### Missing Safeguards
- **Timeouts:** ${reliabilityImprovements.missingTimeouts} workflows need \`timeout-minutes\`
- **Notifications:** ${reliabilityImprovements.missingNotifications} workflows need failure alerts
- **Error Handling:** ${reliabilityImprovements.missingContinueOnError} workflows need \`continue-on-error\`

### Recommended Improvements
${reliabilityImprovements.suggestions.map((s: string) => `- ${s}`).join('\\n')}

## 🧪 Implementation Strategy

### Phase 1: Critical Fixes (Week 1)
1. **Stagger duplicate schedules** to eliminate conflicts
2. **Remove obsolete workflows** (ci-test.yml)
3. **Add timeout-minutes** to all workflows

### Phase 2: Consolidation (Week 2)  
1. **Merge similar scanning workflows** into unified files
2. **Rename CI workflows** for clarity
3. **Implement failure notifications**

### Phase 3: Enhancement (Week 3)
1. **Add weekly meta-audit workflow**
2. **Implement retry mechanisms**  
3. **Create workflow performance dashboard**

## ✅ Verification Checklist

- [ ] All 28 workflows accounted for in plan
- [ ] Zero duplicate cron schedules remain  
- [ ] All workflows pass \`act validate\`
- [ ] Naming follows consistent convention
- [ ] 100% timeout coverage achieved
- [ ] Failure notification system implemented

## 🚀 Next Steps

1. **Review this plan** with the team
2. **Run dry-run validation:** \`tsx scripts/consolidateWorkflows.ts --dry-run\`
3. **Create feature branch:** \`git checkout -b chore/workflow-refactor-plan\`
4. **Implement changes incrementally** following the 3-phase strategy
5. **Monitor workflow reliability** post-implementation

---

**Generated by:** Workflow Consolidation Analysis v1.0  
**Last Updated:** ${new Date().toISOString()}
`

    return markdown
  }

  private displaySummary(consolidationPlan: ConsolidationAction[]): void {
    console.log(chalk.green('\\n🎉 Analysis Complete!'))
    console.log(chalk.green('=' .repeat(25)))
    
    const actionCounts = consolidationPlan.reduce((acc, a) => {
      acc[a.action] = (acc[a.action] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(chalk.cyan('📊 Summary:'))
    console.log(chalk.white(`  ✅ Keep: ${actionCounts.keep || 0} workflows`))
    console.log(chalk.white(`  ⚙️ Merge: ${actionCounts.merge || 0} workflows`))
    console.log(chalk.white(`  🗑️ Remove: ${actionCounts.remove || 0} workflows`))
    console.log(chalk.white(`  📝 Rename: ${actionCounts.rename || 0} workflows`))
    
    const highPriority = consolidationPlan.filter(a => a.priority === 'high').length
    console.log(chalk.red(`\\n🚨 High Priority Actions: ${highPriority}`))
    
    console.log(chalk.blue('\\n📄 Full plan: reports/workflow-refactor-plan.md'))
    
    if (this.dryRun) {
      console.log(chalk.yellow('\\n💡 Run without --dry-run to generate actual files'))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  
  try {
    const consolidator = new WorkflowConsolidator(dryRun)
    await consolidator.analyze()
    
    console.log(chalk.green('\\n✅ Workflow consolidation analysis completed successfully!'))
    
  } catch (error) {
    console.error(chalk.red('❌ Analysis failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { WorkflowConsolidator }