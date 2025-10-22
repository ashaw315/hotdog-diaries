# Secrets & Permissions Matrix

**Generated:** 2025-10-21 19:56:03 UTC  
**Security Score:** 0/100  

## Summary

| Metric | Count |
|--------|-------|
| Total Secrets Referenced | 27 |
| Unique Permissions | 5 |
| High-Risk Secrets | 12 |
| Overprivileged Workflows | 0 |
| Security Issues | 83 |

## Secret Usage

| Secret | Classification | Risk Level | Workflows | Usage Count |
|--------|---------------|------------|-----------|-------------|
| AUTH_TOKEN ⚠️ | auth | 🔴 critical | Auto-Approve Content, Auto Queue Manager, Database Cleanup, Daily Summary Report, Deploy Gate, 🚪 Deployment Gate, Housekeeping, Manual Operations, Post Breakfast Content, Post Dinner Content, Post Evening Content, Post Late Night Content, Post Lunch Content, Post Afternoon Snack, Content Posting, Production Autonomy Watchdog, 🔍 Production Audit, Queue Monitor Hook, Monitor Queue Health & Scan if Needed, Scan Bluesky for Content, Scan Giphy for Content, Scan Imgur for Content, Scan Lemmy for Content, Scan Niche Platforms, Scan Pixabay for Content, Scan Reddit for Content, Scan Social Platforms, Scan Tumblr for Content, Scan YouTube for Content, Schedule Reconciliation, Content Scheduler, Secret Validation, Token Refresh (Reusable) | 33 |
| SITE_URL  | unknown | 🟢 low | Auto-Approve Content, Auto Queue Manager, Database Cleanup, Daily Summary Report, Housekeeping, Manual Operations, Post Breakfast Content, Post Dinner Content, Post Evening Content, Post Late Night Content, Post Lunch Content, Post Afternoon Snack, Content Posting, Queue Monitor Hook, Monitor Queue Health & Scan if Needed, Scan Bluesky for Content, Scan Giphy for Content, Scan Imgur for Content, Scan Lemmy for Content, Scan Niche Platforms, Scan Pixabay for Content, Scan Reddit for Content, Scan Social Platforms, Scan Tumblr for Content, Scan YouTube for Content, Content Scheduler, Token Refresh (Reusable) | 27 |
| GITHUB_TOKEN ⚠️ | deployment | 🟠 high | Auto PR CI Shepherd, CI Failure Drilldown (Read-Only), CI, Daily Summary Report, Meta CI Audit, Phase 3 CI Auto-Healing: Security & Build Diagnostics, Post-Remediation Validation, Production Autonomy Watchdog, 🔍 Production Audit, Queue Readiness, OpenAPI Spec Drift Detection | 11 |
| SUPABASE_URL ⚠️ | database | 🔴 critical | Daily Ingestion Balance Report, Housekeeping, Content Posting, Production Autonomy Watchdog, 🔍 Production Audit, Content Scanners, Schedule Reconciliation, Content Scheduler | 8 |
| SUPABASE_SERVICE_ROLE_KEY_V2 ⚠️ | database | 🔴 critical | Daily Ingestion Balance Report, Housekeeping, Content Posting, Production Autonomy Watchdog, 🔍 Production Audit, Content Scanners, Schedule Reconciliation, Content Scheduler | 8 |
| DATABASE_URL ⚠️ | database | 🔴 critical | Housekeeping, Content Posting, Content Scanners, Schedule Reconciliation, Content Scheduler | 5 |
| SERVICE_ACCOUNT_SECRET  | unknown | 🟢 low | Auto Queue Manager, Post Breakfast Content, Token Refresh (Reusable) | 3 |
| REFRESH_TOKEN ⚠️ | auth | 🔴 critical | Auto Queue Manager, Post Breakfast Content, Token Refresh (Reusable) | 3 |
| JWT_SECRET ⚠️ | auth | 🔴 critical | Deploy Gate, Production Autonomy Watchdog, Secret Validation | 3 |
| REDDIT_CLIENT_ID  | api_key | 🟡 medium | Housekeeping, Content Scanners | 2 |
| YOUTUBE_API_KEY  | api_key | 🟡 medium | Housekeeping, Content Scanners | 2 |
| GIPHY_API_KEY  | api_key | 🟡 medium | Housekeeping, Content Scanners | 2 |
| ALERT_WEBHOOK_URL  | unknown | 🟢 low | Production Autonomy Watchdog, Scheduler SLA Guard | 2 |
| VERCEL_TOKEN ⚠️ | auth | 🔴 critical | Deploy Gate | 1 |
| VERCEL_PROJECT_ID ⚠️ | deployment | 🟠 high | Deploy Gate | 1 |
| VERCEL_TEAM_ID ⚠️ | deployment | 🟠 high | Deploy Gate | 1 |
| SLACK_WEBHOOK_URL  | unknown | 🟢 low | Meta CI Audit | 1 |
| CI_REDISPATCH_TOKEN ⚠️ | auth | 🔴 critical | Phase 3 CI Auto-Healing: Security & Build Diagnostics | 1 |
| REDDIT_CLIENT_SECRET  | api_key | 🟡 medium | Content Scanners | 1 |
| IMGUR_CLIENT_ID  | api_key | 🟡 medium | Content Scanners | 1 |
| BLUESKY_IDENTIFIER  | external_service | 🟡 medium | Content Scanners | 1 |
| BLUESKY_APP_PASSWORD  | external_service | 🟡 medium | Content Scanners | 1 |
| PIXABAY_API_KEY  | api_key | 🟡 medium | Content Scanners | 1 |
| TUMBLR_API_KEY  | api_key | 🟡 medium | Content Scanners | 1 |
| LEMMY_INSTANCE_URL  | external_service | 🟡 medium | Content Scanners | 1 |
| CRON_TOKEN ⚠️ | auth | 🔴 critical | Secret Validation | 1 |
| ADMIN_PASSWORD  | unknown | 🟢 low | Secret Validation | 1 |

## Permission Usage

| Permission | Scope | Risk Level | Workflows | Usage Count |
|------------|-------|------------|-----------|-------------|
| contents  | read | 🟢 low | CI Failure Drilldown (Read-Only), Database Cleanup, Deploy Gate, 🚪 Deployment Gate, Post Breakfast Content, Post Dinner Content, Post Evening Content, Post Late Night Content, Post Lunch Content, Post-Remediation Validation, Post Afternoon Snack | 11 |
| actions  | read | 🟢 low | CI Failure Drilldown (Read-Only), Deploy Gate | 2 |
| checks  | read | 🟢 low | CI Failure Drilldown (Read-Only) | 1 |
| issues ✏️ | write | 🟠 medium | CI Failure Drilldown (Read-Only) | 1 |
| checks ✏️ | write | 🟠 medium | Deploy Gate | 1 |

## 🚨 Security Issues

### 🟡 secret_exposure (medium)

**Workflow:** Auto-Approve Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Auto Queue Manager  
**Description:** Non-production workflow accesses critical secrets: REFRESH_TOKEN, AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** CI Failure Drilldown (Read-Only)  
**Description:** Non-production workflow accesses critical secrets: GITHUB_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Database Cleanup  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Daily Ingestion Balance Report  
**Description:** Non-production workflow accesses critical secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Daily Summary Report  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN, GITHUB_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Housekeeping  
**Description:** Non-production workflow accesses critical secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, DATABASE_URL, AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Manual Operations  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Meta CI Audit  
**Description:** Non-production workflow accesses critical secrets: GITHUB_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Phase 3 CI Auto-Healing: Security & Build Diagnostics  
**Description:** Non-production workflow accesses critical secrets: GITHUB_TOKEN, CI_REDISPATCH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Post Breakfast Content  
**Description:** Non-production workflow accesses critical secrets: REFRESH_TOKEN, AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Post Dinner Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Post Evening Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Post Late Night Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Post Lunch Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Post-Remediation Validation  
**Description:** Non-production workflow accesses critical secrets: GITHUB_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Post Afternoon Snack  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Content Posting  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, DATABASE_URL  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Queue Monitor Hook  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Monitor Queue Health & Scan if Needed  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Queue Readiness  
**Description:** Non-production workflow accesses critical secrets: GITHUB_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Bluesky for Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Giphy for Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Imgur for Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Lemmy for Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Niche Platforms  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Pixabay for Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Reddit for Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Social Platforms  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan Tumblr for Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Scan YouTube for Content  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Content Scanners  
**Description:** Non-production workflow accesses critical secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, DATABASE_URL  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Schedule Reconciliation  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN, DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Content Scheduler  
**Description:** Non-production workflow accesses critical secrets: AUTH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY_V2, DATABASE_URL  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🟡 secret_exposure (medium)

**Workflow:** Token Refresh (Reusable)  
**Description:** Non-production workflow accesses critical secrets: REFRESH_TOKEN, AUTH_TOKEN  
**Recommendation:** Limit critical secret access to production workflows only. Use less privileged secrets for testing.  

### 🔵 missing_permission (low)

**Workflow:** Posting Guard (Reusable)  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Auto-Approve Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Auto PR CI Shepherd  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Auto Queue Manager  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** CI Test  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** CI Test  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** CI  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Daily Ingestion Balance Report  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Daily Summary Report  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Housekeeping  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Manual Operations  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Meta CI Audit  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Phase 3 CI Auto-Healing: Security & Build Diagnostics  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** 📋 Planner Contract  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Content Posting  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Production Autonomy Watchdog  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** 🔍 Production Audit  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Queue Monitor Hook  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Monitor Queue Health & Scan if Needed  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Queue Readiness  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** 📋 Generate Runbook Artifacts  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Bluesky for Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Giphy for Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Imgur for Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Lemmy for Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Niche Platforms  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Pixabay for Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Reddit for Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Social Platforms  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan Tumblr for Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scan YouTube for Content  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Content Scanners  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Schedule Reconciliation  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Scheduler SLA Guard  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Content Scheduler  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Secret Validation  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** OpenAPI Spec Drift Detection  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** Token Refresh (Reusable)  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 missing_permission (low)

**Workflow:** 🔥 Weekly Smoke Test  
**Description:** Workflow does not specify explicit permissions (inherits repo defaults)  
**Recommendation:** Add explicit permissions block to follow principle of least privilege.  

### 🔵 unused_secret (low)

**Workflow:** Meta CI Audit  
**Description:** Secret SLACK_WEBHOOK_URL is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

### 🔵 unused_secret (low)

**Workflow:** Content Scanners  
**Description:** Secret REDDIT_CLIENT_SECRET is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

### 🔵 unused_secret (low)

**Workflow:** Content Scanners  
**Description:** Secret IMGUR_CLIENT_ID is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

### 🔵 unused_secret (low)

**Workflow:** Content Scanners  
**Description:** Secret BLUESKY_IDENTIFIER is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

### 🔵 unused_secret (low)

**Workflow:** Content Scanners  
**Description:** Secret BLUESKY_APP_PASSWORD is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

### 🔵 unused_secret (low)

**Workflow:** Content Scanners  
**Description:** Secret PIXABAY_API_KEY is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

### 🔵 unused_secret (low)

**Workflow:** Content Scanners  
**Description:** Secret TUMBLR_API_KEY is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

### 🔵 unused_secret (low)

**Workflow:** Content Scanners  
**Description:** Secret LEMMY_INSTANCE_URL is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

### 🔵 unused_secret (low)

**Workflow:** Secret Validation  
**Description:** Secret ADMIN_PASSWORD is only used by one workflow  
**Recommendation:** Consider if this secret is necessary or if it could be consolidated with others.  

## Recommendations

- 🚨 Security score is below 70%. Immediate attention required.
- 🔐 Limit critical secret access in 35 workflows.
- 📋 Regularly audit secret usage and permissions.
- 🔄 Rotate secrets according to your security policy.

