# CI Failure Drilldown - Executive Summary

## 📊 Repo-wide Analysis (168h)

**Time Window**: 2025-10-12 to 2025-10-19 (UTC)

### Summary Totals
- **Success**: 103 runs
- **Failure**: 44 runs  
- **Neutral**: 3 runs
- **Skipped**: 0 runs
- **Cancelled**: 0 runs
- **Other**: 0 runs

### Top 10 Workflows by Non-Success Count

| Workflow Path | Event Mix | Non-Success | Last Failure | Primary Signature | Sample Evidence | Link |
|---------------|-----------|-------------|--------------|-------------------|-----------------|------|
| `.github/workflows/scan-youtube.yml` | schedule, deployment_status, pull_request, workflow_dispatch, push | 12 | 10/19/2025 | AUTH_TOKEN_POLICY | `YouTube API key does not meet requiremen...` | [View Workflow](.github/workflows/scan-youtube.yml) |
| `.github/workflows/scan-reddit.yml` | pull_request, workflow_dispatch, push, schedule, deployment_status | 10 | 10/19/2025 | MISSING_SECRET | `Error: REDDIT_CLIENT_ID not set` | [View Workflow](.github/workflows/scan-reddit.yml) |
| `.github/workflows/old-scanner.yml` | push, schedule, deployment_status, pull_request, workflow_dispatch | 9 | 10/19/2025 | PERMISSION | `Resource not accessible by integration` | [View Workflow](.github/workflows/old-scanner.yml) |
| `.github/workflows/health-check.yml` | workflow_dispatch, push, schedule, deployment_status, pull_request | 4 | 10/16/2025 | HEALTH_CHECK | `Health check failed for /health/deep` | [View Workflow](.github/workflows/health-check.yml) |
| `.github/workflows/ci.yml` | pull_request, workflow_dispatch, push, schedule, deployment_status | 4 | 10/18/2025 | None | `None` | [View Workflow](.github/workflows/ci.yml) |
| `.github/workflows/deploy.yml` | push, schedule, deployment_status, pull_request, workflow_dispatch | 3 | 10/15/2025 | None | `None` | [View Workflow](.github/workflows/deploy.yml) |
| `.github/workflows/security.yml` | deployment_status, pull_request, workflow_dispatch, push, schedule | 3 | 10/15/2025 | AUTH_TOKEN_POLICY | `AUTH_TOKEN weak or invalid` | [View Workflow](.github/workflows/security.yml) |
| `Unknown path` | push, schedule, deployment_status, pull_request, workflow_dispatch | 1 | 10/13/2025 | None | `None` | [View Workflow](Unknown path) |
| `Unknown path` | pull_request, workflow_dispatch, push, schedule, deployment_status | 1 | 10/14/2025 | None | `None` | [View Workflow](Unknown path) |
| `Unknown path` | push, pull_request, schedule, workflow_dispatch, deployment_status | 0 | None | None | `None` | [View Workflow](Unknown path) |


## 🔄 Identity Drift Analysis

### Deleted Workflows (3)
- **Legacy CI Pipeline** (ID: 201) - Last seen: 10/19/2025
- **Old Deploy Script** (ID: 202) - Last seen: 10/17/2025
- **CI Pipeline** (ID: 301) - Last seen: 10/17/2025

*These workflows have recent runs but no current workflow file. Consider if their failures are still relevant.*
### Potential Renames (1)
- **CI Pipeline**
  - Current: `.github/workflows/ci.yml` (ID: 101)
  - Previous: .github/workflows/ci-old.yml (IDs: 301)

*These workflows may have been moved or renamed. Earlier failures belong to the old workflow IDs.*


## 📊 Key Metrics

- **Workflows Analyzed**: 7
- **Recent Runs**: 150
- **Overall Failure Rate**: 31.3%
- **Failure Signatures**: 5

## 🎯 Workflow Assessment

| Assessment | Count | Percentage |
|------------|-------|------------|
| 🚨 Necessary | 4 | 57.1% |
| ✅ Useful | 1 | 14.3% |
| ♻️ Redundant | 1 | 14.3% |
| 🗑️ Outdated | 1 | 14.3% |

## 🚨 High-Failure Workflows

- **Old Content Scanner**: 89% failure rate (outdated)
  - Issues: PERMISSION, MISSING_SECRET, OUTDATED
  - Rationale: Consistently failing (89% failure rate) - likely outdated

- **Content Scanner - Reddit**: 65% failure rate (redundant)
  - Issues: MISSING_SECRET, PERMISSION
  - Rationale: Content workflow with permission issues - may be superseded

## 🔍 Most Common Failure Patterns

- **AUTH_TOKEN_POLICY**: 2 occurrences
- **MISSING_SECRET**: 1 occurrences
- **HEALTH_CHECK**: 1 occurrences
- **PERMISSION**: 1 occurrences

## 🎯 Priority Actions

### Immediate (Next Sprint)


### Near-term (Next Month)
- Review Content Scanner - Reddit for consolidation or removal

---
*Generated: 2025-10-19T19:14:47.531Z*

---

## 🔗 Additional Resources

- [Detailed Analysis](./DETAILED_ANALYSIS.md) - In-depth workflow examination
- [Action Plan](./ACTION_PLAN.md) - Prioritized remediation steps
- [Raw Data](./workflow_assessments.json) - Machine-readable assessment data

*This is an automated CI failure analysis. For questions or to request re-analysis, trigger the "CI Failure Drilldown" workflow.*