#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

interface WorkflowAssessment {
  workflow: string
  recentFailRate: number
  dominantSignatures: string[]
  triggerSummary: {
    push: boolean
    pull_request: boolean
    schedule: boolean
    workflow_dispatch: boolean
    deployment_status: boolean
    other: string[]
  }
  assessment: 'useful' | 'necessary' | 'redundant' | 'outdated'
  rationale: string
  suggestedQuestions: string[]
}

function inferIntent(workflowName: string, triggers: string[]): string {
  const name = workflowName.toLowerCase()
  
  // Deployment workflows
  if (name.includes('deploy') || name.includes('gate') || triggers.includes('deployment_status')) {
    return 'deployment_protection'
  }
  
  // Content management
  if (name.includes('scan') || name.includes('content') || name.includes('post')) {
    return 'content_management'
  }
  
  // CI/CD quality gates
  if (name.includes('test') || name.includes('validation') || name.includes('check')) {
    return 'quality_gate'
  }
  
  // Monitoring
  if (name.includes('monitor') || name.includes('audit') || name.includes('health')) {
    return 'monitoring'
  }
  
  // Scheduled operations
  if (name.includes('daily') || name.includes('cleanup') || triggers.includes('schedule')) {
    return 'scheduled_operations'
  }
  
  // Security
  if (name.includes('secret') || name.includes('security') || name.includes('auth')) {
    return 'security'
  }
  
  return 'utility'
}

function assessWorkflow(
  workflowName: string,
  runs: any[],
  signatures: any[]
): WorkflowAssessment {
  const workflowRuns = runs.filter(r => r.workflowName === workflowName)
  const workflowSignatures = signatures.filter(s => s.workflow === workflowName)
  
  // Calculate failure rate
  const totalRuns = workflowRuns.length
  const failedRuns = workflowRuns.filter(r => 
    r.conclusion === 'failure' || r.conclusion === 'neutral' || r.conclusion === 'skipped'
  ).length
  const failRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0
  
  // Get dominant signatures
  const signatureCounts: Record<string, number> = {}
  for (const sig of workflowSignatures) {
    signatureCounts[sig.signature] = (signatureCounts[sig.signature] || 0) + 1
  }
  
  const dominantSignatures = Object.entries(signatureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sig]) => sig)
  
  // Analyze triggers
  const triggerSet = new Set<string>()
  for (const run of workflowRuns) {
    triggerSet.add(run.event)
  }
  
  const triggerSummary = {
    push: triggerSet.has('push'),
    pull_request: triggerSet.has('pull_request'),
    schedule: triggerSet.has('schedule'),
    workflow_dispatch: triggerSet.has('workflow_dispatch'),
    deployment_status: triggerSet.has('deployment_status'),
    other: Array.from(triggerSet).filter(t => 
      !['push', 'pull_request', 'schedule', 'workflow_dispatch', 'deployment_status'].includes(t)
    )
  }
  
  // Infer intent
  const intent = inferIntent(workflowName, Array.from(triggerSet))
  
  // Determine assessment
  let assessment: WorkflowAssessment['assessment'] = 'useful'
  let rationale = ''
  const suggestedQuestions: string[] = []
  
  // High-value workflows
  if (intent === 'deployment_protection' || intent === 'security') {
    assessment = 'necessary'
    rationale = 'Critical for production safety and security'
  }
  // Broken but important
  else if (failRate > 50 && (intent === 'quality_gate' || intent === 'monitoring')) {
    assessment = 'necessary'
    rationale = `Important ${intent.replace('_', ' ')} workflow but needs fixing (${failRate.toFixed(0)}% failure rate)`
    suggestedQuestions.push('Should this workflow be refactored or replaced?')
  }
  // Content workflows with permission issues
  else if (intent === 'content_management' && dominantSignatures.includes('PERMISSION')) {
    assessment = 'redundant'
    rationale = 'Content workflow with permission issues - may be superseded'
    suggestedQuestions.push('Is this content scanner still needed?')
    suggestedQuestions.push('Can it be consolidated with other scanners?')
  }
  // Consistently failing workflows
  else if (failRate > 75) {
    assessment = 'outdated'
    rationale = `Consistently failing (${failRate.toFixed(0)}% failure rate) - likely outdated`
    suggestedQuestions.push('When was this workflow last successfully used?')
    suggestedQuestions.push('What system or process replaced this?')
  }
  // Missing secrets/env issues
  else if (dominantSignatures.includes('MISSING_SECRET') || dominantSignatures.includes('ENV_INCOMPLETE')) {
    assessment = 'redundant'
    rationale = 'Configuration incomplete - may not be actively maintained'
    suggestedQuestions.push('Are the required secrets still available?')
    suggestedQuestions.push('Is this workflow documented in the runbook?')
  }
  // No recent runs
  else if (totalRuns === 0) {
    assessment = 'outdated'
    rationale = 'No recent runs detected'
    suggestedQuestions.push('Is this workflow triggered by external events?')
    suggestedQuestions.push('Should this be removed or archived?')
  }
  // Auth token policy failures
  else if (dominantSignatures.includes('AUTH_TOKEN_POLICY')) {
    assessment = 'necessary'
    rationale = 'Auth validation workflow - needs token policy update'
    suggestedQuestions.push('What are the current token requirements?')
  }
  // Health check failures
  else if (dominantSignatures.includes('HEALTH_CHECK')) {
    assessment = 'necessary'
    rationale = 'Health monitoring workflow - endpoint may need update'
    suggestedQuestions.push('Are the health endpoints correctly configured?')
  }
  // Default useful
  else {
    assessment = 'useful'
    rationale = `${intent.replace('_', ' ')} workflow with manageable failure rate (${failRate.toFixed(0)}%)`
  }
  
  // Add context-specific questions
  if (dominantSignatures.includes('GITHUB_API')) {
    suggestedQuestions.push('Are GitHub API permissions correctly configured?')
  }
  if (dominantSignatures.includes('DEPLOYMENT_STATUS')) {
    suggestedQuestions.push('Is deployment status event being triggered correctly?')
  }
  if (dominantSignatures.includes('TIMEOUT')) {
    suggestedQuestions.push('Should timeout limits be increased?')
  }
  if (triggerSummary.schedule) {
    suggestedQuestions.push('Is the schedule frequency appropriate?')
  }
  
  return {
    workflow: workflowName,
    recentFailRate: failRate,
    dominantSignatures,
    triggerSummary,
    assessment,
    rationale,
    suggestedQuestions
  }
}

async function main() {
  console.log('🔍 Assessing workflow usefulness...')
  
  const outputDir = 'ci_audit/failure_drilldown'
  const runsPath = join(outputDir, 'runs.json')
  const signaturesPath = join(outputDir, 'failure_signatures.json')
  
  if (!existsSync(runsPath)) {
    console.error('❌ runs.json not found. Run fetch-runs-and-logs.ts first.')
    process.exit(1)
  }
  
  if (!existsSync(signaturesPath)) {
    console.error('❌ failure_signatures.json not found. Run classify-failures.ts first.')
    process.exit(1)
  }
  
  const runs = JSON.parse(readFileSync(runsPath, 'utf8'))
  const signatures = JSON.parse(readFileSync(signaturesPath, 'utf8'))
  
  // Get unique workflow names
  const workflowNames = new Set<string>()
  for (const run of runs) {
    workflowNames.add(run.workflowName)
  }
  
  console.log(`📊 Assessing ${workflowNames.size} workflows...`)
  
  const assessments: WorkflowAssessment[] = []
  
  for (const workflowName of workflowNames) {
    const assessment = assessWorkflow(workflowName, runs, signatures)
    assessments.push(assessment)
    
    const icon = {
      necessary: '🚨',
      useful: '✅',
      redundant: '♻️',
      outdated: '🗑️'
    }[assessment.assessment]
    
    console.log(`  ${icon} ${workflowName}: ${assessment.assessment} (${assessment.recentFailRate.toFixed(0)}% fail rate)`)
    console.log(`     Rationale: ${assessment.rationale}`)
    
    if (assessment.dominantSignatures.length > 0) {
      console.log(`     Issues: ${assessment.dominantSignatures.join(', ')}`)
    }
  }
  
  // Save assessments
  writeFileSync(
    join(outputDir, 'workflow_assessments.json'),
    JSON.stringify(assessments, null, 2)
  )
  
  // Generate summary statistics
  const counts = {
    necessary: 0,
    useful: 0,
    redundant: 0,
    outdated: 0
  }
  
  for (const assessment of assessments) {
    counts[assessment.assessment]++
  }
  
  console.log('\n📊 Assessment Summary:')
  console.log(`  🚨 Necessary: ${counts.necessary} workflows`)
  console.log(`  ✅ Useful: ${counts.useful} workflows`)
  console.log(`  ♻️ Redundant: ${counts.redundant} workflows`)
  console.log(`  🗑️ Outdated: ${counts.outdated} workflows`)
  
  // Identify high-priority fixes
  const highPriority = assessments
    .filter(a => a.assessment === 'necessary' && a.recentFailRate > 25)
    .sort((a, b) => b.recentFailRate - a.recentFailRate)
  
  if (highPriority.length > 0) {
    console.log('\n⚠️ High Priority Fixes:')
    for (const workflow of highPriority) {
      console.log(`  - ${workflow.workflow}: ${workflow.recentFailRate.toFixed(0)}% failure rate`)
      console.log(`    Issues: ${workflow.dominantSignatures.join(', ')}`)
    }
  }
  
  console.log('\n✅ Assessment complete!')
  console.log(`📁 Output: ${outputDir}/workflow_assessments.json`)
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as assessUsefulness }