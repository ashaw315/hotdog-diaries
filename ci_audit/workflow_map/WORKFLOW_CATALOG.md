# Workflow Catalog

**Generated:** 2025-10-21 19:56:03 UTC  
**Repository:** ashaw315/hotdog-diaries  
**Total Workflows:** 52  

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Workflows | 52 |
| Composite Actions | 4 |
| Total Jobs | 105 |
| Scheduled Workflows | 36 |
| Parse Errors | 2 |

## Workflow Details

### Posting Guard (Reusable)

**File:** `_posting-guard.yml`  
**Jobs:** 1  
**Triggers:** workflow_call  

### Auto-Approve Content

**File:** `auto-approve.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** AUTH_TOKEN, SITE_URL  

### Auto PR CI Shepherd

**File:** `auto-pr-ci-shepherd.yml`  
**Jobs:** 4  
**Triggers:** push, workflow_dispatch, pull_request  
**Secrets:** GITHUB_TOKEN  
**Composite Actions:** ./.github/actions/neutralize  

### Auto Queue Manager

**File:** `auto-queue-manager.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, SERVICE_ACCOUNT_SECRET, REFRESH_TOKEN, AUTH_TOKEN  
**Reusable Workflows:** ./.github/workflows/token-refresh.yml  

### CI Failure Drilldown (Read-Only)

**File:** `ci-failure-drilldown.yml`  
**Jobs:** 1  
**Triggers:** workflow_dispatch  
**Secrets:** GITHUB_TOKEN  
**Permissions:** contents:read, actions:read, checks:read, issues:write  

### CI Test

**File:** `ci-new.yml`  
**Jobs:** 1  
**Triggers:** push  

### CI Test

**File:** `ci-test.yml`  
**Jobs:** 1  
**Triggers:** push  

### CI

**File:** `ci.yml`  
**Jobs:** 8  
**Triggers:** push, pull_request, workflow_call  
**Secrets:** GITHUB_TOKEN  
**Composite Actions:** ./.github/actions/setup-node  

### Database Cleanup

**File:** `cleanup-duplicates.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  
**Permissions:** contents:read  

### Daily Ingestion Balance Report

**File:** `daily-ingestion-report.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2  

### Daily Summary Report

**File:** `daily-report.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN, GITHUB_TOKEN  

### Deploy Gate

**File:** `deploy-gate.yml`  
**Jobs:** 4  
**Triggers:** deployment_status, push, workflow_run  
**Secrets:** VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, AUTH_TOKEN, JWT_SECRET  
**Composite Actions:** ./.github/actions/neutralize  
**Permissions:** contents:read, actions:read, checks:write  

### 🚪 Deployment Gate

**File:** `deployment-gate.yml`  
**Jobs:** 1  
**Triggers:** workflow_dispatch, deployment_status, workflow_call  
**Secrets:** AUTH_TOKEN  
**Permissions:** contents:read  

### ERROR

**File:** `e2e.yml`  
**Jobs:** 0  
**⚠️ Error:** can not read an implicit mapping pair; a colon is missed (134:13)

 131 |         browser: ${{ fromJSON(
 132 |           needs.should-run.outputs.browser  ...
 133 |           format('["{0}"]', needs.should-ru ...
 134 |         ) }}
-------------------^
 135 |     steps:
 136 |       - name: Checkout code  

### Housekeeping

**File:** `housekeeping.yml`  
**Jobs:** 8  
**Triggers:** schedule, workflow_dispatch, workflow_call  
**Secrets:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, DATABASE_URL, AUTH_TOKEN, SITE_URL, REDDIT_CLIENT_ID, YOUTUBE_API_KEY, GIPHY_API_KEY  
**Composite Actions:** ./.github/actions/setup-node, ./.github/actions/setup-supabase-rest  

### Manual Operations

**File:** `manual-operations.yml`  
**Jobs:** 1  
**Triggers:** workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Meta CI Audit

**File:** `meta-ci-audit.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** GITHUB_TOKEN, SLACK_WEBHOOK_URL  

### Phase 3 CI Auto-Healing: Security & Build Diagnostics

**File:** `phase3-auto-healing.yml`  
**Jobs:** 2  
**Triggers:** workflow_call, workflow_dispatch  
**Secrets:** GITHUB_TOKEN, CI_REDISPATCH_TOKEN  

### 📋 Planner Contract

**File:** `planner-contract.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  

### Post Breakfast Content

**File:** `post-breakfast.yml`  
**Jobs:** 3  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, SERVICE_ACCOUNT_SECRET, REFRESH_TOKEN, AUTH_TOKEN  
**Reusable Workflows:** ./.github/workflows/token-refresh.yml, ./.github/workflows/_posting-guard.yml  
**Permissions:** contents:read  

### ERROR

**File:** `post-deploy-check.yml`  
**Jobs:** 0  
**⚠️ Error:** duplicated mapping key (330:5)

 327 |             echo '{"error": "metric ...
 328 |             echo "snapshot=failed"  ...
 329 |           fi
 330 |     needs: guard
-----------^
 331 |     concurrency:
 332 |       group: health-check-${{ githu ...  

### Post Dinner Content

**File:** `post-dinner.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  
**Reusable Workflows:** ./.github/workflows/_posting-guard.yml  
**Permissions:** contents:read  

### Post Evening Content

**File:** `post-evening.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  
**Reusable Workflows:** ./.github/workflows/_posting-guard.yml  
**Permissions:** contents:read  

### Post Late Night Content

**File:** `post-late-night.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  
**Reusable Workflows:** ./.github/workflows/_posting-guard.yml  
**Permissions:** contents:read  

### Post Lunch Content

**File:** `post-lunch.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  
**Reusable Workflows:** ./.github/workflows/_posting-guard.yml  
**Permissions:** contents:read  

### Post-Remediation Validation

**File:** `post-remediation-check.yml`  
**Jobs:** 2  
**Triggers:** repository_dispatch, workflow_dispatch  
**Secrets:** GITHUB_TOKEN  
**Reusable Workflows:** ./.github/workflows/_posting-guard.yml  
**Permissions:** contents:read  

### Post Afternoon Snack

**File:** `post-snack.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  
**Reusable Workflows:** ./.github/workflows/_posting-guard.yml  
**Permissions:** contents:read  

### Content Posting

**File:** `post.yml`  
**Jobs:** 5  
**Triggers:** schedule, workflow_dispatch, workflow_call  
**Secrets:** AUTH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, DATABASE_URL, SITE_URL  
**Composite Actions:** ./.github/actions/setup-node, ./.github/actions/setup-supabase-rest  

### Production Autonomy Watchdog

**File:** `prod-watchdog.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, GITHUB_TOKEN, AUTH_TOKEN, JWT_SECRET, ALERT_WEBHOOK_URL  
**Variables:** PROD_BASE_URL  

### 🔍 Production Audit

**File:** `production-audit.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** AUTH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, GITHUB_TOKEN  

### Queue Monitor Hook

**File:** `queue-monitor-hook.yml`  
**Jobs:** 1  
**Triggers:** workflow_call  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Monitor Queue Health & Scan if Needed

**File:** `queue-monitor.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Queue Readiness

**File:** `queue-readiness.yml`  
**Jobs:** 1  
**Triggers:** schedule  
**Secrets:** GITHUB_TOKEN  

### 📋 Generate Runbook Artifacts

**File:** `runbook-artifact.yml`  
**Jobs:** 1  
**Triggers:** push, workflow_dispatch  

### Scan Bluesky for Content

**File:** `scan-bluesky.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan Giphy for Content

**File:** `scan-giphy.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan Imgur for Content

**File:** `scan-imgur.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan Lemmy for Content

**File:** `scan-lemmy.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan Niche Platforms

**File:** `scan-niche-platforms.yml`  
**Jobs:** 2  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan Pixabay for Content

**File:** `scan-pixabay.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan Reddit for Content

**File:** `scan-reddit.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan Social Platforms

**File:** `scan-social-platforms.yml`  
**Jobs:** 4  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan Tumblr for Content

**File:** `scan-tumblr.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Scan YouTube for Content

**File:** `scan-youtube.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** SITE_URL, AUTH_TOKEN  

### Content Scanners

**File:** `scanners.yml`  
**Jobs:** 6  
**Triggers:** schedule, workflow_dispatch, workflow_call  
**Secrets:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, DATABASE_URL, REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, YOUTUBE_API_KEY, GIPHY_API_KEY, IMGUR_CLIENT_ID, BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD, PIXABAY_API_KEY, TUMBLR_API_KEY, LEMMY_INSTANCE_URL  
**Variables:** SITE_URL, SCAN_MIN_PER_PLATFORM, SCAN_MAX_PER_PLATFORM, SCAN_GLOBAL_MAX, SCAN_COOLDOWN_MIN, MIN_CONF, MIN_CANDIDATES, PLATFORM_ALLOW  
**Composite Actions:** ./.github/actions/setup-node, ./.github/actions/setup-supabase-rest  

### Schedule Reconciliation

**File:** `schedule-reconcile.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  
**Secrets:** AUTH_TOKEN, DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2  
**Variables:** SITE_URL  

### Scheduler SLA Guard

**File:** `scheduler-sla-guard.yml`  
**Jobs:** 1  
**Triggers:** schedule  
**Secrets:** ALERT_WEBHOOK_URL  

### Content Scheduler

**File:** `scheduler.yml`  
**Jobs:** 6  
**Triggers:** schedule, workflow_dispatch, workflow_call  
**Secrets:** AUTH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, DATABASE_URL, SITE_URL  
**Composite Actions:** ./.github/actions/setup-node, ./.github/actions/setup-supabase-rest  

### Secret Validation

**File:** `secret-validation.yml`  
**Jobs:** 3  
**Triggers:** push, pull_request, schedule  
**Secrets:** JWT_SECRET, AUTH_TOKEN, CRON_TOKEN, ADMIN_PASSWORD  

### OpenAPI Spec Drift Detection

**File:** `spec-drift.yml`  
**Jobs:** 4  
**Triggers:** pull_request, push, workflow_dispatch, schedule  
**Secrets:** GITHUB_TOKEN  

### Token Refresh (Reusable)

**File:** `token-refresh.yml`  
**Jobs:** 1  
**Triggers:** workflow_call  
**Secrets:** SITE_URL, SERVICE_ACCOUNT_SECRET, REFRESH_TOKEN, AUTH_TOKEN  

### 🔥 Weekly Smoke Test

**File:** `weekly-smoke-test.yml`  
**Jobs:** 1  
**Triggers:** schedule, workflow_dispatch  

