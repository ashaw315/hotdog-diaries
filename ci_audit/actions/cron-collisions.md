# Cron Schedule Analysis

Generated: 2025-10-18T19:47:01.400Z
Scheduled workflows: 33

## Overview

❌ **Thundering Herd Risk Detected** - Multiple workflows may execute simultaneously

## Schedule Collisions

| Time (ET) | Severity | Workflows | Issue |
|-----------|----------|-----------|-------|
| 20:00:00 | 🔴 high | Post Evening Content, Content Posting | 2 workflows scheduled at same time (includes posting workflows) |
| 00:00:00 | 🟢 low | Auto-Approve Content, Auto Queue Manager | 2 workflows scheduled at same time |
| 00:00:00 | 🟢 low | Daily Summary Report, Content Scheduler | 2 workflows scheduled at same time |
| 01:00:00 | 🟢 low | Scan Bluesky for Content, Scan Social Platforms | 2 workflows scheduled at same time |
| 02:00:00 | 🟢 low | Scan Giphy for Content, Scan Reddit for Content | 2 workflows scheduled at same time |
| 06:00:00 | 🟡 medium | Database Cleanup, Housekeeping, OpenAPI Spec Drift Detection | Moderate collision risk: 3 workflows |
| 06:00:00 | 🟢 low | Scan Niche Platforms, Scan Tumblr for Content | 2 workflows scheduled at same time |
| 08:00:00 | 🟢 low | Meta CI Audit, 🔥 Weekly Smoke Test | 2 workflows scheduled at same time |
| 09:00:00 | 🟡 medium | Daily Ingestion Balance Report, 🔍 Production Audit, Secret Validation | Moderate collision risk: 3 workflows |
| 12:00:00 | 🔴 high | Post Lunch Content, Content Scheduler | 2 workflows scheduled at same time (includes posting workflows) |

## All Scheduled Workflows

| Workflow | Frequency | Next Run (ET) | Cron Expression |
|----------|-----------|---------------|------------------|
| Content Posting | 📅 daily | 17:00:00 | `0 17 * * *` |
| Post Dinner Content | 📅 daily | 18:00:00 | `0 18 * * *` |
| Post Evening Content | 📅 daily | 20:00:00 | `0 20 * * *` |
| Content Posting | 📅 daily | 20:00:00 | `0 20 * * *` |
| Post Late Night Content | 📅 daily | 22:30:00 | `30 22 * * *` |
| Content Posting | 📅 daily | 23:00:00 | `0 23 * * *` |
| Auto-Approve Content | 📅 daily | 00:00:00 | `0 */6 * * *` |
| Auto Queue Manager | 📅 daily | 00:00:00 | `0 */6 * * *` |
| Daily Summary Report | 📅 daily | 00:00:00 | `0 0 * * *` |
| Monitor Queue Health & Scan if Needed | 📅 daily | 00:00:00 | `0 */3 * * *` |
| Content Scanners | 📅 daily | 00:00:00 | `0 */4 * * *` |
| Content Scheduler | 📆 weekly | 00:00:00 | `0 0 * * 0` |
| Content Scanners | 📅 daily | 00:15:00 | `15 */8 * * *` |
| Content Scanners | 📅 daily | 00:30:00 | `30 */6 * * *` |
| Scan Bluesky for Content | 📅 daily | 01:00:00 | `0 1,9,17 * * *` |
| Scan Social Platforms | 📅 daily | 01:00:00 | `0 1,9,17 * * *` |
| Content Scheduler | 📅 daily | 01:00:00 | `0 1 * * *` |
| Content Posting | 📅 daily | 02:00:00 | `0 2 * * *` |
| Scan Giphy for Content | 📅 daily | 02:00:00 | `0 2,10,18 * * *` |
| Scan Reddit for Content | 📅 daily | 02:00:00 | `0 2,10,18 * * *` |
| Housekeeping | 📆 weekly | 03:00:00 | `0 3 * * 1` |
| Scan Pixabay for Content | 📅 daily | 03:00:00 | `0 3,11,19 * * *` |
| 📋 Planner Contract | 📅 daily | 03:30:00 | `30 3 * * *` |
| Scan Imgur for Content | 📅 daily | 04:00:00 | `0 4,12,20 * * *` |
| Scan YouTube for Content | 📅 daily | 04:00:00 | `0 4,16 * * *` |
| Content Posting | 📅 daily | 04:30:00 | `30 4 * * *` |
| Scan Lemmy for Content | 📅 daily | 05:00:00 | `0 5,13,21 * * *` |
| Database Cleanup | 📅 daily | 06:00:00 | `0 6 * * *` |
| Housekeeping | 📅 daily | 06:00:00 | `0 6 * * *` |
| Scan Niche Platforms | 📅 daily | 06:00:00 | `0 6,14,22 * * *` |
| Scan Tumblr for Content | 📅 daily | 06:00:00 | `0 6,14,22 * * *` |
| OpenAPI Spec Drift Detection | 📆 weekly | 06:00:00 | `0 6 * * 1` |
| Schedule Reconciliation | 📅 daily | 06:30:00 | `30 6 * * *` |
| Post Breakfast Content | 📅 daily | 07:00:00 | `0 7 * * *` |
| Meta CI Audit | 📆 weekly | 08:00:00 | `0 8 * * 1` |
| 🔥 Weekly Smoke Test | 📆 weekly | 08:00:00 | `0 8 * * 1` |
| Daily Ingestion Balance Report | 📅 daily | 09:00:00 | `0 9 * * *` |
| 🔍 Production Audit | 📆 weekly | 09:00:00 | `0 9 * * 2` |
| Secret Validation | 📆 weekly | 09:00:00 | `0 9 * * 1` |
| Post Lunch Content | 📅 daily | 12:00:00 | `0 12 * * *` |
| Content Scheduler | 📅 daily | 12:00:00 | `0 12 * * *` |
| Content Posting | 📅 daily | 13:00:00 | `0 13 * * *` |
| Post Afternoon Snack | 📅 daily | 15:00:00 | `0 15 * * *` |

## Today's Expected Runs (2025-10-18)

| Time (ET) | Workflow | Status |
|-----------|----------|--------|
| 00:00 | Auto-Approve Content | ⏳ Scheduled later |
| 00:00 | Auto Queue Manager | ⏳ Scheduled later |
| 00:00 | Daily Summary Report | ⏳ Scheduled later |
| 00:00 | Monitor Queue Health & Scan if Needed | ⏳ Scheduled later |
| 00:00 | Content Scanners | ⏳ Scheduled later |
| 00:00 | Content Scheduler | ⏳ Scheduled later |
| 00:15 | Content Scanners | ⏳ Scheduled later |
| 00:30 | Content Scanners | ⏳ Scheduled later |
| 01:00 | Scan Bluesky for Content | ✅ Should have run |
| 01:00 | Scan Social Platforms | ✅ Should have run |
| 01:00 | Content Scheduler | ✅ Should have run |
| 02:00 | Content Posting | ✅ Should have run |
| 02:00 | Scan Giphy for Content | ✅ Should have run |
| 02:00 | Scan Reddit for Content | ✅ Should have run |
| 03:00 | Housekeeping | ✅ Should have run |
| 03:00 | Scan Pixabay for Content | ✅ Should have run |
| 03:30 | 📋 Planner Contract | ✅ Should have run |
| 04:00 | Scan Imgur for Content | ✅ Should have run |
| 04:00 | Scan YouTube for Content | ✅ Should have run |
| 04:30 | Content Posting | ✅ Should have run |
| 05:00 | Scan Lemmy for Content | ✅ Should have run |
| 06:00 | Database Cleanup | ✅ Should have run |
| 06:00 | Housekeeping | ✅ Should have run |
| 06:00 | Scan Niche Platforms | ✅ Should have run |
| 06:00 | Scan Tumblr for Content | ✅ Should have run |
| 06:00 | OpenAPI Spec Drift Detection | ✅ Should have run |
| 06:30 | Schedule Reconciliation | ✅ Should have run |
| 07:00 | Post Breakfast Content | ✅ Should have run |
| 08:00 | Meta CI Audit | ✅ Should have run |
| 08:00 | 🔥 Weekly Smoke Test | ✅ Should have run |
| 09:00 | Daily Ingestion Balance Report | ✅ Should have run |
| 09:00 | 🔍 Production Audit | ✅ Should have run |
| 09:00 | Secret Validation | ✅ Should have run |
| 12:00 | Post Lunch Content | ✅ Should have run |
| 12:00 | Content Scheduler | ✅ Should have run |
| 13:00 | Content Posting | ✅ Should have run |
| 15:00 | Post Afternoon Snack | ✅ Should have run |
| 17:00 | Content Posting | ⏳ Scheduled later |
| 18:00 | Post Dinner Content | ⏳ Scheduled later |
| 20:00 | Post Evening Content | ⏳ Scheduled later |
| 20:00 | Content Posting | ⏳ Scheduled later |
| 22:30 | Post Late Night Content | ⏳ Scheduled later |
| 23:00 | Content Posting | ⏳ Scheduled later |

## Peak Load Times

- */6:xx UTC (3 workflows)
- 06:xx UTC (4 workflows)
- 09:xx UTC (3 workflows)

## Recommendations

- Stagger high-collision workflows by 1-2 minutes to reduce load spikes
