# Hotdog Diaries System Health Monitor

The monitoring script provides comprehensive health checks for the Hotdog Diaries automation system.

## Features

### Health Checks
1. **Content Queue** - Ensures >3 days of approved content (18+ posts)
2. **Posting Schedule** - Verifies posts within 6-hour intervals (6x daily)  
3. **Platform Diversity** - Checks no platform >30% of recent posts
4. **GitHub Workflows** - Monitors critical automation workflows
5. **API Health** - Tests production API endpoints

### Output Formats
- **Standard**: Human-readable report with status icons
- **JSON**: Machine-readable format for automation
- **Alert-only**: Shows only warnings and critical issues

## Usage

### Basic Monitoring
```bash
# Local development monitoring
JWT_SECRET=<secret> DATABASE_USER=user DATABASE_PASSWORD=pass NODE_ENV=development npx tsx scripts/monitor-system-health.ts

# Production monitoring
SITE_URL=https://hotdog-diaries.vercel.app AUTH_TOKEN=<token> npx tsx scripts/monitor-system-health.ts
```

### Options
```bash
# JSON output for automation
npx tsx scripts/monitor-system-health.ts --json

# Only show alerts/warnings
npx tsx scripts/monitor-system-health.ts --alert-only

# Verbose output with details
npx tsx scripts/monitor-system-health.ts --verbose

# Help
npx tsx scripts/monitor-system-health.ts --help
```

## Health Thresholds

### Content Queue
- **Healthy**: ≥3 days of content (18+ posts)
- **Warning**: 1-3 days of content
- **Critical**: <1 day of content

### Posting Schedule
- **Healthy**: Last post ≤6 hours ago
- **Warning**: Last post 6-8 hours ago  
- **Critical**: Last post >8 hours ago

### Platform Diversity
- **Healthy**: No platform >30% of recent posts
- **Warning**: Top platform 30-50%
- **Critical**: Top platform >50%

### GitHub Workflows
- **Healthy**: No critical workflow failures
- **Warning**: >2 non-critical failures
- **Critical**: Any critical workflow failing

## Exit Codes
- `0` - Healthy (all checks pass)
- `1` - Critical issues found
- `2` - Warnings found  
- `3` - Monitoring script error

## Integration

### Cron Job
```bash
# Check every hour
0 * * * * cd /path/to/hotdog-diaries && ./scripts/monitor-system-health.ts --alert-only

# Daily summary
0 6 * * * cd /path/to/hotdog-diaries && ./scripts/monitor-system-health.ts > /var/log/hotdog-health.log
```

### GitHub Actions
```yaml
- name: System Health Check
  run: |
    SITE_URL=https://hotdog-diaries.vercel.app \
    AUTH_TOKEN=${{ secrets.AUTH_TOKEN }} \
    npx tsx scripts/monitor-system-health.ts --json
```

### Slack/Discord Alerts
```bash
# Pipe alerts to notification service
./scripts/monitor-system-health.ts --alert-only | curl -X POST -H 'Content-Type: application/json' \
  -d '{"text": "Hotdog Diaries Alert: $(cat)"}' \
  $SLACK_WEBHOOK_URL
```

## Troubleshooting

### Common Issues

**GitHub CLI timeout**: 
- Ensure `gh` is installed and authenticated
- Script continues without GitHub checks if CLI unavailable

**API authentication failed**:
- Verify AUTH_TOKEN or JWT_SECRET is correct
- Check token hasn't expired (24-hour default)

**Database connection failed**:
- Ensure DATABASE_USER and DATABASE_PASSWORD are set
- Verify NODE_ENV is set to 'development' for SQLite

### Environment Variables
- `SITE_URL` - API base URL (default: http://localhost:3000)
- `AUTH_TOKEN` - Bearer token for API authentication  
- `JWT_SECRET` - Alternative to AUTH_TOKEN (generates token)
- `DATABASE_USER` - Database username (development)
- `DATABASE_PASSWORD` - Database password (development)
- `NODE_ENV` - Environment mode (development/production)
- `FORCE_API_CHECK` - Force API checks even on localhost

## Monitoring Results

The current system status shows:
- ⚠️ **1.7 days** of content remaining (below 3-day threshold)
- 🚨 **107+ hours** since last post (automation broken)
- 🚨 **Platform imbalance** - Pixabay dominating (66.7%)
- 🚨 **Critical workflows failing** - Auto-approval broken

### Recommended Actions
1. **Immediate**: Fix GitHub Actions workflows (already addressed with 308 redirect fix + JWT token)
2. **Short-term**: Run platform scanning to collect more diverse content  
3. **Long-term**: Set up automated monitoring alerts for early detection