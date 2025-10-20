#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

interface ReportData {
  runs: any[]
  signatures: any[]
  assessments: any[]
  snapshot?: any[]
  workflows?: any[]
  harvestSummary?: any
  isRepowide?: boolean
  metadata: {
    generated: string
    totalWorkflows: number
    totalRuns: number
    totalSignatures: number
  }
}

function generateRepowideSection(data: ReportData): string {
  if (!data.isRepowide || !data.harvestSummary) return ''
  
  const { runs, workflows, harvestSummary } = data
  
  // Calculate workflow stats by non-success count
  const workflowStats = new Map<number, { name: string, path: string, nonSuccessCount: number, eventMix: string[], lastFailure: string | null, primarySignature: string | null }>()
  
  for (const run of runs) {
    const workflowId = run.workflow_id
    const workflow = workflows?.find((w: any) => w.id === workflowId)
    
    if (!workflowStats.has(workflowId)) {
      workflowStats.set(workflowId, {
        name: workflow?.name || run.workflow_name || `Workflow ${workflowId}`,
        path: workflow?.path || 'Unknown path',
        nonSuccessCount: 0,
        eventMix: [],
        lastFailure: null,
        primarySignature: null
      })
    }
    
    const stats = workflowStats.get(workflowId)!
    
    // Track non-success runs
    if (run.conclusion !== 'success') {
      stats.nonSuccessCount++
      if (!stats.lastFailure || new Date(run.updated_at) > new Date(stats.lastFailure)) {
        stats.lastFailure = run.updated_at
      }
    }
    
    // Track event types
    if (!stats.eventMix.includes(run.event)) {
      stats.eventMix.push(run.event)
    }
  }
  
  // Add signature data
  for (const signature of data.signatures) {
    const workflowName = signature.workflow
    const workflowId = Array.from(workflowStats.keys()).find(id => {
      const stats = workflowStats.get(id)!
      return stats.name === workflowName || workflowName.includes(String(id))
    })
    
    if (workflowId && !workflowStats.get(workflowId)!.primarySignature) {
      workflowStats.get(workflowId)!.primarySignature = signature.signature
    }
  }
  
  // Sort by non-success count and take top 10
  const topWorkflows = Array.from(workflowStats.entries())
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.nonSuccessCount - a.nonSuccessCount)
    .slice(0, 10)
    
  const timeWindow = harvestSummary.timeWindow
  const cutoffDate = new Date(timeWindow.cutoffTime).toISOString().split('T')[0]
  const currentDate = new Date().toISOString().split('T')[0]
  
  return `
## 📊 Repo-wide Analysis (${harvestSummary.timeWindow.sinceHours}h)

**Time Window**: ${cutoffDate} to ${currentDate} (UTC)

### Summary Totals
- **Success**: ${harvestSummary.conclusions.success} runs
- **Failure**: ${harvestSummary.conclusions.failure} runs  
- **Neutral**: ${harvestSummary.conclusions.neutral} runs
- **Skipped**: ${harvestSummary.conclusions.skipped} runs
- **Cancelled**: ${harvestSummary.conclusions.cancelled} runs
- **Other**: ${harvestSummary.conclusions.other} runs

### Top 10 Workflows by Non-Success Count

| Workflow Path | Event Mix | Non-Success | Last Failure | Primary Signature | Sample Evidence | Link |
|---------------|-----------|-------------|--------------|-------------------|-----------------|------|
${topWorkflows.map(w => {
  const eventMix = w.eventMix.join(', ')
  const lastFailure = w.lastFailure ? new Date(w.lastFailure).toLocaleDateString() : 'None'
  const signature = w.primarySignature || 'None'
  const sampleEvidence = data.signatures.find(s => s.workflow === w.name)?.evidenceLines[0] || 'None'
  const truncatedEvidence = sampleEvidence.length > 40 ? sampleEvidence.substring(0, 40) + '...' : sampleEvidence
  const workflowSlug = w.path.replace(/[^a-zA-Z0-9]/g, '_')
  
  return `| \`${w.path}\` | ${eventMix} | ${w.nonSuccessCount} | ${lastFailure} | ${signature} | \`${truncatedEvidence}\` | [View Workflow](${w.path}) |`
}).join('\n')}

`
}

function generateIdentityDriftSection(data: ReportData): string {
  if (!data.isRepowide || !data.workflows) return ''
  
  const { runs, workflows } = data
  
  // Find workflows with runs but no current workflow file
  const currentWorkflowIds = new Set(workflows.map((w: any) => w.id))
  const runWorkflowIds = new Set(runs.map((r: any) => r.workflow_id))
  
  const orphanedWorkflows: any[] = []
  const renamedWorkflows: any[] = []
  
  for (const workflowId of runWorkflowIds) {
    if (!currentWorkflowIds.has(workflowId)) {
      // This workflow has runs but no current definition - it was deleted
      const runSample = runs.find((r: any) => r.workflow_id === workflowId)
      orphanedWorkflows.push({
        id: workflowId,
        oldName: runSample?.workflow_name || 'Unknown',
        lastSeen: Math.max(...runs.filter((r: any) => r.workflow_id === workflowId).map((r: any) => new Date(r.updated_at).getTime()))
      })
    }
  }
  
  // Find potential renames (same name, different ID or path)
  for (const workflow of workflows) {
    const similarRuns = runs.filter((r: any) => 
      r.workflow_name === workflow.name && r.workflow_id !== workflow.id
    )
    
    if (similarRuns.length > 0) {
      renamedWorkflows.push({
        currentId: workflow.id,
        currentPath: workflow.path,
        currentName: workflow.name,
        oldIds: [...new Set(similarRuns.map((r: any) => r.workflow_id))],
        oldPaths: [...new Set(similarRuns.map((r: any) => r.workflow_path || 'Unknown'))]
      })
    }
  }
  
  if (orphanedWorkflows.length === 0 && renamedWorkflows.length === 0) {
    return ''
  }
  
  return `
## 🔄 Identity Drift Analysis

${orphanedWorkflows.length > 0 ? `### Deleted Workflows (${orphanedWorkflows.length})
${orphanedWorkflows.map(w => {
  const lastSeenDate = new Date(w.lastSeen).toLocaleDateString()
  return `- **${w.oldName}** (ID: ${w.id}) - Last seen: ${lastSeenDate}`
}).join('\n')}

*These workflows have recent runs but no current workflow file. Consider if their failures are still relevant.*
` : ''}${renamedWorkflows.length > 0 ? `### Potential Renames (${renamedWorkflows.length})
${renamedWorkflows.map(w => {
  return `- **${w.currentName}**
  - Current: \`${w.currentPath}\` (ID: ${w.currentId})
  - Previous: ${w.oldPaths.join(', ')} (IDs: ${w.oldIds.join(', ')})`
}).join('\n\n')}

*These workflows may have been moved or renamed. Earlier failures belong to the old workflow IDs.*
` : ''}
`
}

function generateExecutiveSummary(data: ReportData): string {
  const { assessments, runs, signatures, snapshot } = data
  
  const counts = {
    necessary: assessments.filter((a: any) => a.assessment === 'necessary').length,
    useful: assessments.filter((a: any) => a.assessment === 'useful').length,
    redundant: assessments.filter((a: any) => a.assessment === 'redundant').length,
    outdated: assessments.filter((a: any) => a.assessment === 'outdated').length
  }
  
  const totalRuns = runs.length
  const failedRuns = runs.filter((r: any) => 
    r.conclusion === 'failure' || r.conclusion === 'neutral' || r.conclusion === 'skipped'
  ).length
  const overallFailRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0
  
  const highFailureWorkflows = assessments
    .filter((a: any) => a.recentFailRate > 50)
    .sort((a: any, b: any) => b.recentFailRate - a.recentFailRate)
  
  const topSignatures = signatures
    .reduce((acc: Record<string, number>, sig: any) => {
      acc[sig.signature] = (acc[sig.signature] || 0) + 1
      return acc
    }, {})
  
  const sortedSignatures = Object.entries(topSignatures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  
  // Calculate snapshot summary if available
  let snapshotSection = ''
  if (snapshot && snapshot.length > 0) {
    const totalSnapshot = snapshot.reduce((sum, s) => sum + s.summary.total, 0)
    const nonSuccessSnapshot = snapshot.reduce((sum, s) => 
      sum + s.summary.neutral + s.summary.failure + s.summary.skipped + s.summary.cancelled, 0)
    
    snapshotSection = `
## 📸 Last 24h Snapshot

📋 [View Live Snapshot Matrix](./SNAPSHOT_MATRIX.md)

- **Total Runs (24h)**: ${totalSnapshot}
- **Non-Success Runs**: ${nonSuccessSnapshot}
- **Success Rate**: ${totalSnapshot > 0 ? ((totalSnapshot - nonSuccessSnapshot) / totalSnapshot * 100).toFixed(1) : '0.0'}%

`
  }

  // Generate repowide and identity drift sections
  const repowideSection = generateRepowideSection(data)
  const identityDriftSection = generateIdentityDriftSection(data)

  return `# CI Failure Drilldown - Executive Summary
${repowideSection}${identityDriftSection}
## 📊 Key Metrics

- **Workflows Analyzed**: ${data.metadata.totalWorkflows}
- **Recent Runs**: ${data.metadata.totalRuns}
- **Overall Failure Rate**: ${overallFailRate.toFixed(1)}%
- **Failure Signatures**: ${data.metadata.totalSignatures}

${snapshotSection}## 🎯 Workflow Assessment

| Assessment | Count | Percentage |
|------------|-------|------------|
| 🚨 Necessary | ${counts.necessary} | ${((counts.necessary / assessments.length) * 100).toFixed(1)}% |
| ✅ Useful | ${counts.useful} | ${((counts.useful / assessments.length) * 100).toFixed(1)}% |
| ♻️ Redundant | ${counts.redundant} | ${((counts.redundant / assessments.length) * 100).toFixed(1)}% |
| 🗑️ Outdated | ${counts.outdated} | ${((counts.outdated / assessments.length) * 100).toFixed(1)}% |

## 🚨 High-Failure Workflows

${highFailureWorkflows.length > 0 
  ? highFailureWorkflows.slice(0, 5).map((w: any) => 
      `- **${w.workflow}**: ${w.recentFailRate.toFixed(0)}% failure rate (${w.assessment})\n  - Issues: ${w.dominantSignatures.join(', ')}\n  - Rationale: ${w.rationale}`
    ).join('\n\n')
  : 'No workflows with high failure rates detected.'
}

## 🔍 Most Common Failure Patterns

${sortedSignatures.map(([sig, count]) => `- **${sig}**: ${count} occurrences`).join('\n')}

## 🎯 Priority Actions

${data.metadata.totalRuns === 0 
  ? `### ✅ No Recent Failures Detected

No non-success conclusions found in the last ${runs.length || 'N'} runs analyzed. This indicates good CI health for the target workflows.

**If you observed earlier failures:**
- Increase lookback (currently limited) to capture older runs
- Widen the time window for analysis  
- Check if the specific workflows are triggered by deployment events
- Verify workflow names/paths match the actual failing workflows

**Target workflows analyzed:**
${snapshot ? snapshot.map((s: any) => `- \`${s.workflowPath}\``).join('\n') : '- Configuration not available'}`
  : highFailureWorkflows.length > 0 
    ? `### Immediate (Next Sprint)
${highFailureWorkflows
    .filter((w: any) => w.assessment === 'necessary')
    .slice(0, 3)
    .map((w: any) => `- Fix ${w.workflow} (${w.dominantSignatures.join(', ')})`)
    .join('\n')}

### Near-term (Next Month)
${assessments
    .filter((a: any) => a.assessment === 'redundant' && a.recentFailRate > 0)
    .slice(0, 3)
    .map((a: any) => `- Review ${a.workflow} for consolidation or removal`)
    .join('\n')}`
    : '### Low Priority\n- All workflows appear to be functioning within acceptable parameters'
}

---
*Generated: ${data.metadata.generated}*`
}

function generateDetailedReport(data: ReportData): string {
  const { assessments, runs, signatures } = data
  
  const workflowDetails = assessments.map((assessment: any) => {
    const workflowRuns = runs.filter((r: any) => r.workflowName === assessment.workflow)
    const workflowSignatures = signatures.filter((s: any) => s.workflow === assessment.workflow)
    
    const recentRuns = workflowRuns
      .sort((a: any, b: any) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
      .slice(0, 3)
    
    const icon = {
      necessary: '🚨',
      useful: '✅',
      redundant: '♻️',
      outdated: '🗑️'
    }[assessment.assessment]
    
    return `## ${icon} ${assessment.workflow}

**Assessment**: ${assessment.assessment}
**Failure Rate**: ${assessment.recentFailRate.toFixed(1)}%
**Rationale**: ${assessment.rationale}

### Triggers
- Push: ${assessment.triggerSummary.push ? '✓' : '✗'}
- Pull Request: ${assessment.triggerSummary.pull_request ? '✓' : '✗'}
- Schedule: ${assessment.triggerSummary.schedule ? '✓' : '✗'}
- Manual: ${assessment.triggerSummary.workflow_dispatch ? '✓' : '✗'}
- Deployment: ${assessment.triggerSummary.deployment_status ? '✓' : '✗'}
${assessment.triggerSummary.other.length > 0 ? `- Other: ${assessment.triggerSummary.other.join(', ')}` : ''}

### Dominant Issues
${assessment.dominantSignatures.length > 0 
  ? assessment.dominantSignatures.map((sig: string) => `- ${sig}`).join('\n')
  : 'No recurring issues detected'
}

### Recent Runs
${recentRuns.length > 0 
  ? recentRuns.map((run: any) => 
      `- [Run ${run.runId}](${run.htmlUrl}) - ${run.conclusion || run.status} (${new Date(run.updated).toLocaleDateString()})`
    ).join('\n')
  : 'No recent runs found'
}

### Evidence Examples
${workflowSignatures.slice(0, 2).map((sig: any) => 
  `**${sig.signature}** (Job: ${sig.job}):
\`\`\`
${sig.evidenceLines.slice(0, 3).join('\n')}
\`\`\``
).join('\n\n')}

### Suggested Questions
${assessment.suggestedQuestions.length > 0 
  ? assessment.suggestedQuestions.map((q: string) => `- ${q}`).join('\n')
  : 'No specific questions identified'
}`
  }).join('\n\n---\n\n')
  
  return `# CI Failure Drilldown - Detailed Analysis

*Generated: ${data.metadata.generated}*

This report provides in-depth analysis of CI workflow failures and recommendations for remediation.

${workflowDetails}

---

## 📋 Methodology

This analysis examined ${data.metadata.totalRuns} recent workflow runs across ${data.metadata.totalWorkflows} workflows, identifying ${data.metadata.totalSignatures} failure signatures using pattern matching against log content.

**Assessment Categories:**
- 🚨 **Necessary**: Critical workflows that must be maintained and fixed
- ✅ **Useful**: Working workflows providing value
- ♻️ **Redundant**: Workflows that may be consolidated or simplified
- 🗑️ **Outdated**: Workflows that can likely be removed

**Failure Signature Buckets:**
- MISSING_SECRET: Missing or undefined secret/environment variables
- PERMISSION: Insufficient GitHub/API permissions
- INVALID_TRIGGER: Deployment or event trigger issues
- ENV_INCOMPLETE: Missing required environment configuration
- AUTH_TOKEN_POLICY: Token validation or policy failures
- NETWORK: Connection timeouts, DNS, or service unavailability
- TIMEOUT: Operation timeouts and cancellations
- ASSERTION: Test failures and validation errors
- BUILD_ERROR: Compilation and module resolution failures
- PACKAGE_MANAGER: NPM/PNPM/Yarn dependency issues
- SYNTAX_ERROR: Code parsing and syntax issues
- GITHUB_API: GitHub API access and authentication
- DEPLOYMENT_STATUS: Deployment status event handling
- HEALTH_CHECK: Application health endpoint failures
- WORKFLOW_DISPATCH: Manual workflow invocation issues`
}

function generateActionPlan(data: ReportData): string {
  const { assessments } = data
  
  const necessary = assessments.filter((a: any) => a.assessment === 'necessary')
  const redundant = assessments.filter((a: any) => a.assessment === 'redundant')
  const outdated = assessments.filter((a: any) => a.assessment === 'outdated')
  
  const highFailure = necessary.filter((a: any) => a.recentFailRate > 25)
  const permissionIssues = assessments.filter((a: any) => 
    a.dominantSignatures.includes('PERMISSION') || a.dominantSignatures.includes('MISSING_SECRET')
  )
  const authIssues = assessments.filter((a: any) => 
    a.dominantSignatures.includes('AUTH_TOKEN_POLICY') || a.dominantSignatures.includes('GITHUB_API')
  )
  
  return `# CI Failure Drilldown - Action Plan

*Generated: ${data.metadata.generated}*

## 🚨 Phase 1: Critical Fixes (This Sprint)

${highFailure.length > 0 
  ? `### High-Failure Critical Workflows
${highFailure.map((w: any) => 
  `#### ${w.workflow}
- **Priority**: URGENT
- **Failure Rate**: ${w.recentFailRate.toFixed(0)}%
- **Issues**: ${w.dominantSignatures.join(', ')}
- **Action**: ${w.rationale}
- **Questions**: ${w.suggestedQuestions.slice(0, 2).join('; ')}`
).join('\n\n')}`
  : '✅ No critical high-failure workflows identified'
}

## 🔧 Phase 2: Configuration & Permissions (Next 2 weeks)

${permissionIssues.length > 0 || authIssues.length > 0
  ? `${permissionIssues.length > 0 
      ? `### Permission & Secret Issues (${permissionIssues.length} workflows)
${permissionIssues.slice(0, 5).map((w: any) => `- ${w.workflow}: ${w.dominantSignatures.join(', ')}`).join('\n')}`
      : ''
    }

${authIssues.length > 0 
  ? `### Authentication Issues (${authIssues.length} workflows)
${authIssues.slice(0, 5).map((w: any) => `- ${w.workflow}: ${w.dominantSignatures.join(', ')}`).join('\n')}`
  : ''
}`
  : '✅ No major configuration issues identified'
}

## 🧹 Phase 3: Cleanup & Optimization (Next Month)

${redundant.length > 0 || outdated.length > 0
  ? `### Redundant Workflows (${redundant.length} candidates)
${redundant.slice(0, 5).map((w: any) => `- ${w.workflow}: ${w.rationale}`).join('\n')}
${redundant.length > 5 ? `- ...and ${redundant.length - 5} more` : ''}

### Outdated Workflows (${outdated.length} candidates)
${outdated.slice(0, 5).map((w: any) => `- ${w.workflow}: ${w.rationale}`).join('\n')}
${outdated.length > 5 ? `- ...and ${outdated.length - 5} more` : ''}`
  : '✅ No cleanup opportunities identified'
}

## 📊 Success Metrics

- [ ] Critical workflows (🚨) achieve >90% success rate
- [ ] All permission/secret issues resolved
- [ ] Authentication token policies updated
- [ ] ${redundant.length + outdated.length} workflows reviewed for removal/consolidation
- [ ] Documentation updated for remaining workflows

## 🎯 Quick Wins

${assessments
  .filter((a: any) => a.suggestedQuestions.some((q: string) => q.includes('secret') || q.includes('token')))
  .slice(0, 3)
  .map((a: any) => `- **${a.workflow}**: Update secrets/tokens`)
  .join('\n') || '- Review and update GitHub Actions secrets'}

---

**Next Steps:**
1. Prioritize Phase 1 critical fixes
2. Audit and update secrets/permissions for Phase 2
3. Schedule cleanup sprint for Phase 3
4. Set up monitoring for success metrics`
}

async function main() {
  console.log('📋 Generating drilldown reports...')
  
  // Check for repowide data first, fallback to regular data
  const repowideOutputDir = 'ci_audit/failure_drilldown/repowide'
  const regularOutputDir = 'ci_audit/failure_drilldown'
  
  let outputDir: string
  let isRepowide = false
  
  if (existsSync(join(repowideOutputDir, 'runs.json'))) {
    outputDir = repowideOutputDir
    isRepowide = true
    console.log('📊 Using repowide data for reporting')
  } else {
    outputDir = regularOutputDir
    console.log('📊 Using regular workflow data for reporting')
  }
  
  const requiredFiles = ['runs.json', 'failure_signatures.json', 'workflow_assessments.json']
  
  for (const file of requiredFiles) {
    const filePath = join(outputDir, file)
    if (!existsSync(filePath)) {
      console.error(`❌ ${file} not found. Run previous scripts first.`)
      process.exit(1)
    }
  }
  
  // Load all data
  const runs = JSON.parse(readFileSync(join(outputDir, 'runs.json'), 'utf8'))
  const signatures = JSON.parse(readFileSync(join(outputDir, 'failure_signatures.json'), 'utf8'))
  const assessments = JSON.parse(readFileSync(join(outputDir, 'workflow_assessments.json'), 'utf8'))
  
  // Load additional repowide data
  let workflows = null
  let harvestSummary = null
  if (isRepowide) {
    const workflowsPath = join(outputDir, 'workflows.json')
    const summaryPath = join(outputDir, 'harvest_summary.json')
    
    if (existsSync(workflowsPath)) {
      workflows = JSON.parse(readFileSync(workflowsPath, 'utf8'))
      console.log('📋 Loaded workflow metadata')
    }
    
    if (existsSync(summaryPath)) {
      harvestSummary = JSON.parse(readFileSync(summaryPath, 'utf8'))
      console.log('📊 Loaded harvest summary')
    }
  }
  
  // Load snapshot data if available
  let snapshot = null
  const snapshotPath = join(outputDir, 'snapshot.json')
  if (existsSync(snapshotPath)) {
    snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
    console.log('📸 Loaded live snapshot data')
  }
  
  const data: ReportData = {
    runs,
    signatures,
    assessments,
    snapshot,
    workflows,
    harvestSummary,
    isRepowide,
    metadata: {
      generated: new Date().toISOString(),
      totalWorkflows: assessments.length,
      totalRuns: runs.length,
      totalSignatures: signatures.length
    }
  }
  
  console.log(`📊 Processing data:`)
  console.log(`  - ${data.metadata.totalWorkflows} workflows`)
  console.log(`  - ${data.metadata.totalRuns} runs`)
  console.log(`  - ${data.metadata.totalSignatures} failure signatures`)
  
  // Generate reports
  console.log('📝 Generating executive summary...')
  const executiveSummary = generateExecutiveSummary(data)
  writeFileSync(join(outputDir, 'EXECUTIVE_SUMMARY.md'), executiveSummary)
  
  console.log('📝 Generating detailed report...')
  const detailedReport = generateDetailedReport(data)
  writeFileSync(join(outputDir, 'DETAILED_ANALYSIS.md'), detailedReport)
  
  console.log('📝 Generating action plan...')
  const actionPlan = generateActionPlan(data)
  writeFileSync(join(outputDir, 'ACTION_PLAN.md'), actionPlan)
  
  // Generate main drilldown report (for GitHub issue)
  const drilldownReport = `${executiveSummary}

---

## 🔗 Additional Resources

- [Detailed Analysis](./DETAILED_ANALYSIS.md) - In-depth workflow examination
- [Action Plan](./ACTION_PLAN.md) - Prioritized remediation steps
- [Raw Data](./workflow_assessments.json) - Machine-readable assessment data

*This is an automated CI failure analysis. For questions or to request re-analysis, trigger the "CI Failure Drilldown" workflow.*`
  
  writeFileSync(join(outputDir, 'DRILLDOWN_REPORT.md'), drilldownReport)
  
  // Create summary JSON for automation
  const summary = {
    metadata: data.metadata,
    summary: {
      necessary: assessments.filter((a: any) => a.assessment === 'necessary').length,
      useful: assessments.filter((a: any) => a.assessment === 'useful').length,
      redundant: assessments.filter((a: any) => a.assessment === 'redundant').length,
      outdated: assessments.filter((a: any) => a.assessment === 'outdated').length,
      highFailureCount: assessments.filter((a: any) => a.recentFailRate > 50).length,
      overallHealthScore: Math.round(
        (assessments.filter((a: any) => a.assessment === 'necessary' || a.assessment === 'useful').length / 
         assessments.length) * 100
      )
    }
  }
  
  writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2))
  
  console.log('\n✅ All reports generated!')
  console.log(`📁 Output directory: ${outputDir}/`)
  console.log('📋 Files created:')
  console.log('  - DRILLDOWN_REPORT.md (Main report for GitHub issue)')
  console.log('  - EXECUTIVE_SUMMARY.md')
  console.log('  - DETAILED_ANALYSIS.md')
  console.log('  - ACTION_PLAN.md')
  console.log('  - summary.json')
  
  console.log(`\n🎯 Health Score: ${summary.summary.overallHealthScore}/100`)
  console.log(`🚨 Critical Issues: ${summary.summary.highFailureCount}`)
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as emitDrilldownReport }