#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs'

interface ForensicsReport {
  report_metadata: {
    generated_at: string
    analysis_scope: string
    total_workflows_analyzed: number
    data_sources: string[]
    analysis_depth: 'shallow' | 'deep' | 'comprehensive'
  }
  executive_summary: {
    overall_health_score: number
    critical_issues_count: number
    workflows_needing_attention: number
    deprecation_candidates: number
    total_failure_patterns: number
    key_findings: string[]
    immediate_actions: string[]
  }
  workflow_portfolio: {
    total_count: number
    by_classification: Record<string, number>
    by_complexity: Record<string, number>
    by_maintenance_burden: Record<string, number>
    by_failure_rate: Record<string, number>
  }
  failure_analysis: {
    total_failures_analyzed: number
    unique_patterns: number
    most_critical_patterns: Array<{
      pattern: string
      category: string
      severity: string
      frequency: number
      affected_workflows: string[]
    }>
    category_breakdown: Record<string, number>
  }
  priority_recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    description: string
    affected_workflows: string[]
    estimated_effort: 'low' | 'medium' | 'high'
    business_impact: 'low' | 'medium' | 'high'
    technical_debt_reduction: number
  }>
  detailed_findings: {
    critical_workflows: any[]
    high_maintenance_workflows: any[]
    failure_prone_workflows: any[]
    outdated_workflows: any[]
  }
  appendix: {
    methodology: string
    data_limitations: string[]
    future_recommendations: string[]
  }
}

async function emitReport(): Promise<void> {
  console.log('📊 Generating comprehensive CI failure forensics report...')
  
  // Load all analysis data
  const dataFiles = {
    workflows: 'ci_audit/failure_forensics/workflows.json',
    runs: 'ci_audit/failure_forensics/runs_and_logs.json',
    signatures: 'ci_audit/failure_forensics/failure_signatures.json',
    relevance: 'ci_audit/failure_forensics/relevance_assessment.json'
  }
  
  const data: Record<string, any> = {}
  const missingFiles: string[] = []
  
  // Load available data
  for (const [key, path] of Object.entries(dataFiles)) {
    if (existsSync(path)) {
      data[key] = JSON.parse(readFileSync(path, 'utf8'))
      console.log(`✅ Loaded ${key} data from ${path}`)
    } else {
      missingFiles.push(path)
      console.warn(`⚠️ Missing ${path}`)
    }
  }
  
  if (missingFiles.length > 0) {
    console.warn(`⚠️ Some analysis files are missing: ${missingFiles.join(', ')}`)
    console.warn('📋 Report will be generated with available data only')
  }
  
  // Generate comprehensive report
  const report = generateComprehensiveReport(data)
  
  // Save main report
  writeFileSync(
    'ci_audit/failure_forensics/FORENSICS_REPORT.json',
    JSON.stringify(report, null, 2)
  )
  
  // Generate markdown version
  const markdownReport = generateMarkdownReport(report)
  writeFileSync(
    'ci_audit/failure_forensics/FORENSICS_REPORT.md',
    markdownReport
  )
  
  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(report)
  writeFileSync(
    'ci_audit/failure_forensics/EXECUTIVE_SUMMARY.md',
    executiveSummary
  )
  
  // Generate action plan
  const actionPlan = generateActionPlan(report)
  writeFileSync(
    'ci_audit/failure_forensics/ACTION_PLAN.md',
    actionPlan
  )
  
  console.log('\n✅ Comprehensive forensics report generated')
  console.log('📄 Main report: ci_audit/failure_forensics/FORENSICS_REPORT.md')
  console.log('📄 Executive summary: ci_audit/failure_forensics/EXECUTIVE_SUMMARY.md')
  console.log('📄 Action plan: ci_audit/failure_forensics/ACTION_PLAN.md')
  console.log('📄 Raw data: ci_audit/failure_forensics/FORENSICS_REPORT.json')
  
  // Print key findings to console
  printKeyFindings(report)
}

function generateComprehensiveReport(data: Record<string, any>): ForensicsReport {
  const workflows = data.workflows || []
  const runsData = data.runs || {}
  const signaturesData = data.signatures || { signatures: [], total_failures_analyzed: 0 }
  const relevanceData = data.relevance || { assessments: [], priority_actions: {} }
  
  // Calculate overall health score
  const healthScore = calculateOverallHealthScore(workflows, signaturesData, relevanceData)
  
  // Extract key findings
  const keyFindings = extractKeyFindings(workflows, signaturesData, relevanceData)
  
  // Generate priority recommendations
  const priorityRecommendations = generatePriorityRecommendations(workflows, signaturesData, relevanceData)
  
  // Analyze workflow portfolio
  const workflowPortfolio = analyzeWorkflowPortfolio(workflows, relevanceData)
  
  // Analyze failure patterns
  const failureAnalysis = analyzeFailurePatterns(signaturesData)
  
  return {
    report_metadata: {
      generated_at: new Date().toISOString(),
      analysis_scope: 'CI/CD Pipeline Health Assessment',
      total_workflows_analyzed: workflows.length,
      data_sources: Object.keys(data),
      analysis_depth: Object.keys(data).length >= 3 ? 'comprehensive' : 'shallow'
    },
    executive_summary: {
      overall_health_score: healthScore,
      critical_issues_count: relevanceData.priority_actions?.critical_fixes?.length || 0,
      workflows_needing_attention: relevanceData.recommendations_summary?.needs_improvement || 0,
      deprecation_candidates: relevanceData.recommendations_summary?.consider_deprecation || 0,
      total_failure_patterns: signaturesData.unique_signatures || 0,
      key_findings: keyFindings,
      immediate_actions: generateImmediateActions(relevanceData, signaturesData)
    },
    workflow_portfolio: workflowPortfolio,
    failure_analysis: failureAnalysis,
    priority_recommendations: priorityRecommendations,
    detailed_findings: {
      critical_workflows: relevanceData.priority_actions?.critical_fixes || [],
      high_maintenance_workflows: relevanceData.priority_actions?.maintenance_intensive || [],
      failure_prone_workflows: extractFailureProneWorkflows(workflows, signaturesData),
      outdated_workflows: relevanceData.priority_actions?.deprecation_candidates || []
    },
    appendix: {
      methodology: 'Automated analysis of GitHub Actions workflows, failure logs, and usage patterns using signature-based failure detection and business value assessment.',
      data_limitations: generateDataLimitations(data),
      future_recommendations: [
        'Implement automated workflow health monitoring',
        'Set up failure pattern alerting',
        'Create workflow deprecation process',
        'Establish maintenance burden metrics',
        'Implement progressive rollout for workflow changes'
      ]
    }
  }
}

function calculateOverallHealthScore(workflows: any[], signaturesData: any, relevanceData: any): number {
  let score = 100
  
  // Deduct for critical issues
  const criticalIssues = relevanceData.priority_actions?.critical_fixes?.length || 0
  score -= criticalIssues * 15
  
  // Deduct for high failure rates
  const highFailureWorkflows = workflows.filter(w => 
    Object.values(relevanceData.runs || {}).some((run: any) => 
      run.workflow_name === w.name && run.fetch_summary?.recent_failure_rate > 0.3
    )
  ).length
  score -= highFailureWorkflows * 10
  
  // Deduct for maintenance burden
  const highMaintenanceCount = relevanceData.assessments?.filter((a: any) => 
    a.maintenance_burden === 'high' || a.maintenance_burden === 'very_high'
  ).length || 0
  score -= highMaintenanceCount * 5
  
  // Deduct for technical debt
  const technicalDebtCount = relevanceData.assessments?.reduce((count: number, a: any) => 
    count + Object.values(a.technical_debt || {}).filter(Boolean).length, 0
  ) || 0
  score -= Math.min(technicalDebtCount * 2, 30)
  
  return Math.max(0, Math.min(100, score))
}

function extractKeyFindings(workflows: any[], signaturesData: any, relevanceData: any): string[] {
  const findings: string[] = []
  
  // Workflow count finding
  findings.push(`Analyzed ${workflows.length} CI/CD workflows across the repository`)
  
  // Critical issues
  const criticalCount = relevanceData.priority_actions?.critical_fixes?.length || 0
  if (criticalCount > 0) {
    findings.push(`${criticalCount} workflows have critical reliability issues requiring immediate attention`)
  }
  
  // Failure patterns
  const criticalPatterns = signaturesData.signatures?.filter((s: any) => s.severity === 'critical').length || 0
  if (criticalPatterns > 0) {
    findings.push(`Identified ${criticalPatterns} critical failure patterns across workflows`)
  }
  
  // Maintenance burden
  const highMaintenance = relevanceData.assessments?.filter((a: any) => 
    a.maintenance_burden === 'very_high'
  ).length || 0
  if (highMaintenance > 0) {
    findings.push(`${highMaintenance} workflows have very high maintenance burden`)
  }
  
  // Deprecation candidates
  const deprecationCount = relevanceData.recommendations_summary?.consider_deprecation || 0
  if (deprecationCount > 0) {
    findings.push(`${deprecationCount} workflows are candidates for deprecation or major refactoring`)
  }
  
  // Common failure categories
  const topCategory = Object.entries(signaturesData.signature_categories || {})
    .sort(([,a], [,b]) => (b as number) - (a as number))[0]
  if (topCategory) {
    findings.push(`Most common failure category: ${topCategory[0]} (${topCategory[1]} occurrences)`)
  }
  
  return findings
}

function generateImmediateActions(relevanceData: any, signaturesData: any): string[] {
  const actions: string[] = []
  
  // Critical workflow fixes
  const criticalWorkflows = relevanceData.priority_actions?.critical_fixes || []
  if (criticalWorkflows.length > 0) {
    actions.push(`Fix ${criticalWorkflows.length} critical workflows with high failure rates`)
  }
  
  // Authentication issues
  const authIssues = signaturesData.signatures?.filter((s: any) => 
    s.category === 'authentication' && s.severity === 'critical'
  ).length || 0
  if (authIssues > 0) {
    actions.push('Resolve authentication and token issues')
  }
  
  // Permission issues
  const permissionIssues = signaturesData.signatures?.filter((s: any) => 
    s.category === 'permissions'
  ).length || 0
  if (permissionIssues > 0) {
    actions.push('Update workflow permissions and repository settings')
  }
  
  // Outdated dependencies
  const outdatedWorkflows = relevanceData.assessments?.filter((a: any) => 
    a.technical_debt?.outdated_dependencies
  ).length || 0
  if (outdatedWorkflows > 0) {
    actions.push(`Update dependencies in ${outdatedWorkflows} workflows`)
  }
  
  return actions
}

function analyzeWorkflowPortfolio(workflows: any[], relevanceData: any): ForensicsReport['workflow_portfolio'] {
  const assessments = relevanceData.assessments || []
  
  const byClassification: Record<string, number> = {}
  const byComplexity: Record<string, number> = {
    'Low (0-25)': 0,
    'Medium (26-50)': 0,
    'High (51-75)': 0,
    'Very High (76+)': 0
  }
  const byMaintenanceBurden: Record<string, number> = {}
  const byFailureRate: Record<string, number> = {
    'Low (0-10%)': 0,
    'Medium (10-30%)': 0,
    'High (30-50%)': 0,
    'Very High (50%+)': 0
  }
  
  assessments.forEach((assessment: any) => {
    // Classification
    byClassification[assessment.classification] = (byClassification[assessment.classification] || 0) + 1
    
    // Complexity
    const complexity = assessment.usage_metrics?.complexity_score || 0
    if (complexity <= 25) byComplexity['Low (0-25)']++
    else if (complexity <= 50) byComplexity['Medium (26-50)']++
    else if (complexity <= 75) byComplexity['High (51-75)']++
    else byComplexity['Very High (76+)']++
    
    // Maintenance burden
    byMaintenanceBurden[assessment.maintenance_burden] = (byMaintenanceBurden[assessment.maintenance_burden] || 0) + 1
    
    // Failure rate
    const failureRate = (assessment.usage_metrics?.failure_rate || 0) * 100
    if (failureRate <= 10) byFailureRate['Low (0-10%)']++
    else if (failureRate <= 30) byFailureRate['Medium (10-30%)']++
    else if (failureRate <= 50) byFailureRate['High (30-50%)']++
    else byFailureRate['Very High (50%+)']++
  })
  
  return {
    total_count: workflows.length,
    by_classification: byClassification,
    by_complexity: byComplexity,
    by_maintenance_burden: byMaintenanceBurden,
    by_failure_rate: byFailureRate
  }
}

function analyzeFailurePatterns(signaturesData: any): ForensicsReport['failure_analysis'] {
  const signatures = signaturesData.signatures || []
  
  const mostCritical = signatures
    .filter((s: any) => s.severity === 'critical' || s.severity === 'high')
    .sort((a: any, b: any) => b.frequency - a.frequency)
    .slice(0, 10)
    .map((s: any) => ({
      pattern: s.pattern.substring(0, 100) + (s.pattern.length > 100 ? '...' : ''),
      category: s.category,
      severity: s.severity,
      frequency: s.frequency,
      affected_workflows: s.affected_workflows || []
    }))
  
  return {
    total_failures_analyzed: signaturesData.total_failures_analyzed || 0,
    unique_patterns: signaturesData.unique_signatures || 0,
    most_critical_patterns: mostCritical,
    category_breakdown: signaturesData.signature_categories || {}
  }
}

function generatePriorityRecommendations(workflows: any[], signaturesData: any, relevanceData: any): ForensicsReport['priority_recommendations'] {
  const recommendations: ForensicsReport['priority_recommendations'] = []
  
  // Critical workflow fixes
  const criticalWorkflows = relevanceData.priority_actions?.critical_fixes || []
  if (criticalWorkflows.length > 0) {
    recommendations.push({
      priority: 'critical',
      title: 'Fix Critical Workflow Reliability Issues',
      description: `${criticalWorkflows.length} workflows have high failure rates and critical business impact`,
      affected_workflows: criticalWorkflows.map((w: any) => w.workflow_name),
      estimated_effort: criticalWorkflows.length > 3 ? 'high' : 'medium',
      business_impact: 'high',
      technical_debt_reduction: 40
    })
  }
  
  // Authentication/permissions fixes
  const authPatterns = signaturesData.signatures?.filter((s: any) => 
    s.category === 'authentication' || s.category === 'permissions'
  ) || []
  if (authPatterns.length > 0) {
    recommendations.push({
      priority: 'critical',
      title: 'Resolve Authentication and Permission Issues',
      description: `${authPatterns.length} authentication/permission failure patterns detected`,
      affected_workflows: [...new Set(authPatterns.flatMap((p: any) => p.affected_workflows || []))],
      estimated_effort: 'medium',
      business_impact: 'high',
      technical_debt_reduction: 30
    })
  }
  
  // Dependency updates
  const outdatedWorkflows = relevanceData.assessments?.filter((a: any) => 
    a.technical_debt?.outdated_dependencies
  ) || []
  if (outdatedWorkflows.length > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Update Outdated Dependencies',
      description: `${outdatedWorkflows.length} workflows use outdated actions or dependencies`,
      affected_workflows: outdatedWorkflows.map((w: any) => w.workflow_name),
      estimated_effort: 'medium',
      business_impact: 'medium',
      technical_debt_reduction: 25
    })
  }
  
  // Workflow deprecation
  const deprecationCandidates = relevanceData.priority_actions?.deprecation_candidates || []
  if (deprecationCandidates.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Deprecate Unused or Redundant Workflows',
      description: `${deprecationCandidates.length} workflows have low business value or are unused`,
      affected_workflows: deprecationCandidates.map((w: any) => w.workflow_name),
      estimated_effort: 'low',
      business_impact: 'low',
      technical_debt_reduction: 50
    })
  }
  
  return recommendations
}

function extractFailureProneWorkflows(workflows: any[], signaturesData: any): any[] {
  const signatures = signaturesData.signatures || []
  const workflowFailureCounts: Record<string, number> = {}
  
  signatures.forEach((sig: any) => {
    (sig.affected_workflows || []).forEach((workflow: string) => {
      workflowFailureCounts[workflow] = (workflowFailureCounts[workflow] || 0) + sig.frequency
    })
  })
  
  return Object.entries(workflowFailureCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ workflow_name: name, failure_count: count }))
}

function generateDataLimitations(data: Record<string, any>): string[] {
  const limitations: string[] = []
  
  if (!data.runs) {
    limitations.push('GitHub Actions run data not available - analysis based on workflow definitions only')
  }
  
  if (!data.signatures) {
    limitations.push('Failure signature analysis not performed - cannot identify specific failure patterns')
  }
  
  if (!data.relevance) {
    limitations.push('Relevance assessment not performed - business value analysis limited')
  }
  
  limitations.push('Analysis limited to workflows in .github/workflows directory')
  limitations.push('Historical data limited to last 50 runs per workflow')
  limitations.push('Log analysis may miss certain failure patterns due to log formatting variations')
  
  return limitations
}

function generateMarkdownReport(report: ForensicsReport): string {
  const sections = [
    '# CI/CD Pipeline Forensics Report',
    '',
    `**Generated**: ${report.report_metadata.generated_at}`,
    `**Analysis Scope**: ${report.report_metadata.analysis_scope}`,
    `**Workflows Analyzed**: ${report.report_metadata.total_workflows_analyzed}`,
    `**Overall Health Score**: ${report.executive_summary.overall_health_score}/100`,
    '',
    '## Executive Summary',
    '',
    `This comprehensive analysis of ${report.report_metadata.total_workflows_analyzed} CI/CD workflows reveals an overall health score of **${report.executive_summary.overall_health_score}/100**.`,
    '',
    '### Key Findings',
    ''
  ]
  
  report.executive_summary.key_findings.forEach(finding => {
    sections.push(`- ${finding}`)
  })
  
  sections.push('')
  sections.push('### Immediate Actions Required')
  sections.push('')
  
  report.executive_summary.immediate_actions.forEach(action => {
    sections.push(`- ${action}`)
  })
  
  // Workflow Portfolio Analysis
  sections.push('')
  sections.push('## Workflow Portfolio Analysis')
  sections.push('')
  sections.push('### By Classification')
  sections.push('')
  sections.push('| Classification | Count | Percentage |')
  sections.push('|----------------|-------|------------|')
  
  Object.entries(report.workflow_portfolio.by_classification).forEach(([classification, count]) => {
    const percentage = ((count / report.workflow_portfolio.total_count) * 100).toFixed(1)
    const emoji = classification === 'critical' ? '🚨' : 
                  classification === 'useful' ? '✅' :
                  classification === 'maintenance' ? '🔧' :
                  classification === 'redundant' ? '⚠️' : '🗑️'
    sections.push(`| ${emoji} ${classification} | ${count} | ${percentage}% |`)
  })
  
  // Priority Recommendations
  if (report.priority_recommendations.length > 0) {
    sections.push('')
    sections.push('## Priority Recommendations')
    sections.push('')
    
    report.priority_recommendations.forEach((rec, index) => {
      const priorityEmoji = rec.priority === 'critical' ? '🚨' : 
                           rec.priority === 'high' ? '⚠️' :
                           rec.priority === 'medium' ? '🟡' : '🔵'
      
      sections.push(`### ${priorityEmoji} ${rec.title}`)
      sections.push('')
      sections.push(`**Priority**: ${rec.priority}`)
      sections.push(`**Description**: ${rec.description}`)
      sections.push(`**Estimated Effort**: ${rec.estimated_effort}`)
      sections.push(`**Business Impact**: ${rec.business_impact}`)
      sections.push(`**Technical Debt Reduction**: ${rec.technical_debt_reduction}%`)
      sections.push('')
      sections.push('**Affected Workflows**:')
      rec.affected_workflows.forEach(workflow => {
        sections.push(`- ${workflow}`)
      })
      sections.push('')
    })
  }
  
  // Failure Analysis
  if (report.failure_analysis.total_failures_analyzed > 0) {
    sections.push('')
    sections.push('## Failure Pattern Analysis')
    sections.push('')
    sections.push(`**Total Failures Analyzed**: ${report.failure_analysis.total_failures_analyzed}`)
    sections.push(`**Unique Patterns**: ${report.failure_analysis.unique_patterns}`)
    sections.push('')
    sections.push('### Most Critical Patterns')
    sections.push('')
    
    report.failure_analysis.most_critical_patterns.forEach((pattern, index) => {
      sections.push(`#### ${index + 1}. ${pattern.category} (${pattern.frequency} occurrences)`)
      sections.push('')
      sections.push(`**Severity**: ${pattern.severity}`)
      sections.push(`**Affected Workflows**: ${pattern.affected_workflows.join(', ')}`)
      sections.push('')
      sections.push('**Pattern**:')
      sections.push('```')
      sections.push(pattern.pattern)
      sections.push('```')
      sections.push('')
    })
  }
  
  // Appendix
  sections.push('')
  sections.push('## Methodology')
  sections.push('')
  sections.push(report.appendix.methodology)
  
  if (report.appendix.data_limitations.length > 0) {
    sections.push('')
    sections.push('## Data Limitations')
    sections.push('')
    report.appendix.data_limitations.forEach(limitation => {
      sections.push(`- ${limitation}`)
    })
  }
  
  return sections.join('\n')
}

function generateExecutiveSummary(report: ForensicsReport): string {
  return [
    '# Executive Summary: CI/CD Pipeline Health',
    '',
    `**Analysis Date**: ${new Date(report.report_metadata.generated_at).toLocaleDateString()}`,
    `**Overall Health Score**: ${report.executive_summary.overall_health_score}/100`,
    '',
    '## Key Metrics',
    '',
    `- **Workflows Analyzed**: ${report.report_metadata.total_workflows_analyzed}`,
    `- **Critical Issues**: ${report.executive_summary.critical_issues_count}`,
    `- **Workflows Needing Attention**: ${report.executive_summary.workflows_needing_attention}`,
    `- **Deprecation Candidates**: ${report.executive_summary.deprecation_candidates}`,
    `- **Unique Failure Patterns**: ${report.executive_summary.total_failure_patterns}`,
    '',
    '## Immediate Actions Required',
    '',
    ...report.executive_summary.immediate_actions.map(action => `- ${action}`),
    '',
    '## Business Impact',
    '',
    `The CI/CD pipeline health score of ${report.executive_summary.overall_health_score}/100 indicates ` +
    (report.executive_summary.overall_health_score >= 80 ? 'excellent pipeline health with minimal issues.' :
     report.executive_summary.overall_health_score >= 60 ? 'good pipeline health with some areas for improvement.' :
     report.executive_summary.overall_health_score >= 40 ? 'moderate pipeline health requiring attention.' :
     'poor pipeline health requiring immediate action.'),
    '',
    '**Recommended Next Steps**:',
    '1. Address critical workflow reliability issues',
    '2. Implement recommended fixes for authentication/permission problems', 
    '3. Update outdated dependencies and configurations',
    '4. Review deprecation candidates for potential removal',
    '5. Establish ongoing monitoring for pipeline health'
  ].join('\n')
}

function generateActionPlan(report: ForensicsReport): string {
  const sections = [
    '# CI/CD Pipeline Action Plan',
    '',
    `Generated: ${new Date(report.report_metadata.generated_at).toLocaleDateString()}`,
    '',
    '## Phase 1: Critical Issues (Immediate - 1-2 weeks)',
    ''
  ]
  
  const criticalRecs = report.priority_recommendations.filter(r => r.priority === 'critical')
  if (criticalRecs.length > 0) {
    criticalRecs.forEach((rec, index) => {
      sections.push(`### ${index + 1}. ${rec.title}`)
      sections.push(`**Effort**: ${rec.estimated_effort} | **Impact**: ${rec.business_impact}`)
      sections.push('')
      sections.push('**Tasks**:')
      rec.affected_workflows.forEach(workflow => {
        sections.push(`- [ ] Fix ${workflow}`)
      })
      sections.push('')
    })
  } else {
    sections.push('✅ No critical issues identified')
  }
  
  sections.push('')
  sections.push('## Phase 2: High Priority (2-4 weeks)')
  sections.push('')
  
  const highRecs = report.priority_recommendations.filter(r => r.priority === 'high')
  if (highRecs.length > 0) {
    highRecs.forEach((rec, index) => {
      sections.push(`### ${index + 1}. ${rec.title}`)
      sections.push(`**Effort**: ${rec.estimated_effort} | **Impact**: ${rec.business_impact}`)
      sections.push('')
      sections.push('**Tasks**:')
      rec.affected_workflows.slice(0, 5).forEach(workflow => {
        sections.push(`- [ ] Update ${workflow}`)
      })
      if (rec.affected_workflows.length > 5) {
        sections.push(`- [ ] ... and ${rec.affected_workflows.length - 5} more workflows`)
      }
      sections.push('')
    })
  }
  
  sections.push('')
  sections.push('## Phase 3: Maintenance (1-2 months)')
  sections.push('')
  
  const mediumRecs = report.priority_recommendations.filter(r => r.priority === 'medium')
  mediumRecs.forEach((rec, index) => {
    sections.push(`### ${index + 1}. ${rec.title}`)
    sections.push(`**Expected Outcome**: ${rec.technical_debt_reduction}% technical debt reduction`)
    sections.push('')
  })
  
  sections.push('')
  sections.push('## Success Metrics')
  sections.push('')
  sections.push('- [ ] Overall health score improved to 80+')
  sections.push('- [ ] Zero critical workflow failures')
  sections.push('- [ ] All authentication/permission issues resolved')
  sections.push('- [ ] Dependency update process established')
  sections.push('- [ ] Unused workflows removed or documented')
  
  return sections.join('\n')
}

function printKeyFindings(report: ForensicsReport): void {
  console.log('\n📋 KEY FINDINGS SUMMARY')
  console.log('========================')
  console.log(`Overall Health Score: ${report.executive_summary.overall_health_score}/100`)
  console.log(`Critical Issues: ${report.executive_summary.critical_issues_count}`)
  console.log(`Workflows Needing Attention: ${report.executive_summary.workflows_needing_attention}`)
  console.log(`Deprecation Candidates: ${report.executive_summary.deprecation_candidates}`)
  
  if (report.executive_summary.immediate_actions.length > 0) {
    console.log('\n🚨 IMMEDIATE ACTIONS REQUIRED:')
    report.executive_summary.immediate_actions.forEach(action => {
      console.log(`  - ${action}`)
    })
  }
  
  console.log(`\n📊 Full analysis available in ci_audit/failure_forensics/`)
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  emitReport().catch(error => {
    console.error('❌ Report generation failed:', error)
    process.exit(1)
  })
}

export { emitReport, ForensicsReport }