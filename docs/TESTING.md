# Hotdog Diaries Platform Testing Guide

## Overview
This guide covers the comprehensive regression testing process for all content platforms after the Giphy integration.

## Quick Start

### 1. Reset Database
```bash
# Backup current data and clear all content
npm run reset-db
```

This will:
- Create a timestamped backup in `/backups/`
- Clear all content tables
- Reset scan timestamps for all platforms

### 2. Run Platform Scan Test
```bash
# Start the development server first
npm run dev

# In another terminal, run the scan test
curl -X POST http://localhost:3000/api/test/scan-all
```

Or use the combined command:
```bash
npm run test:platforms
```

### 3. View Results
Open http://localhost:3000/test-results in your browser to see:
- Platform scan results with color-coded status
- Content validation from database
- Direct links to test individual platforms
- Summary statistics

## Platform Status Indicators

### Scan Status
- 🟢 **Success** - Platform working correctly
- 🟡 **Partial** - Some errors occurred but content was found
- 🔴 **Failed** - Platform not working

### Content Status
- ✓ Has approved content
- ○ Has content (not approved)
- ✗ No content found

## Expected Results

All platforms should show:
1. **Success** or **Partial** scan status
2. At least some content found
3. Some approved content (varies by platform)

### Platform-Specific Notes

- **Reddit**: Should find text posts and discussions
- **YouTube**: Should find videos (may use mock data if no API key)
- **Imgur**: Should find GIFs and images
- **Lemmy**: Should find federated posts
- **Tumblr**: Should find blog posts
- **Pixabay**: Should find stock images
- **Bluesky**: Should find social posts
- **Giphy**: Should find GIFs with MP4 versions

## Troubleshooting

### Platform Shows "Failed"
1. Check API credentials in `.env.local`
2. Review error messages in scan results
3. Test individual platform API: `/api/admin/{platform}/test`

### No Content Approved
1. Content filtering may be too strict
2. Check confidence thresholds in content processor
3. Review filter keywords and patterns

### Database Reset Issues
1. Ensure PostgreSQL is running
2. Check database permissions
3. Manual reset: `TRUNCATE TABLE content_queue CASCADE;`

## Manual Testing

### Test Individual Platform
```bash
# Replace {platform} with: reddit, youtube, imgur, etc.
curl http://localhost:3000/api/admin/{platform}/scan -X POST
```

### Check Current Status
```bash
curl http://localhost:3000/api/test/scan-all
```

### View Platform Content
Visit `/admin/content?platform={platform}` to see content from specific platform.

## Monitoring

The test results page automatically updates when you:
1. Run a new scan test
2. Reload the page after manual scans
3. Click "Run Scan Test" button

## Best Practices

1. **Always backup before reset** - The reset script does this automatically
2. **Test in development** - Don't run reset in production
3. **Check rate limits** - Some APIs have hourly/daily limits
4. **Monitor logs** - Check console for detailed error messages
5. **Incremental testing** - Test platforms individually if bulk scan fails