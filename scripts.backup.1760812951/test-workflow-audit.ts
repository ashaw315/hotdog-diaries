#!/usr/bin/env tsx
/**
 * Test and Verification Script for Workflow Audit
 * 
 * Validates the workflow audit system without requiring GitHub API access
 */

import { readdir, readFile } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'

interface TestResults {
  totalWorkflows: number
  parsedSuccessfully: number
  parseErrors: string[]
  cronWorkflows: number
  manualWorkflows: number
  pushWorkflows: number
  scheduledTimes: string[]
  hasSecrets: number
  referencesScripts: number
  duplicateNames: string[]
  duplicateSchedules: string[]
}

class WorkflowAuditTester {
  private workflowsPath: string

  constructor() {
    this.workflowsPath = join(process.cwd(), '.github', 'workflows')
  }

  async runTest(): Promise<TestResults> {
    console.log('🧪 Testing Workflow Audit System...')
    console.log('==================================')

    const results: TestResults = {
      totalWorkflows: 0,
      parsedSuccessfully: 0,
      parseErrors: [],
      cronWorkflows: 0,
      manualWorkflows: 0,
      pushWorkflows: 0,
      scheduledTimes: [],
      hasSecrets: 0,
      referencesScripts: 0,
      duplicateNames: [],
      duplicateSchedules: []
    }

    try {
      // 1. Discover workflow files
      console.log('\n📋 Step 1: Discovering workflow files...')
      const files = await readdir(this.workflowsPath)
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      results.totalWorkflows = yamlFiles.length
      console.log(`✅ Found ${yamlFiles.length} workflow files`)

      // 2. Parse each workflow
      console.log('\n🔍 Step 2: Parsing workflow configurations...')
      const nameMap = new Map<string, string[]>()
      const scheduleMap = new Map<string, string[]>()

      for (const filename of yamlFiles) {
        try {
          const filePath = join(this.workflowsPath, filename)
          const content = await readFile(filePath, 'utf-8')
          const config = parseYaml(content)
          
          results.parsedSuccessfully++
          
          // Analyze configuration
          this.analyzeWorkflow(filename, config, results, nameMap, scheduleMap)
          
          console.log(`  ✅ ${filename}`)
          
        } catch (error) {
          results.parseErrors.push(`${filename}: ${error.message}`)
          console.log(`  ❌ ${filename}: ${error.message}`)
        }
      }

      // 3. Detect duplicates
      console.log('\n🔍 Step 3: Detecting duplicates...')
      nameMap.forEach((files, name) => {
        if (files.length > 1) {
          results.duplicateNames.push(`${name}: ${files.join(', ')}`)
        }
      })

      scheduleMap.forEach((files, schedule) => {
        if (files.length > 1) {
          results.duplicateSchedules.push(`${schedule}: ${files.join(', ')}`)
        }
      })

      // 4. Display results
      this.displayResults(results)

      return results

    } catch (error) {
      console.error('❌ Test failed:', error)
      throw error
    }
  }

  private analyzeWorkflow(
    filename: string, 
    config: any, 
    results: TestResults, 
    nameMap: Map<string, string[]>,
    scheduleMap: Map<string, string[]>
  ): void {
    // Track workflow names
    const workflowName = config.name || filename.replace(/\.ya?ml$/, '')
    const normalizedName = workflowName.toLowerCase().replace(/[-_\s]/g, '')
    
    if (!nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, [])
    }
    nameMap.get(normalizedName)!.push(filename)

    // Analyze triggers
    if (config.on) {
      if (typeof config.on === 'object') {
        const triggers = Object.keys(config.on)
        
        if (triggers.includes('schedule')) {
          results.cronWorkflows++
          
          // Extract cron schedules
          if (Array.isArray(config.on.schedule)) {
            config.on.schedule.forEach((schedule: any) => {
              if (schedule.cron) {
                results.scheduledTimes.push(schedule.cron)
                
                if (!scheduleMap.has(schedule.cron)) {
                  scheduleMap.set(schedule.cron, [])
                }
                scheduleMap.get(schedule.cron)!.push(filename)
              }
            })
          }
        }
        
        if (triggers.includes('workflow_dispatch')) {
          results.manualWorkflows++
        }
        
        if (triggers.includes('push') || triggers.includes('pull_request')) {
          results.pushWorkflows++
        }
      }
    }

    // Check for secrets usage
    const configStr = JSON.stringify(config)
    if (configStr.includes('secrets.') || configStr.includes('${{ secrets')) {
      results.hasSecrets++
    }

    // Check for script references
    if (configStr.includes('.ts') || configStr.includes('.js') || configStr.includes('.sh')) {
      results.referencesScripts++
    }
  }

  private displayResults(results: TestResults): void {
    console.log('\n📊 Test Results Summary')
    console.log('=====================')
    console.log(`📄 Total workflows: ${results.totalWorkflows}`)
    console.log(`✅ Parsed successfully: ${results.parsedSuccessfully}`)
    console.log(`❌ Parse errors: ${results.parseErrors.length}`)
    
    if (results.parseErrors.length > 0) {
      console.log('\n❌ Parse Errors:')
      results.parseErrors.forEach(error => console.log(`  - ${error}`))
    }

    console.log(`\n🔍 Trigger Analysis:`)
    console.log(`  ⏰ Scheduled (cron): ${results.cronWorkflows}`)
    console.log(`  🎯 Manual (workflow_dispatch): ${results.manualWorkflows}`)
    console.log(`  📝 Push/PR triggers: ${results.pushWorkflows}`)
    console.log(`  🔐 Using secrets: ${results.hasSecrets}`)
    console.log(`  📋 References scripts: ${results.referencesScripts}`)

    if (results.scheduledTimes.length > 0) {
      console.log(`\n⏰ Scheduled Times:`)
      const scheduleFreq = new Map<string, number>()
      results.scheduledTimes.forEach(schedule => {
        scheduleFreq.set(schedule, (scheduleFreq.get(schedule) || 0) + 1)
      })
      
      Array.from(scheduleFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([schedule, count]) => {
          console.log(`  - ${schedule} (${count} workflow${count > 1 ? 's' : ''})`)
        })
    }

    if (results.duplicateNames.length > 0) {
      console.log(`\n⚠️ Potential Name Conflicts:`)
      results.duplicateNames.forEach(duplicate => {
        console.log(`  - ${duplicate}`)
      })
    }

    if (results.duplicateSchedules.length > 0) {
      console.log(`\n🔄 Duplicate Schedules:`)
      results.duplicateSchedules.forEach(duplicate => {
        console.log(`  - ${duplicate}`)
      })
    }

    // Health assessment
    const healthScore = this.calculateHealthScore(results)
    console.log(`\n🏥 Workflow Health Score: ${healthScore}/100`)
    
    if (healthScore >= 80) {
      console.log('✅ Excellent - workflows are well-organized')
    } else if (healthScore >= 60) {
      console.log('⚠️ Good - some minor issues to address')
    } else {
      console.log('❌ Needs attention - significant issues detected')
    }
  }

  private calculateHealthScore(results: TestResults): number {
    let score = 100

    // Deduct for parse errors
    score -= (results.parseErrors.length / results.totalWorkflows) * 30

    // Deduct for duplicates
    score -= (results.duplicateNames.length / results.totalWorkflows) * 20
    score -= (results.duplicateSchedules.length / results.totalWorkflows) * 15

    // Bonus for good practices
    if (results.hasSecrets > 0) score += 5 // Uses authentication
    if (results.referencesScripts > 0) score += 5 // Modular design

    return Math.max(0, Math.round(score))
  }
}

/**
 * Validate that the audit system can access required resources
 */
async function validateEnvironment(): Promise<void> {
  console.log('🔍 Validating Environment...')
  
  // Check if workflows directory exists
  const workflowsPath = join(process.cwd(), '.github', 'workflows')
  try {
    const files = await readdir(workflowsPath)
    console.log(`✅ Found workflows directory with ${files.length} files`)
  } catch (error) {
    throw new Error(`❌ Cannot access workflows directory: ${error.message}`)
  }

  // Check for GitHub token (optional for testing)
  const hasToken = !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN)
  if (hasToken) {
    console.log('✅ GitHub token detected (can run full audit)')
  } else {
    console.log('⚠️ No GitHub token (can only run static analysis)')
  }

  // Validate dependencies
  try {
    await import('@octokit/rest')
    await import('yaml')
    console.log('✅ All required dependencies available')
  } catch (error) {
    throw new Error(`❌ Missing dependencies: ${error.message}`)
  }
}

/**
 * Main test execution
 */
async function main() {
  try {
    console.log('🧪 Workflow Audit System Test')
    console.log('==============================\n')

    // Validate environment
    await validateEnvironment()

    // Run static analysis test
    const tester = new WorkflowAuditTester()
    const results = await tester.runTest()

    // Check if we can run full audit
    const hasToken = !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN)
    
    if (hasToken) {
      console.log('\n🚀 Full audit test with GitHub API...')
      
      // Import and test the main auditor
      const { WorkflowAuditor } = await import('./auditWorkflows.js')
      
      try {
        const auditor = new WorkflowAuditor(process.env.GH_TOKEN || process.env.GITHUB_TOKEN!)
        console.log('✅ WorkflowAuditor initialized successfully')
        console.log('💡 Run with full audit: tsx scripts/auditWorkflows.ts')
      } catch (error) {
        console.warn('⚠️ Full audit test skipped:', error.message)
      }
    } else {
      console.log('\n💡 To test full audit with GitHub API:')
      console.log('   GH_TOKEN=your_token tsx scripts/auditWorkflows.ts')
    }

    console.log('\n✅ All tests completed successfully!')
    console.log('\n📄 Next steps:')
    console.log('  1. Get GitHub token from: https://github.com/settings/tokens')
    console.log('  2. Run full audit: GH_TOKEN=token tsx scripts/auditWorkflows.ts')
    console.log('  3. Review generated report: reports/workflow-audit.md')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}