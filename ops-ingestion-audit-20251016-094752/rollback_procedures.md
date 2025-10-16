# STEP 8: Rollback Procedures

## Overview
Complete rollback procedures for the ingestion rebalance system if issues arise.

## 1. Database Rollback (Priority Reset)

### Immediate Rollback - Restore All Content to Active Priority
```sql
-- Restore all deprioritized content to normal priority
UPDATE public.content_queue 
SET ingest_priority = 0,
    updated_at = NOW()
WHERE ingest_priority < 0;

-- Verify rollback
SELECT 
  lower(source_platform) AS platform,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE COALESCE(ingest_priority, 0) >= 0) AS active_priority,
  COUNT(*) FILTER (WHERE COALESCE(ingest_priority, 0) < 0) AS deprioritized
FROM public.content_queue
WHERE is_approved = true AND COALESCE(is_posted, false) = false
GROUP BY 1
ORDER BY total_items DESC;
```

**Expected Result After Rollback:**
- All platforms return to original distribution
- 1000 total items back in active pool  
- 0 items with negative priority

## 2. Code Rollback

### Scheduler Query Changes
If the enhanced scheduler queries cause issues, revert these files:

**File**: `lib/services/schedule-content-production.ts`
```typescript
// ROLLBACK: Remove these additions
- .gte('ingest_priority', 0)  // Remove priority filter
- underrep boost logic        // Remove diversity boost
- getCurrentPoolDistribution  // Remove helper functions
```

**File**: `scripts/collectors/base-collector.ts`
```typescript
// ROLLBACK: Remove quota enforcement
- shouldRunCollection()       // Remove quota checking
- IngestionQuotaManager      // Remove quota manager usage
```

### Git Rollback Commands
```bash
# If changes are committed but not yet deployed
git revert <commit-hash>

# If changes are deployed and need immediate rollback  
git reset --hard <previous-stable-commit>
git push --force-with-lease origin main

# Emergency: Disable specific features via environment variables
export DISABLE_PRIORITY_FILTERING=true
export DISABLE_QUOTA_ENFORCEMENT=true
```

## 3. Gradual Rollback Options

### Partial Priority Reset (Conservative)
```sql
-- Reset only platforms that are causing issues
UPDATE public.content_queue 
SET ingest_priority = 0
WHERE ingest_priority < 0 
  AND lower(source_platform) IN ('pixabay', 'bluesky');
```

### Temporary Quota Adjustment
```typescript
// Increase quotas temporarily if too restrictive
export const EMERGENCY_QUOTAS: Record<string, PlatformQuotas> = {
  pixabay: { dailyCap: 200, bufferFloor: 300, burstAllowed: 500 },
  bluesky: { dailyCap: 200, bufferFloor: 300, burstAllowed: 500 },
  // ... other platforms with relaxed limits
}
```

## 4. Monitoring During Rollback

### Key Metrics to Watch
1. **Content Pool Size**
   ```sql
   SELECT COUNT(*) FROM content_queue 
   WHERE is_approved = true AND is_posted = false;
   ```

2. **Platform Distribution**
   ```sql
   SELECT lower(source_platform), COUNT(*) 
   FROM content_queue 
   WHERE is_approved = true AND is_posted = false AND ingest_priority >= 0
   GROUP BY 1 ORDER BY 2 DESC;
   ```

3. **Scheduler Success Rate**
   - Monitor scheduled_posts table for successful daily generation
   - Check forecast API for proper diversity scores
   - Verify no empty slots in daily schedules

### Alert Thresholds
- **Pool Size**: Alert if drops below 500 items
- **Platform Diversity**: Alert if fewer than 3 platforms in daily schedule
- **Scheduling Failures**: Alert if daily schedule generation fails

## 5. Testing After Rollback

### Verification Checklist
- [ ] Pool size restored to ~1000 items
- [ ] All platforms visible in candidate selection
- [ ] Forecast API returns expected platform mix
- [ ] Daily schedule generation completes successfully
- [ ] No scheduling errors in logs

### Test Commands
```bash
# Test pool distribution
npm run test:pool-distribution

# Test scheduler candidates
npm run test:scheduler-candidates

# Test forecast API
curl "$APP_ORIGIN/api/admin/schedule/forecast?date=$(date +%F)" | jq '.summary'
```

## 6. Prevention of Future Issues

### Safe Deployment Practices
1. **Stage Changes**: Test in development environment first
2. **Gradual Rollout**: Deploy to subset of platforms initially
3. **Monitoring**: Watch metrics for 24h after deployment
4. **Quick Rollback**: Keep rollback scripts ready

### Emergency Contacts
- **Database Issues**: Run priority reset SQL immediately
- **Scheduler Issues**: Set DISABLE_PRIORITY_FILTERING=true
- **API Issues**: Revert to previous deployment

## 7. Rollback Success Criteria

### Database Rollback Success
- ✅ All items have ingest_priority >= 0
- ✅ Original platform distribution restored
- ✅ No content lost or corrupted

### Code Rollback Success  
- ✅ Scheduler selects from full content pool
- ✅ No quota enforcement errors
- ✅ Normal diversity scores in forecast

### System Health Verification
- ✅ Daily schedules generate successfully
- ✅ Content posting continues normally
- ✅ No error spikes in monitoring
