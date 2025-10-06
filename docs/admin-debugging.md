# Admin Dashboard Debugging Guide

This guide provides comprehensive troubleshooting and debugging information for the Hotdog Diaries admin dashboard.

## Quick Health Check

### 1. Debug Endpoint
Use the debug endpoint to quickly assess system health:

```bash
curl -s http://localhost:3000/api/admin/debug | jq .
```

Or in production:
```bash
curl -s https://hotdog-diaries.vercel.app/api/admin/debug | jq .
```

### 2. Health Score Interpretation
- **80-100**: System healthy
- **50-79**: Warning - some issues detected
- **0-49**: Critical - major problems

## Common Issues and Solutions

### Issue 1: Content Queue Not Loading

**Symptoms:**
- Empty content queue page
- Loading spinner that never completes
- Error message "Failed to fetch content"

**Debugging Steps:**
1. Check browser console for JavaScript errors
2. Verify authentication status in DevTools > Application > Cookies
3. Test API directly:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        "http://localhost:3000/api/admin/content?limit=10"
   ```

**Common Causes:**
- Expired or invalid JWT token
- Database connection issues
- Missing content_queue table

**Solutions:**
- Clear cookies and re-login
- Run database audit: `npm run db:audit`
- Check database environment variables

### Issue 2: Metrics Panel Shows Empty Data

**Symptoms:**
- Metrics dashboard shows zeros or null values
- "Failed to fetch metrics" error
- Platform performance section empty

**Debugging Steps:**
1. Test metrics API endpoint:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        "http://localhost:3000/api/admin/metrics?type=dashboard"
   ```
2. Check database for content:
   ```sql
   SELECT COUNT(*) FROM content_queue;
   SELECT COUNT(*) FROM posted_content;
   ```

**Solutions:**
- Ensure content_queue has data: run content scanning
- Verify posted_content table exists with proper schema
- Check if metrics aggregation queries are working

### Issue 3: 500 Errors from Admin API Routes

**Symptoms:**
- HTTP 500 responses from `/api/admin/*` endpoints
- "Internal server error" messages
- Dashboard components failing to load

**Debugging Steps:**
1. Check server logs for detailed error messages
2. Verify database connectivity:
   ```bash
   npm run db:audit
   ```
3. Test authentication:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        "http://localhost:3000/api/admin/debug"
   ```

**Common Causes:**
- Database schema drift between dev and production
- Missing environment variables
- Invalid JWT secret configuration

### Issue 4: Schema Drift Between Environments

**Symptoms:**
- Features work in development but fail in production
- Database errors mentioning missing tables/columns
- Inconsistent data between environments

**Debugging Process:**
1. Run schema audit:
   ```bash
   npm run db:audit
   ```
2. Compare table structures:
   ```bash
   # Development
   NODE_ENV=development sqlite3 hotdog_diaries_dev.db ".schema"
   
   # Production (if accessible)
   psql $DATABASE_URL -c "\d+ content_queue"
   ```

**Solutions:**
- Run migration scripts on production
- Apply schema fixes from `migrations/supabase_schema_fix.sql`
- Sync environment variables between dev and prod

## Authentication Debugging

### JWT Token Issues

**Generate Fresh Token:**
```bash
JWT_SECRET=<your-secret> npm run generate:token
```

**Verify Token:**
```javascript
// In browser console
const token = document.cookie.split('auth=')[1]?.split(';')[0]
console.log('Token:', token)

// Decode payload (without verification)
const payload = JSON.parse(atob(token.split('.')[1]))
console.log('Payload:', payload)
console.log('Expires:', new Date(payload.exp * 1000))
```

### Cookie Issues

**Check Authentication Cookies:**
1. Open DevTools > Application > Cookies
2. Look for `auth` cookie
3. Verify it's not expired
4. Check domain and path settings

**Clear Authentication:**
```javascript
// In browser console
document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
location.reload()
```

## Database Debugging

### Connection Issues

**Test Database Connectivity:**
```bash
# Development
NODE_ENV=development npm run db:audit

# Production
DATABASE_URL="postgresql://..." npm run db:audit
```

**Common Environment Variables:**
- `DATABASE_URL` - Full database connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `JWT_SECRET` - JWT signing secret

### Data Integrity

**Check Content Pipeline:**
```sql
-- Content status distribution
SELECT 
  is_approved,
  is_posted,
  COUNT(*) as count
FROM content_queue
GROUP BY is_approved, is_posted;

-- Platform distribution
SELECT 
  source_platform,
  COUNT(*) as count
FROM content_queue
GROUP BY source_platform
ORDER BY count DESC;

-- Recent activity
SELECT 
  id,
  content_text,
  source_platform,
  created_at,
  is_approved,
  is_posted
FROM content_queue
ORDER BY created_at DESC
LIMIT 10;
```

**Check Posting History:**
```sql
-- Recent posts
SELECT 
  pc.posted_at,
  cq.source_platform,
  cq.content_type,
  SUBSTR(cq.content_text, 1, 50) as preview
FROM posted_content pc
JOIN content_queue cq ON pc.content_queue_id = cq.id
ORDER BY pc.posted_at DESC
LIMIT 10;

-- Duplicate detection
SELECT 
  content_queue_id,
  COUNT(*) as times_posted
FROM posted_content
GROUP BY content_queue_id
HAVING COUNT(*) > 1;
```

## Frontend Debugging

### React Component Issues

**Enable React DevTools:**
1. Install React Developer Tools browser extension
2. Open Components tab in DevTools
3. Look for error boundaries and failed components

**Check Hook States:**
```javascript
// In component using useContentData
console.log('Content hook state:', {
  data,
  loading,
  error,
  pagination
})
```

### Network Request Debugging

**Monitor API Calls:**
1. Open DevTools > Network tab
2. Filter by "Fetch/XHR"
3. Look for failed requests (red status codes)
4. Check request/response headers and payloads

**Common Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
Cookie: auth=<jwt-token>
```

### Error Boundaries

The admin interface includes error boundaries that catch and display component errors. Check browser console for detailed error information.

## Performance Debugging

### Slow Loading Issues

**Check API Response Times:**
```bash
# Time API calls
time curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/api/admin/content?limit=50"
```

**Database Query Performance:**
```sql
-- Check for missing indexes
EXPLAIN QUERY PLAN 
SELECT * FROM content_queue 
WHERE is_approved = 1 AND is_posted = 0 
ORDER BY confidence_score DESC;

-- Check table sizes
SELECT 
  name,
  COUNT(*) as row_count
FROM (
  SELECT 'content_queue' as name UNION ALL
  SELECT 'posted_content' UNION ALL
  SELECT 'admin_users' UNION ALL
  SELECT 'system_logs'
) tables
JOIN content_queue ON tables.name = 'content_queue'
-- Add similar JOINs for other tables
```

## Production Deployment Issues

### Environment Configuration

**Required Environment Variables:**
```bash
# Authentication
JWT_SECRET=<64-char-hex-string>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# API Keys (for content scanning)
YOUTUBE_API_KEY=AIza...
REDDIT_CLIENT_ID=...
GIPHY_API_KEY=...
PIXABAY_API_KEY=...
```

**Verify Production Environment:**
```bash
# Test production API
curl -s https://hotdog-diaries.vercel.app/api/admin/debug

# Check Vercel logs
vercel logs --app=hotdog-diaries

# Check environment variables
vercel env ls
```

### Database Migration

**Apply Schema Updates:**
1. Connect to production database
2. Run migration script:
   ```sql
   \i migrations/supabase_schema_fix.sql
   ```
3. Verify tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

## Monitoring and Alerts

### System Health Monitoring

The admin interface provides real-time health monitoring:

1. **Dashboard Health Score**: Overall system health (0-100)
2. **Database Connectivity**: Connection status and latency
3. **Content Pipeline**: Queue status and flow metrics
4. **Platform Performance**: Source platform statistics

### Key Metrics to Monitor

- **Content Queue Size**: Should maintain 10+ approved items
- **Daily Posting Rate**: Should match configured schedule (6 posts/day)
- **Platform Diversity**: Content should come from multiple sources
- **Error Rate**: API calls should have <5% error rate
- **Response Times**: API calls should complete in <2 seconds

### Setting Up Alerts

Consider implementing alerts for:
- Queue running low (<5 approved items)
- No content posted in 6+ hours
- API error rate >10%
- Database connection failures
- Authentication failures spike

## Troubleshooting Checklist

When issues occur, follow this systematic approach:

1. **Check System Health**
   - [ ] Visit `/api/admin/debug` endpoint
   - [ ] Review health score and error list
   - [ ] Check database connectivity

2. **Verify Authentication**
   - [ ] Check JWT token validity
   - [ ] Verify cookie configuration
   - [ ] Test admin login flow

3. **Test Database**
   - [ ] Run `npm run db:audit`
   - [ ] Check table existence and row counts
   - [ ] Verify schema matches expectations

4. **Review Recent Changes**
   - [ ] Check recent deployments
   - [ ] Review environment variable changes
   - [ ] Look for schema migrations

5. **Check Frontend**
   - [ ] Browser console for JavaScript errors
   - [ ] Network tab for failed API calls
   - [ ] React DevTools for component issues

6. **Monitor Performance**
   - [ ] API response times
   - [ ] Database query performance
   - [ ] Client-side rendering performance

## Getting Help

If issues persist after following this guide:

1. **Collect Debug Information:**
   - Screenshot of error messages
   - Browser console logs
   - Network request/response details
   - System health check results

2. **Check Documentation:**
   - Review API documentation
   - Check component documentation
   - Reference database schema

3. **Contact Support:**
   - Provide debug information
   - Include steps to reproduce
   - Specify environment (dev/staging/prod)

Remember: The admin debug endpoint (`/api/admin/debug`) is your first stop for system health assessment and should guide your troubleshooting efforts.