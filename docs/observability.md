# Observability Guide

## Overview

This guide provides comprehensive monitoring, alerting, and troubleshooting information for the Hotdog Diaries application. The observability stack is designed to be "boringly reliable" with simple, actionable metrics and clear escalation paths.

## 📊 Core Metrics Endpoints

### System Metrics (`/api/system/metrics`)

**Endpoint**: `https://hotdog-diaries.vercel.app/api/system/metrics`  
**Purpose**: Lightweight, frequently-polled system health indicators  
**Cache**: No cache (real-time data)  
**PII**: None (safe for external monitoring)

#### Response Format

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime_seconds": 86400,
  "queue_depth_by_platform": {
    "reddit": 12,
    "youtube": 8,
    "imgur": 6,
    "giphy": 4,
    "pixabay": 3,
    "bluesky": 2
  },
  "posts_today": 4,
  "scans_last_24h": 15,
  "refill_count": 12,
  "errors_last_1h": 0,
  "health_status": "healthy",
  "version": "1.0.0",
  "environment": "production"
}
```

#### Key Metrics Explained

| Metric | Description | Normal Range | Alert Threshold |
|--------|-------------|--------------|-----------------|
| `queue_depth_by_platform` | Approved, unposted content per platform | 5-50 per platform | < 5 total |
| `posts_today` | Content posted today | 0-8 (depends on time) | 0 after 2 PM |
| `scans_last_24h` | New content discovered | 10-100 | < 5 |
| `refill_count` | Scheduled content next 2 days | 8-12 | < 6 |
| `errors_last_1h` | System errors in last hour | 0-2 | > 5 |
| `health_status` | Overall system health | "healthy" | "unhealthy" |

### Deep Health Check (`/api/admin/health/deep`)

**Endpoint**: `https://hotdog-diaries.vercel.app/api/admin/health/deep`  
**Purpose**: Comprehensive system diagnostics  
**Authentication**: Required (Bearer token)  
**Use Case**: Detailed troubleshooting and deploy gates

#### Response Format

```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "request_id": "01HF2K8VQXR9N7G3J4P8M2K5QW",
  "response_time_ms": 147,
  "components": {
    "database": {
      "status": "healthy",
      "response_time_ms": 23,
      "connection_pool": "available"
    },
    "jwt": {
      "status": "healthy", 
      "can_sign": true,
      "can_verify": true
    },
    "filesystem": {
      "status": "healthy",
      "writable": true
    },
    "external_apis": {
      "status": "healthy",
      "configured_services": 6
    }
  }
}
```

## 🚨 Alert Thresholds & Escalation

### Critical Alerts (Immediate Response)

| Condition | Threshold | Action | Escalation |
|-----------|-----------|--------|------------|
| Health status = "unhealthy" | Any occurrence | Page on-call | Immediate |
| Total queue depth | < 5 items | Page on-call | Within 15 min |
| Posts today = 0 | After 2 PM local | Alert DevOps | Within 30 min |
| Errors last hour | > 10 | Page on-call | Immediate |
| Deep health check failing | Any occurrence | Page on-call | Immediate |

### Warning Alerts (Business Hours Response)

| Condition | Threshold | Action | Escalation |
|-----------|-----------|--------|------------|
| Health status = "degraded" | Any occurrence | Slack alert | Within 2 hours |
| Platform queue depth | < 2 for any platform | Slack alert | Within 4 hours |
| Scans last 24h | < 10 | Slack alert | Next business day |
| Refill count | < 8 | Slack alert | Within 4 hours |
| Diversity score | < 0.4 (40%) | Slack alert | Next business day |

### Informational Alerts

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Deploy success | Each deployment | GitHub issue |
| Weekly secret audit | Every Monday | GitHub issue |
| High diversity score | > 0.8 (80%) | Slack celebration |

## 🔧 Curl Recipes

### Basic Health Check

```bash
# Quick system status
curl -s https://hotdog-diaries.vercel.app/api/system/metrics | jq .

# Pretty-printed key metrics
curl -s https://hotdog-diaries.vercel.app/api/system/metrics | \
  jq '{health: .health_status, posts_today: .posts_today, total_queue: ([.queue_depth_by_platform | to_entries[]] | map(.value) | add)}'
```

### Authenticated Deep Check

```bash
# Set your admin token
export ADMIN_TOKEN="your-jwt-token-here"

# Comprehensive health check
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://hotdog-diaries.vercel.app/api/admin/health/deep | jq .

# Check specific component
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://hotdog-diaries.vercel.app/api/admin/health/deep | \
  jq '.components.database'
```

### Forecast Validation

```bash
# Check today's content schedule
TODAY=$(date +%Y-%m-%d)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=$TODAY" | \
  jq '{date: .date, filled_slots: ([.slots[] | select(.content_id != null)] | length), total_slots: (.slots | length)}'

# Two-day readiness check
TOMORROW=$(date -d "+1 day" +%Y-%m-%d)
for DATE in $TODAY $TOMORROW; do
  echo "=== $DATE ==="
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=$DATE" | \
    jq '{filled: ([.slots[] | select(.content_id != null)] | length), diversity: .summary.diversity_score}'
done
```

### Queue Analysis

```bash
# Platform-specific queue depths
curl -s https://hotdog-diaries.vercel.app/api/system/metrics | \
  jq '.queue_depth_by_platform | to_entries | sort_by(.value) | reverse'

# Queue health assessment
curl -s https://hotdog-diaries.vercel.app/api/system/metrics | \
  jq 'if ([.queue_depth_by_platform | to_entries[]] | map(.value) | add) < 10 then "🔴 LOW QUEUE" elif .health_status == "healthy" then "✅ HEALTHY" else "⚠️ DEGRADED" end'
```

## 📈 Monitoring Setup

### Automated Monitoring (Recommended)

#### Datadog / New Relic

```bash
# Example monitoring script for external services
#!/bin/bash

METRICS=$(curl -s https://hotdog-diaries.vercel.app/api/system/metrics)

# Extract metrics
HEALTH_STATUS=$(echo $METRICS | jq -r '.health_status')
TOTAL_QUEUE=$(echo $METRICS | jq '[.queue_depth_by_platform | to_entries[]] | map(.value) | add // 0')
POSTS_TODAY=$(echo $METRICS | jq '.posts_today // 0')
ERRORS=$(echo $METRICS | jq '.errors_last_1h // 0')

# Send to monitoring service (replace with your service)
echo "hotdog_diaries.health_status:1|g|#status:$HEALTH_STATUS"
echo "hotdog_diaries.queue_depth:$TOTAL_QUEUE|g"
echo "hotdog_diaries.posts_today:$POSTS_TODAY|g"
echo "hotdog_diaries.errors_last_hour:$ERRORS|g"
```

#### Grafana Dashboard Queries

```promql
# Queue depth by platform
sum by (platform) (hotdog_diaries_queue_depth_by_platform)

# Daily posting rate
rate(hotdog_diaries_posts_today[1h]) * 24

# Error rate
rate(hotdog_diaries_errors_last_hour[5m])

# Health status (1 = healthy, 0.5 = degraded, 0 = unhealthy)
hotdog_diaries_health_status
```

### Manual Monitoring

#### Daily Checklist

```bash
# Morning health check (run daily at 9 AM)
#!/bin/bash
echo "📅 $(date) - Daily Health Check"
echo "================================"

# 1. System metrics
METRICS=$(curl -s https://hotdog-diaries.vercel.app/api/system/metrics)
HEALTH=$(echo $METRICS | jq -r '.health_status')
POSTS=$(echo $METRICS | jq '.posts_today')
QUEUE=$(echo $METRICS | jq '[.queue_depth_by_platform | to_entries[]] | map(.value) | add')

echo "Health Status: $HEALTH"
echo "Posts Today: $POSTS"
echo "Total Queue: $QUEUE"

# 2. Forecast check
TODAY=$(date +%Y-%m-%d)
FORECAST=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=$TODAY")
FILLED=$(echo $FORECAST | jq '[.slots[] | select(.content_id != null)] | length')

echo "Today's Schedule: $FILLED/6 slots filled"

# 3. Alert conditions
if [ "$HEALTH" != "healthy" ] || [ "$QUEUE" -lt 10 ] || [ "$FILLED" -lt 4 ]; then
  echo "⚠️ ATTENTION REQUIRED"
else
  echo "✅ All systems normal"
fi
```

#### Weekly Review

```bash
# Weekly metrics review (run Mondays)
#!/bin/bash
echo "📊 Weekly Metrics Review - $(date)"
echo "=================================="

# Historical metrics (would require logging/aggregation)
echo "📈 Trends to review:"
echo "  - Daily posting consistency"
echo "  - Platform diversity scores"
echo "  - Queue depth stability"
echo "  - Error frequency patterns"
echo "  - Deploy gate success rate"

# Secret rotation status
echo "🔐 Security review:"
echo "  - Check docs/secrets.md for rotation due dates"
echo "  - Verify weekly secret audit passed"
echo "  - Review any security alerts"
```

## 🔍 Troubleshooting Guide

### Health Status = "unhealthy"

1. **Check system metrics for specific issues**:
   ```bash
   curl -s https://hotdog-diaries.vercel.app/api/system/metrics | jq .
   ```

2. **Run deep health check**:
   ```bash
   curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://hotdog-diaries.vercel.app/api/admin/health/deep | jq .components
   ```

3. **Common causes & solutions**:
   - **Database connectivity**: Check Supabase status, connection strings
   - **High error count**: Review application logs, check external API limits
   - **Low queue depth**: Run content scans, check platform API keys

### Low Queue Depth (< 10 total)

1. **Check platform-specific queues**:
   ```bash
   curl -s https://hotdog-diaries.vercel.app/api/system/metrics | \
     jq '.queue_depth_by_platform'
   ```

2. **Identify problematic platforms** (depth < 2)

3. **Check platform API status**:
   ```bash
   curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://hotdog-diaries.vercel.app/api/admin/platforms/status | jq .
   ```

4. **Manual content scan** (if needed):
   ```bash
   # Trigger manual scan for specific platform
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"platform": "reddit", "maxPosts": 10}' \
     https://hotdog-diaries.vercel.app/api/admin/scan
   ```

### No Posts Today (after 2 PM)

1. **Check scheduled content**:
   ```bash
   TODAY=$(date +%Y-%m-%d)
   curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=$TODAY" | \
     jq '{scheduled: ([.slots[] | select(.content_id != null)] | length), posted: .summary.posted}'
   ```

2. **Check posting service health**:
   ```bash
   curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://hotdog-diaries.vercel.app/api/admin/queue/health | jq .
   ```

3. **Manual post trigger** (emergency):
   ```bash
   # Manually trigger next scheduled post
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://hotdog-diaries.vercel.app/api/admin/post/trigger
   ```

### Deploy Gate Failures

1. **Check post-deploy workflow logs** in GitHub Actions

2. **Manual validation**:
   ```bash
   # Test the same checks as deploy gate
   curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://hotdog-diaries.vercel.app/api/admin/health/deep
   
   TODAY=$(date +%Y-%m-%d)
   TOMORROW=$(date -d "+1 day" +%Y-%m-%d)
   
   for DATE in $TODAY $TOMORROW; do
     curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
       "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=$DATE"
   done
   ```

3. **Check authentication**:
   ```bash
   curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://hotdog-diaries.vercel.app/api/admin/health/auth-token
   ```

## 📞 Escalation Paths

### Level 1: Automated Recovery
- **Duration**: 0-5 minutes
- **Actions**: Automatic retries, circuit breakers, graceful degradation
- **Examples**: Temporary API failures, brief database connectivity issues

### Level 2: On-Call Response
- **Duration**: 5-30 minutes  
- **Trigger**: Critical alerts (health = unhealthy, zero queue depth)
- **Actions**: Manual intervention, service restarts, configuration fixes
- **Contacts**: Primary on-call engineer

### Level 3: Team Escalation
- **Duration**: 30+ minutes
- **Trigger**: Persistent critical issues, multiple system failures
- **Actions**: Team mobilization, architecture changes, vendor escalation
- **Contacts**: Engineering team, DevOps lead, Product owner

### Level 4: Incident Response
- **Duration**: 1+ hours
- **Trigger**: User-impacting outages, data integrity issues
- **Actions**: Full incident response protocol, external communication
- **Contacts**: Engineering leadership, CEO, customer support

## 🎯 SLA & Performance Targets

### Availability Targets

| Service | Target | Measurement |
|---------|--------|-------------|
| System Metrics Endpoint | 99.9% | Monthly uptime |
| Deep Health Check | 99.5% | Monthly uptime |
| Content Posting | 99.0% | Successful posts/scheduled |
| Deploy Gate | 95.0% | Successful validations |

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Metrics response time | < 500ms | 95th percentile |
| Health check response time | < 2s | 95th percentile |
| Deploy gate completion | < 5 min | 95th percentile |
| Queue refill time | < 10 min | Average |

### Quality Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Platform diversity | > 60% | Daily average |
| Content approval rate | > 80% | Weekly average |
| Error rate | < 1% | Monthly average |
| Deploy success rate | > 95% | Monthly success |

## 📝 Runbook Templates

### Daily Operations

```markdown
## Daily Health Check

**Date**: _____
**Engineer**: _____

### Morning Check (9 AM)
- [ ] System metrics: health_status = "healthy"
- [ ] Queue depth: total > 20
- [ ] Posts today: appropriate for time
- [ ] Forecast: today 6/6 filled

### Issues Found
- [ ] None
- [ ] Minor (documented below)
- [ ] Major (escalated)

**Notes**: 
_____

### Evening Review (5 PM)
- [ ] Posts today: 4-6 expected
- [ ] Tomorrow forecast: 6/6 filled
- [ ] No critical alerts

**Notes**:
_____
```

### Incident Response

```markdown
## Incident Response: ______

**Started**: _____
**Engineer**: _____
**Severity**: Critical/Major/Minor

### Detection
- **Alert source**: _____
- **Symptoms**: _____
- **Initial assessment**: _____

### Investigation
- [ ] System metrics checked
- [ ] Deep health check performed
- [ ] Logs reviewed
- [ ] Root cause identified: _____

### Resolution
- [ ] Fix applied: _____
- [ ] System validated
- [ ] Monitoring resumed
- [ ] Post-mortem scheduled

**Total Duration**: _____
**Impact**: _____
```

---

## 🔗 Related Documentation

- [Secrets & Rotation Audit](./secrets.md) - Security monitoring
- [API Documentation](../README.md) - Endpoint specifications  
- [Architecture Overview](./architecture.md) - System design
- [Deployment Guide](./deployment.md) - CI/CD pipeline

---

**Version**: 1.0  
**Last Updated**: 2025-01-15  
**Maintained By**: DevOps Team