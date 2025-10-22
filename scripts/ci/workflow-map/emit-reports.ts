#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { format } from 'date-fns';

interface ReportData {
  workflows: any;
  runStats: any;
  cronMap: any;
  topology: any;
  securityAudit: any;
  duplicationReport: any;
}

function loadData(): ReportData {
  const dataDir = 'ci_audit/workflow_map/data';
  
  return {
    workflows: JSON.parse(readFileSync(`${dataDir}/workflows.json`, 'utf8')),
    runStats: existsSync(`${dataDir}/run_stats.json`) ? JSON.parse(readFileSync(`${dataDir}/run_stats.json`, 'utf8')) : null,
    cronMap: JSON.parse(readFileSync(`${dataDir}/cron_map.json`, 'utf8')),
    topology: JSON.parse(readFileSync(`${dataDir}/topology.json`, 'utf8')),
    securityAudit: JSON.parse(readFileSync(`${dataDir}/security_audit.json`, 'utf8')),
    duplicationReport: JSON.parse(readFileSync(`${dataDir}/duplication_report.json`, 'utf8')),
  };
}

function generateWorkflowCatalog(data: ReportData): string {
  const { workflows } = data;
  
  let content = `# Workflow Catalog\n\n`;
  content += `**Generated:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC  \n`;
  content += `**Repository:** ashaw315/hotdog-diaries  \n`;
  content += `**Total Workflows:** ${workflows.summary.workflow_count}  \n\n`;
  
  content += `## Summary Statistics\n\n`;
  content += `| Metric | Count |\n`;
  content += `|--------|-------|\n`;
  content += `| Total Workflows | ${workflows.summary.workflow_count} |\n`;
  content += `| Composite Actions | ${workflows.summary.composite_action_count} |\n`;
  content += `| Total Jobs | ${workflows.summary.total_jobs} |\n`;
  content += `| Scheduled Workflows | ${workflows.summary.workflows_with_schedule} |\n`;
  content += `| Parse Errors | ${workflows.summary.workflows_with_errors} |\n\n`;
  
  content += `## Workflow Details\n\n`;
  
  for (const workflow of workflows.workflows) {
    content += `### ${workflow.name}\n\n`;
    content += `**File:** \`${workflow.filename}\`  \n`;
    content += `**Jobs:** ${workflow.job_count}  \n`;
    
    if (workflow.triggers.length > 0) {
      content += `**Triggers:** ${workflow.triggers.map((t: any) => t.event).join(', ')}  \n`;
    }
    
    if (workflow.secrets_refs.length > 0) {
      content += `**Secrets:** ${workflow.secrets_refs.join(', ')}  \n`;
    }
    
    if (workflow.vars_refs.length > 0) {
      content += `**Variables:** ${workflow.vars_refs.join(', ')}  \n`;
    }
    
    if (workflow.composite_actions.length > 0) {
      content += `**Composite Actions:** ${workflow.composite_actions.join(', ')}  \n`;
    }
    
    if (workflow.reusable_workflows.length > 0) {
      content += `**Reusable Workflows:** ${workflow.reusable_workflows.join(', ')}  \n`;
    }
    
    if (workflow.permissions) {
      const perms = Object.entries(workflow.permissions).map(([k, v]) => `${k}:${v}`).join(', ');
      content += `**Permissions:** ${perms}  \n`;
    }
    
    if (workflow.error) {
      content += `**⚠️ Error:** ${workflow.error}  \n`;
    }
    
    content += `\n`;
  }
  
  return content;
}

function generateCronMatrix(data: ReportData): string {
  const { cronMap } = data;
  
  let content = `# Cron Schedule Matrix\n\n`;
  content += `**Generated:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC  \n`;
  content += `**Timezone:** ${cronMap.timezone}  \n`;
  content += `**DST Note:** ${cronMap.dst_note}  \n\n`;
  
  content += `## Summary\n\n`;
  content += `| Metric | Count |\n`;
  content += `|--------|-------|\n`;
  content += `| Scheduled Workflows | ${cronMap.summary.total_scheduled_workflows} |\n`;
  content += `| Total Cron Expressions | ${cronMap.summary.total_cron_expressions} |\n`;
  content += `| Collision Windows | ${cronMap.summary.collision_windows} |\n\n`;
  
  if (cronMap.entries.length > 0) {
    content += `## Schedule Details\n\n`;
    content += `| Workflow | Cron Expression | Description | Sample Times (ET) |\n`;
    content += `|----------|-----------------|-------------|-------------------|\n`;
    
    for (const entry of cronMap.entries) {
      const sampleTimes = entry.sample_times_et.slice(0, 2).join('<br>');
      content += `| ${entry.workflow_name} | \`${entry.cron_expression}\` | ${entry.description} | ${sampleTimes} |\n`;
    }
    content += `\n`;
  }
  
  if (cronMap.collisions.length > 0) {
    content += `## ⚠️ Scheduling Collisions\n\n`;
    
    for (const collision of cronMap.collisions) {
      const severity = collision.severity === 'severe' ? '🔴' : collision.severity === 'moderate' ? '🟠' : '🟡';
      content += `### ${severity} ${collision.time_window} UTC (${collision.severity})\n\n`;
      content += `**Colliding Workflows:**\n`;
      for (const workflow of collision.colliding_workflows) {
        content += `- ${workflow}\n`;
      }
      content += `\n`;
    }
  }
  
  if (cronMap.summary.staggering_recommendations.length > 0) {
    content += `## Recommendations\n\n`;
    for (const rec of cronMap.summary.staggering_recommendations) {
      content += `- ${rec}\n`;
    }
    content += `\n`;
  }
  
  return content;
}

function generateSecretsMatrix(data: ReportData): string {
  const { securityAudit } = data;
  
  let content = `# Secrets & Permissions Matrix\n\n`;
  content += `**Generated:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC  \n`;
  content += `**Security Score:** ${securityAudit.summary.security_score}/100  \n\n`;
  
  content += `## Summary\n\n`;
  content += `| Metric | Count |\n`;
  content += `|--------|-------|\n`;
  content += `| Total Secrets Referenced | ${securityAudit.summary.total_secrets_referenced} |\n`;
  content += `| Unique Permissions | ${securityAudit.summary.total_unique_permissions} |\n`;
  content += `| High-Risk Secrets | ${securityAudit.summary.high_risk_secrets} |\n`;
  content += `| Overprivileged Workflows | ${securityAudit.summary.overprivileged_workflows} |\n`;
  content += `| Security Issues | ${securityAudit.security_issues.length} |\n\n`;
  
  content += `## Secret Usage\n\n`;
  content += `| Secret | Classification | Risk Level | Workflows | Usage Count |\n`;
  content += `|--------|---------------|------------|-----------|-------------|\n`;
  
  for (const secret of securityAudit.secret_usage) {
    const riskIcon = secret.risk_level === 'critical' ? '🔴' : secret.risk_level === 'high' ? '🟠' : secret.risk_level === 'medium' ? '🟡' : '🟢';
    const criticalIcon = secret.is_critical ? '⚠️' : '';
    content += `| ${secret.secret_name} ${criticalIcon} | ${secret.classification} | ${riskIcon} ${secret.risk_level} | ${secret.workflows.join(', ')} | ${secret.workflow_count} |\n`;
  }
  content += `\n`;
  
  content += `## Permission Usage\n\n`;
  content += `| Permission | Scope | Risk Level | Workflows | Usage Count |\n`;
  content += `|------------|-------|------------|-----------|-------------|\n`;
  
  for (const permission of securityAudit.permission_usage) {
    const riskIcon = permission.risk_level === 'high' ? '🔴' : permission.risk_level === 'medium' ? '🟠' : '🟢';
    const writeIcon = permission.is_write_permission ? '✏️' : '';
    content += `| ${permission.permission} ${writeIcon} | ${permission.scope} | ${riskIcon} ${permission.risk_level} | ${permission.workflows.join(', ')} | ${permission.workflow_count} |\n`;
  }
  content += `\n`;
  
  if (securityAudit.security_issues.length > 0) {
    content += `## 🚨 Security Issues\n\n`;
    
    for (const issue of securityAudit.security_issues) {
      const severityIcon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : issue.severity === 'medium' ? '🟡' : '🔵';
      content += `### ${severityIcon} ${issue.type} (${issue.severity})\n\n`;
      content += `**Workflow:** ${issue.workflow}  \n`;
      content += `**Description:** ${issue.description}  \n`;
      content += `**Recommendation:** ${issue.recommendation}  \n\n`;
    }
  }
  
  content += `## Recommendations\n\n`;
  for (const rec of securityAudit.summary.recommendations) {
    content += `- ${rec}\n`;
  }
  content += `\n`;
  
  return content;
}

function generatePermissionsMatrix(data: ReportData): string {
  const { securityAudit } = data;
  
  let content = `# Permissions Matrix\n\n`;
  content += `**Generated:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC  \n\n`;
  
  content += `## Permission Risk Analysis\n\n`;
  
  // Group by permission type
  const permissionGroups = new Map<string, any[]>();
  for (const perm of securityAudit.permission_usage) {
    if (!permissionGroups.has(perm.permission)) {
      permissionGroups.set(perm.permission, []);
    }
    permissionGroups.get(perm.permission)!.push(perm);
  }
  
  for (const [permission, usages] of permissionGroups.entries()) {
    content += `### ${permission}\n\n`;
    
    content += `| Scope | Risk Level | Workflows |\n`;
    content += `|-------|------------|-----------||\n`;
    
    for (const usage of usages) {
      const riskIcon = usage.risk_level === 'high' ? '🔴' : usage.risk_level === 'medium' ? '🟠' : '🟢';
      content += `| ${usage.scope} | ${riskIcon} ${usage.risk_level} | ${usage.workflows.join(', ')} |\n`;
    }
    content += `\n`;
  }
  
  return content;
}

function generateDuplicationReport(data: ReportData): string {
  const { duplicationReport } = data;
  
  let content = `# Workflow Duplication Analysis\n\n`;
  content += `**Generated:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC  \n`;
  content += `**Potential Reduction:** ${duplicationReport.summary.potential_workflow_reduction}  \n\n`;
  
  content += `## Summary\n\n`;
  content += `| Metric | Count |\n`;
  content += `|--------|-------|\n`;
  content += `| Workflow Pairs Analyzed | ${duplicationReport.summary.total_workflow_pairs_analyzed} |\n`;
  content += `| High Similarity Matches | ${duplicationReport.summary.high_similarity_matches} |\n`;
  content += `| Redundant Patterns | ${duplicationReport.summary.redundant_patterns_found} |\n`;
  content += `| Consolidation Opportunities | ${duplicationReport.summary.consolidation_opportunities} |\n\n`;
  
  if (duplicationReport.similarity_matches.length > 0) {
    content += `## High Similarity Workflow Pairs\n\n`;
    content += `| Workflow A | Workflow B | Similarity | Consolidation Potential |\n`;
    content += `|------------|------------|------------|------------------------|\n`;
    
    for (const match of duplicationReport.similarity_matches.filter((m: any) => m.similarity_score > 0.5)) {
      const potentialIcon = match.consolidation_potential === 'high' ? '🟢' : match.consolidation_potential === 'medium' ? '🟡' : '🔴';
      content += `| ${match.workflow_a} | ${match.workflow_b} | ${Math.round(match.similarity_score * 100)}% | ${potentialIcon} ${match.consolidation_potential} |\n`;
    }
    content += `\n`;
  }
  
  if (duplicationReport.redundant_patterns.length > 0) {
    content += `## Redundant Patterns\n\n`;
    
    for (const pattern of duplicationReport.redundant_patterns) {
      const priorityIcon = pattern.priority === 'high' ? '🔴' : pattern.priority === 'medium' ? '🟠' : '🟡';
      content += `### ${priorityIcon} ${pattern.pattern_name} (${pattern.priority})\n\n`;
      content += `**Type:** ${pattern.pattern_type}  \n`;
      content += `**Affected Workflows:** ${pattern.affected_workflows.join(', ')}  \n`;
      content += `**Description:** ${pattern.description}  \n`;
      content += `**Suggestion:** ${pattern.consolidation_suggestion}  \n\n`;
    }
  }
  
  if (duplicationReport.consolidation_opportunities.length > 0) {
    content += `## Consolidation Opportunities\n\n`;
    
    for (const opp of duplicationReport.consolidation_opportunities) {
      const complexityIcon = opp.estimated_complexity === 'low' ? '🟢' : opp.estimated_complexity === 'medium' ? '🟡' : '🔴';
      content += `### ${complexityIcon} ${opp.title}\n\n`;
      content += `**Type:** ${opp.opportunity_type}  \n`;
      content += `**Complexity:** ${opp.estimated_complexity}  \n`;
      content += `**Affected Workflows:** ${opp.affected_workflows.join(', ')}  \n`;
      content += `**Description:** ${opp.description}  \n`;
      content += `**Potential Savings:** ${opp.potential_savings}  \n`;
      
      content += `**Implementation Steps:**\n`;
      for (const step of opp.implementation_steps) {
        content += `1. ${step}\n`;
      }
      content += `\n`;
    }
  }
  
  content += `## Golden Path Recommendation\n\n`;
  for (const rec of duplicationReport.summary.golden_path_recommendation) {
    content += `- ${rec}\n`;
  }
  content += `\n`;
  
  return content;
}

function generateScheduleCoverage(data: ReportData): string {
  const { cronMap } = data;
  
  let content = `# Schedule Coverage Analysis\n\n`;
  content += `**Generated:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC  \n`;
  content += `**Analysis Period:** 24-hour coverage in ${cronMap.timezone}  \n\n`;
  
  // Create hourly coverage map
  const hourlyCoverage = new Array(24).fill(0);
  for (const entry of cronMap.entries) {
    for (const timeStr of entry.sample_times_et) {
      const hour = parseInt(timeStr.split(' ')[1].split(':')[0]);
      if (hour >= 0 && hour < 24) {
        hourlyCoverage[hour]++;
      }
    }
  }
  
  content += `## Hourly Coverage (Eastern Time)\n\n`;
  content += `| Hour | Workflows | Coverage |\n`;
  content += `|------|-----------|----------|\n`;
  
  for (let hour = 0; hour < 24; hour++) {
    const count = hourlyCoverage[hour];
    const coverage = count > 0 ? '█'.repeat(Math.min(count, 5)) : '▁';
    content += `| ${hour.toString().padStart(2, '0')}:00 | ${count} | ${coverage} |\n`;
  }
  content += `\n`;
  
  // Peak hours analysis
  const maxWorkflows = Math.max(...hourlyCoverage);
  const peakHours = hourlyCoverage.map((count, hour) => ({ hour, count }))
    .filter(h => h.count === maxWorkflows)
    .map(h => `${h.hour.toString().padStart(2, '0')}:00`);
  
  content += `## Analysis\n\n`;
  content += `**Peak Hours:** ${peakHours.join(', ')} (${maxWorkflows} workflows)  \n`;
  content += `**Coverage Gaps:** ${hourlyCoverage.filter(c => c === 0).length} hours with no scheduled workflows  \n`;
  content += `**Total Scheduled Hours:** ${hourlyCoverage.filter(c => c > 0).length}/24  \n\n`;
  
  if (cronMap.collisions.length > 0) {
    content += `## Collision Impact\n\n`;
    content += `${cronMap.collisions.length} time windows have scheduling conflicts that may impact system performance.\n\n`;
  }
  
  return content;
}

function generateRunHealth(data: ReportData): string {
  const { runStats } = data;
  
  let content = `# 7-Day Run Health Report\n\n`;
  content += `**Generated:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC  \n`;
  
  if (!runStats || runStats.error) {
    content += `**⚠️ Note:** Run statistics unavailable (${runStats?.error || 'No data collected'})  \n\n`;
    content += `This report would normally include:\n`;
    content += `- Workflow success/failure rates\n`;
    content += `- Staleness analysis\n`;
    content += `- Performance trends\n`;
    content += `- Health recommendations\n\n`;
    return content;
  }
  
  content += `**Repository:** ${runStats.repo}  \n\n`;
  
  content += `## Summary\n\n`;
  content += `| Metric | Count |\n`;
  content += `|--------|-------|\n`;
  content += `| Total Workflows Tracked | ${runStats.summary.total_workflows_tracked} |\n`;
  content += `| With Recent Failures | ${runStats.summary.workflows_with_recent_failures} |\n`;
  content += `| Stale 30+ Days | ${runStats.summary.workflows_stale_30d} |\n`;
  content += `| Stale 60+ Days | ${runStats.summary.workflows_stale_60d} |\n`;
  content += `| Stale 90+ Days | ${runStats.summary.workflows_stale_90d} |\n\n`;
  
  content += `## Workflow Health Details\n\n`;
  content += `| Workflow | Success Rate | Total Runs | Staleness (Days) | Status |\n`;
  content += `|----------|--------------|------------|------------------|--------|\n`;
  
  for (const stat of runStats.stats) {
    const successRate = stat.last_7_days.total_runs > 0 
      ? Math.round((stat.last_7_days.success / stat.last_7_days.total_runs) * 100)
      : 0;
    
    let status = '🟢 Healthy';
    if (stat.staleness_days > 90) status = '🔴 Very Stale';
    else if (stat.staleness_days > 30) status = '🟠 Stale';
    else if (stat.last_7_days.failure > 0) status = '🟡 Has Failures';
    
    content += `| ${stat.workflow_name} | ${successRate}% | ${stat.last_7_days.total_runs} | ${stat.staleness_days} | ${status} |\n`;
  }
  content += `\n`;
  
  // Health issues
  const unhealthyWorkflows = runStats.stats.filter((s: any) => 
    s.staleness_days > 30 || s.last_7_days.failure > 0
  );
  
  if (unhealthyWorkflows.length > 0) {
    content += `## ⚠️ Health Issues\n\n`;
    
    for (const workflow of unhealthyWorkflows) {
      content += `### ${workflow.workflow_name}\n\n`;
      
      if (workflow.staleness_days > 30) {
        content += `**Staleness:** ${workflow.staleness_days} days since last success  \n`;
      }
      
      if (workflow.last_7_days.failure > 0) {
        content += `**Recent Failures:** ${workflow.last_7_days.failure} in last 7 days  \n`;
      }
      
      if (workflow.last_non_success_runs.length > 0) {
        content += `**Recent Non-Success Runs:**\n`;
        for (const run of workflow.last_non_success_runs.slice(0, 2)) {
          content += `- [${run.conclusion}](${run.html_url}) on ${run.head_branch} (${run.created_at})  \n`;
        }
      }
      
      content += `\n`;
    }
  }
  
  return content;
}

function generateActionPlan(data: ReportData): string {
  const { duplicationReport, securityAudit, cronMap } = data;
  
  let content = `# CI/CD Action Plan\n\n`;
  content += `**Generated:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC  \n`;
  content += `**Priority:** Immediate → Short-term → Long-term  \n\n`;
  
  content += `## 🚨 Immediate Actions (This Week)\n\n`;
  
  // Critical security issues
  const criticalSecurityIssues = securityAudit.security_issues.filter((i: any) => i.severity === 'critical');
  if (criticalSecurityIssues.length > 0) {
    content += `### Critical Security Issues\n\n`;
    for (const issue of criticalSecurityIssues) {
      content += `- **${issue.workflow}:** ${issue.description}\n`;
      content += `  - Action: ${issue.recommendation}\n`;
    }
    content += `\n`;
  }
  
  // Severe scheduling collisions
  const severeCollisions = cronMap.collisions.filter((c: any) => c.severity === 'severe');
  if (severeCollisions.length > 0) {
    content += `### Severe Scheduling Collisions\n\n`;
    for (const collision of severeCollisions) {
      content += `- **${collision.time_window} UTC:** ${collision.colliding_workflows.join(', ')}\n`;
      content += `  - Action: Stagger execution times by 2-5 minutes\n`;
    }
    content += `\n`;
  }
  
  content += `## 🟠 Short-term Actions (Next 2 Weeks)\n\n`;
  
  // High-priority consolidation opportunities
  const lowComplexityOpportunities = duplicationReport.consolidation_opportunities.filter((o: any) => o.estimated_complexity === 'low');
  if (lowComplexityOpportunities.length > 0) {
    content += `### Low-Complexity Consolidations\n\n`;
    for (const opp of lowComplexityOpportunities.slice(0, 3)) {
      content += `- **${opp.title}**\n`;
      content += `  - Benefit: ${opp.potential_savings}\n`;
      content += `  - First step: ${opp.implementation_steps[0]}\n`;
    }
    content += `\n`;
  }
  
  // High security issues
  const highSecurityIssues = securityAudit.security_issues.filter((i: any) => i.severity === 'high');
  if (highSecurityIssues.length > 0) {
    content += `### High-Priority Security Issues\n\n`;
    for (const issue of highSecurityIssues.slice(0, 3)) {
      content += `- **${issue.workflow}:** ${issue.description}\n`;
    }
    content += `\n`;
  }
  
  content += `## 🟡 Long-term Actions (Next Month)\n\n`;
  
  // Major consolidation opportunities
  const majorOpportunities = duplicationReport.consolidation_opportunities.filter((o: any) => 
    o.opportunity_type === 'merge_workflows' || o.opportunity_type === 'extract_reusable'
  );
  if (majorOpportunities.length > 0) {
    content += `### Workflow Architecture Improvements\n\n`;
    for (const opp of majorOpportunities.slice(0, 3)) {
      content += `- **${opp.title}**\n`;
      content += `  - Complexity: ${opp.estimated_complexity}\n`;
      content += `  - Impact: ${opp.potential_savings}\n`;
    }
    content += `\n`;
  }
  
  // Golden path implementation
  content += `### Golden Path Implementation\n\n`;
  for (const rec of duplicationReport.summary.golden_path_recommendation.slice(0, 3)) {
    content += `- ${rec}\n`;
  }
  content += `\n`;
  
  content += `## 📊 Success Metrics\n\n`;
  content += `### Target Improvements\n\n`;
  content += `| Metric | Current | Target | Timeline |\n`;
  content += `|--------|---------|--------|---------|\n`;
  content += `| Security Score | ${securityAudit.summary.security_score}/100 | 85+ | 2 weeks |\n`;
  content += `| Workflow Count | ${data.workflows.summary.workflow_count} | ${data.workflows.summary.workflow_count - Math.floor(duplicationReport.summary.consolidation_opportunities * 0.3)} | 1 month |\n`;
  content += `| Scheduling Collisions | ${cronMap.summary.collision_windows} | <3 | 1 week |\n`;
  content += `| High-Risk Secrets | ${securityAudit.summary.high_risk_secrets} | <${Math.max(1, securityAudit.summary.high_risk_secrets - 2)} | 2 weeks |\n\n`;
  
  content += `### Monitoring Plan\n\n`;
  content += `- **Weekly:** Review security audit and scheduling health\n`;
  content += `- **Bi-weekly:** Assess consolidation progress\n`;
  content += `- **Monthly:** Full workflow audit and architecture review\n`;
  content += `- **Quarterly:** Golden path assessment and optimization\n\n`;
  
  content += `## 📋 Implementation Checklist\n\n`;
  content += `### Phase 1: Immediate Security & Stability\n\n`;
  content += `- [ ] Fix critical security issues\n`;
  content += `- [ ] Resolve severe scheduling collisions\n`;
  content += `- [ ] Add explicit permissions to workflows missing them\n`;
  content += `- [ ] Review overprivileged workflows\n\n`;
  
  content += `### Phase 2: Quick Wins\n\n`;
  content += `- [ ] Implement low-complexity consolidations\n`;
  content += `- [ ] Create composite actions for common step patterns\n`;
  content += `- [ ] Optimize cron schedules\n`;
  content += `- [ ] Remove unused secrets\n\n`;
  
  content += `### Phase 3: Architecture Optimization\n\n`;
  content += `- [ ] Merge highly similar workflows\n`;
  content += `- [ ] Extract reusable workflow patterns\n`;
  content += `- [ ] Implement golden path recommendations\n`;
  content += `- [ ] Document workflow standards\n\n`;
  
  return content;
}

async function main() {
  console.log('📝 Generating comprehensive workflow audit reports...');
  
  try {
    // Load all data
    const data = loadData();
    
    const outputDir = 'ci_audit/workflow_map';
    
    // Generate all reports
    const reports = [
      { filename: 'WORKFLOW_CATALOG.md', content: generateWorkflowCatalog(data) },
      { filename: 'CRON_MATRIX.md', content: generateCronMatrix(data) },
      { filename: 'SECRETS_MATRIX.md', content: generateSecretsMatrix(data) },
      { filename: 'PERMISSIONS_MATRIX.md', content: generatePermissionsMatrix(data) },
      { filename: 'DUPLICATION_REPORT.md', content: generateDuplicationReport(data) },
      { filename: 'SCHEDULE_COVERAGE.md', content: generateScheduleCoverage(data) },
      { filename: 'RUN_HEALTH_7D.md', content: generateRunHealth(data) },
      { filename: 'ACTION_PLAN.md', content: generateActionPlan(data) },
    ];
    
    // Write all reports
    for (const report of reports) {
      const filePath = `${outputDir}/${report.filename}`;
      writeFileSync(filePath, report.content);
      console.log(`   ✅ Generated ${report.filename}`);
    }
    
    // Copy topology Mermaid file
    const topologyPath = `${outputDir}/TOPOLOGY.mmd`;
    if (existsSync(topologyPath)) {
      console.log(`   ✅ Topology diagram available at ${topologyPath}`);
    }
    
    console.log(`\n📊 Report Summary:`);
    console.log(`   - Total workflows analyzed: ${data.workflows.summary.workflow_count}`);
    console.log(`   - Security score: ${data.securityAudit.summary.security_score}/100`);
    console.log(`   - Consolidation opportunities: ${data.duplicationReport.summary.consolidation_opportunities}`);
    console.log(`   - Scheduling collisions: ${data.cronMap.summary.collision_windows}`);
    
    console.log(`\n📁 Reports generated in: ${outputDir}/`);
    console.log(`   - WORKFLOW_CATALOG.md - Complete workflow inventory`);
    console.log(`   - CRON_MATRIX.md - Scheduling analysis`);
    console.log(`   - TOPOLOGY.mmd - Dependency graph (Mermaid)`);
    console.log(`   - SECRETS_MATRIX.md - Security analysis`);
    console.log(`   - PERMISSIONS_MATRIX.md - Permission breakdown`);
    console.log(`   - DUPLICATION_REPORT.md - Redundancy analysis`);
    console.log(`   - SCHEDULE_COVERAGE.md - 24-hour coverage`);
    console.log(`   - RUN_HEALTH_7D.md - Performance health`);
    console.log(`   - ACTION_PLAN.md - Implementation roadmap`);
    
    // Summary recommendations
    const criticalIssues = data.securityAudit.security_issues.filter((i: any) => i.severity === 'critical').length;
    const severeCollisions = data.cronMap.collisions.filter((c: any) => c.severity === 'severe').length;
    
    if (criticalIssues > 0 || severeCollisions > 0) {
      console.log(`\n🚨 IMMEDIATE ATTENTION REQUIRED:`);
      if (criticalIssues > 0) console.log(`   - ${criticalIssues} critical security issues`);
      if (severeCollisions > 0) console.log(`   - ${severeCollisions} severe scheduling collisions`);
      console.log(`   See ACTION_PLAN.md for details.`);
    } else {
      console.log(`\n✅ No critical issues found. Review ACTION_PLAN.md for optimization opportunities.`);
    }
    
  } catch (error) {
    console.error('❌ Failed to generate reports:', error);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}