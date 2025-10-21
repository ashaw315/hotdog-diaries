# Production Watchdog Runbook

This runbook covers the Production Autonomy Watchdog system that monitors Hotdog Diaries' production environment.

## 🎯 Purpose

The Production Watchdog verifies that Hotdog Diaries is operating autonomously in production by checking:
- GitHub Actions posting workflows are executing as scheduled
- Supabase has materialized schedule rows for today and tomorrow
- Posted content exists and updates correctly
- Health endpoints in production return OK
- Optional synthetic posting canary confirms end-to-end path

## ⚙️ How It Works

### Schedule

The watchdog runs automatically via GitHub Actions:
- **Hourly**: At :07 past each hour (e.g., 1:07, 2:07)
- **Critical Times**: 
  - 06:07 ET - Pre-breakfast check
  - 06:37 ET - Post-scheduler window
  - 07:07 ET - Breakfast posting verification

### Components Checked

1. **GitHub Actions** (`check-actions-today.ts`)
   - Fetches workflow runs for posting slots
   - Classifies each slot: SUCCESS, SKIPPED, MISSING, FAILED
   - Verifies timing alignment with ET schedule

2. **Database State** (`check-db-posting.ts`)
   - Connects to Supabase using service role key
   - Counts scheduled_posts for today/tomorrow
   - Counts posted_content for today
   - Validates schedule completeness (≥6 slots)

3. **UI Health** (`probe-ui.ts`)
   - Probes `/api/health/schedule-tz`
   - Probes `/api/health/posting-source-of-truth`
   - Checks admin page loads
   - Validates main page serves

4. **Synthetic Canary** (`synthetic-post-canary.ts`)
   - Optional dry-run posting test
   - Only runs in safe window (06:20-06:40 ET)
   - Validates posting pipeline without publishing

## 🚀 Manual Triggers

### Run Full Watchdog Check

```bash
# Basic run (check today)
gh workflow run prod-watchdog.yml --ref main

# Check specific date
gh workflow run prod-watchdog.yml --ref main \
  -f date="2025-10-20"

# Run with canary test
gh workflow run prod-watchdog.yml --ref main \
  -f run_canary=true
```

### View Recent Runs

```bash
# List recent watchdog runs
gh run list --workflow prod-watchdog.yml --limit 10

# View specific run
gh run view <run-id>

# Download artifacts
gh run download <run-id>
```

## 📊 Reading the Report

The watchdog generates `PROD_WATCHDOG_REPORT.md` with:

### Overall Status
- 🟢 **GREEN**: System fully operational
- 🟡 **YELLOW**: Minor issues, degraded performance
- 🔴 **RED**: Critical failures requiring intervention

### Component Breakdown

```markdown
| Component | Status | Details |
|-----------|--------|---------|
| GitHub Actions | 🟢 | 6 executed |
| Database | 🟢 | Today: 6/6, Tomorrow: 6/6, Posted: 4 |
| UI Health | 🟢 | 4/4 endpoints OK |
| Canary | 🟢 | Success (234ms) |
```

### Action Slots Table

```markdown
| Slot | Time (ET) | Status | Last Run |
|------|-----------|--------|----------|
| breakfast | 08:00 | ✅ EXECUTED_SUCCESS | Run #123 |
| lunch | 12:00 | ⏩ EXECUTED_SKIPPED_BY_GUARD | Run #124 |
| snack | 15:00 | ⏰ NOT_EXECUTED_YET | - |
```

Status meanings:
- ✅ **EXECUTED_SUCCESS**: Workflow ran and posted content
- ⏩ **EXECUTED_SKIPPED_BY_GUARD**: Guard blocked (no content available)
- ⏰ **NOT_EXECUTED_YET**: Future slot
- ❌ **MISSING_EXECUTION**: Past slot with no run
- ⚠️ **FAILED**: Workflow failed

## 🔧 Required Secrets

Configure these in GitHub repository settings:

| Secret | Description | Example |
|--------|-------------|---------|
| `JWT_SECRET` | **Primary auth secret** (64+ hex chars) | `a694aa9b...` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (read-only ops) | `eyJhbGc...` |
| `AUTH_TOKEN` | **Legacy fallback** (being deprecated) | `eyJhbGc...` |
| `ALERT_WEBHOOK_URL` | Optional webhook for alerts | Slack/Discord webhook |

### Authentication Methods

The watchdog uses **JWT runtime minting** as the primary authentication method:

1. **Primary**: Uses `JWT_SECRET` to mint short-lived tokens (15-30 minutes)
2. **Fallback**: Falls back to static `AUTH_TOKEN` if JWT minting fails
3. **Validation**: Tests auth self-test endpoint before running checks

Variables (optional):
| Variable | Description | Default |
|----------|-------------|---------|
| `PROD_BASE_URL` | Production app URL | `https://hotdog-diaries.vercel.app` |

## 🚨 Alert Handling

### GitHub Issues

On RED status, the watchdog:
1. Creates issue labeled `production-watchdog`
2. Updates existing open issue if present
3. Includes full report in issue body

### Webhook Alerts

If `ALERT_WEBHOOK_URL` is configured:
- Sends JSON payload on failures
- Compatible with Slack, Discord, generic webhooks

## 📋 Common Scenarios

### Scenario: Multiple Missing Executions

**Symptoms**: Report shows multiple slots with MISSING_EXECUTION

**Actions**:
```bash
# Manually trigger missing slots
gh workflow run post-breakfast.yml --ref main
gh workflow run post-lunch.yml --ref main
gh workflow run post-dinner.yml --ref main

# Check scheduler
gh workflow run content-scheduler.yml --ref main
```

### Scenario: Schedule Incomplete

**Symptoms**: Database shows <6 slots for today

**Actions**:
```bash
# Run content scheduler
gh workflow run content-scheduler.yml --ref main

# Force schedule materialization
gh workflow run manual-operations.yml --ref main \
  -f operation="materialize-schedule" \
  -f dates="$(date +%Y-%m-%d)"
```

### Scenario: UI Endpoints Failing

**Symptoms**: Health endpoints return non-200 or ok:false

**Actions**:
1. Check Vercel deployment status
2. Review production logs
3. Verify environment variables
4. Check Supabase connection

### Scenario: Canary Failures

**Symptoms**: Synthetic posting test fails

**Actions**:
1. Check if dry-run endpoint exists
2. Verify posting service configuration
3. Review canary timing (must be 06:20-06:40 ET)

### Scenario: Authentication Failures

**Symptoms**: Auth self-test endpoint fails, JWT minting errors

**Actions**:
```bash
# Test JWT_SECRET manually
echo $JWT_SECRET | wc -c  # Should be 65 (64 chars + newline)

# Test JWT minting locally
JWT_SECRET="your-secret" pnpm tsx scripts/ci/lib/jwt.ts mint --ttl 5m

# Test auth endpoint directly
TOKEN="..." curl -H "Authorization: Bearer $TOKEN" \
  "https://hotdog-diaries.vercel.app/api/health/auth-selftest"

# Check production auth self-test
curl "https://hotdog-diaries.vercel.app/api/health/auth-selftest"
```

**Common Issues**:
- `JWT_SECRET` not 64 hex characters exactly
- Secret mismatch between CI and production
- Auth self-test endpoint not deployed
- Network issues during token minting

## 📈 Performance Baselines

Expected metrics:
- **Workflow execution**: Within 5 minutes of scheduled time
- **Database queries**: <1s response time
- **UI endpoints**: <2s response time
- **Canary**: <5s total execution

## 🔄 Maintenance

### Weekly Reviews

- Check watchdog run history for patterns
- Review false positive rate
- Update thresholds if needed

### Monthly Tasks

- Rotate service role key if needed
- Review and close stale issues
- Update alert webhook configuration

## 🔗 Related Documentation

- [Auth Token Rotation & Deprecation Guide](../ci/auth-rotation.md)
- [Posting Reliability Runbook](./posting-reliability.md)
- [Secrets Management](../secrets.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Supabase Documentation](https://supabase.com/docs)

## 📞 Escalation

If watchdog consistently fails:

1. **Check External Services**:
   - GitHub Actions status: https://www.githubstatus.com
   - Vercel status: https://www.vercel-status.com
   - Supabase status: https://status.supabase.com

2. **Manual Verification**:
   ```bash
   # Check database directly
   SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
     pnpm tsx scripts/prod/check-db-posting.ts
   
   # Check UI manually
   curl -s https://hotdog-diaries.vercel.app/api/health/schedule-tz
   ```

3. **Emergency Recovery**:
   - Use admin dashboard for manual posting
   - Trigger emergency content ingestion
   - Consider temporary pause if quality issues

---

*Last Updated: 2025-10-20*  
*Next Review: 2025-11-20*