# Production Verification Report

**Generated:** 2025-10-22T14:09:43.017Z
**Verdict:** **FAIL**

## Executive Summary

**System Status Overview**: 1 systems passing, 1 with warnings, 5 failing.

**Is the scheduler filling six daily slots with diverse content?** No - Slot filling or diversity constraints may have issues.

**Is the unified posting pipeline actually posting?** No - No recent successful posting activity found.

**Are cron collisions meaningfully reduced?** Yes - Collision count reduced from baseline through staggering.

**Are app health endpoints green?** Yes - All monitored health endpoints returning 200 OK.

**Are secrets and Supabase connectivity solid?** Unknown - Secret management or Supabase connectivity needs attention.


## Environment

- **Site URL:** https://hotdog-diaries.vercel.app
- **Supabase URL:** https://ulaadphxfsrihoubjdrb.supabase.co
- **Service Key:** Present
- **Auth Token:** Present
- **Node Version:** v24.3.0
- **Verification Date:** 2025-10-22

## Verification Results

### ❌ Repository & PR State

❌ Target commit 6609f69 not found

❌ Failed to check PR status: HttpError: Bad credentials - https://docs.github.com/rest

✅ Required file exists: .github/workflows/post-time-slot.yml

✅ Required file exists: .github/workflows/post.yml

✅ Required file exists: __tests__/posting-diversity.test.ts

⚠️ Legacy wrapper not converted: post-snack.yml

⚠️ Legacy wrapper not converted: post-remediation-check.yml

⚠️ Legacy wrapper not converted: post-lunch.yml

⚠️ Legacy wrapper not converted: post-late-night.yml

⚠️ Legacy wrapper not converted: post-evening.yml

⚠️ Legacy wrapper not converted: post-dinner.yml

⚠️ Legacy wrapper not converted: post-deploy-check.yml

✅ Legacy wrapper converted: post-breakfast.yml

📊 Found 1 converted legacy wrappers

📊 Workflows with permissions blocks: 23/53

📊 Workflows with secret fallback pattern: 9

⚠️ Many workflows missing permissions blocks

### ✅ Cron & Collision Health

📊 Found 38 total cron jobs across all workflows

📊 Severe collision windows (≥4 workflows): 1

⚠️ Collision hotspots found:

   02:00 UTC: 4 workflows (scan-reddit, scan-giphy, post...)

✅ Collision count (1) reduced from baseline (17)

📅 Next 24h cron schedule (first 10):

   08:00 UTC (4:00 AM) - weekly-smoke-test

   06:00 UTC (2:00 AM) - spec-drift

   09:00 UTC (5:00 AM) - secret-validation

   01:00 UTC (9:00 PM) - scheduler

   12:00 UTC (8:00 AM) - scheduler

   00:00 UTC (8:00 PM) - scheduler

   10:10 UTC (6:10 AM) - scheduler-sla-guard

   06:30 UTC (2:30 AM) - schedule-reconcile

   04:00 UTC (12:00 AM) - scan-youtube

   06:05 UTC (2:05 AM) - scan-tumblr

### ❌ GitHub Actions Run Health

❌ Failed to fetch runs for scheduler.yml: HttpError: Bad credentials - https://docs.github.com/rest

❌ Failed to fetch runs for post.yml: HttpError: Bad credentials - https://docs.github.com/rest

❌ Failed to fetch runs for post-breakfast.yml: HttpError: Bad credentials - https://docs.github.com/rest

❌ Failed to fetch runs for post-lunch.yml: HttpError: Bad credentials - https://docs.github.com/rest

❌ Failed to fetch runs for post-dinner.yml: HttpError: Bad credentials - https://docs.github.com/rest

### ❌ App Health Endpoints

✅ /api/health/schedule-tz: HTTP 200

   Response: {"status":"warning","current_time_et":"2025-10-22 10:09:42 EDT","current_time_utc":"2025-10-22T14:09:42.010Z","timezone_offset_hours":4,"slot_conversions":[{"slot_index":0,"time_et":"08:00","time_utc"...

❌ /api/health/posting-source-of-truth: HTTP 500

   Error: {"status":"error","feature_flag_active":false,"total_recent_posts":14,"linked_posts":0,"orphan_posts":14,"orphan_percentage":100,"scheduled_posts_count":25,"posting_compliance_score":0,"issues":["ENFORCE_SCHEDULE_SOURCE_OF_TRUTH feature flag is not active","14 orphan posts found (100.0% of recent posts)"],"recommendations":["Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true to enforce scheduled_posts as s

### ❌ Supabase Ground Truth

✅ Supabase REST API accessible (HTTP 200)

📅 2025-10-22: 2 scheduled posts

❌ Expected 6 slots, found 2 for 2025-10-22

📊 2025-10-22 diversity:

   Platforms: 2 unique (pixabay, imgur)

✅ Platform diversity maintained (≤3 per platform)

📅 2025-10-23: 0 scheduled posts

❌ Expected 6 slots, found 0 for 2025-10-23

📊 2025-10-23 diversity:

   Platforms: 0 unique ()

✅ Platform diversity maintained (≤3 per platform)

### ❌ End-to-end Posting Probe

❌ Posting probe verification failed: HttpError: Bad credentials - https://docs.github.com/rest

### ⚠️ Neutralization Behavior

⚠️ No neutral runs found - neutralization may not be triggered yet

## Next Actions

1. Address 5 failing systems: Repository & PR State, GitHub Actions Run Health, App Health Endpoints, Supabase Ground Truth, End-to-end Posting Probe
2. Review 1 systems with warnings for optimization
3. Verify Supabase connection and scheduled_posts table integrity

---
*Report generated by production verification system*
