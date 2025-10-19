#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

interface ReportData {
  runs: any[]
  signatures: any[]
  assessments: any[]
  metadata: {
    generated: string
    totalWorkflows: number
    totalRuns: number
    totalSignatures: number
  }
}

function generateExecutiveSummary(data: ReportData): string {
  const { assessments, runs, signatures } = data
  
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
  
  return `# CI Failure Drilldown - Executive Summary

## 📊 Key Metrics

- **Workflows Analyzed**: ${data.metadata.totalWorkflows}
- **Recent Runs**: ${data.metadata.totalRuns}
- **Overall Failure Rate**: ${overallFailRate.toFixed(1)}%
- **Failure Signatures**: ${data.metadata.totalSignatures}

## 🎯 Workflow Assessment

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

${highFailureWorkflows.length > 0 
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
  
  const outputDir = 'ci_audit/failure_drilldown'
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
  
  const data: ReportData = {
    runs,
    signatures,
    assessments,
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