# Hotdog Diaries GitHub Actions Workflows

This directory contains the complete automation system for Hotdog Diaries, replacing the previous Vercel Cron setup with distributed, reliable GitHub Actions workflows.

## 📁 Workflow Files Overview

### 🍽️ **Meal Time Posting Workflows (6 files)**

| File | Schedule (UTC) | Meal | Purpose |
|------|----------------|------|---------|
| `post-breakfast.yml` | `0 7 * * *` | 7:00 AM | Morning hotdog content |
| `post-lunch.yml` | `0 12 * * *` | 12:00 PM | Lunch time content |
| `post-snack.yml` | `0 15 * * *` | 3:00 PM | Afternoon snack |
| `post-dinner.yml` | `0 18 * * *` | 6:00 PM | Dinner time content |
| `post-evening.yml` | `0 20 * * *` | 8:00 PM | Evening content |
| `post-late-night.yml` | `30 22 * * *` | 10:30 PM | Late night content |

**Features:**
- ✅ Individual execution (isolation from failures)
- ✅ Manual trigger capability (`workflow_dispatch`)
- ✅ Duplicate detection and prevention
- ✅ Automatic retry with delay
- ✅ Success/failure reporting

### 🔍 **Platform Scanning Workflows (8 files)**

| File | Schedule (UTC) | Platform | Frequency | Max Posts |
|------|----------------|----------|-----------|-----------|
| `scan-reddit.yml` | `0 2,10,18 * * *` | Reddit | 3x daily | 20 |
| `scan-youtube.yml` | `0 4,16 * * *` | YouTube | 2x daily | 10 |
| `scan-giphy.yml` | `0 2,10,18 * * *` | Giphy | 3x daily | 15 |
| `scan-pixabay.yml` | `0 3,11,19 * * *` | Pixabay | 3x daily | 15 |
| `scan-bluesky.yml` | `0 1,9,17 * * *` | Bluesky | 3x daily | 15 |
| `scan-imgur.yml` | `0 4,12,20 * * *` | Imgur | 3x daily | 15 |
| `scan-lemmy.yml` | `0 5,13,21 * * *` | Lemmy | 3x daily | 10 |
| `scan-tumblr.yml` | `0 6,14,22 * * *` | Tumblr | 3x daily | 10 |

**Staggered Timing Benefits:**
- 📊 Distributes API load throughout the day
- 🔄 Avoids rate limiting issues
- ⚡ Maximizes content discovery opportunities
- 🛡️ Fault tolerance (one platform failure doesn't affect others)

### 📊 **Monitoring & Management Workflows (4 files)**

#### `queue-monitor.yml`
- **Schedule:** Every 3 hours (`0 */3 * * *`)
- **Logic:**
  - `< 1 day` content → 🚨 **CRITICAL** emergency scan
  - `< 3 days` content → ⚠️ **HIGH** priority scan
  - `< 7 days` content → 📡 **NORMAL** maintenance scan
  - `> 7 days` content → ✅ **SKIP** (healthy queue)

#### `manual-operations.yml`
- **Trigger:** Manual dispatch only
- **Operations:**
  - `post-now` - Immediate content posting
  - `catch-up-missed-posts` - Multiple posts with count
  - `scan-all-emergency` - All platforms with auto-approval
  - `scan-all-normal` - Regular all-platform scan
  - `approve-pending` - Auto-approve high-confidence content
  - `system-health-check` - Full diagnostics
  - `clear-queue-test` - Cleanup test/duplicate content

#### `daily-report.yml`
- **Schedule:** Midnight UTC (`0 0 * * *`)
- **Features:**
  - Daily performance metrics
  - Queue health analysis
  - Automatic recommendations
  - Critical issue alerts
  - Report archival (30 days)

## 🔐 Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SITE_URL` | Production website URL | `https://hotdog-diaries.vercel.app` |
| `AUTH_TOKEN` | API authentication token | `your-secure-api-token-here` |

## 🚀 How to Use

### **Automatic Operation**
All workflows run automatically on their schedules. No manual intervention needed for normal operation.

### **Manual Triggers**

#### 1. **Post Content Now**
```
Actions → Manual Operations → Run workflow
Operation: post-now
```

#### 2. **Catch Up Missed Posts**
```
Actions → Manual Operations → Run workflow  
Operation: catch-up-missed-posts
Count: 3 (number of posts to make)
```

#### 3. **Emergency Content Scan**
```
Actions → Manual Operations → Run workflow
Operation: scan-all-emergency
```

#### 4. **Individual Platform Scan**
```
Actions → [Select platform] → Run workflow
```

#### 5. **Individual Meal Post**
```
Actions → [Select meal time] → Run workflow
```

## 📈 Monitoring Workflow Status

### **GitHub Actions Dashboard**
1. Go to repository **Actions** tab
2. View workflow run history
3. Click any run for detailed logs
4. Check success/failure status

### **Daily Reports**
- Automatically generated at midnight UTC
- Available in **Actions** → **Daily Summary Report**
- Download artifacts for detailed analysis

### **Queue Health**
- Monitor via **Actions** → **Monitor Queue Health**
- Runs every 3 hours automatically
- Triggers emergency scans when needed

## 🛠️ Troubleshooting

### **Missed Meal Posts**
```bash
# Manual catch-up via Actions UI:
Actions → Manual Operations → catch-up-missed-posts → Count: X
```

### **Platform Scan Failures**
Individual platform failures don't affect others. Check specific workflow logs and retry manually if needed.

### **Queue Emergency**
If queue drops below 1 day of content, emergency scan triggers automatically. Manual override:
```bash
Actions → Manual Operations → scan-all-emergency
```

### **API Rate Limits**
Workflows are staggered to avoid rate limits. If issues persist:
1. Check platform-specific API status
2. Retry individual platform scans
3. Temporarily disable problematic platforms

## 🔄 Migration from Vercel Cron

**Removed:**
- ❌ Single daily cron job
- ❌ Complex monolithic posting logic
- ❌ Hidden failure modes

**Added:**
- ✅ 6 individual meal time workflows
- ✅ 8 distributed platform scans
- ✅ Intelligent queue monitoring
- ✅ Manual operation controls
- ✅ Daily automated reporting
- ✅ Real-time visibility

## 📊 Success Metrics

### **Reliability Improvements:**
- Individual workflow isolation
- Automatic retry mechanisms
- Manual override capabilities
- Real-time monitoring

### **Visibility Improvements:**
- Clear execution history
- Detailed logging
- Performance metrics
- Automated reporting

### **Control Improvements:**
- Manual trigger any operation
- Fine-grained platform control
- Emergency procedures
- Queue health automation

## 🚨 Emergency Procedures

### **Complete System Recovery**
1. **Manual Operations** → `scan-all-emergency`
2. **Manual Operations** → `catch-up-missed-posts` → Count: 6
3. Wait 30 minutes for queue to populate
4. Monitor **Daily Report** for recovery status

### **Single Platform Issues**
1. Check specific platform workflow logs
2. Manually trigger that platform's scan
3. If persistent, disable that platform temporarily
4. Focus on working platforms until resolved

---

*This automation system ensures reliable, visible, and controllable content posting for Hotdog Diaries.*