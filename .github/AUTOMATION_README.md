# Hotdog Diaries GitHub Actions Automation

This document describes the comprehensive GitHub Actions automation system that replaces the previous Vercel Cron setup for better reliability, visibility, and control.

## 🍽️ Meal Time Posting Workflows

**Individual workflows for each posting time:**

| Workflow | Schedule (EST) | Schedule (UTC) | Description |
|----------|---------------|----------------|-------------|
| `post-breakfast.yml` | 8:00 AM | 12:00 PM | Morning hotdog content |
| `post-lunch.yml` | 12:00 PM | 4:00 PM | Midday hotdog content |
| `post-snack.yml` | 3:00 PM | 7:00 PM | Afternoon snack time |
| `post-dinner.yml` | 6:00 PM | 10:00 PM | Evening dinner content |
| `post-evening.yml` | 9:00 PM | 1:00 AM+1 | Late evening content |
| `post-late-night.yml` | 11:30 PM | 3:30 AM+1 | Very late night content |

**Benefits:**
- ✅ Independent execution (one failure doesn't affect others)
- ✅ Clear posting history for each meal time
- ✅ Manual trigger capability for catch-up posts
- ✅ Automatic retry on failure

## 📊 Queue Monitoring System

**Queue Health Check (`queue-monitor.yml`)**
- **Schedule:** Every 3 hours
- **Smart Logic:**
  - `< 1 day`: 🚨 CRITICAL - Emergency scan with auto-approval
  - `< 3 days`: ⚠️ HIGH - Priority platform scanning  
  - `< 7 days`: 📡 NORMAL - Regular maintenance scanning
  - `> 7 days`: ✅ Skip (queue healthy)

## 🔍 Platform Scanning Workflows

**Staggered throughout the day to optimize API usage:**

### Reddit (`scan-reddit.yml`)
- **Schedule:** 3x daily (2 AM, 10 AM, 6 PM UTC)
- **Quota:** High (most reliable source)

### YouTube (`scan-youtube.yml`) 
- **Schedule:** 2x daily (4 AM, 4 PM UTC)
- **Quota:** Limited (API quota restrictions)

### Social Platforms (`scan-social-platforms.yml`)
- **Schedule:** 3x daily (1 AM, 9 AM, 5 PM UTC) 
- **Includes:** Giphy, Bluesky, Imgur, Pixabay
- **Parallel execution** for efficiency

### Niche Platforms (`scan-niche-platforms.yml`)
- **Schedule:** 3x daily (6 AM, 2 PM, 10 PM UTC)
- **Includes:** Lemmy, Tumblr
- **Fault-tolerant** (continues if one fails)

## 🛠️ Manual Operations

**Manual Operations Workflow (`manual-operations.yml`)**

Available operations:
- `post-now`: Immediate content posting
- `catch-up-missed-posts`: Post multiple items with count parameter
- `scan-all-emergency`: Full platform scan with auto-approval
- `scan-all-normal`: Regular full platform scan
- `approve-pending`: Auto-approve high-confidence content
- `system-health-check`: Comprehensive system diagnostics
- `clear-queue-test`: Remove test/duplicate content

**Usage:**
1. Go to GitHub Actions tab
2. Select "Manual Operations" 
3. Click "Run workflow"
4. Choose operation and parameters
5. Monitor execution in real-time

## 📈 Daily Reporting

**Daily Summary Report (`daily-report.yml`)**
- **Schedule:** Midnight UTC daily
- **Features:**
  - Performance metrics (posts today, success rate)
  - Queue health analysis
  - Automatic recommendations
  - Critical issue detection
  - Archived reports (30-day retention)

**Example report:**
```markdown
# Hotdog Diaries Daily Report
**Date:** 2025-08-21

## 📊 Performance Metrics
- **Posts Today:** 4 / 6 expected
- **Missed Posts:** 2
- **Success Rate:** 66.7%

## 📦 Content Queue Status
- **Total Items:** 156
- **Approved & Ready:** 12
- **Days of Content:** 2.0 days
- **Health Status:** ⚠️ Low

## 🔧 Recommended Actions
- 🚨 **URGENT:** Run catch-up posting for 2 missed meals
- 📡 **HIGH PRIORITY:** Emergency content scanning needed
```

## 🔑 Required Secrets

Configure these in GitHub Settings → Secrets:

| Secret | Description | Example |
|--------|-------------|---------|
| `SITE_URL` | Production site URL | `https://hotdog-diaries.vercel.app` |
| `AUTH_TOKEN` | API authentication token | `your-secure-token` |
| `GITHUB_TOKEN` | Auto-provided by GitHub | (automatic) |

## 📱 API Endpoints

**New endpoints created for GitHub Actions:**

### `/api/admin/posting/post-meal`
```json
POST /api/admin/posting/post-meal
{
  "meal": "breakfast",
  "time": "08:00",
  "catchUp": false,
  "sequence": 1
}
```

### `/api/admin/posting/post-now`
```json
POST /api/admin/posting/post-now
{
  "immediate": true,
  "catchUp": false,
  "sequence": 1
}
```

### `/api/admin/daily-stats`
```json
GET /api/admin/daily-stats
// Returns comprehensive daily statistics
```

## 🔧 Migration from Vercel Cron

**What changed:**
- ❌ **Removed:** Single daily cron job at 10 AM UTC
- ✅ **Added:** 6 individual meal time workflows
- ✅ **Added:** Intelligent queue monitoring
- ✅ **Added:** Distributed platform scanning
- ✅ **Added:** Manual operation controls
- ✅ **Added:** Daily reporting system

**Benefits:**
1. **Reliability:** Individual jobs can't affect each other
2. **Visibility:** Clear history of what ran when
3. **Control:** Manual triggers for any operation
4. **Intelligence:** Smart scanning based on queue health
5. **Reporting:** Daily automated status reports
6. **Scalability:** Easy to add new platforms or times

## 🚨 Emergency Procedures

### Queue Empty Emergency
1. **Trigger:** Manual Operations → `scan-all-emergency`
2. **Result:** All platforms scanned + auto-approval
3. **Monitor:** Check daily report next day

### Missed Meal Posts
1. **Trigger:** Manual Operations → `catch-up-missed-posts`
2. **Set count:** Number of missed meals
3. **Result:** Sequential posting with delays

### Platform API Issues
1. **Check:** Individual platform workflow logs
2. **Retry:** Manual Operations → `scan-all-normal`
3. **Fallback:** Focus on working platforms temporarily

## 📊 Monitoring & Debugging

**GitHub Actions provides:**
- ✅ Real-time execution logs
- ✅ Success/failure history
- ✅ Performance metrics
- ✅ Manual re-run capability
- ✅ Workflow dependency tracking

**Admin dashboard shows:**
- ✅ Actual posting status (fixed!)
- ✅ Real-time queue metrics
- ✅ Platform health status
- ✅ Content approval pipeline

---

*This automation system ensures Hotdog Diaries maintains consistent posting while providing comprehensive monitoring and manual override capabilities.*