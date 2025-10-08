#!/usr/bin/env tsx
/**
 * Quick Workflow Health Check
 * 
 * A lightweight version that provides immediate insights without GitHub API
 */

import { readdir, readFile } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'

interface QuickCheckResult {
  filename: string
  name: string
  triggers: string[]
  schedules: string[]
  status: 'healthy' | 'warning' | 'error'
  issues: string[]
}

async function quickWorkflowCheck(): Promise<void> {
  console.log('⚡ Quick Workflow Health Check')
  console.log('=============================\n')

  const workflowsPath = join(process.cwd(), '.github', 'workflows')
  const results: QuickCheckResult[] = []

  try {
    const files = await readdir(workflowsPath)
    const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))

    console.log(`🔍 Analyzing ${yamlFiles.length} workflow files...\n`)

    for (const filename of yamlFiles) {
      const result: QuickCheckResult = {
        filename,
        name: '',
        triggers: [],
        schedules: [],
        status: 'healthy',
        issues: []
      }

      try {
        const content = await readFile(join(workflowsPath, filename), 'utf-8')
        const config = parseYaml(content)

        result.name = config.name || filename.replace(/\.ya?ml$/, '')

        // Analyze triggers
        if (config.on) {
          if (typeof config.on === 'string') {
            result.triggers.push(config.on)
          } else if (typeof config.on === 'object') {
            result.triggers = Object.keys(config.on)
            
            // Extract schedules
            if (config.on.schedule && Array.isArray(config.on.schedule)) {
              result.schedules = config.on.schedule
                .map((s: any) => s.cron)
                .filter(Boolean)
            }
          }
        }

        // Health checks
        if (result.triggers.length === 0) {
          result.status = 'error'
          result.issues.push('No triggers defined')
        }

        if (!config.jobs || Object.keys(config.jobs).length === 0) {
          result.status = 'error'
          result.issues.push('No jobs defined')
        }

        // Check for common issues
        const configStr = JSON.stringify(config)
        
        if (configStr.includes('secrets.') && !result.triggers.includes('schedule')) {
          result.issues.push('Uses secrets but not scheduled - may need auth')
        }

        if (result.schedules.length > 0 && !configStr.includes('secrets.')) {
          result.status = result.status === 'error' ? 'error' : 'warning'
          result.issues.push('Scheduled but no secrets - may fail auth')
        }

        // Check for script references
        const scriptRefs = configStr.match(/(?:tsx|node|npm run)\s+([^\s]+\.(?:ts|js))/g)
        if (scriptRefs) {
          // Could validate if scripts exist, but skipping for quick check
        }

      } catch (error) {
        result.status = 'error'
        result.issues.push(`Parse error: ${error.message}`)
      }

      results.push(result)
    }

    // Display results
    displayResults(results)

  } catch (error) {
    console.error('❌ Failed to read workflows:', error)
  }
}

function displayResults(results: QuickCheckResult[]): void {
  const healthy = results.filter(r => r.status === 'healthy')
  const warnings = results.filter(r => r.status === 'warning')
  const errors = results.filter(r => r.status === 'error')

  console.log('📊 Summary:')
  console.log(`  ✅ Healthy: ${healthy.length}`)
  console.log(`  ⚠️ Warnings: ${warnings.length}`)
  console.log(`  ❌ Errors: ${errors.length}`)
  console.log()

  // Show issues first
  if (errors.length > 0) {
    console.log('❌ Workflows with Errors:')
    errors.forEach(result => {
      console.log(`  ${result.filename}:`)
      result.issues.forEach(issue => console.log(`    - ${issue}`))
    })
    console.log()
  }

  if (warnings.length > 0) {
    console.log('⚠️ Workflows with Warnings:')
    warnings.forEach(result => {
      console.log(`  ${result.filename}:`)
      result.issues.forEach(issue => console.log(`    - ${issue}`))
    })
    console.log()
  }

  // Show schedule overview
  const scheduledWorkflows = results.filter(r => r.schedules.length > 0)
  if (scheduledWorkflows.length > 0) {
    console.log('⏰ Scheduled Workflows:')
    scheduledWorkflows.forEach(result => {
      console.log(`  ${result.filename}: ${result.schedules.join(', ')}`)
    })
    console.log()
  }

  // Show trigger distribution
  const triggerCounts = new Map<string, number>()
  results.forEach(result => {
    result.triggers.forEach(trigger => {
      triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1)
    })
  })

  console.log('🎯 Trigger Distribution:')
  Array.from(triggerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([trigger, count]) => {
      console.log(`  ${trigger}: ${count} workflows`)
    })

  const healthPercent = Math.round((healthy.length / results.length) * 100)
  console.log(`\n🏥 Overall Health: ${healthPercent}%`)
  
  if (healthPercent >= 90) {
    console.log('✅ Excellent workflow health!')
  } else if (healthPercent >= 70) {
    console.log('⚠️ Good health, minor issues to address')
  } else {
    console.log('❌ Needs attention - multiple issues detected')
  }

  console.log('\n💡 For detailed analysis with GitHub API:')
  console.log('   GH_TOKEN=your_token tsx scripts/auditWorkflows.ts')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  quickWorkflowCheck()
}