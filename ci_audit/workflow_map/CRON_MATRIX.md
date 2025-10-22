# Cron Schedule Matrix

**Generated:** 2025-10-21 19:56:03 UTC  
**Timezone:** America/New_York  
**DST Note:** Eastern Time observes DST (UTC-4 in summer, UTC-5 in winter). Cron expressions run in UTC.  

## Summary

| Metric | Count |
|--------|-------|
| Scheduled Workflows | 36 |
| Total Cron Expressions | 49 |
| Collision Windows | 17 |

## Schedule Details

| Workflow | Cron Expression | Description | Sample Times (ET) |
|----------|-----------------|-------------|-------------------|
| Auto-Approve Content | `0 */6 * * *` | At */6:00 UTC | 2025-10-22 00:00:00 EDT<br>2025-10-22 06:00:00 EDT |
| Auto Queue Manager | `0 */6 * * *` | At */6:00 UTC | 2025-10-22 00:00:00 EDT<br>2025-10-22 06:00:00 EDT |
| Database Cleanup | `0 6 * * *` | At 6:00 UTC | 2025-10-22 06:00:00 EDT<br>2025-10-23 06:00:00 EDT |
| Daily Ingestion Balance Report | `0 9 * * *` | At 9:00 UTC | 2025-10-22 09:00:00 EDT<br>2025-10-23 09:00:00 EDT |
| Daily Summary Report | `0 0 * * *` | At 0:00 UTC | 2025-10-22 00:00:00 EDT<br>2025-10-23 00:00:00 EDT |
| Housekeeping | `0 3 * * 1` | At 3:00 on Mon UTC | 2025-10-22 03:00:00 EDT<br>2025-10-23 03:00:00 EDT |
| Housekeeping | `0 6 * * *` | At 6:00 UTC | 2025-10-22 06:00:00 EDT<br>2025-10-23 06:00:00 EDT |
| Meta CI Audit | `0 8 * * 1` | At 8:00 on Mon UTC | 2025-10-22 08:00:00 EDT<br>2025-10-23 08:00:00 EDT |
| 📋 Planner Contract | `30 3 * * *` | At 3:30 UTC | 2025-10-22 03:30:00 EDT<br>2025-10-23 03:30:00 EDT |
| Post Breakfast Content | `0 7 * * *` | At 7:00 UTC | 2025-10-22 07:00:00 EDT<br>2025-10-23 07:00:00 EDT |
| Post Dinner Content | `0 18 * * *` | At 18:00 UTC | 2025-10-22 18:00:00 EDT<br>2025-10-23 18:00:00 EDT |
| Post Evening Content | `0 22 * * *` | At 22:00 UTC | 2025-10-21 22:00:00 EDT<br>2025-10-22 22:00:00 EDT |
| Post Late Night Content | `30 22 * * *` | At 22:30 UTC | 2025-10-21 22:30:00 EDT<br>2025-10-22 22:30:00 EDT |
| Post Lunch Content | `0 12 * * *` | At 12:00 UTC | 2025-10-22 12:00:00 EDT<br>2025-10-23 12:00:00 EDT |
| Post Afternoon Snack | `0 15 * * *` | At 15:00 UTC | 2025-10-22 15:00:00 EDT<br>2025-10-23 15:00:00 EDT |
| Content Posting | `0 13 * * *` | At 13:00 UTC | 2025-10-22 13:00:00 EDT<br>2025-10-23 13:00:00 EDT |
| Content Posting | `0 17 * * *` | At 17:00 UTC | 2025-10-22 17:00:00 EDT<br>2025-10-23 17:00:00 EDT |
| Content Posting | `0 20 * * *` | At 20:00 UTC | 2025-10-21 20:00:00 EDT<br>2025-10-22 20:00:00 EDT |
| Content Posting | `0 23 * * *` | At 23:00 UTC | 2025-10-21 23:00:00 EDT<br>2025-10-22 23:00:00 EDT |
| Content Posting | `0 2 * * *` | At 2:00 UTC | 2025-10-22 02:00:00 EDT<br>2025-10-23 02:00:00 EDT |
| Content Posting | `30 4 * * *` | At 4:30 UTC | 2025-10-22 04:30:00 EDT<br>2025-10-23 04:30:00 EDT |
| Production Autonomy Watchdog | `7 * * * *` | Complex schedule UTC | 2025-10-22 00:07:00 EDT<br>2025-10-22 06:07:00 EDT |
| Production Autonomy Watchdog | `7 10 * * *` | At 10:07 UTC | 2025-10-22 10:07:00 EDT<br>2025-10-23 10:07:00 EDT |
| Production Autonomy Watchdog | `37 10 * * *` | At 10:37 UTC | 2025-10-22 10:37:00 EDT<br>2025-10-23 10:37:00 EDT |
| Production Autonomy Watchdog | `7 11 * * *` | At 11:07 UTC | 2025-10-22 11:07:00 EDT<br>2025-10-23 11:07:00 EDT |
| 🔍 Production Audit | `0 9 * * 2` | At 9:00 on Tue UTC | 2025-10-22 09:00:00 EDT<br>2025-10-23 09:00:00 EDT |
| Monitor Queue Health & Scan if Needed | `0 */3 * * *` | At */3:00 UTC | 2025-10-22 00:00:00 EDT<br>2025-10-22 03:00:00 EDT |
| Queue Readiness | `0 10 * * *` | At 10:00 UTC | 2025-10-22 10:00:00 EDT<br>2025-10-23 10:00:00 EDT |
| Scan Bluesky for Content | `0 1,9,17 * * *` | At 1,9,17:00 UTC | 2025-10-22 01:00:00 EDT<br>2025-10-22 09:00:00 EDT |
| Scan Giphy for Content | `0 2,10,18 * * *` | At 2,10,18:00 UTC | 2025-10-22 02:00:00 EDT<br>2025-10-22 10:00:00 EDT |
| Scan Imgur for Content | `0 4,12,20 * * *` | At 4,12,20:00 UTC | 2025-10-21 20:00:00 EDT<br>2025-10-22 04:00:00 EDT |
| Scan Lemmy for Content | `0 5,13,21 * * *` | At 5,13,21:00 UTC | 2025-10-21 21:00:00 EDT<br>2025-10-22 05:00:00 EDT |
| Scan Niche Platforms | `0 6,14,22 * * *` | At 6,14,22:00 UTC | 2025-10-21 22:00:00 EDT<br>2025-10-22 06:00:00 EDT |
| Scan Pixabay for Content | `0 3,11,19 * * *` | At 3,11,19:00 UTC | 2025-10-22 03:00:00 EDT<br>2025-10-22 11:00:00 EDT |
| Scan Reddit for Content | `0 2,10,18 * * *` | At 2,10,18:00 UTC | 2025-10-22 02:00:00 EDT<br>2025-10-22 10:00:00 EDT |
| Scan Social Platforms | `0 1,9,17 * * *` | At 1,9,17:00 UTC | 2025-10-22 01:00:00 EDT<br>2025-10-22 09:00:00 EDT |
| Scan Tumblr for Content | `0 6,14,22 * * *` | At 6,14,22:00 UTC | 2025-10-21 22:00:00 EDT<br>2025-10-22 06:00:00 EDT |
| Scan YouTube for Content | `0 4,16 * * *` | At 4,16:00 UTC | 2025-10-22 04:00:00 EDT<br>2025-10-22 16:00:00 EDT |
| Content Scanners | `0 */4 * * *` | At */4:00 UTC | 2025-10-22 00:00:00 EDT<br>2025-10-22 04:00:00 EDT |
| Content Scanners | `30 */6 * * *` | At */6:30 UTC | 2025-10-22 00:30:00 EDT<br>2025-10-22 06:30:00 EDT |
| Content Scanners | `15 */8 * * *` | At */8:15 UTC | 2025-10-22 00:15:00 EDT<br>2025-10-22 00:15:00 EDT |
| Schedule Reconciliation | `30 6 * * *` | At 6:30 UTC | 2025-10-22 06:30:00 EDT<br>2025-10-23 06:30:00 EDT |
| Scheduler SLA Guard | `10 10 * * *` | At 10:10 UTC | 2025-10-22 10:10:00 EDT<br>2025-10-23 10:10:00 EDT |
| Content Scheduler | `0 1 * * *` | At 1:00 UTC | 2025-10-22 01:00:00 EDT<br>2025-10-23 01:00:00 EDT |
| Content Scheduler | `0 12 * * *` | At 12:00 UTC | 2025-10-22 12:00:00 EDT<br>2025-10-23 12:00:00 EDT |
| Content Scheduler | `0 0 * * 0` | At 0:00 on Sun UTC | 2025-10-22 00:00:00 EDT<br>2025-10-23 00:00:00 EDT |
| Secret Validation | `0 9 * * 1` | At 9:00 on Mon UTC | 2025-10-22 09:00:00 EDT<br>2025-10-23 09:00:00 EDT |
| OpenAPI Spec Drift Detection | `0 6 * * 1` | At 6:00 on Mon UTC | 2025-10-22 06:00:00 EDT<br>2025-10-23 06:00:00 EDT |
| 🔥 Weekly Smoke Test | `0 8 * * 1` | At 8:00 on Mon UTC | 2025-10-22 08:00:00 EDT<br>2025-10-23 08:00:00 EDT |

## ⚠️ Scheduling Collisions

### 🔴 06:00 UTC (severe)

**Colliding Workflows:**
- Auto-Approve Content
- Auto Queue Manager
- Database Cleanup
- Housekeeping
- Monitor Queue Health & Scan if Needed
- Scan Niche Platforms
- Scan Tumblr for Content
- OpenAPI Spec Drift Detection

### 🔴 00:00 UTC (severe)

**Colliding Workflows:**
- Auto-Approve Content
- Auto Queue Manager
- Daily Summary Report
- Monitor Queue Health & Scan if Needed
- Content Scanners
- Content Scheduler

### 🔴 12:00 UTC (severe)

**Colliding Workflows:**
- Auto-Approve Content
- Auto Queue Manager
- Post Lunch Content
- Scan Imgur for Content
- Content Scanners
- Content Scheduler

### 🔴 09:00 UTC (severe)

**Colliding Workflows:**
- Daily Ingestion Balance Report
- 🔍 Production Audit
- Monitor Queue Health & Scan if Needed
- Scan Bluesky for Content
- Scan Social Platforms
- Secret Validation

### 🔴 18:00 UTC (severe)

**Colliding Workflows:**
- Auto-Approve Content
- Auto Queue Manager
- Post Dinner Content
- Scan Giphy for Content
- Scan Reddit for Content

### 🟠 03:00 UTC (moderate)

**Colliding Workflows:**
- Housekeeping
- Monitor Queue Health & Scan if Needed
- Scan Pixabay for Content

### 🟠 08:00 UTC (moderate)

**Colliding Workflows:**
- Meta CI Audit
- Content Scanners
- 🔥 Weekly Smoke Test

### 🟠 22:00 UTC (moderate)

**Colliding Workflows:**
- Post Evening Content
- Scan Niche Platforms
- Scan Tumblr for Content

### 🟠 17:00 UTC (moderate)

**Colliding Workflows:**
- Content Posting
- Scan Bluesky for Content
- Scan Social Platforms

### 🟠 02:00 UTC (moderate)

**Colliding Workflows:**
- Content Posting
- Scan Giphy for Content
- Scan Reddit for Content

### 🟠 10:00 UTC (moderate)

**Colliding Workflows:**
- Queue Readiness
- Scan Giphy for Content
- Scan Reddit for Content

### 🟠 01:00 UTC (moderate)

**Colliding Workflows:**
- Scan Bluesky for Content
- Scan Social Platforms
- Content Scheduler

### 🟠 04:00 UTC (moderate)

**Colliding Workflows:**
- Scan Imgur for Content
- Scan YouTube for Content
- Content Scanners

### 🟡 13:00 UTC (minor)

**Colliding Workflows:**
- Content Posting
- Scan Lemmy for Content

### 🟡 20:00 UTC (minor)

**Colliding Workflows:**
- Content Posting
- Scan Imgur for Content

### 🟡 14:00 UTC (minor)

**Colliding Workflows:**
- Scan Niche Platforms
- Scan Tumblr for Content

### 🟡 06:30 UTC (minor)

**Colliding Workflows:**
- Content Scanners
- Schedule Reconciliation

## Recommendations

- Stagger workflows at 06:00 UTC: Auto-Approve Content, Auto Queue Manager, Database Cleanup, Housekeeping, Monitor Queue Health & Scan if Needed, Scan Niche Platforms, Scan Tumblr for Content, OpenAPI Spec Drift Detection (±2-5 min offset recommended)
- Stagger workflows at 00:00 UTC: Auto-Approve Content, Auto Queue Manager, Daily Summary Report, Monitor Queue Health & Scan if Needed, Content Scanners, Content Scheduler (±2-5 min offset recommended)
- Stagger workflows at 12:00 UTC: Auto-Approve Content, Auto Queue Manager, Post Lunch Content, Scan Imgur for Content, Content Scanners, Content Scheduler (±2-5 min offset recommended)
- Stagger workflows at 09:00 UTC: Daily Ingestion Balance Report, 🔍 Production Audit, Monitor Queue Health & Scan if Needed, Scan Bluesky for Content, Scan Social Platforms, Secret Validation (±2-5 min offset recommended)
- Stagger workflows at 18:00 UTC: Auto-Approve Content, Auto Queue Manager, Post Dinner Content, Scan Giphy for Content, Scan Reddit for Content (±2-5 min offset recommended)
- Stagger workflows at 03:00 UTC: Housekeeping, Monitor Queue Health & Scan if Needed, Scan Pixabay for Content (±2-5 min offset recommended)
- Stagger workflows at 08:00 UTC: Meta CI Audit, Content Scanners, 🔥 Weekly Smoke Test (±2-5 min offset recommended)
- Stagger workflows at 22:00 UTC: Post Evening Content, Scan Niche Platforms, Scan Tumblr for Content (±2-5 min offset recommended)
- Stagger workflows at 17:00 UTC: Content Posting, Scan Bluesky for Content, Scan Social Platforms (±2-5 min offset recommended)
- Stagger workflows at 02:00 UTC: Content Posting, Scan Giphy for Content, Scan Reddit for Content (±2-5 min offset recommended)
- Stagger workflows at 10:00 UTC: Queue Readiness, Scan Giphy for Content, Scan Reddit for Content (±2-5 min offset recommended)
- Stagger workflows at 01:00 UTC: Scan Bluesky for Content, Scan Social Platforms, Content Scheduler (±2-5 min offset recommended)
- Stagger workflows at 04:00 UTC: Scan Imgur for Content, Scan YouTube for Content, Content Scanners (±2-5 min offset recommended)

