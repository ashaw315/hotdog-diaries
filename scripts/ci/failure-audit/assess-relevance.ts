#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs'

interface RelevanceAssessment {
  workflow_file: string
  workflow_name: string
  relevance_score: number
  classification: 'critical' | 'useful' | 'maintenance' | 'redundant' | 'outdated'
  justification: string
  maintenance_burden: 'low' | 'medium' | 'high' | 'very_high'
  recommendations: string[]
  usage_metrics: {
    recent_runs: number
    failure_rate: number
    last_success: string | null
    complexity_score: number
    dependencies: string[]
  }
  business_value: {
    protects_production: boolean
    enforces_quality: boolean
    automates_manual_process: boolean
    provides_visibility: boolean
    blocks_bad_deployments: boolean
  }
  technical_debt: {
    outdated_dependencies: boolean
    hardcoded_values: boolean
    poor_error_handling: boolean
    missing_documentation: boolean
    overly_complex: boolean
  }
}

interface RelevanceReport {
  assessment_timestamp: string
  total_workflows: number
  recommendations_summary: {
    keep_as_is: number
    needs_improvement: number
    consider_deprecation: number
    immediate_action_required: number
  }
  assessments: RelevanceAssessment[]
  priority_actions: {
    critical_fixes: RelevanceAssessment[]
    optimization_candidates: RelevanceAssessment[]
    deprecation_candidates: RelevanceAssessment[]
    maintenance_intensive: RelevanceAssessment[]
  }
}

async function assessRelevance(): Promise<void> {
  console.log('📊 Assessing workflow relevance and maintenance burden...')
  
  // Load previous analysis data
  const workflowsPath = 'ci_audit/failure_forensics/workflows.json'
  const runsPath = 'ci_audit/failure_forensics/runs_and_logs.json'
  const signaturesPath = 'ci_audit/failure_forensics/failure_signatures.json'
  
  if (!existsSync(workflowsPath)) {
    console.error('❌ workflows.json not found. Run scan-workflows.ts first.')
    process.exit(1)
  }
  
  const workflowsData = JSON.parse(readFileSync(workflowsPath, 'utf8'))
  const runsData = existsSync(runsPath) ? JSON.parse(readFileSync(runsPath, 'utf8')) : {}
  const signaturesData = existsSync(signaturesPath) ? JSON.parse(readFileSync(signaturesPath, 'utf8')) : { signatures: [] }
  
  console.log(`🔍 Analyzing ${workflowsData.length} workflows`)
  
  const assessments: RelevanceAssessment[] = []
  
  // Assess each workflow
  for (const workflow of workflowsData) {
    const assessment = assessWorkflow(workflow, runsData[workflow.filename] || {}, signaturesData.signatures || [])
    assessments.push(assessment)
    
    console.log(`📋 ${workflow.name}: ${assessment.classification} (score: ${assessment.relevance_score}/100)`)
  }
  
  // Generate comprehensive report
  const report = generateRelevanceReport(assessments)
  
  // Save results
  writeFileSync(
    'ci_audit/failure_forensics/relevance_assessment.json',
    JSON.stringify(report, null, 2)
  )
  
  // Generate readable report
  const reportMd = generateRelevanceReportMarkdown(report)
  writeFileSync(
    'ci_audit/failure_forensics/relevance_report.md',
    reportMd
  )
  
  console.log('\n✅ Relevance assessment completed')
  console.log(`📊 ${report.recommendations_summary.keep_as_is} workflows are well-maintained`)
  console.log(`⚠️ ${report.recommendations_summary.needs_improvement} workflows need improvement`)
  console.log(`🗑️ ${report.recommendations_summary.consider_deprecation} workflows should be reviewed for deprecation`)
  console.log('📄 Output: ci_audit/failure_forensics/relevance_assessment.json')
  console.log('📄 Report: ci_audit/failure_forensics/relevance_report.md')
}

function assessWorkflow(
  workflow: any,
  runsData: any,
  signatures: any[]
): RelevanceAssessment {
  
  const workflowSignatures = signatures.filter(sig => 
    sig.affected_workflows?.includes(workflow.name)
  )
  
  // Calculate usage metrics
  const recentRuns = runsData.fetch_summary?.runs_fetched || 0
  const failureRate = runsData.fetch_summary?.recent_failure_rate || 0
  const lastSuccess = findLastSuccessfulRun(runsData.runs || [])
  
  // Assess business value
  const businessValue = assessBusinessValue(workflow)
  
  // Assess technical debt
  const technicalDebt = assessTechnicalDebt(workflow, workflowSignatures)
  
  // Calculate maintenance burden
  const maintenanceBurden = calculateMaintenanceBurden(workflow, failureRate, technicalDebt)
  
  // Calculate relevance score (0-100)
  const relevanceScore = calculateRelevanceScore(workflow, businessValue, technicalDebt, recentRuns, failureRate)
  
  // Classify workflow
  const classification = classifyWorkflow(relevanceScore, businessValue, technicalDebt, recentRuns)
  
  // Generate justification and recommendations
  const { justification, recommendations } = generateJustificationAndRecommendations(
    classification,
    businessValue,
    technicalDebt,
    failureRate,
    recentRuns
  )
  
  return {
    workflow_file: workflow.filename,
    workflow_name: workflow.name,
    relevance_score: relevanceScore,
    classification,
    justification,
    maintenance_burden: maintenanceBurden,
    recommendations,
    usage_metrics: {
      recent_runs: recentRuns,
      failure_rate: failureRate,
      last_success: lastSuccess,
      complexity_score: workflow.complexity_score || 0,
      dependencies: extractDependencies(workflow)
    },
    business_value: businessValue,
    technical_debt: technicalDebt
  }
}

function assessBusinessValue(workflow: any): RelevanceAssessment['business_value'] {
  const name = workflow.name.toLowerCase()
  const triggers = workflow.triggers || []
  const jobs = Object.keys(workflow.jobs || {})
  
  return {
    protects_production: (
      name.includes('deploy') || 
      name.includes('gate') || 
      name.includes('security') ||
      triggers.includes('deployment_status')
    ),
    enforces_quality: (
      name.includes('test') ||
      name.includes('lint') ||
      name.includes('validation') ||
      name.includes('check') ||
      jobs.some(job => job.includes('test') || job.includes('lint'))
    ),
    automates_manual_process: (
      name.includes('auto') ||
      name.includes('schedule') ||
      triggers.includes('schedule') ||
      triggers.includes('workflow_dispatch')
    ),
    provides_visibility: (
      name.includes('report') ||
      name.includes('monitor') ||
      name.includes('alert') ||
      name.includes('status')
    ),
    blocks_bad_deployments: (
      name.includes('gate') ||
      name.includes('guard') ||
      name.includes('validation') ||
      triggers.includes('deployment_status')
    )
  }
}

function assessTechnicalDebt(workflow: any, signatures: any[]): RelevanceAssessment['technical_debt'] {
  const workflowContent = JSON.stringify(workflow)
  
  return {
    outdated_dependencies: checkOutdatedDependencies(workflow),
    hardcoded_values: checkHardcodedValues(workflowContent),
    poor_error_handling: checkErrorHandling(workflow, signatures),
    missing_documentation: checkDocumentation(workflow),
    overly_complex: workflow.complexity_score > 50
  }
}

function checkOutdatedDependencies(workflow: any): boolean {
  const content = JSON.stringify(workflow)
  
  // Check for old action versions
  const outdatedPatterns = [
    /actions\/setup-node@v[12]/,
    /actions\/checkout@v[123]/,
    /actions\/upload-artifact@v[123]/,
    /actions\/download-artifact@v[123]/,
    /npm.*install/, // Using npm instead of pnpm
  ]
  
  return outdatedPatterns.some(pattern => pattern.test(content))
}

function checkHardcodedValues(content: string): boolean {
  const hardcodedPatterns = [
    /https:\/\/[^"'\s]+\.vercel\.app/, // Hardcoded Vercel URLs
    /node-version:\s*['"]1[89]['"]/, // Hardcoded old Node versions
    /timeout-minutes:\s*[5-9]\d+/, // Very high timeouts
    /ubuntu-\d+/, // Hardcoded Ubuntu versions
  ]
  
  return hardcodedPatterns.some(pattern => pattern.test(content))
}

function checkErrorHandling(workflow: any, signatures: any[]): boolean {
  // Check if workflow has poor error handling based on signature patterns
  const hasAuthErrors = signatures.some(sig => sig.category === 'authentication' || sig.category === 'permissions')
  const hasNetworkErrors = signatures.some(sig => sig.category === 'network' || sig.category === 'timeout')
  const hasNoRetryLogic = !JSON.stringify(workflow).includes('retry')
  
  return hasAuthErrors || (hasNetworkErrors && hasNoRetryLogic)
}

function checkDocumentation(workflow: any): boolean {
  const hasDescription = Boolean(workflow.description)
  const hasComments = JSON.stringify(workflow).includes('#')
  const hasInputDescriptions = Object.values(workflow.on?.workflow_dispatch?.inputs || {})
    .some((input: any) => input.description)
  
  return !hasDescription && !hasComments && !hasInputDescriptions
}

function calculateMaintenanceBurden(
  workflow: any,
  failureRate: number,
  technicalDebt: RelevanceAssessment['technical_debt']
): RelevanceAssessment['maintenance_burden'] {
  let score = 0
  
  // Failure rate impact
  if (failureRate > 0.5) score += 3
  else if (failureRate > 0.3) score += 2
  else if (failureRate > 0.1) score += 1
  
  // Complexity impact
  if (workflow.complexity_score > 75) score += 3
  else if (workflow.complexity_score > 50) score += 2
  else if (workflow.complexity_score > 25) score += 1
  
  // Technical debt impact
  Object.values(technicalDebt).forEach(hasTechDebt => {
    if (hasTechDebt) score += 1
  })
  
  if (score >= 8) return 'very_high'
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

function calculateRelevanceScore(
  workflow: any,
  businessValue: RelevanceAssessment['business_value'],
  technicalDebt: RelevanceAssessment['technical_debt'],
  recentRuns: number,
  failureRate: number
): number {
  let score = 50 // Start at neutral
  
  // Business value adds points
  Object.values(businessValue).forEach(hasValue => {
    if (hasValue) score += 15
  })
  
  // Technical debt subtracts points
  Object.values(technicalDebt).forEach(hasDebt => {
    if (hasDebt) score -= 8
  })
  
  // Usage frequency impact
  if (recentRuns > 20) score += 10
  else if (recentRuns > 10) score += 5
  else if (recentRuns < 3) score -= 15
  
  // Reliability impact
  if (failureRate < 0.1) score += 10
  else if (failureRate > 0.5) score -= 20
  else if (failureRate > 0.3) score -= 10
  
  // Complexity penalty
  if (workflow.complexity_score > 75) score -= 10
  
  return Math.max(0, Math.min(100, score))
}

function classifyWorkflow(
  score: number,
  businessValue: RelevanceAssessment['business_value'],
  technicalDebt: RelevanceAssessment['technical_debt'],
  recentRuns: number
): RelevanceAssessment['classification'] {
  
  const hasCriticalBusinessValue = businessValue.protects_production || businessValue.blocks_bad_deployments
  const hasHighTechnicalDebt = Object.values(technicalDebt).filter(Boolean).length >= 3
  const isUnused = recentRuns < 5
  
  if (hasCriticalBusinessValue && score >= 60) return 'critical'
  if (score >= 70) return 'useful'
  if (isUnused || score < 30) return 'outdated'
  if (hasHighTechnicalDebt || score < 50) return 'redundant'
  return 'maintenance'
}

function generateJustificationAndRecommendations(
  classification: RelevanceAssessment['classification'],
  businessValue: RelevanceAssessment['business_value'],
  technicalDebt: RelevanceAssessment['technical_debt'],
  failureRate: number,
  recentRuns: number
): { justification: string; recommendations: string[] } {
  
  const businessValues = Object.entries(businessValue).filter(([, value]) => value).map(([key]) => key)
  const techDebtIssues = Object.entries(technicalDebt).filter(([, value]) => value).map(([key]) => key)
  
  let justification = ''
  const recommendations: string[] = []
  
  switch (classification) {
    case 'critical':
      justification = `Critical workflow providing essential business value: ${businessValues.join(', ')}. Must be maintained and improved.`
      if (failureRate > 0.1) recommendations.push('Improve reliability to reduce failure rate')
      if (techDebtIssues.length > 0) recommendations.push(`Address technical debt: ${techDebtIssues.join(', ')}`)
      recommendations.push('Add comprehensive monitoring and alerting')
      break
      
    case 'useful':
      justification = `Valuable workflow with good performance and business relevance. Provides: ${businessValues.join(', ')}.`
      if (techDebtIssues.length > 0) recommendations.push(`Consider addressing: ${techDebtIssues.join(', ')}`)
      recommendations.push('Maintain current functionality')
      if (failureRate > 0.2) recommendations.push('Investigate and fix failure patterns')
      break
      
    case 'maintenance':
      justification = `Workflow requires maintenance attention. Issues: ${techDebtIssues.join(', ')}. Failure rate: ${(failureRate * 100).toFixed(1)}%`
      recommendations.push('Schedule maintenance sprint to address technical debt')
      recommendations.push('Update dependencies and fix hardcoded values')
      if (failureRate > 0.3) recommendations.push('Priority fix for reliability issues')
      break
      
    case 'redundant':
      justification = `Workflow has limited value or significant technical debt (${techDebtIssues.length} issues). Consider consolidation or improvement.`
      recommendations.push('Evaluate if functionality can be merged with other workflows')
      recommendations.push('Consider deprecation if business value is low')
      if (recentRuns > 10) recommendations.push('If keeping, invest in major refactoring')
      break
      
    case 'outdated':
      justification = `Workflow appears outdated or unused (${recentRuns} recent runs). High technical debt: ${techDebtIssues.join(', ')}.`
      recommendations.push('Strong candidate for deprecation')
      recommendations.push('Archive or remove if no longer needed')
      recommendations.push('If still needed, complete rewrite recommended')
      break
  }
  
  return { justification, recommendations }
}

function findLastSuccessfulRun(runs: any[]): string | null {
  const successfulRun = runs.find(run => run.conclusion === 'success')
  return successfulRun ? successfulRun.created_at : null
}

function extractDependencies(workflow: any): string[] {
  const content = JSON.stringify(workflow)
  const dependencies: string[] = []
  
  // Extract GitHub Actions dependencies
  const actionMatches = content.match(/uses:\s*[\'"']([^'\"]+)[\'"']/g) || []
  actionMatches.forEach(match => {
    const action = match.replace(/uses:\s*[\'"']/, '').replace(/[\'"']/, '')
    dependencies.push(action)
  })
  
  return [...new Set(dependencies)]
}

function generateRelevanceReport(assessments: RelevanceAssessment[]): RelevanceReport {
  const recommendations_summary = {
    keep_as_is: assessments.filter(a => a.classification === 'critical' || a.classification === 'useful').length,
    needs_improvement: assessments.filter(a => a.classification === 'maintenance').length,
    consider_deprecation: assessments.filter(a => a.classification === 'redundant' || a.classification === 'outdated').length,
    immediate_action_required: assessments.filter(a => 
      a.classification === 'critical' && a.usage_metrics.failure_rate > 0.3
    ).length
  }
  
  const priority_actions = {
    critical_fixes: assessments
      .filter(a => a.classification === 'critical' && a.usage_metrics.failure_rate > 0.2)
      .sort((a, b) => b.usage_metrics.failure_rate - a.usage_metrics.failure_rate),
    optimization_candidates: assessments
      .filter(a => a.maintenance_burden === 'high' || a.maintenance_burden === 'very_high')
      .sort((a, b) => b.relevance_score - a.relevance_score),
    deprecation_candidates: assessments
      .filter(a => a.classification === 'outdated' || a.classification === 'redundant')
      .sort((a, b) => a.relevance_score - b.relevance_score),
    maintenance_intensive: assessments
      .filter(a => a.maintenance_burden === 'very_high')
      .sort((a, b) => b.usage_metrics.failure_rate - a.usage_metrics.failure_rate)
  }
  
  return {
    assessment_timestamp: new Date().toISOString(),
    total_workflows: assessments.length,
    recommendations_summary,
    assessments: assessments.sort((a, b) => b.relevance_score - a.relevance_score),
    priority_actions
  }
}

function generateRelevanceReportMarkdown(report: RelevanceReport): string {
  const sections = [
    '# Workflow Relevance Assessment',
    '',
    `Generated: ${report.assessment_timestamp}`,
    `Total workflows analyzed: ${report.total_workflows}`,
    '',
    '## Executive Summary',
    ''
  ]
  
  // Executive summary
  sections.push('| Status | Count | Percentage |')
  sections.push('|--------|-------|------------|')
  
  const total = report.total_workflows
  Object.entries(report.recommendations_summary).forEach(([status, count]) => {
    const percentage = ((count / total) * 100).toFixed(1)
    const label = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    sections.push(`| ${label} | ${count} | ${percentage}% |`)
  })
  
  // Priority actions
  if (report.priority_actions.critical_fixes.length > 0) {
    sections.push('')
    sections.push('## 🚨 Critical Issues Requiring Immediate Attention')
    sections.push('')
    
    report.priority_actions.critical_fixes.forEach((assessment, index) => {
      sections.push(`### ${index + 1}. ${assessment.workflow_name}`)
      sections.push(`**Failure Rate**: ${(assessment.usage_metrics.failure_rate * 100).toFixed(1)}%`)
      sections.push(`**Classification**: ${assessment.classification}`)
      sections.push(`**Justification**: ${assessment.justification}`)
      sections.push('')
      sections.push('**Immediate actions**:')
      assessment.recommendations.forEach(rec => {
        sections.push(`- ${rec}`)
      })
      sections.push('')
    })
  }
  
  // Deprecation candidates
  if (report.priority_actions.deprecation_candidates.length > 0) {
    sections.push('')
    sections.push('## 🗑️ Deprecation Candidates')
    sections.push('')
    
    report.priority_actions.deprecation_candidates.forEach(assessment => {
      sections.push(`### ${assessment.workflow_name}`)
      sections.push(`**Score**: ${assessment.relevance_score}/100`)
      sections.push(`**Recent runs**: ${assessment.usage_metrics.recent_runs}`)
      sections.push(`**Justification**: ${assessment.justification}`)
      sections.push('')
    })
  }
  
  // Full assessment table
  sections.push('')
  sections.push('## Complete Assessment')
  sections.push('')
  sections.push('| Workflow | Score | Classification | Maintenance Burden | Failure Rate | Recent Runs |')
  sections.push('|----------|-------|----------------|-------------------|--------------|-------------|')
  
  report.assessments.forEach(assessment => {
    const failureRate = (assessment.usage_metrics.failure_rate * 100).toFixed(1)
    const emoji = assessment.classification === 'critical' ? '🚨' : 
                  assessment.classification === 'useful' ? '✅' :
                  assessment.classification === 'maintenance' ? '🔧' :
                  assessment.classification === 'redundant' ? '⚠️' : '🗑️'
    
    sections.push(`| ${assessment.workflow_name} | ${assessment.relevance_score} | ${emoji} ${assessment.classification} | ${assessment.maintenance_burden} | ${failureRate}% | ${assessment.usage_metrics.recent_runs} |`)
  })
  
  return sections.join('\n')
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  assessRelevance().catch(error => {
    console.error('❌ Relevance assessment failed:', error)
    process.exit(1)
  })
}

export { assessRelevance, RelevanceAssessment, RelevanceReport }