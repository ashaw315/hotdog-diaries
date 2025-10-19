#!/usr/bin/env tsx

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import yaml from 'yaml'

interface WorkflowJob {
  name?: string
  'runs-on'?: string
  if?: string
  needs?: string | string[]
  'timeout-minutes'?: number
  uses?: string
  steps?: Array<{
    name?: string
    uses?: string
    run?: string
    if?: string
    env?: Record<string, string>
  }>
  permissions?: Record<string, string>
  env?: Record<string, string>
}

interface ParsedWorkflow {
  filename: string
  name: string
  triggers: string[]
  permissions?: Record<string, string>
  concurrency?: {
    group?: string
    'cancel-in-progress'?: boolean
  }
  env?: Record<string, string>
  jobs: Record<string, WorkflowJob>
  secrets_referenced: string[]
  env_vars_referenced: string[]
  has_deployment_status: boolean
  has_environment_usage: boolean
  complexity_score: number
}

async function scanWorkflows(): Promise<void> {
  console.log('🔍 Scanning workflow files...')
  
  const workflowsDir = '.github/workflows'
  const files = readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  
  const workflows: ParsedWorkflow[] = []
  
  for (const file of files) {
    try {
      const filePath = join(workflowsDir, file)
      const content = readFileSync(filePath, 'utf8')
      const workflow = yaml.parse(content)
      
      if (!workflow || typeof workflow !== 'object') {
        console.warn(`⚠️ Skipping invalid workflow: ${file}`)
        continue
      }
      
      const parsed = parseWorkflow(file, workflow)
      workflows.push(parsed)
      
    } catch (error) {
      console.error(`❌ Error parsing ${file}:`, error)
    }
  }
  
  // Generate output
  writeFileSync(
    'ci_audit/failure_forensics/workflows.json',
    JSON.stringify(workflows, null, 2)
  )
  
  // Generate overview
  const overview = generateMarkdownOverview(workflows)
  writeFileSync(
    'ci_audit/failure_forensics/workflows_overview.md',
    overview
  )
  
  console.log(`✅ Parsed ${workflows.length} workflows`)
  console.log(`📄 Output: ci_audit/failure_forensics/workflows.json`)
  console.log(`📄 Overview: ci_audit/failure_forensics/workflows_overview.md`)
}

function parseWorkflow(filename: string, workflow: any): ParsedWorkflow {
  const triggers = extractTriggers(workflow.on)
  const secretsReferenced = extractSecrets(JSON.stringify(workflow))
  const envVarsReferenced = extractEnvVars(JSON.stringify(workflow))
  
  const hasDeploymentStatus = triggers.includes('deployment_status') || 
    JSON.stringify(workflow).includes('deployment_status')
  
  const hasEnvironmentUsage = JSON.stringify(workflow).includes('environment:') ||
    JSON.stringify(workflow).includes('environment_url')
  
  const complexityScore = calculateComplexity(workflow)
  
  return {
    filename,
    name: workflow.name || filename.replace(/\.ya?ml$/, ''),
    triggers,
    permissions: workflow.permissions,
    concurrency: workflow.concurrency,
    env: workflow.env,
    jobs: workflow.jobs || {},
    secrets_referenced: secretsReferenced,
    env_vars_referenced: envVarsReferenced,
    has_deployment_status: hasDeploymentStatus,
    has_environment_usage: hasEnvironmentUsage,
    complexity_score: complexityScore
  }
}

function extractTriggers(on: any): string[] {
  if (!on) return []
  
  if (typeof on === 'string') {
    return [on]
  }
  
  if (Array.isArray(on)) {
    return on
  }
  
  if (typeof on === 'object') {
    return Object.keys(on)
  }
  
  return []
}

function extractSecrets(content: string): string[] {
  const secretRefs = content.match(/secrets\.[A-Z_][A-Z0-9_]*/g) || []
  return [...new Set(secretRefs.map(ref => ref.replace('secrets.', '')))]
}

function extractEnvVars(content: string): string[] {
  const envRefs = content.match(/\$\{\{\s*env\.[A-Z_][A-Z0-9_]*\s*\}\}/g) || []
  const processEnvRefs = content.match(/process\.env\.[A-Z_][A-Z0-9_]*/g) || []
  
  const envVars = [
    ...envRefs.map(ref => ref.match(/env\.([A-Z_][A-Z0-9_]*)/)?.[1]).filter(Boolean),
    ...processEnvRefs.map(ref => ref.replace('process.env.', ''))
  ]
  
  return [...new Set(envVars)]
}

function calculateComplexity(workflow: any): number {
  let score = 0
  
  // Base complexity
  const jobCount = Object.keys(workflow.jobs || {}).length
  score += jobCount * 2
  
  // Dependencies complexity
  for (const job of Object.values(workflow.jobs || {})) {
    const jobObj = job as WorkflowJob
    if (jobObj.needs) {
      score += Array.isArray(jobObj.needs) ? jobObj.needs.length : 1
    }
    
    if (jobObj.steps) {
      score += jobObj.steps.length
    }
    
    if (jobObj.if) {
      score += 2 // Conditional logic
    }
  }
  
  // External dependencies
  if (workflow.permissions) {
    score += Object.keys(workflow.permissions).length
  }
  
  // Triggers complexity
  const triggers = extractTriggers(workflow.on)
  score += triggers.length * 1.5
  
  if (triggers.includes('deployment_status')) score += 3
  if (triggers.includes('workflow_run')) score += 2
  if (triggers.includes('schedule')) score += 1
  
  return Math.round(score)
}

function generateMarkdownOverview(workflows: ParsedWorkflow[]): string {
  const sections = [
    '# Workflow Analysis Overview',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Total workflows: ${workflows.length}`,
    '',
    '## Trigger Distribution',
    ''
  ]
  
  // Trigger statistics
  const triggerStats: Record<string, number> = {}
  workflows.forEach(wf => {
    wf.triggers.forEach(trigger => {
      triggerStats[trigger] = (triggerStats[trigger] || 0) + 1
    })
  })
  
  sections.push('| Trigger | Count |')
  sections.push('|---------|-------|')
  Object.entries(triggerStats)
    .sort(([,a], [,b]) => b - a)
    .forEach(([trigger, count]) => {
      sections.push(`| ${trigger} | ${count} |`)
    })
  
  sections.push('')
  sections.push('## Complexity Distribution')
  sections.push('')
  
  const complexityBuckets = {
    'Low (0-10)': workflows.filter(w => w.complexity_score <= 10).length,
    'Medium (11-25)': workflows.filter(w => w.complexity_score > 10 && w.complexity_score <= 25).length,
    'High (26-50)': workflows.filter(w => w.complexity_score > 25 && w.complexity_score <= 50).length,
    'Very High (50+)': workflows.filter(w => w.complexity_score > 50).length
  }
  
  sections.push('| Complexity | Count |')
  sections.push('|------------|-------|')
  Object.entries(complexityBuckets).forEach(([range, count]) => {
    sections.push(`| ${range} | ${count} |`)
  })
  
  sections.push('')
  sections.push('## Deployment-Related Workflows')
  sections.push('')
  
  const deploymentWorkflows = workflows.filter(w => 
    w.has_deployment_status || 
    w.has_environment_usage ||
    w.name.toLowerCase().includes('deploy') ||
    w.name.toLowerCase().includes('gate')
  )
  
  if (deploymentWorkflows.length > 0) {
    sections.push('| Workflow | Deployment Status | Environment Usage | Triggers |')
    sections.push('|----------|------------------|-------------------|----------|')
    deploymentWorkflows.forEach(wf => {
      sections.push(`| ${wf.name} | ${wf.has_deployment_status ? '✅' : '❌'} | ${wf.has_environment_usage ? '✅' : '❌'} | ${wf.triggers.join(', ')} |`)
    })
  } else {
    sections.push('No deployment-related workflows detected.')
  }
  
  sections.push('')
  sections.push('## High-Complexity Workflows')
  sections.push('')
  
  const highComplexity = workflows
    .filter(w => w.complexity_score > 25)
    .sort((a, b) => b.complexity_score - a.complexity_score)
  
  if (highComplexity.length > 0) {
    sections.push('| Workflow | Complexity Score | Jobs | Triggers | Secrets |')
    sections.push('|----------|-----------------|------|----------|---------|')
    highComplexity.forEach(wf => {
      sections.push(`| ${wf.name} | ${wf.complexity_score} | ${Object.keys(wf.jobs).length} | ${wf.triggers.join(', ')} | ${wf.secrets_referenced.length} |`)
    })
  } else {
    sections.push('All workflows have manageable complexity.')
  }
  
  return sections.join('\n')
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  scanWorkflows().catch(console.error)
}

export { scanWorkflows, parseWorkflow }