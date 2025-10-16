# GitHub Actions Workflow Deletions

## Summary
This document lists all the workflows that can be safely deleted after implementing the consolidated workflow architecture.

**Total workflows before:** 35  
**Total workflows after:** 7 (12 including preserved workflows)  
**Workflows to delete:** 28

## Consolidated Workflows (Keep These 7)
- `ci.yml` - Consolidated CI/CD pipeline
- `e2e.yml` - Consolidated E2E testing with conditional triggers  
- `scanners.yml` - Consolidated content scanning with matrix strategy
- `scheduler.yml` - Consolidated content scheduling operations
- `post.yml` - Consolidated content posting workflow
- `housekeeping.yml` - Consolidated maintenance and cleanup tasks
- `post-deploy-check.yml` - Updated post-deployment validation

## Workflows to Delete (28 files)

### CI/CD Workflows (3 files)
**Replaced by:** `ci.yml`
- `ci-new.yml` - Duplicate CI workflow
- `ci-test.yml` - Test CI workflow  
- `meta-ci-audit.yml` - CI audit tasks

### Scanner Workflows (10 files)
**Replaced by:** `scanners.yml`
- `scan-bluesky.yml` - Bluesky content scanning
- `scan-giphy.yml` - Giphy content scanning
- `scan-imgur.yml` - Imgur content scanning
- `scan-lemmy.yml` - Lemmy content scanning
- `scan-niche-platforms.yml` - Niche platform scanning
- `scan-pixabay.yml` - Pixabay content scanning
- `scan-reddit.yml` - Reddit content scanning
- `scan-social-platforms.yml` - Social platform scanning
- `scan-tumblr.yml` - Tumblr content scanning
- `scan-youtube.yml` - YouTube content scanning

### Posting Workflows (6 files)
**Replaced by:** `post.yml`
- `post-breakfast.yml` - Morning posting slot
- `post-dinner.yml` - Evening posting slot
- `post-evening.yml` - Late evening posting slot
- `post-late-night.yml` - Late night posting slot
- `post-lunch.yml` - Lunch posting slot
- `post-snack.yml` - Afternoon posting slot

### Housekeeping Workflows (6 files)
**Replaced by:** `housekeeping.yml`
- `auto-approve.yml` - Content auto-approval
- `auto-queue-manager.yml` - Queue management
- `cleanup-duplicates.yml` - Duplicate content cleanup
- `daily-ingestion-report.yml` - Daily reporting
- `daily-report.yml` - Daily status reports
- `secret-validation.yml` - Secrets validation

### Operations Workflows (3 files)
**Replaced by:** Distributed across consolidated workflows
- `manual-operations.yml` - Manual operations (functionality moved to housekeeping.yml)
- `queue-monitor.yml` - Queue monitoring (functionality moved to housekeeping.yml)
- `token-refresh.yml` - Token management (functionality moved to housekeeping.yml)

## Workflows to Preserve (5 files)
These workflows have specialized functionality that doesn't fit into our 7-workflow consolidation:
- `deploy-gate.yml` - Deployment gating logic
- `phase3-auto-healing.yml` - Auto-healing system
- `post-remediation-check.yml` - Post-remediation validation
- `queue-monitor-hook.yml` - Queue monitoring hooks

## Deletion Commands

```bash
# CI/CD Workflows
rm .github/workflows/ci-new.yml
rm .github/workflows/ci-test.yml  
rm .github/workflows/meta-ci-audit.yml

# Scanner Workflows  
rm .github/workflows/scan-bluesky.yml
rm .github/workflows/scan-giphy.yml
rm .github/workflows/scan-imgur.yml
rm .github/workflows/scan-lemmy.yml
rm .github/workflows/scan-niche-platforms.yml
rm .github/workflows/scan-pixabay.yml
rm .github/workflows/scan-reddit.yml
rm .github/workflows/scan-social-platforms.yml
rm .github/workflows/scan-tumblr.yml
rm .github/workflows/scan-youtube.yml

# Posting Workflows
rm .github/workflows/post-breakfast.yml
rm .github/workflows/post-dinner.yml
rm .github/workflows/post-evening.yml
rm .github/workflows/post-late-night.yml
rm .github/workflows/post-lunch.yml
rm .github/workflows/post-snack.yml

# Housekeeping Workflows
rm .github/workflows/auto-approve.yml
rm .github/workflows/auto-queue-manager.yml
rm .github/workflows/cleanup-duplicates.yml
rm .github/workflows/daily-ingestion-report.yml
rm .github/workflows/daily-report.yml
rm .github/workflows/secret-validation.yml

# Operations Workflows
rm .github/workflows/manual-operations.yml
rm .github/workflows/queue-monitor.yml
rm .github/workflows/token-refresh.yml
```

## Migration Benefits

### Reduced Complexity
- **28 fewer workflow files** to maintain
- **Centralized configuration** for similar operations
- **Consistent naming** and structure
- **Reduced duplication** of setup steps

### Improved Performance  
- **Shared composite actions** reduce execution time
- **Optimized caching** strategies across workflows
- **Matrix strategies** for parallel execution
- **Conditional execution** to avoid unnecessary runs

### Enhanced Maintainability
- **Single source of truth** for each operation type
- **Easier updates** and configuration changes
- **Better observability** with consolidated logs
- **Standardized error handling** and reporting

## Rollback Plan
If issues are discovered after deletion:
1. All deleted workflows are preserved in git history
2. Individual workflows can be restored with: `git checkout HEAD~1 -- .github/workflows/[filename].yml`
3. The consolidated workflows can be temporarily disabled
4. Original functionality can be restored within minutes

## Validation Checklist
Before deleting workflows, ensure:
- [ ] All composite actions are tested and working
- [ ] Each consolidated workflow covers all original functionality  
- [ ] Secrets and environment variables are properly configured
- [ ] Schedules and triggers match original workflows
- [ ] All dependent systems are updated to use new workflow names