# GitHub Actions Workflows Overview

Generated: 2025-10-18T19:46:43.152Z
Total workflows: 45

## By Category

### Scanning (15)

| Workflow | Triggers | Intent |
|----------|----------|--------|
| [Auto-Approve Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/auto-approve.yml) | cron (1), manual | Scans social media platforms for hotdog-related content |
| [Content Posting](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post.yml) | cron (6), manual, reusable | Scans social media platforms for hotdog-related content |
| [Monitor Queue Health & Scan if Needed](https://github.com/ashaw315/hotdog-diaries/actions/workflows/queue-monitor.yml) | cron (1) | Scans social media platforms for hotdog-related content |
| [Scan Bluesky for Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-bluesky.yml) | cron (1) | Scans Bluesky for hotdog content |
| [Scan Giphy for Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-giphy.yml) | cron (1) | Scans Giphy for hotdog GIFs |
| [Scan Imgur for Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-imgur.yml) | cron (1) | Scans Imgur for hotdog images |
| [Scan Lemmy for Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-lemmy.yml) | cron (1) | Scans social media platforms for hotdog-related content |
| [Scan Niche Platforms](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-niche-platforms.yml) | cron (1) | Scans social media platforms for hotdog-related content |
| [Scan Pixabay for Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-pixabay.yml) | cron (1) | Scans social media platforms for hotdog-related content |
| [Scan Reddit for Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-reddit.yml) | cron (1) | Scans Reddit for hotdog content |
| [Scan Social Platforms](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-social-platforms.yml) | cron (1) | Scans social media platforms for hotdog-related content |
| [Scan Tumblr for Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-tumblr.yml) | cron (1) | Scans social media platforms for hotdog-related content |
| [Scan YouTube for Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scan-youtube.yml) | cron (1) | Scans YouTube for hotdog content |
| [Content Scanners](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scanners.yml) | cron (3), manual, reusable | Scans social media platforms for hotdog-related content |
| [Content Scheduler](https://github.com/ashaw315/hotdog-diaries/actions/workflows/scheduler.yml) | cron (3), manual, reusable | Creates scheduled_posts rows for upcoming posting slots |

### Maintenance (12)

| Workflow | Triggers | Intent |
|----------|----------|--------|
| [Auto Queue Manager](https://github.com/ashaw315/hotdog-diaries/actions/workflows/auto-queue-manager.yml) | cron (1), manual | General workflow (purpose unclear from name) |
| [Database Cleanup](https://github.com/ashaw315/hotdog-diaries/actions/workflows/cleanup-duplicates.yml) | cron (1), manual | Performs maintenance and cleanup tasks |
| [Daily Ingestion Balance Report](https://github.com/ashaw315/hotdog-diaries/actions/workflows/daily-ingestion-report.yml) | cron (1), manual | General workflow (purpose unclear from name) |
| [Daily Summary Report](https://github.com/ashaw315/hotdog-diaries/actions/workflows/daily-report.yml) | cron (1) | General workflow (purpose unclear from name) |
| [Housekeeping](https://github.com/ashaw315/hotdog-diaries/actions/workflows/housekeeping.yml) | cron (2), manual, reusable | General workflow (purpose unclear from name) |
| [Manual Operations](https://github.com/ashaw315/hotdog-diaries/actions/workflows/manual-operations.yml) | manual | General workflow (purpose unclear from name) |
| [📋 Planner Contract](https://github.com/ashaw315/hotdog-diaries/actions/workflows/planner-contract.yml) | cron (1), manual | General workflow (purpose unclear from name) |
| [🔍 Production Audit](https://github.com/ashaw315/hotdog-diaries/actions/workflows/production-audit.yml) | cron (1), manual | General workflow (purpose unclear from name) |
| [📋 Generate Runbook Artifacts](https://github.com/ashaw315/hotdog-diaries/actions/workflows/runbook-artifact.yml) | manual, push | General workflow (purpose unclear from name) |
| [Secret Validation](https://github.com/ashaw315/hotdog-diaries/actions/workflows/secret-validation.yml) | cron (1), push | General workflow (purpose unclear from name) |
| [OpenAPI Spec Drift Detection](https://github.com/ashaw315/hotdog-diaries/actions/workflows/spec-drift.yml) | cron (1), push | General workflow (purpose unclear from name) |
| [Token Refresh (Reusable)](https://github.com/ashaw315/hotdog-diaries/actions/workflows/token-refresh.yml) | reusable | General workflow (purpose unclear from name) |

### Test (7)

| Workflow | Triggers | Intent |
|----------|----------|--------|
| [CI Test](https://github.com/ashaw315/hotdog-diaries/actions/workflows/ci-new.yml) | push | Runs automated tests and builds |
| [CI Test](https://github.com/ashaw315/hotdog-diaries/actions/workflows/ci-test.yml) | push | Runs automated tests and builds |
| [CI](https://github.com/ashaw315/hotdog-diaries/actions/workflows/ci.yml) | push, reusable | Runs automated tests and builds |
| [Meta CI Audit](https://github.com/ashaw315/hotdog-diaries/actions/workflows/meta-ci-audit.yml) | cron (1) | Runs automated tests and builds |
| [Phase 3 CI Auto-Healing: Security & Build Diagnostics](https://github.com/ashaw315/hotdog-diaries/actions/workflows/phase3-auto-healing.yml) | manual, reusable | Runs automated tests and builds |
| [Schedule Reconciliation](https://github.com/ashaw315/hotdog-diaries/actions/workflows/schedule-reconcile.yml) | cron (1), manual | Creates scheduled_posts rows for upcoming posting slots |
| [🔥 Weekly Smoke Test](https://github.com/ashaw315/hotdog-diaries/actions/workflows/weekly-smoke-test.yml) | cron (1), manual | Runs automated tests and builds |

### Deploy (2)

| Workflow | Triggers | Intent |
|----------|----------|--------|
| [Deploy Gate](https://github.com/ashaw315/hotdog-diaries/actions/workflows/deploy-gate.yml) | push, workflow_run | Validates deployment health and security gates |
| [🚪 Deployment Gate](https://github.com/ashaw315/hotdog-diaries/actions/workflows/deployment-gate.yml) | manual, reusable | Validates deployment health and security gates |

### Posting (8)

| Workflow | Triggers | Intent |
|----------|----------|--------|
| [Post Breakfast Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post-breakfast.yml) | cron (1) | Posts scheduled content at 08:00 ET (breakfast slot) |
| [Post-Deploy Check](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post-deploy-check.yml) | manual, push, reusable, workflow_run | Posts scheduled content at configured time |
| [Post Dinner Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post-dinner.yml) | cron (1) | Posts scheduled content at 18:00 ET (dinner slot) |
| [Post Evening Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post-evening.yml) | cron (1) | Posts scheduled content at 21:00 ET (evening slot) |
| [Post Late Night Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post-late-night.yml) | cron (1) | Posts scheduled content at 23:30 ET (late night slot) |
| [Post Lunch Content](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post-lunch.yml) | cron (1) | Posts scheduled content at 12:00 ET (lunch slot) |
| [Post-Remediation Validation](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post-remediation-check.yml) | manual | Posts scheduled content at configured time |
| [Post Afternoon Snack](https://github.com/ashaw315/hotdog-diaries/actions/workflows/post-snack.yml) | cron (1) | Posts scheduled content at 15:00 ET (snack slot) |

### Monitor (1)

| Workflow | Triggers | Intent |
|----------|----------|--------|
| [Queue Monitor Hook](https://github.com/ashaw315/hotdog-diaries/actions/workflows/queue-monitor-hook.yml) | reusable | Monitors system health and performance |

## Scheduled Workflows

| Workflow | Cron | Next Run (approx) |
|----------|------|------------------|
| Auto-Approve Content | `0 */6 * * *` | Daily at */6:00 UTC |
| Auto Queue Manager | `0 */6 * * *` | Daily at */6:00 UTC |
| Database Cleanup | `0 6 * * *` | Daily at 06:00 UTC |
| Daily Ingestion Balance Report | `0 9 * * *` | Daily at 09:00 UTC |
| Daily Summary Report | `0 0 * * *` | Daily at 00:00 UTC |
| Housekeeping | `0 3 * * 1` | Daily at 03:00 UTC |
| Housekeeping | `0 6 * * *` | Daily at 06:00 UTC |
| Meta CI Audit | `0 8 * * 1` | Daily at 08:00 UTC |
| 📋 Planner Contract | `30 3 * * *` | Daily at 03:30 UTC |
| Post Breakfast Content | `0 7 * * *` | Daily at 07:00 UTC |
| Post Dinner Content | `0 18 * * *` | Daily at 18:00 UTC |
| Post Evening Content | `0 20 * * *` | Daily at 20:00 UTC |
| Post Late Night Content | `30 22 * * *` | Daily at 22:30 UTC |
| Post Lunch Content | `0 12 * * *` | Daily at 12:00 UTC |
| Post Afternoon Snack | `0 15 * * *` | Daily at 15:00 UTC |
| Content Posting | `0 13 * * *` | Daily at 13:00 UTC |
| Content Posting | `0 17 * * *` | Daily at 17:00 UTC |
| Content Posting | `0 20 * * *` | Daily at 20:00 UTC |
| Content Posting | `0 23 * * *` | Daily at 23:00 UTC |
| Content Posting | `0 2 * * *` | Daily at 02:00 UTC |
| Content Posting | `30 4 * * *` | Daily at 04:30 UTC |
| 🔍 Production Audit | `0 9 * * 2` | Daily at 09:00 UTC |
| Monitor Queue Health & Scan if Needed | `0 */3 * * *` | Daily at */3:00 UTC |
| Scan Bluesky for Content | `0 1,9,17 * * *` | Daily at 1,9,17:00 UTC |
| Scan Giphy for Content | `0 2,10,18 * * *` | Daily at 2,10,18:00 UTC |
| Scan Imgur for Content | `0 4,12,20 * * *` | Daily at 4,12,20:00 UTC |
| Scan Lemmy for Content | `0 5,13,21 * * *` | Daily at 5,13,21:00 UTC |
| Scan Niche Platforms | `0 6,14,22 * * *` | Daily at 6,14,22:00 UTC |
| Scan Pixabay for Content | `0 3,11,19 * * *` | Daily at 3,11,19:00 UTC |
| Scan Reddit for Content | `0 2,10,18 * * *` | Daily at 2,10,18:00 UTC |
| Scan Social Platforms | `0 1,9,17 * * *` | Daily at 1,9,17:00 UTC |
| Scan Tumblr for Content | `0 6,14,22 * * *` | Daily at 6,14,22:00 UTC |
| Scan YouTube for Content | `0 4,16 * * *` | Daily at 4,16:00 UTC |
| Content Scanners | `0 */4 * * *` | Daily at */4:00 UTC |
| Content Scanners | `30 */6 * * *` | Daily at */6:30 UTC |
| Content Scanners | `15 */8 * * *` | Daily at */8:15 UTC |
| Schedule Reconciliation | `30 6 * * *` | Daily at 06:30 UTC |
| Content Scheduler | `0 1 * * *` | Daily at 01:00 UTC |
| Content Scheduler | `0 12 * * *` | Daily at 12:00 UTC |
| Content Scheduler | `0 0 * * 0` | Daily at 00:00 UTC |
| Secret Validation | `0 9 * * 1` | Daily at 09:00 UTC |
| OpenAPI Spec Drift Detection | `0 6 * * 1` | Daily at 06:00 UTC |
| 🔥 Weekly Smoke Test | `0 8 * * 1` | Daily at 08:00 UTC |

## Configuration Analysis

⚠️ **Auto-Approve Content**: 1 jobs without timeout-minutes
⚠️ **Auto Queue Manager**: 2 jobs without timeout-minutes
⚠️ **CI**: 1 jobs without timeout-minutes
⚠️ **Database Cleanup**: 2 jobs without timeout-minutes
⚠️ **Daily Ingestion Balance Report**: 1 jobs without timeout-minutes
⚠️ **Daily Summary Report**: 1 jobs without timeout-minutes
⚠️ **Deploy Gate**: 3 jobs without timeout-minutes
🔒 **Deploy Gate**: Has write permissions - review necessity
⚠️ **Housekeeping**: 1 jobs without timeout-minutes
⚠️ **Manual Operations**: 1 jobs without timeout-minutes
⚠️ **Phase 3 CI Auto-Healing: Security & Build Diagnostics**: 2 jobs without timeout-minutes
⚠️ **Post Breakfast Content**: 2 jobs without timeout-minutes
⚠️ **Post-Deploy Check**: 2 jobs without timeout-minutes
🔒 **Post-Deploy Check**: Has write permissions - review necessity
⚠️ **Post Dinner Content**: 1 jobs without timeout-minutes
⚠️ **Post Evening Content**: 1 jobs without timeout-minutes
⚠️ **Post Late Night Content**: 1 jobs without timeout-minutes
⚠️ **Post Lunch Content**: 1 jobs without timeout-minutes
⚠️ **Post Afternoon Snack**: 1 jobs without timeout-minutes
⚠️ **Content Posting**: 1 jobs without timeout-minutes
⚠️ **Queue Monitor Hook**: 1 jobs without timeout-minutes
⚠️ **Monitor Queue Health & Scan if Needed**: 2 jobs without timeout-minutes
⚠️ **📋 Generate Runbook Artifacts**: 1 jobs without timeout-minutes
⚠️ **Scan Bluesky for Content**: 1 jobs without timeout-minutes
⚠️ **Scan Giphy for Content**: 1 jobs without timeout-minutes
⚠️ **Scan Imgur for Content**: 1 jobs without timeout-minutes
⚠️ **Scan Lemmy for Content**: 1 jobs without timeout-minutes
⚠️ **Scan Niche Platforms**: 2 jobs without timeout-minutes
⚠️ **Scan Pixabay for Content**: 1 jobs without timeout-minutes
⚠️ **Scan Reddit for Content**: 1 jobs without timeout-minutes
⚠️ **Scan Social Platforms**: 4 jobs without timeout-minutes
⚠️ **Scan Tumblr for Content**: 1 jobs without timeout-minutes
⚠️ **Scan YouTube for Content**: 1 jobs without timeout-minutes
⚠️ **Content Scanners**: 1 jobs without timeout-minutes
⚠️ **Content Scheduler**: 1 jobs without timeout-minutes
⚠️ **Secret Validation**: 3 jobs without timeout-minutes
⚠️ **OpenAPI Spec Drift Detection**: 2 jobs without timeout-minutes
⚠️ **Token Refresh (Reusable)**: 1 jobs without timeout-minutes

