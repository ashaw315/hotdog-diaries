# Posting Reliability Runbook

This runbook covers how to diagnose and resolve posting failures in the Hotdog Diaries content pipeline.

## 🚨 Emergency Response

### If Nothing Posted Today

**Immediate Actions (5 minutes):**
```bash
# 1. Check current schedule status
pnpm tsx scripts/ops/assert-schedule-ready.ts --tz America/New_York --date today --min 6

# 2. Emergency schedule materialization
pnpm tsx scripts/ops/materialize-schedule.ts --dates $(date -d "today" +%Y-%m-%d) --force

# 3. Trigger immediate posting for current time slot
gh workflow run post-breakfast.yml --ref main   # If before 12:00 ET
gh workflow run post-lunch.yml --ref main       # If before 15:00 ET
gh workflow run post-snack.yml --ref main       # If before 18:00 ET
gh workflow run post-dinner.yml --ref main      # If before 21:00 ET
gh workflow run post-evening.yml --ref main     # If before 23:30 ET
gh workflow run post-late-night.yml --ref main  # If after 21:00 ET
```

### If Schedule Slots = 0

**Root Cause**: Content scheduler failed or queue is empty

```bash
# 1. Check queue levels
pnpm tsx scripts/ops/check-queue-readiness.ts --min 12

# 2. If queue low, trigger scanners
gh workflow run scan-reddit.yml --ref main
gh workflow run scan-youtube.yml --ref main
gh workflow run scan-giphy.yml --ref main
gh workflow run scan-pixabay.yml --ref main

# 3. Force content scheduler
gh workflow run content-scheduler.yml --ref main

# 4. Manual scheduling for today + tomorrow
TODAY=$(date -d "today" +%Y-%m-%d)
TOMORROW=$(date -d "tomorrow" +%Y-%m-%d)
pnpm tsx scripts/ops/materialize-schedule.ts --dates $TODAY,$TOMORROW --force
```

## 📊 Daily Operations

### Morning Checklist (06:00 ET)

Run the SLA guard to ensure schedule compliance:

```bash
# Check today and tomorrow have sufficient content
pnpm tsx scripts/ops/assert-schedule-sla.ts --tz America/New_York --today 6 --tomorrow 6

# If fails, run emergency procedures above
```

### Pre-Posting Verification

Before each posting window, verify guard conditions:

```bash
# Verify current time slot has content
pnpm tsx scripts/ops/assert-schedule-ready.ts --tz America/New_York --date today --min 1

# Check specific time slot (example for lunch)
pnpm tsx scripts/ops/assert-schedule-ready.ts --tz America/New_York --date today --min 1
```

## 🔧 Manual Schedule Operations

### Create Schedule for Specific Dates

```bash
# Single date
pnpm tsx scripts/ops/materialize-schedule.ts --dates 2025-10-20

# Multiple dates
pnpm tsx scripts/ops/materialize-schedule.ts --dates 2025-10-20,2025-10-21,2025-10-22

# Force refill existing slots
pnpm tsx scripts/ops/materialize-schedule.ts --dates 2025-10-20 --force
```

### Manual Posting Triggers

```bash
# Trigger all posting workflows for today
for workflow in post-breakfast post-lunch post-snack post-dinner post-evening post-late-night; do
  gh workflow run $workflow.yml --ref main
done

# Trigger specific time slot
gh workflow run post-breakfast.yml --ref main  # 08:00 ET
gh workflow run post-lunch.yml --ref main      # 12:00 ET  
gh workflow run post-snack.yml --ref main      # 15:00 ET
gh workflow run post-dinner.yml --ref main     # 18:00 ET
gh workflow run post-evening.yml --ref main    # 21:00 ET
gh workflow run post-late-night.yml --ref main # 23:30 ET
```

### Queue Management

```bash
# Check queue health
pnpm tsx scripts/ops/check-queue-readiness.ts --min 12

# Trigger content ingestion
gh workflow run scan-all-platforms.yml --ref main

# Emergency content approval (if available)
pnpm tsx scripts/ops/emergency-approve-content.ts --platform reddit --limit 5
```

## 📈 Monitoring & Diagnostics

### Daily Reconciliation

Check posting vs schedule alignment:

```bash
# Run full audit
pnpm tsx scripts/ci/run-actions-audit.ts

# Check today's posting matrix
pnpm tsx scripts/ci/today-posting-matrix.ts

# View reports
cat ci_audit/actions/TODAY-posting-matrix.md
cat ci_audit/actions/WORKFLOW_HEALTH_REPORT.md
```

### Workflow Status

```bash
# Check recent workflow runs
gh run list --workflow post-breakfast.yml --limit 5
gh run list --workflow content-scheduler.yml --limit 5

# View specific run details
gh run view <run-id>

# Download run logs
gh run download <run-id>
```

### Database Queries

Connect to production database for direct inspection:

```bash
# Check today's schedule
SUPABASE_URL="https://ulaadphxfsrihoubjdrb.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<key>" \
pnpm tsx -e "
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await supabase.from('scheduled_posts').select('*').gte('scheduled_post_time', '$(date -u +%Y-%m-%d)T00:00:00Z').lte('scheduled_post_time', '$(date -u +%Y-%m-%d)T23:59:59Z')
console.table(data)
"
```

## 🎯 SLOs & Expectations

### Service Level Objectives

- **Schedule Materialization**: By 06:15 ET daily
  - Today: 6/6 slots filled with content
  - Tomorrow: 6/6 slots filled with content

- **Posting Success Rate**: ≥95% 
  - 6 posts per day
  - Maximum 1 missed slot per week

- **Queue Buffer**: ≥12 approved items
  - Minimum 2 days of content buffer
  - Platform diversity maintained

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Today's Schedule | <6 slots | <4 slots |
| Tomorrow's Schedule | <6 slots | <4 slots |
| Queue Size | <20 items | <12 items |
| Posting Success | <90% | <80% |

## 🔄 Recovery Procedures

### Full System Recovery

If multiple days of posting failed:

```bash
# 1. Emergency content ingestion
for platform in reddit youtube giphy pixabay imgur lemmy tumblr; do
  gh workflow run scan-${platform}.yml --ref main
done

# 2. Wait 30 minutes for content ingestion

# 3. Material schedule for next 3 days  
DATES=$(date -d "today" +%Y-%m-%d),$(date -d "tomorrow" +%Y-%m-%d),$(date -d "+2 days" +%Y-%m-%d)
pnpm tsx scripts/ops/materialize-schedule.ts --dates $DATES --force

# 4. Verify recovery
pnpm tsx scripts/ops/assert-schedule-sla.ts --today 6 --tomorrow 6
```

### Content Pipeline Recovery

If content scanners are failing:

```bash
# Check scanner health
pnpm tsx scripts/ops/check-scanner-health.ts

# Reset scanner state
pnpm tsx scripts/ops/reset-scanner-cursors.ts

# Emergency manual content addition
# (Use admin dashboard at https://hotdog-diaries.vercel.app/admin)
```

## 📱 Admin Dashboard

**URL**: https://hotdog-diaries.vercel.app/admin

**Login**: 
- Username: admin
- Password: (from 1Password)

**Key Features**:
- Schedule forecast view
- Content queue management  
- Manual content approval
- Platform scanner status
- Posting history

## 🔗 Quick Links

- **GitHub Actions**: https://github.com/ashaw315/hotdog-diaries/actions
- **Admin Dashboard**: https://hotdog-diaries.vercel.app/admin  
- **Production Logs**: Vercel dashboard
- **Database**: Supabase dashboard
- **Monitoring**: GitHub workflow status badges

## 📞 Escalation

If automated recovery fails:

1. **Check GitHub Actions Status**: https://www.githubstatus.com
2. **Check Vercel Status**: https://www.vercel-status.com  
3. **Check Supabase Status**: https://status.supabase.com
4. **Manual Content Entry**: Use admin dashboard
5. **Social Media Pause**: If content quality concerns

---

*Last Updated: 2025-10-18*  
*Next Review: 2025-11-18*