#!/usr/bin/env tsx

/**
 * Attach Posting Guard Codemod
 * 
 * Automatically modifies posting workflows to include:
 * - Posting guard job with proper dependencies
 * - Timeout and concurrency settings
 * - Staggered cron schedules to avoid collisions
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import path from 'node:path'

interface WorkflowChanges {
  file: string
  changes: string[]
  before: string
  after: string
}

async function main() {
  console.log('🔧 Posting Guard Codemod: Attaching guards to posting workflows')
  
  try {
    const workflowsDir = '.github/workflows'
    const files = await readdir(workflowsDir)
    
    const postingWorkflows = files.filter(file => 
      file.startsWith('post-') && file.endsWith('.yml')
    )
    
    console.log(`📁 Found ${postingWorkflows.length} posting workflows:`)
    postingWorkflows.forEach(file => console.log(`   ${file}`))
    
    const allChanges: WorkflowChanges[] = []
    
    for (const file of postingWorkflows) {
      const changes = await processWorkflow(path.join(workflowsDir, file))
      if (changes) {
        allChanges.push(changes)
      }
    }
    
    // Print summary
    console.log(`\n📊 Summary:`)
    console.log(`   Workflows processed: ${postingWorkflows.length}`)
    console.log(`   Workflows modified: ${allChanges.length}`)
    
    if (allChanges.length > 0) {
      console.log(`\n🔍 Changes made:`)
      allChanges.forEach(change => {
        console.log(`\n📄 ${change.file}:`)
        change.changes.forEach(desc => console.log(`   ✅ ${desc}`))
      })
    } else {
      console.log(`   No changes needed - all workflows already compliant`)
    }
    
  } catch (error) {
    console.error('❌ Codemod failed:', error)
    process.exit(1)
  }
}

async function processWorkflow(filePath: string): Promise<WorkflowChanges | null> {
  const originalContent = await readFile(filePath, 'utf8')
  let workflow: any
  
  try {
    workflow = parseYaml(originalContent)
  } catch (error) {
    console.warn(`⚠️ Skipping ${filePath}: YAML parse error`)
    return null
  }
  
  const changes: string[] = []
  let modified = false
  
  // Ensure top-level permissions
  if (!workflow.permissions) {
    workflow.permissions = { contents: 'read' }
    changes.push('Added top-level permissions: contents: read')
    modified = true
  }
  
  // Ensure jobs exist
  if (!workflow.jobs) {
    workflow.jobs = {}
  }
  
  // Add guard job if missing
  if (!workflow.jobs.guard) {
    workflow.jobs.guard = {
      uses: './.github/workflows/_posting-guard.yml'
    }
    changes.push('Added guard job using _posting-guard.yml')
    modified = true
  }
  
  // Find the main posting job (assumes it's the non-guard job)
  const postingJobName = Object.keys(workflow.jobs).find(name => name !== 'guard')
  
  if (postingJobName) {
    const postingJob = workflow.jobs[postingJobName]
    
    // Add needs: guard dependency
    if (!postingJob.needs || (Array.isArray(postingJob.needs) && !postingJob.needs.includes('guard'))) {
      if (!postingJob.needs) {
        postingJob.needs = 'guard'
      } else if (Array.isArray(postingJob.needs)) {
        postingJob.needs.push('guard')
      } else if (postingJob.needs !== 'guard') {
        postingJob.needs = [postingJob.needs, 'guard']
      }
      changes.push(`Added 'needs: guard' to ${postingJobName} job`)
      modified = true
    }
    
    // Add timeout if missing
    if (!postingJob['timeout-minutes']) {
      postingJob['timeout-minutes'] = 10
      changes.push(`Added timeout-minutes: 10 to ${postingJobName} job`)
      modified = true
    }
    
    // Add concurrency if missing
    if (!postingJob.concurrency) {
      postingJob.concurrency = {
        group: `${postingJobName}-\${{ github.ref }}`,
        'cancel-in-progress': true
      }
      changes.push(`Added concurrency group to ${postingJobName} job`)
      modified = true
    }
  }
  
  // Stagger cron schedules
  if (workflow.on?.schedule) {
    for (const schedule of workflow.on.schedule) {
      if (schedule.cron && schedule.cron.includes(' * * *')) {
        const cronParts = schedule.cron.split(' ')
        if (cronParts.length >= 2 && cronParts[1].endsWith('0') && !cronParts[1].includes(',')) {
          const originalCron = schedule.cron
          // Shift :00 times to :02 to let guards run first
          cronParts[1] = cronParts[1].replace(/(\d+)0$/, '$12')
          schedule.cron = cronParts.join(' ')
          
          // Add explanatory comment
          if (!originalContent.includes('shifted by +2m')) {
            changes.push(`Staggered cron: ${originalCron} → ${schedule.cron} (shifted +2m for guards)`)
            modified = true
          }
        }
      }
    }
  }
  
  if (!modified) {
    return null
  }
  
  // Write back with preserved formatting
  let newContent = stringifyYaml(workflow, {
    indent: 2,
    lineWidth: 120,
    minContentWidth: 0
  })
  
  // Add comment about cron staggering if we modified crons
  const cronChanges = changes.filter(c => c.includes('Staggered cron'))
  if (cronChanges.length > 0) {
    const scheduleSection = newContent.indexOf('schedule:')
    if (scheduleSection > -1) {
      const beforeSchedule = newContent.substring(0, scheduleSection)
      const afterSchedule = newContent.substring(scheduleSection)
      newContent = beforeSchedule + 
        '# NOTE: Cron shifted by +2m to let guard/SLA checks run first (ET)\n  ' +
        afterSchedule
    }
  }
  
  await writeFile(filePath, newContent)
  
  return {
    file: path.basename(filePath),
    changes,
    before: originalContent,
    after: newContent
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('attach-posting-guard')
if (isMainModule) {
  main().catch(console.error)
}

export { main as attachPostingGuard }