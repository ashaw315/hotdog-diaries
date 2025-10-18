import fs from 'node:fs/promises';

const summary = JSON.parse(await fs.readFile('ci_audit/summary.json', 'utf8'));
const workflows = JSON.parse(await fs.readFile('ci_audit/workflows.json', 'utf8'));

const now = new Date().toISOString();
const repoName = 'ashaw315/hotdog-diaries';

// Generate markdown report
let report = `# GitHub Actions Workflow Audit Report

**Repository:** ${repoName}  
**Generated:** ${now}  
**Total Workflows:** ${workflows.length}  
**Failing Workflows:** ${summary.failingCount}  

## Executive Summary

This audit analyzed ${workflows.length} GitHub Actions workflows and their recent execution history. 

### Key Findings

- **Overall Health:** ${summary.failingCount === 0 ? '✅ **HEALTHY** - No consistently failing workflows detected' : `⚠️ **${summary.failingCount} workflows** showing consistent failures`}
- **Workflow Coverage:** ${workflows.length} active workflows found
- **Recent Activity:** Analysis covers up to 10 recent runs per workflow

## Workflow Analysis

### Status Distribution

| Status | Count | Percentage |
|--------|-------|------------|
`;

// Calculate status distribution
const statusCounts = {
  passing: 0,
  failing: 0,
  'no-runs': 0,
  unknown: 0
};

for (const item of summary.items) {
  const { success, failure, recent_total } = item.stats;
  if (failure > 0) statusCounts.failing++;
  else if (success > 0) statusCounts.passing++;
  else if (recent_total === 0) statusCounts['no-runs']++;
  else statusCounts.unknown++;
}

const total = summary.items.length;
for (const [status, count] of Object.entries(statusCounts)) {
  const pct = Math.round((count / total) * 100);
  const emoji = status === 'passing' ? '✅' : status === 'failing' ? '❌' : status === 'no-runs' ? '⚫' : '❓';
  report += `| ${emoji} ${status} | ${count} | ${pct}% |\n`;
}

report += `

### Detailed Workflow Status

`;

// Sort workflows by failure rate and recent activity
const sortedWorkflows = summary.items.sort((a, b) => {
  const aFailureRate = a.stats.recent_total > 0 ? (a.stats.failure / a.stats.recent_total) : 0;
  const bFailureRate = b.stats.recent_total > 0 ? (b.stats.failure / b.stats.recent_total) : 0;
  return bFailureRate - aFailureRate || b.stats.recent_total - a.stats.recent_total;
});

for (const item of sortedWorkflows) {
  const { name, file, stats, flags, latest_url } = item;
  const { recent_total, success, failure, pass_rate_pct, avg_duration_s, flaky } = stats;
  
  let status_emoji = '✅';
  let status_text = 'Healthy';
  
  if (failure > 0) {
    status_emoji = '❌';
    status_text = 'Failing';
  } else if (recent_total === 0) {
    status_emoji = '⚫';
    status_text = 'No Recent Runs';
  } else if (flaky) {
    status_emoji = '⚠️';
    status_text = 'Flaky';
  }

  report += `#### ${status_emoji} ${name}

**File:** \`${file}\`  
**Status:** ${status_text}  
**Pass Rate:** ${pass_rate_pct}% (${success}/${recent_total} recent runs)  
**Average Duration:** ${avg_duration_s}s  
`;

  if (latest_url) {
    report += `**Latest Run:** [View Details](${latest_url})  \n`;
  }

  // Add flags if any issues detected
  const issues = [];
  if (flags.missing_timeouts) issues.push('⚠️ Missing job timeouts');
  if (flags.missing_concurrency) issues.push('⚠️ Missing concurrency control');
  if (!flags.minimal_permissions) issues.push('⚠️ Broad permissions');
  if (!flags.uses_cache && name.toLowerCase().includes('ci')) issues.push('💡 Could benefit from caching');

  if (issues.length > 0) {
    report += `**Issues:** ${issues.join(', ')}  \n`;
  }

  // Add positive flags
  const positives = [];
  if (flags.uses_cache) positives.push('📦 Uses caching');
  if (flags.uploads_artifacts) positives.push('📤 Uploads artifacts');
  if (flags.minimal_permissions) positives.push('🔒 Minimal permissions');

  if (positives.length > 0) {
    report += `**Good Practices:** ${positives.join(', ')}  \n`;
  }

  report += `\n`;
}

report += `
## Security & Best Practices Analysis

### Permission Analysis
`;

const permissionStats = {
  minimal: 0,
  broad: 0,
  undefined: 0
};

for (const item of summary.items) {
  if (item.flags.minimal_permissions) {
    permissionStats.minimal++;
  } else if (item.permissions) {
    permissionStats.broad++;
  } else {
    permissionStats.undefined++;
  }
}

report += `
- **Minimal Permissions:** ${permissionStats.minimal} workflows (${Math.round((permissionStats.minimal/total)*100)}%)
- **Broad Permissions:** ${permissionStats.broad} workflows (${Math.round((permissionStats.broad/total)*100)}%)
- **Default Permissions:** ${permissionStats.undefined} workflows (${Math.round((permissionStats.undefined/total)*100)}%)

### Configuration Issues
`;

const configIssues = {
  missingTimeouts: summary.items.filter(i => i.flags.missing_timeouts).length,
  missingConcurrency: summary.items.filter(i => i.flags.missing_concurrency).length,
  noCache: summary.items.filter(i => !i.flags.uses_cache && (i.name.toLowerCase().includes('ci') || i.name.toLowerCase().includes('test'))).length
};

report += `
- **Missing Timeouts:** ${configIssues.missingTimeouts} workflows
- **Missing Concurrency:** ${configIssues.missingConcurrency} workflows  
- **CI without Caching:** ${configIssues.noCache} workflows

## Recommendations

### High Priority
`;

if (summary.failingCount > 0) {
  report += `
1. **🚨 Fix Failing Workflows:** ${summary.failingCount} workflows are consistently failing and need immediate attention
`;
}

if (configIssues.missingTimeouts > 0) {
  report += `
2. **⏱️ Add Timeouts:** ${configIssues.missingTimeouts} workflows missing job timeouts (prevent hung jobs)
`;
}

if (permissionStats.broad > 0) {
  report += `
3. **🔒 Minimize Permissions:** ${permissionStats.broad} workflows using broad permissions (security risk)
`;
}

report += `
### Performance Optimizations

`;

if (configIssues.noCache > 0) {
  report += `
1. **📦 Add Caching:** ${configIssues.noCache} CI workflows could benefit from dependency caching
`;
}

if (configIssues.missingConcurrency > 0) {
  report += `
2. **🔄 Concurrency Control:** ${configIssues.missingConcurrency} workflows missing concurrency limits (resource optimization)
`;
}

const avgDuration = Math.round(summary.items.filter(i => i.stats.avg_duration_s > 0).reduce((sum, i) => sum + i.stats.avg_duration_s, 0) / summary.items.filter(i => i.stats.avg_duration_s > 0).length);

report += `
3. **⚡ Duration Optimization:** Average workflow duration is ${avgDuration}s - consider parallelization for longer workflows

## Conclusion

`;

if (summary.failingCount === 0) {
  report += `✅ **Workflow health is good** with no consistently failing workflows detected. Focus on security hardening and performance optimizations.`;
} else {
  report += `⚠️ **Action required** - ${summary.failingCount} workflows need immediate attention to resolve consistent failures.`;
}

report += `

---
*This report was generated automatically by the GitHub Actions audit script on ${now}*
`;

await fs.writeFile('ci_audit/audit_report.md', report);
console.log('✅ Generated comprehensive audit report: ci_audit/audit_report.md');